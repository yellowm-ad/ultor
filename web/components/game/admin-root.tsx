'use client'

import { useEffect, useState } from 'react'
import { GameProvider, useGame } from '@/lib/game-state'
import { WorldScreen } from '@/components/game/world-screen'
import { BattleScreen } from '@/components/game/battle-screen'
import { Hud } from '@/components/game/hud'
import { Minimap } from '@/components/game/minimap'
import { DialogueScreen } from '@/components/game/dialogue-screen'
import { ShopScreen } from '@/components/game/shop-screen'
import { InventoryScreen } from '@/components/game/inventory-screen'
import { CharacterScreen } from '@/components/game/character-screen'
import { PartyScreen } from '@/components/game/party-screen'
import { TamerScreen } from '@/components/game/tamer-screen'
import { SettingsScreen } from '@/components/game/settings-screen'
import { Toast } from '@/components/game/toast'
import { AdminPanel } from '@/components/game/admin-panel'
import { StoryOverlay } from '@/components/game/story-overlay'

// 실제 인증이 아니라 우연히 /admin 으로 들어오는 걸 막는 정도의 가벼운 문지기.
// 저장 데이터가 전혀 없는 순수 클라이언트 샌드박스라 뚫려도 실질적 피해는 없음.
const PASSCODE = 'ultor2026'

function AdminGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null)
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    try {
      setUnlocked(sessionStorage.getItem('ultor-admin-unlocked') === '1')
    } catch {
      setUnlocked(false)
    }
  }, [])

  if (unlocked === null) return null
  if (unlocked) return <>{children}</>

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-[#0b0907] px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (input === PASSCODE) {
            try {
              sessionStorage.setItem('ultor-admin-unlocked', '1')
            } catch {}
            setUnlocked(true)
          } else {
            setError(true)
          }
        }}
        className="flex w-full max-w-xs flex-col gap-2 rounded-lg border border-gold/50 bg-black/70 p-6 text-center"
      >
        <div className="font-display text-sm text-gold-soft">관리자 테스트 페이지</div>
        <input
          type="password"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setError(false)
          }}
          placeholder="암호"
          autoFocus
          className="rounded border border-gold/40 bg-black/40 px-2 py-1.5 text-center text-sm text-white outline-none"
        />
        {error && <div className="text-[11px] text-red-300">암호가 틀렸습니다.</div>}
        <button type="submit" className="rounded border border-gold bg-primary px-3 py-1.5 text-sm text-primary-foreground">
          입장
        </button>
      </form>
    </div>
  )
}

function AdminShell() {
  const { state, dispatch } = useGame()
  const [booted, setBooted] = useState(false)

  // 1) 타이틀이면 즉시 기본 캐릭터로 START_GAME
  useEffect(() => {
    if (!booted && state.screen === 'title') {
      dispatch({ type: 'START_GAME', name: '관리자', appearance: {}, starterPetId: 'pet-emberling' })
      setBooted(true)
    }
  }, [booted, state.screen, dispatch])

  // 2) 부팅 직후 한 번만 테스트룸으로 자동 이동(이후 사용자가 다른 맵으로 나가는 건 막지 않음)
  useEffect(() => {
    if (booted && state.screen === 'world' && state.currentMapId !== 'testroom') {
      dispatch({ type: 'ADMIN_ENTER_TESTROOM' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted, state.screen])

  if (state.screen === 'title' || state.screen === 'create') {
    return <div className="flex h-full w-full items-center justify-center text-sm text-white/60">관리자 캐릭터 준비 중…</div>
  }
  if (state.screen === 'battle') return (
    <>
      <BattleScreen />
      <AdminPanel />
    </>
  )

  return (
    <div className="relative h-full w-full">
      <WorldScreen />
      <Hud />
      <Minimap />
      <Toast />
      <DialogueScreen />
      <ShopScreen />
      <InventoryScreen />
      <CharacterScreen />
      <PartyScreen />
      <TamerScreen />
      <SettingsScreen />
      {/* 관리자 '컷신' 탭의 장면 재생용 */}
      {state.storyQueue.length > 0 && <StoryOverlay />}
      <AdminPanel />
    </div>
  )
}

export function AdminRoot() {
  return (
    <AdminGate>
      <GameProvider>
        <div className="fixed inset-0 h-dvh w-dvw select-none overflow-hidden bg-background">
          <AdminShell />
        </div>
      </GameProvider>
    </AdminGate>
  )
}
