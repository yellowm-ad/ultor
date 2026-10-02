'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useGame } from '@/lib/game-state'
import { itemById } from '@/lib/mock-data'
import { schoolNpcById } from '@/lib/companions'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { DiamondMark, rarityGlowStyle } from '@/components/game/ui-motifs'
import type { ItemType } from '@/lib/types'

const TABS: { id: ItemType | 'all'; label: string; icon?: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'weapon', label: '무기', icon: '/images/icons/items/weapon.png' },
  { id: 'armor', label: '방어구', icon: '/images/icons/items/armor.png' },
  { id: 'accessory', label: '장신구', icon: '/images/icons/items/accessory.png' },
  { id: 'potion', label: '물약', icon: '/images/icons/items/potion.png' },
  { id: 'tool', label: '도구', icon: '/images/icons/items/tool.png' },
  { id: 'feed', label: '먹이', icon: '/images/icons/items/feed.png' },
  { id: 'material', label: '재료', icon: '/images/icons/items/material.png' },
  // 생활 콘텐츠 — 요리/어획물/가구·코스튬(가구 탭에 함께)
  { id: 'food', label: '요리' },
  { id: 'fish', label: '물고기' },
  { id: 'furniture', label: '가구·의상' },
]

/** 탭 하나에 여러 타입을 묶어 보여줄 때 */
const TAB_ALSO: Partial<Record<ItemType, ItemType[]>> = { furniture: ['costume'] }

export function InventoryScreen() {
  const { state, dispatch } = useGame()
  const [tab, setTab] = useState<ItemType | 'all'>('all')
  const [selected, setSelected] = useState<string | null>(null)

  if (state.screen !== 'inventory') return null
  const close = () => dispatch({ type: 'SET_SCREEN', screen: 'world' })

  const slots = state.inventory.filter((s) => {
    const item = itemById(s.itemId)
    if (!item) return false
    return tab === 'all' || item.type === tab || !!TAB_ALSO[tab]?.includes(item.type)
  })

  // 생활 재료가 늘어 24칸을 넘을 수 있으니 한 줄(6칸) 단위로 늘린다
  const GRID_SIZE = Math.max(24, Math.ceil(slots.length / 6) * 6)
  const cells = Array.from({ length: GRID_SIZE }, (_, i) => slots[i] ?? null)
  const selectedItem = selected ? itemById(selected) : null
  const selectedSlot = selected ? state.inventory.find((s) => s.itemId === selected) : null

  return (
    <Modal open onClose={close} title="가방" widthClass="max-w-3xl">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <DiamondMark size={11} className="text-gold" />
          <span>보유 아이템 {state.inventory.length}종</span>
        </div>
        <span className="text-sm font-semibold text-gold-soft">{state.player.gold.toLocaleString()} G</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <nav className="nav-tab-list shrink-0 sm:w-28">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`nav-tab ${tab === t.id ? 'nav-tab-active' : ''}`}>
              {t.icon ? (
                <Image src={t.icon} alt="" width={16} height={16} className="rounded-full" />
              ) : (
                <DiamondMark size={10} />
              )}
              {t.label}
            </button>
          ))}
        </nav>

        <div className="panel-parchment grid grid-cols-5 gap-2 p-3 sm:w-2/3">
          {cells.map((slot, i) => {
            const item = slot ? itemById(slot.itemId) : null
            return (
              <button
                key={i}
                disabled={!item}
                onClick={() => item && setSelected(item.id)}
                style={{
                  ['--gem-bg' as string]: item ? undefined : 'rgba(0,0,0,0.25)',
                  borderColor: !item ? 'var(--border)' : selected === item.id ? 'var(--gold-soft)' : undefined,
                  boxShadow: !item ? 'none' : undefined,
                  ...(item ? rarityGlowStyle(item.type) : {}),
                }}
                className={`gem-btn rarity-glow relative flex aspect-square items-center justify-center p-1 ${!item ? 'opacity-35 grayscale' : ''}`}
              >
                {item && (
                  <>
                    <Image src={item.icon} alt={item.name} width={40} height={40} />
                    {slot && slot.qty > 1 && (
                      <span className="absolute bottom-1 right-1 rounded-full bg-black/60 px-1.5 text-[11px] font-bold text-gold-soft">
                        {slot.qty}
                      </span>
                    )}
                  </>
                )}
              </button>
            )
          })}
        </div>

        <div className="panel-parchment flex-1 p-3 text-sm">
          {selectedItem ? (
            <div className="flex h-full flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="flex size-10 items-center justify-center rounded-md bg-white/40">
                  <Image src={selectedItem.icon} alt={selectedItem.name} width={24} height={24} />
                </div>
                <div>
                  <div className="font-semibold">{selectedItem.name}</div>
                  <div className="text-[11px] opacity-60">보유 {selectedSlot?.qty ?? 0}개</div>
                </div>
              </div>
              <p className="text-xs leading-relaxed opacity-80">{selectedItem.description}</p>
              <div className="mt-auto flex flex-wrap gap-1.5">
                {(selectedItem.type === 'weapon' || selectedItem.type === 'armor' || selectedItem.type === 'accessory') && (
                  <Button
                    size="sm"
                    onClick={() =>
                      dispatch({
                        type: 'EQUIP_ITEM',
                        itemId: selectedItem.id,
                        slot: selectedItem.type as 'weapon' | 'armor' | 'accessory',
                      })
                    }
                  >
                    장착
                  </Button>
                )}
                {selectedItem.type === 'potion' && !selectedItem.useEffect?.grantExp && (
                  <Button size="sm" onClick={() => dispatch({ type: 'USE_ITEM_FIELD', itemId: selectedItem.id })}>
                    사용
                  </Button>
                )}
                {/* 마력캔디 — 먹일 캐릭터 선택(주인공 + 합류한 동료) */}
                {!!selectedItem.useEffect?.grantExp && (
                  <div className="flex w-full flex-wrap gap-1">
                    <span className="w-full text-[10px] opacity-70">누구에게 먹일까?</span>
                    <Button size="sm" onClick={() => dispatch({ type: 'USE_EXP_CANDY', itemId: selectedItem.id, targetId: 'hero' })}>
                      {state.player.name || '주인공'} Lv.{state.player.level}
                    </Button>
                    {Object.entries(state.companions.recruited).map(([id, prog]) => (
                      <Button key={id} size="sm" variant="parchment" onClick={() => dispatch({ type: 'USE_EXP_CANDY', itemId: selectedItem.id, targetId: id })}>
                        {schoolNpcById(id)?.name ?? id} Lv.{prog.level}
                      </Button>
                    ))}
                  </div>
                )}
                {selectedItem.type === 'food' && (
                  <Button size="sm" onClick={() => dispatch({ type: 'USE_ITEM_FIELD', itemId: selectedItem.id })}>
                    먹기
                  </Button>
                )}
                {selectedItem.type === 'feed' && (
                  <Button size="sm" onClick={() => dispatch({ type: 'USE_ITEM_FIELD', itemId: selectedItem.id })}>
                    먹이 주기
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="border-[#8a6a2c] text-[var(--parchment-foreground)] hover:bg-black/10"
                  onClick={() => dispatch({ type: 'SELL_ITEM', itemId: selectedItem.id })}
                >
                  판매 ({selectedItem.sellPrice}G)
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-xs opacity-50">아이템을 선택하세요</div>
          )}
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <Button variant="ghost" onClick={close}>
          닫기
        </Button>
      </div>
    </Modal>
  )
}
