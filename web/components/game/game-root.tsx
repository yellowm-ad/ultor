'use client'

import { useEffect } from 'react'
import { GameProvider, useGame } from '@/lib/game-state'
import type { ScreenId } from '@/lib/types'
import { TitleScreen } from '@/components/game/title-screen'
import { CreateScreen } from '@/components/game/create-screen'
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
import { CraftScreen } from '@/components/game/craft-screen'
import { WorldMapScreen } from '@/components/game/world-map-screen'
import { Toast } from '@/components/game/toast'

const OVERLAY_HOTKEYS: Record<string, ScreenId> = { i: 'inventory', c: 'character', p: 'party', m: 'worldmap' }
const CLOSABLE_WITH_ESC = new Set<ScreenId>([
  'inventory',
  'character',
  'party',
  'shop',
  'tamer',
  'settings',
  'craft',
  'worldmap',
  'dialogue',
])

function GameShell() {
  const { state, dispatch } = useGame()

  // 단축키: ESC로 오버레이 닫기, I/C/P/M으로 가방·정보·파티·전체지도 토글(월드 화면에서만 동작).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

      if (e.key === 'Escape') {
        if (CLOSABLE_WITH_ESC.has(state.screen)) {
          e.preventDefault()
          dispatch({ type: 'CLOSE_OVERLAY' })
        }
        return
      }

      const wanted = OVERLAY_HOTKEYS[e.key.toLowerCase()]
      if (!wanted) return
      if (state.screen === 'world') {
        e.preventDefault()
        dispatch({ type: 'SET_SCREEN', screen: wanted })
      } else if (state.screen === wanted) {
        e.preventDefault()
        dispatch({ type: 'SET_SCREEN', screen: 'world' })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [state.screen, dispatch])

  if (state.screen === 'title') return <TitleScreen />
  if (state.screen === 'create') return <CreateScreen />
  if (state.screen === 'battle') return <BattleScreen />

  return (
    <div className="relative h-full w-full">
      <WorldScreen />
      <Hud />
      <Minimap />
      <Toast />
      {/* 대화·가방은 내부 로컬 state(대사 인덱스·탭 선택 등)가 열고 닫는 사이 유지돼야 해서 상시 마운트.
          나머지는 로컬 state가 없어 필요할 때만 마운트해도 동작이 완전히 동일 — 이동 중 매 프레임
          쓸데없이 리렌더되는 걸 막는다(useGame() 컨텍스트를 구독하면 화면이 'world'로 안 열려 있어도
          모든 디스패치마다 리렌더되기 때문). */}
      <DialogueScreen />
      <InventoryScreen />
      {state.screen === 'shop' && <ShopScreen />}
      {state.screen === 'character' && <CharacterScreen />}
      {state.screen === 'party' && <PartyScreen />}
      {state.screen === 'tamer' && <TamerScreen />}
      {state.screen === 'craft' && <CraftScreen />}
      {state.screen === 'settings' && <SettingsScreen />}
      {state.screen === 'worldmap' && <WorldMapScreen />}
    </div>
  )
}

export function GameRoot() {
  return (
    <GameProvider>
      <div className="fixed inset-0 h-dvh w-dvw select-none overflow-hidden bg-background">
        <GameShell />
      </div>
    </GameProvider>
  )
}
