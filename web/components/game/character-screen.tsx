'use client'

// 내 정보 — 공용 GameWindow(검은 틀 + 아이보리 패널). 왼쪽 프로필 · 가운데 장비·스탯 · 오른쪽 장비 강화·잠재력.
// 마법(스킬) 관리는 2026-10-31 HUD 「마법」 창(components/game/magic-screen.tsx)으로 분리했다.

import { useGame } from '@/lib/game-state'
import { HeroSprite } from '@/components/game/pixel-hero'
import { POSITION_META } from '@/lib/constants'
import { gearOf, STAT_SHORT } from '@/lib/gear-enhance'
import { itemById } from '@/lib/mock-data'
import { getEffectiveStats } from '@/lib/derived'
import { expProgressPercent, expRequiredForLevel, MAX_LEVEL } from '@/lib/exp-table'
import type { EquipSlot, StatKey } from '@/lib/types'
import { Bar, GameWindow, HeadPill, menuIcon, Ribbon, Slot } from '@/components/game/game-window'
import { CostumeButton } from '@/components/game/wardrobe'
import { heroSheet, npcSheet } from '@/lib/costumes'

const STAT_LABELS: Record<StatKey, string> = {
  maxHp: '최대 HP',
  maxMp: '최대 MP',
  atk: '공격력',
  def: '방어력',
  matk: '마법공격력',
  mdef: '마법방어력',
  spd: '속도',
  luck: '행운',
}

const SLOT_LABELS: Record<EquipSlot, string> = { weapon: '무기', armor: '방어구', accessory: '장신구' }
const SLOT_ICON: Record<EquipSlot, string> = { weapon: 'cat-weapon', armor: 'cat-armor', accessory: 'cat-accessory' }

export function CharacterScreen() {
  const { state, dispatch } = useGame()
  if (state.screen !== 'character') return null
  const close = () => dispatch({ type: 'SET_SCREEN', screen: 'world' })

  const { player } = state
  const effStats = getEffectiveStats(player)
  const learnedCount = player.learnedSkills.length
  const heroPos = state.formation.positions.hero ?? 'front'

  return (
    <GameWindow
      title="내 정보"
      subtitle="CHARACTER"
      onClose={close}
      tall
      cols
      width={860}
      height={420}
      headerExtra={
        <HeadPill icon={menuIcon('icon-coin')}>
          <b>{player.gold.toLocaleString()}</b> G
        </HeadPill>
      }
    >
      <div className="gw-cols char-cols">
        {/* 프로필 */}
        <section className="gw-panel is-flex is-pad">
          <div className="char-stage">
            <HeroSprite sheet={heroSheet(state)} dir="down" px={110} />
          </div>
          <div className="mt-3 text-center">
            <div className="font-display text-[17px] font-bold text-[#2c2a33]">{player.name}</div>
            <div className="mt-1 flex flex-wrap justify-center gap-1.5">
              <span className="gw-pill is-gold">Lv.{player.level}</span>
              <span className="gw-pill is-soft">{POSITION_META[heroPos].label}</span>
              <span className="gw-pill is-soft">고정 속성 없음</span>
            </div>
            <div className="mt-2 flex justify-center">
              <CostumeButton owner="hero" name={player.name} />
            </div>
          </div>
          <div className="mt-3 space-y-2 text-[12.5px] text-[#6c6150]">
            <div>
              <div className="mb-1 flex justify-between">
                <span>HP</span>
                <b className="text-[#3b3843]">
                  {player.hp}/{effStats.maxHp}
                </b>
              </div>
              <Bar kind="hp" value={(player.hp / effStats.maxHp) * 100} />
            </div>
            <div>
              <div className="mb-1 flex justify-between">
                <span>MP</span>
                <b className="text-[#3b3843]">
                  {player.mp}/{effStats.maxMp}
                </b>
              </div>
              <Bar kind="mp" value={(player.mp / effStats.maxMp) * 100} />
            </div>
            <div>
              <div className="mb-1 flex justify-between">
                <span>EXP</span>
                <b className="text-[#3b3843]">{player.level >= MAX_LEVEL ? '최대 레벨' : `${expProgressPercent(player.level, player.exp)}%`}</b>
              </div>
              <Bar kind="exp" value={expProgressPercent(player.level, player.exp)} />
              {player.level < MAX_LEVEL && <div className="mt-1 text-right text-[11px]">다음 레벨까지 {(expRequiredForLevel(player.level) - player.exp).toLocaleString()} EXP</div>}
            </div>
          </div>
        </section>

        {/* 장비 + 스탯 */}
        <section className="gw-panel is-flex is-pad">
          <div className="gw-scroll is-fill pr-1">
            <Ribbon>장비</Ribbon>
            <div className="gw-box mb-4 flex justify-around gap-3">
              {(['weapon', 'armor', 'accessory'] as EquipSlot[]).map((slot) => {
                const itemId = player.equipped[slot]
                const item = itemId ? itemById(itemId) : null
                return (
                  <button
                    key={slot}
                    type="button"
                    className={item ? 'cursor-pointer' : 'cursor-default opacity-60'}
                    onClick={() => item && dispatch({ type: 'UNEQUIP_ITEM', slot })}
                    title={item ? `${item.name} — 눌러서 해제` : `${SLOT_LABELS[slot]} 없음 (가방에서 장착)`}
                  >
                    <Slot icon={item ? item.icon : menuIcon(SLOT_ICON[slot])} label={item ? `${item.name}${gearOf(player.gear, item.id).enh ? ` +${gearOf(player.gear, item.id).enh}` : ''}` : SLOT_LABELS[slot]} />
                  </button>
                )
              })}
            </div>

            <Ribbon>스탯</Ribbon>
            <div className="gw-box grid grid-cols-1 gap-x-6 sm:grid-cols-2">
              {(Object.keys(STAT_LABELS) as StatKey[]).map((key) => (
                <div key={key} className="char-stat">
                  <span>{STAT_LABELS[key]}</span>
                  <b>{effStats[key]}</b>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-[#8a7c62]">장비 칸을 누르면 해제됩니다. 장착은 가방에서 할 수 있어요.</p>
          </div>
        </section>

        {/* 장비 상세 — 강화 단계 · 잠재력(스킬은 2026-10-31 「마법」 창으로 분리) */}
        <aside className="gw-panel is-flex is-pad">
          <Ribbon>장비 강화 · 잠재력</Ribbon>
          <div className="gw-scroll is-fill flex flex-col gap-2 pr-1">
            {(['weapon', 'armor', 'accessory'] as EquipSlot[]).map((slot) => {
              const itemId = player.equipped[slot]
              const item = itemId ? itemById(itemId) : null
              const m = itemId ? gearOf(player.gear, itemId) : null
              return (
                <div key={slot} className="gw-box text-[12px]">
                  <div className="flex items-center justify-between font-semibold text-[#2c2a33]">
                    <span>{item ? item.name : `${SLOT_LABELS[slot]} 없음`}</span>
                    {m && m.enh > 0 && <span className="gear-enh-tag">+{m.enh}</span>}
                  </div>
                  {m && m.pot.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {m.pot.map((p, i) => (
                        <span key={i} className="gw-pill is-purple">
                          {STAT_SHORT[p.stat]} +{p.value}
                        </span>
                      ))}
                    </div>
                  ) : (
                    item && <div className="mt-1 text-[11px] text-[#8a7c62]">잠재력 없음 — 제작대에서 강화하면 열려요</div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" className="gw-btn is-sm flex-1" onClick={() => dispatch({ type: 'OPEN_CRAFT', npcId: 'npc-workbench' })}>
              장비 강화
            </button>
            <button type="button" className="gw-btn is-gold is-sm flex-1" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'magic' })}>
              마법 관리 ({learnedCount})
            </button>
          </div>
        </aside>
      </div>
    </GameWindow>
  )
}

