'use client'
// 천공 콜로세움에 있는 동안 15초마다 광장 신호(접속자·한마디·내 점수) — 화면에는 아무것도 그리지 않는다
import { useEffect } from 'react'
import { ARENA_MAP_ID, type ArenaIdentity } from '@/lib/arena-core'
import { pingArena } from '@/lib/arena-client'

export function ArenaPresence({ mapId, identity }: { mapId: string; identity?: ArenaIdentity }) {
  const here = mapId === ARENA_MAP_ID
  const pid = identity?.pid
  useEffect(() => {
    if (!here) return
    void pingArena(identity)
    const t = window.setInterval(() => {
      if (!document.hidden) void pingArena(identity)
    }, 15000)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [here, pid])
  return null
}
