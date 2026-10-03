'use client'

// 상점 — 공용 GameWindow. 왼쪽 상인(초상 + 인사) · 가운데 상품 목록 · 오른쪽 상세(수량 · 구매).

import Image from 'next/image'
import { useState } from 'react'
import { useGame } from '@/lib/game-state'
import { npcById, itemById } from '@/lib/mock-data'
import { Portrait } from '@/components/game/portrait'
import { Divider, GameWindow, HeadPill, menuIcon, Sparkle } from '@/components/game/game-window'

export function ShopScreen() {
  const { state, dispatch } = useGame()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const npc = state.activeShopId ? npcById(state.activeShopId) : null
  if (!npc || !npc.shopItemIds || state.screen !== 'shop') return null

  const close = () => dispatch({ type: 'CLOSE_OVERLAY' })
  const goods = npc.shopItemIds.flatMap((id) => {
    const item = itemById(id)
    return item ? [item] : []
  })
  const item = goods.find((g) => g.id === selectedId) ?? goods[0] ?? null
  const owned = item ? state.inventory.find((s) => s.itemId === item.id)?.qty ?? 0 : 0
  const affordable = item && item.price > 0 ? Math.floor(state.player.gold / item.price) : 0
  const amount = Math.max(1, Math.min(qty, Math.max(1, affordable)))
  const total = item ? item.price * amount : 0
  const buy = () => {
    if (!item || affordable < amount) return
    for (let i = 0; i < amount; i++) dispatch({ type: 'BUY_ITEM', itemId: item.id })
    setQty(1)
  }

  return (
    <GameWindow
      title="상점"
      subtitle="SHOP"
      onClose={close}
      tall
      cols
      width={840}
      height={480}
      headerExtra={
        <HeadPill icon={menuIcon('icon-coin')}>
          <b>{state.player.gold.toLocaleString()}</b> G
        </HeadPill>
      }
    >
      <div className="gw-cols shop-cols">
        {/* 상인 */}
        <section className="gw-panel is-flex is-pad">
          <div className="char-stage !h-[150px]">
            <Portrait id={npc.id} className="h-full w-full" />
          </div>
          <div className="mt-3 text-center font-display text-[15px] font-bold text-[#2c2a33]">{npc.name}</div>
          <div className="gw-box mt-2 text-[13px] leading-relaxed text-[#4d4856]">{npc.greeting[0]}</div>
        </section>

        {/* 상품 */}
        <section className="gw-panel is-flex p-3">
          <div className="mb-2.5 flex items-center justify-between text-[12px] text-[#8a7c62]">
            <span className="font-display text-[14px] font-bold text-[#3b3843]">판매 상품</span>
            <span>{goods.length}종</span>
          </div>
          <div className="gw-scroll is-fill flex flex-col gap-2 pr-1">
            {goods.map((g) => {
              const have = state.inventory.find((s) => s.itemId === g.id)?.qty ?? 0
              return (
                <button
                  key={g.id}
                  type="button"
                  className={`gw-row ${item?.id === g.id ? 'is-active' : ''}`}
                  onClick={() => {
                    setSelectedId(g.id)
                    setQty(1)
                  }}
                >
                  <span className="gw-row-icon is-tile">
                    <Image src={g.icon} alt="" width={38} height={38} unoptimized />
                  </span>
                  <span className="gw-row-main">
                    <span className="gw-row-title">{g.name}</span>
                    <span className="gw-row-desc">{g.description}</span>
                    {have > 0 && <span className="gw-row-meta">보유 {have}개</span>}
                  </span>
                  <span className={`gw-row-side ${state.player.gold < g.price ? 'opacity-50' : ''}`}>
                    <Image src={menuIcon('icon-coin')} alt="" width={20} height={20} unoptimized />
                    {g.price.toLocaleString()}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* 상세 */}
        <aside className="gw-panel is-flex is-pad">
          {item ? (
            <>
              <div className="gw-scroll is-fill">
                <div className="flex flex-col items-center text-center">
                  <div className="craft-medal">
                    <Image src={item.icon} alt={item.name} width={64} height={64} unoptimized />
                  </div>
                  <h3 className="mt-3 font-display text-[16px] font-bold text-[#2c2a33]">{item.name}</h3>
                  <div className="mt-1.5 flex flex-wrap justify-center gap-1.5">
                    <span className="gw-pill is-soft">보유 {owned}개</span>
                    <span className="gw-pill is-soft">판매가 {item.sellPrice}G</span>
                  </div>
                </div>
                <Divider />
                <p className="text-[13.5px] leading-relaxed text-[#4d4856]">{item.description}</p>
              </div>

              <div className="pt-3">
                <div className="mb-3 flex items-center justify-center gap-2">
                  <span className="mr-1 text-[13px] text-[#6c6150]">구매 수량</span>
                  <button type="button" className="craft-step" onClick={() => setQty(Math.max(1, amount - 1))} disabled={amount <= 1} aria-label="하나 줄이기">
                    −
                  </button>
                  <span className="craft-qty">{amount}</span>
                  <button type="button" className="craft-step" onClick={() => setQty(Math.min(Math.max(1, affordable), amount + 1))} disabled={amount >= affordable} aria-label="하나 늘리기">
                    +
                  </button>
                </div>
                <button type="button" className="gw-btn is-gold is-lg w-full" disabled={affordable < amount} onClick={buy}>
                  {affordable < 1 ? '골드가 부족합니다' : `${total.toLocaleString()}G 구매하기`}
                </button>
              </div>
            </>
          ) : (
            <div className="gw-empty">
              <Sparkle />
              상품을 선택하세요
            </div>
          )}
        </aside>
      </div>
    </GameWindow>
  )
}
