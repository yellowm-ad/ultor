'use client'

import { useEffect, useState } from 'react'
import type { Element, Gender } from '@/lib/types'

// ============================================================================
// NPC / 주인공 초상화 — PixelLab 도트·사용자 일러스트만 사용.
// (예전 코드로 그린 절차적 SVG 초상 폴백은 NPC 도트·주인공 일러스트가 전부 갖춰져 제거 — 2026-09-28)
// ============================================================================

/** 사람이 아닌 오브젝트(작업대·가마·주방) — 전신 크롭 대신 아이콘 그대로 가운데 배치 */
const OBJECT_ICON_IDS = new Set(['npc-workbench', 'npc-alchemy-pot', 'npc-kitchen'])

/**
 * NPC 초상화. 우선순위: ① `public/images/npc/portrait-<id>.png`(대화창용 채색 일러스트 흉상 크롭)
 * → ② `public/images/npc/<id>.png`(도트 전신 스프라이트 상반신 크롭)
 * → ③ 오브젝트류는 마도구 작업대 아이콘. 전부 없으면 빈 패널.
 */
export function Portrait({ id, className }: { id: string; className?: string }) {
  const isObjectIcon = OBJECT_ICON_IDS.has(id)
  const candidates = [`/images/npc/portrait-${id}.png`, `/images/npc/${id}.png`, ...(isObjectIcon ? ['/images/npc/npc-workbench.png'] : [])]
  const [idx, setIdx] = useState(0)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    setIdx(0)
    setReady(false)
    setFailed(false)
  }, [id])
  const src = candidates[idx]
  const isIllustration = idx === 0
  return (
    <span
      className={className}
      style={{ display: 'inline-block', position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg, #2c2838, #17141f)' }}
    >
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          onLoad={(e) => setReady((e.target as HTMLImageElement).naturalWidth > 0)}
          onError={() => {
            if (idx < candidates.length - 1) setIdx(idx + 1)
            else setFailed(true)
          }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: isObjectIcon ? 'contain' : 'cover',
            objectPosition: isObjectIcon ? '50% 50%' : isIllustration ? '50% 15%' : '50% 6%',
            padding: isObjectIcon ? '12%' : 0,
            imageRendering: isIllustration ? 'auto' : 'pixelated',
            visibility: ready ? 'visible' : 'hidden',
          }}
        />
      )}
    </span>
  )
}

/** 주인공 초상화 — public/images/portraits/hero-<element>-<gender>.png (6종) */
export function HeroPortrait({ element, gender, className }: { element: Element; gender: Gender; className?: string }) {
  return (
    <span className={className} style={{ display: 'inline-block', overflow: 'hidden', position: 'relative' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/images/portraits/hero-${element}-${gender}.png`}
        alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 14%' }}
      />
    </span>
  )
}
