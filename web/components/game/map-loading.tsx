'use client'

// 맵 이동 로딩 화면(2026-11-05) — 포탈·텔레포트로 맵이 바뀌면 화면을 덮고, 그 맵의 그림(소품·건물·벽 무늬)만 미리 받아 둔 뒤 걷어낸다.
//   · 그림은 원래도 지금 맵 것만 불러온다. 이 화면은 '받는 동안 빈 화면·튀어나오는 그림'을 가리는 역할.
//   · 한 번 받은 그림은 브라우저가 기억하므로 다시 가는 맵은 금방 지나간다(최소 0.35초 · 최대 4초).

import { useEffect, useState } from 'react'
import { useGame } from '@/lib/game-state'
import { MAPS } from '@/lib/maps'
import { regionById, regionOfMap } from '@/lib/regions'
import { REGION_COLOR } from '@/lib/map-graph'
import type { GameMap } from '@/lib/types'

const MIN_MS = 350
const MAX_MS = 4000
const done = new Set<string>()

/** 맵에 쓰인 그림 경로를 전부 모은다(소품 · 구조물 면 · 벽 무늬) */
function imagesOf(map: GameMap): string[] {
  const out = new Set<string>()
  const walk = (v: unknown, depth: number) => {
    if (depth > 6 || v == null) return
    if (typeof v === 'string') {
      if (v.startsWith('/images/') && /\.(png|svg|webp|jpg)(\?|$)/.test(v)) out.add(v)
      return
    }
    if (Array.isArray(v)) {
      for (const x of v) walk(x, depth + 1)
      return
    }
    if (typeof v === 'object') for (const x of Object.values(v as Record<string, unknown>)) walk(x, depth + 1)
  }
  walk(map.props, 0)
  walk(map.structures, 0)
  return [...out]
}

function preload(src: string): Promise<void> {
  if (done.has(src)) return Promise.resolve()
  return new Promise((res) => {
    const img = new Image()
    img.onload = img.onerror = () => {
      done.add(src)
      res()
    }
    img.src = src
  })
}

export function MapLoadingOverlay() {
  const { state } = useGame()
  const mapId = state.screen === 'title' || state.screen === 'create' ? null : state.currentMapId
  const [show, setShow] = useState<{ id: string; total: number; loaded: number; fading: boolean } | null>(null)
  useEffect(() => {
    // 맵이 바뀔 때마다(개발 모드에서 두 번 실행돼도 다시 시작할 뿐 — 예전엔 두 번째 실행을 건너뛰어 화면이 안 걷혔다)
    if (!mapId) return
    const map = MAPS[mapId]
    if (!map) return
    const srcs = imagesOf(map).filter((s) => !done.has(s))
    let alive = true
    const t0 = performance.now()
    setShow({ id: mapId, total: srcs.length, loaded: 0, fading: false })
    let n = 0
    const all = Promise.all(srcs.map((s) => preload(s).then(() => alive && setShow((v) => (v && v.id === mapId ? { ...v, loaded: ++n } : v)))))
    const timeout = new Promise((r) => setTimeout(r, MAX_MS))
    Promise.race([all, timeout]).then(() => {
      const wait = Math.max(0, MIN_MS - (performance.now() - t0))
      setTimeout(() => {
        if (!alive) return
        setShow((v) => (v && v.id === mapId ? { ...v, fading: true } : v))
        setTimeout(() => alive && setShow((v) => (v && v.id === mapId ? null : v)), 260)
      }, wait)
    })
    return () => {
      alive = false
    }
  }, [mapId])

  if (!show) return null
  const map = MAPS[show.id as keyof typeof MAPS]
  const region = regionOfMap(show.id as keyof typeof MAPS)
  const color = REGION_COLOR[region]
  const pct = show.total ? Math.round((show.loaded / show.total) * 100) : 100
  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-4 bg-[#0b0806]"
      style={{ opacity: show.fading ? 0 : 1, transition: 'opacity 0.25s ease-out', pointerEvents: show.fading ? 'none' : 'auto' }}
      aria-live="polite"
    >
      <div className="text-[11px] tracking-[0.3em]" style={{ color }}>{regionById(region).name}</div>
      <div className="font-display text-[26px] text-[#f3e6c4]" style={{ textShadow: '0 2px 0 #000' }}>{map?.name}</div>
      <div className="h-[10px] w-[min(320px,70vw)] border-2 border-[#c79a3e]/80 bg-black p-[1px]" style={{ imageRendering: 'pixelated' }}>
        <div className="h-full" style={{ width: `${pct}%`, background: color, transition: 'width 0.15s linear' }} />
      </div>
      <div className="text-[10px] text-white/45">이동 중…</div>
    </div>
  )
}
