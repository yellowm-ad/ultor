'use client'

// 햇살 농가 밭 — 빈 칸에서 E 를 누르면 뜨는 씨앗 고르기 창(lib/farming). 가진 씨앗만 보인다.

import Image from 'next/image'
import { useGame } from '@/lib/game-state'
import { CROPS, plotById } from '@/lib/farming'
import { itemById } from '@/lib/mock-data'
import { GameWindow, Ribbon } from '@/components/game/game-window'

export function FarmSeedPicker() {
  const { state, dispatch } = useGame()
  const plotId = state.farmPick
  if (!plotId || !plotById(plotId) || state.screen !== 'world') return null
  const close = () => dispatch({ type: 'FARM_CANCEL' })
  const owned = CROPS.map((c) => ({ c, qty: state.inventory.filter((s) => s.itemId === c.seedId).reduce((a, s) => a + s.qty, 0) })).filter((e) => e.qty > 0)

  return (
    <GameWindow title="씨앗 심기" subtitle="FARM" size="md" width={520} onClose={close}>
      <section className="gw-panel is-pad">
        <Ribbon>무엇을 심을까</Ribbon>
        <p className="rep-note">심은 뒤 물을 주면 그때부터 두 배로 자랍니다. 베리·사탕수수·나무는 거둔 뒤 다시 열립니다.</p>
        <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto pr-1 scrollbar-thin">
          {owned.map(({ c, qty }) => {
            const item = itemById(c.seedId)
            return (
              <button key={c.id} type="button" className="rep-req text-left" onClick={() => dispatch({ type: 'FARM_PLANT', plotId, seedId: c.seedId })}>
                <span className="gw-row-icon is-tile">{item?.icon && <Image src={item.icon} alt="" width={38} height={38} unoptimized style={{ imageRendering: 'pixelated' }} />}</span>
                <span className="min-w-0 flex-1">
                  <span className="rep-req-who">{c.seedName} ×{qty}</span>
                  <span className="rep-req-text block">
                    {c.name} · {c.growMin}분{c.regrow ? ' · 다시 자람' : ''} — {c.yields.map((y) => itemById(y.itemId)?.name ?? y.itemId).join(', ')}
                  </span>
                </span>
                <span className="gw-pill is-gold">심기</span>
              </button>
            )
          })}
        </div>
      </section>
    </GameWindow>
  )
}
