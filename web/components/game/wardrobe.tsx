'use client'

// 코스튬 옷장(lib/costumes) — 주인공·동료마다 '옷 한 벌 = 스킨 한 장'을 골라 입는다(2026-11-02)
//   CostumeButton: 작은 '옷장' 버튼 → 누르면 그 캐릭터의 옷장 창이 뜬다
import { useState } from 'react'
import { useGame } from '@/lib/game-state'
import { HeroSprite } from '@/components/game/pixel-hero'
import { costumesOf, ownsCostume, wornCostume, type CostumeOwner } from '@/lib/costumes'
import type { Gender } from '@/lib/types'

function sheetOf(sheet: string | Record<Gender, string>, gender: Gender) {
  return typeof sheet === 'string' ? sheet : sheet[gender]
}

export function Wardrobe({ owner, name, onClose }: { owner: CostumeOwner; name: string; onClose: () => void }) {
  const { state, dispatch } = useGame()
  const worn = wornCostume(state, owner)
  const list = costumesOf(owner)
  const gender = state.player.appearance.gender
  return (
    <div className="wd-backdrop" onClick={onClose}>
      <div className="wd-panel gw-window" onClick={(e) => e.stopPropagation()}>
        <div className="wd-head">
          <b>{name}의 옷장</b>
          <button type="button" className="gw-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <div className="wd-grid">
          {list.map((c) => {
            const own = ownsCostume(state, c.id)
            const on = worn?.id === c.id
            return (
              <button
                key={c.id}
                type="button"
                className={`wd-item ${on ? 'is-on' : ''} ${own ? '' : 'is-locked'}`}
                disabled={!own || on}
                title={own ? c.description : '아직 얻지 못한 코스튬'}
                onClick={() => dispatch({ type: 'COSTUME_WEAR', owner, costumeId: c.id })}
              >
                <span className="wd-fig">
                  <HeroSprite sheet={sheetOf(c.sheet, gender)} dir="down" px={64} />
                </span>
                <span className="wd-name">{c.name}</span>
                <span className="wd-sub">{on ? '입는 중' : own ? '입기' : '미획득'}</span>
              </button>
            )
          })}
        </div>
        {list.length <= 1 && <p className="wd-note">새 코스튬은 앞으로 이벤트·상점·스토리 보상으로 얻을 수 있어요. 얻으면 여기서 통째로 갈아입습니다.</p>}
      </div>
    </div>
  )
}

export function CostumeButton({ owner, name, className = '' }: { owner: CostumeOwner; name: string; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={`gw-btn is-quiet is-sm ${className}`} onClick={() => setOpen(true)}>
        옷장
      </button>
      {open && <Wardrobe owner={owner} name={name} onClose={() => setOpen(false)} />}
    </>
  )
}
