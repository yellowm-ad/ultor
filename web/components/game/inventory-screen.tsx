'use client'

// 가방 — 「인벤토리 UI 개선안.png」 참고 (2026-10-03)
// 검은 머리띠·사이드바(공용 GameWindow) + 아이보리 슬롯 격자 + 오른쪽 상세 패널. 카테고리는 아이콘 + 이름 3열 격자로 세로 길이를 줄였다.
// 문장·카테고리 아이콘은 PixelLab 로 HUD 아이콘과 같은 화풍으로 생성(scripts/_pixellab/gen-ui-icons.mjs).

import Image from 'next/image'
import { useState } from 'react'
import { useGame } from '@/lib/game-state'
import { itemById } from '@/lib/mock-data'
import { schoolNpcById } from '@/lib/companions'
import { SlotSparkle } from '@/components/game/inventory-icons'
import { Divider, GameWindow, menuIcon } from '@/components/game/game-window'
import type { ItemDef, ItemRarity, ItemType, StatKey } from '@/lib/types'

type TabId = ItemType | 'all'

const TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'weapon', label: '무기' },
  { id: 'armor', label: '방어구' },
  { id: 'accessory', label: '장신구' },
  { id: 'potion', label: '물약' },
  { id: 'tool', label: '도구' },
  { id: 'feed', label: '먹이' },
  { id: 'material', label: '재료' },
  // 생활 콘텐츠 — 요리/어획물/가구·코스튬(가구 탭에 함께)
  { id: 'food', label: '요리' },
  { id: 'fish', label: '물고기' },
  { id: 'furniture', label: '가구·의상' },
]

/** 탭 하나에 여러 타입을 묶어 보여줄 때 */
const TAB_ALSO: Partial<Record<ItemType, ItemType[]>> = { furniture: ['costume'] }

const TYPE_LABEL: Record<ItemType, string> = {
  weapon: '무기',
  armor: '방어구',
  accessory: '장신구',
  potion: '물약',
  tool: '도구',
  feed: '펫 먹이',
  material: '재료',
  food: '요리',
  fish: '물고기',
  furniture: '가구',
  costume: '의상',
}

const RARITY_LABEL: Record<ItemRarity, string> = { common: '일반', uncommon: '고급', rare: '희귀', mythic: '신화', unique: '고유' }

const STAT_LABEL: Record<StatKey, string> = {
  maxHp: '최대 HP',
  maxMp: '최대 MP',
  atk: '공격력',
  def: '방어력',
  matk: '마법공격력',
  mdef: '마법방어력',
  spd: '속도',
  luck: '행운',
}

type SortId = 'default' | 'name' | 'qty' | 'price'
const SORTS: { id: SortId; label: string }[] = [
  { id: 'default', label: '기본 정렬' },
  { id: 'name', label: '이름순' },
  { id: 'qty', label: '수량순' },
  { id: 'price', label: '판매가순' },
]

const COLS = 6

const inTab = (item: ItemDef, tab: TabId) => tab === 'all' || item.type === tab || !!TAB_ALSO[tab]?.includes(item.type)

/** 상세 패널의 수치 줄(회복량·스탯 보너스·요구 레벨 등) */
function detailLines(item: ItemDef): [string, string][] {
  const out: [string, string][] = []
  const u = item.useEffect
  if (u?.healHp) out.push(['HP 회복', `${u.healHp}`])
  if (u?.healMp) out.push(['MP 회복', `${u.healMp}`])
  if (u?.reviveOnly) out.push(['효과', '전투불능 부활'])
  if (u?.cureStatus) out.push(['효과', '상태이상 해제'])
  if (u?.escapeBattle) out.push(['효과', '전투 이탈'])
  if (u?.petAffection) out.push(['펫 호감도', `+${u.petAffection}`])
  if (u?.grantExp) out.push(['경험치', `+${u.grantExp}`])
  for (const [k, v] of Object.entries(item.statBonus ?? {}) as [StatKey, number][]) {
    if (v) out.push([STAT_LABEL[k], `${v > 0 ? '+' : ''}${v}`])
  }
  if (item.statusResist) out.push(['상태이상 저항', `${item.statusResist}%`])
  if (item.mealBuff) out.push(['식사 효과', `${item.mealBuff.battles}전투 지속`])
  if (item.requiredLevel) out.push(['요구 레벨', `Lv.${item.requiredLevel}`])
  return out
}

export function InventoryScreen() {
  const { state, dispatch } = useGame()
  const [tab, setTab] = useState<TabId>('all')
  const [sort, setSort] = useState<SortId>('default')
  const [selected, setSelected] = useState<string | null>(null)

  if (state.screen !== 'inventory') return null
  const close = () => dispatch({ type: 'SET_SCREEN', screen: 'world' })

  const owned = state.inventory.flatMap((s) => {
    const item = itemById(s.itemId)
    return item ? [{ slot: s, item }] : []
  })
  const countOf = (t: TabId) => owned.filter((o) => inTab(o.item, t)).length

  const rows = owned.filter((o) => inTab(o.item, tab))
  if (sort === 'name') rows.sort((a, b) => a.item.name.localeCompare(b.item.name, 'ko'))
  if (sort === 'qty') rows.sort((a, b) => b.slot.qty - a.slot.qty)
  if (sort === 'price') rows.sort((a, b) => b.item.sellPrice - a.item.sellPrice)

  // 기본 4줄(24칸), 넘치면 한 줄(6칸)씩 늘린다
  const gridSize = Math.max(COLS * 4, Math.ceil(rows.length / COLS) * COLS)
  const cells = Array.from({ length: gridSize }, (_, i) => rows[i] ?? null)
  // 다 팔거나 써서 없어진 아이템은 상세에서 내린다
  const selectedSlot = selected ? state.inventory.find((s) => s.itemId === selected) : null
  const selectedItem = selectedSlot ? itemById(selectedSlot.itemId) : null
  const isEquip = selectedItem && (selectedItem.type === 'weapon' || selectedItem.type === 'armor' || selectedItem.type === 'accessory')

  return (
    <GameWindow title="가방" subtitle="INVENTORY" onClose={close} tall cols width={860} height={450}>
        <div className="inv-body">
          {/* 카테고리 — 아이콘 + 이름 3열 격자 */}
          <nav className="inv-cats" aria-label="카테고리">
            {TABS.map((t) => {
              const n = countOf(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTab(t.id)
                    // 고른 아이템이 새 카테고리에 없으면 상세를 비운다
                    const cur = selected ? itemById(selected) : null
                    if (cur && !inTab(cur, t.id)) setSelected(null)
                  }}
                  className={`inv-cat ${tab === t.id ? 'is-active' : ''} ${n === 0 && t.id !== 'all' ? 'is-empty' : ''}`}
                  aria-pressed={tab === t.id}
                >
                  <Image src={`/images/icons/menu/cat-${t.id}.png`} alt="" width={64} height={64} className="inv-cat-icon" unoptimized />
                  <span className="inv-cat-label">{t.label}</span>
                  {n > 0 && <span className="inv-cat-count">{n}</span>}
                </button>
              )
            })}
          </nav>

          {/* 슬롯 격자 */}
          <section className="inv-grid-panel">
            <div className="inv-toolbar">
              <label className="inv-sort">
                <select value={sort} onChange={(e) => setSort(e.target.value as SortId)} aria-label="정렬">
                  {SORTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
                  <path d="M6 9l6 6 6-6z" fill="currentColor" />
                </svg>
              </label>
              <div className="inv-stats">
                <span>
                  보유 아이템 <b>{owned.length}</b>종
                </span>
                <span className="inv-gold">
                  <Image src={menuIcon('icon-coin')} alt="" width={22} height={22} unoptimized className="[image-rendering:pixelated]" />
                  <b>{state.player.gold.toLocaleString()}</b> G
                </span>
              </div>
            </div>

            <div className="inv-grid">
              {cells.map((cell, i) =>
                cell ? (
                  <button
                    key={cell.item.id}
                    type="button"
                    onClick={() => setSelected(cell.item.id)}
                    className={`inv-slot ${selected === cell.item.id ? 'is-selected' : ''}`}
                    title={cell.item.name}
                  >
                    <Image src={cell.item.icon} alt={cell.item.name} width={44} height={44} className="inv-slot-icon" />
                    {cell.slot.qty > 1 && <span className="inv-qty">{cell.slot.qty}</span>}
                  </button>
                ) : (
                  <div key={`empty-${i}`} className="inv-slot is-empty" aria-hidden>
                    <SlotSparkle className="inv-slot-spark" />
                  </div>
                ),
              )}
            </div>

            <p className="inv-hint">
              {rows.length === 0 ? '이 카테고리에는 아이템이 없습니다.' : '아이템을 누르면 오른쪽에 자세한 정보가 표시됩니다.'}
            </p>
          </section>

          {/* 상세 */}
          <aside className="inv-detail">
            {selectedItem ? (
              <>
                <div className="inv-detail-top">
                  <div className="inv-detail-frame">
                    <Image src={selectedItem.icon} alt={selectedItem.name} width={64} height={64} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="inv-detail-name">{selectedItem.name}</h3>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="gw-pill">{selectedItem.rarity ? `${RARITY_LABEL[selectedItem.rarity]} ${TYPE_LABEL[selectedItem.type]}` : TYPE_LABEL[selectedItem.type]}</span>
                      <span className="gw-pill is-soft">보유 {selectedSlot?.qty ?? 0}개</span>
                    </div>
                  </div>
                </div>

                {detailLines(selectedItem).length > 0 && (
                  <dl className="inv-detail-lines">
                    {detailLines(selectedItem).map(([k, v], i) => (
                      <div key={`${k}-${i}`}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                <Divider />

                <p className="inv-detail-desc">{selectedItem.description}</p>

                <div className="inv-actions">
                  {/* 마력캔디 — 먹일 캐릭터 선택(주인공 + 합류한 동료) */}
                  {!!selectedItem.useEffect?.grantExp && (
                    <div className="inv-candy">
                      <span>누구에게 먹일까?</span>
                      <div>
                        <button type="button" className="gw-btn" onClick={() => dispatch({ type: 'USE_EXP_CANDY', itemId: selectedItem.id, targetId: 'hero' })}>
                          {state.player.name || '주인공'} Lv.{state.player.level}
                        </button>
                        {Object.entries(state.companions.recruited).map(([id, prog]) => (
                          <button key={id} type="button" className="gw-btn" onClick={() => dispatch({ type: 'USE_EXP_CANDY', itemId: selectedItem.id, targetId: id })}>
                            {schoolNpcById(id)?.name ?? id} Lv.{prog.level}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="inv-actions-row">
                    {isEquip && (
                      <button
                        type="button"
                        className="gw-btn is-gold"
                        onClick={() => dispatch({ type: 'EQUIP_ITEM', itemId: selectedItem.id, slot: selectedItem.type as 'weapon' | 'armor' | 'accessory' })}
                      >
                        장착
                      </button>
                    )}
                    {selectedItem.type === 'potion' && !selectedItem.useEffect?.grantExp && (
                      <button type="button" className="gw-btn is-gold" onClick={() => dispatch({ type: 'USE_ITEM_FIELD', itemId: selectedItem.id })}>
                        사용
                      </button>
                    )}
                    {selectedItem.type === 'food' && (
                      <button type="button" className="gw-btn is-gold" onClick={() => dispatch({ type: 'USE_ITEM_FIELD', itemId: selectedItem.id })}>
                        먹기
                      </button>
                    )}
                    {selectedItem.type === 'feed' && (
                      <button type="button" className="gw-btn is-gold" onClick={() => dispatch({ type: 'USE_ITEM_FIELD', itemId: selectedItem.id })}>
                        먹이 주기
                      </button>
                    )}
                    <button type="button" className="gw-btn" onClick={() => dispatch({ type: 'SELL_ITEM', itemId: selectedItem.id })}>
                      판매 <small>{selectedItem.sellPrice}G</small>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="inv-detail-empty">
                <SlotSparkle className="size-7" />
                <span>아이템을 선택하세요</span>
              </div>
            )}
          </aside>
        </div>
    </GameWindow>
  )
}
