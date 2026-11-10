'use client'

// 효과음 다리(2026-11-10) — 게임 상태 변화를 보고 lib/sfx 를 울린다(엔진·리듀서는 건드리지 않는다).
//   · 음량 = 설정 「효과음 음량」 · 첫 입력 때 소리 풀기
//   · 버튼 누름(짧은 틱 — data-sfx="none" 이면 생략) · 창 열기/닫기 · 몬스터 접촉 · 맵 이동 · 레벨업 · 아이템/골드 획득
//   · 전투 안의 타격·마법·처치 소리는 battle-screen / damage-pops, 대사 글자 소리는 dialogue-box 가 낸다.
import { useEffect, useRef } from 'react'
import { useGame } from '@/lib/game-state'
import { setSfxVolume, sfx, unlockSfx } from '@/lib/sfx'

export function SfxBridge() {
  const { state } = useGame()
  const vol = Math.max(0, Math.min(100, state.settings.sfxVolume ?? 80)) / 100

  useEffect(() => setSfxVolume(vol), [vol])

  // 첫 입력 때 소리 풀기 + 버튼 틱
  useEffect(() => {
    const down = (e: PointerEvent) => {
      unlockSfx()
      const b = (e.target as HTMLElement | null)?.closest('button')
      if (!b || (b as HTMLButtonElement).disabled || b.closest('[data-sfx="none"]')) return
      sfx('ui-move')
    }
    const key = () => unlockSfx()
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('keydown', key, true)
    return () => {
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('keydown', key, true)
    }
  }, [])

  // 상태 변화 → 소리
  const prev = useRef<{ screen: string; map: string; enc: string | null; battle: boolean; level: number; items: number; gold: number } | null>(null)
  const items = state.inventory.reduce((a, s) => a + s.qty, 0)
  const now = { screen: state.screen, map: state.currentMapId, enc: state.pendingEncounterUid, battle: !!state.battle, level: state.player.level, items, gold: state.player.gold }
  useEffect(() => {
    const p = prev.current
    prev.current = now
    if (!p) return
    // 몬스터와 부딪힘 → 전투로(바로 전투든, 물어보든 한 번)
    if ((!p.enc && now.enc) || (!p.battle && now.battle && !p.enc)) sfx('encounter')
    else if (p.battle && !now.battle && state.screen === 'world') {
      /* 전투 끝 — 승리·패배 곡은 배경음(battle-win/lose)이 낸다 */
    }
    if (p.map !== now.map && !now.battle) sfx('portal')
    if (now.level > p.level) sfx('level-up')
    else if (now.items > p.items && !now.battle) sfx('item-get')
    else if (now.gold > p.gold && !now.battle) sfx('coin')
    if (p.screen !== now.screen && !now.battle && !p.battle) {
      if (now.screen === 'world') sfx('ui-close')
      else if (p.screen === 'world') sfx('ui-open')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now.screen, now.map, now.enc, now.battle, now.level, now.items, now.gold])

  return null
}
