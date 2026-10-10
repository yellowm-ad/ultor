'use client'

import { initMapOverrides } from '@/lib/map-overrides'
import { initDialogueOverrides } from '@/lib/dialogue-overrides'
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
import { JournalScreen } from '@/components/game/journal-screen'
import { ClassSceneOverlay } from '@/components/game/class-scene'
import { StoryOverlay } from '@/components/game/story-overlay'
import { FishingOverlay } from '@/components/game/fishing-overlay'
import { PassageOverlay } from '@/components/game/passage-overlay'
import { ScreenGuard } from '@/components/game/screen-guard'

// e.code(물리 키) 기준 — 한글 IME 상태에서도 동작. 이동 W/A/S/D·상호작용 E·달리기 Shift 와 겹치지 않게 유지할 것
const OVERLAY_HOTKEYS: Record<string, ScreenId> = { KeyI: 'inventory', KeyC: 'character', KeyP: 'party', KeyM: 'worldmap', KeyJ: 'journal' }
const CLOSABLE_WITH_ESC = new Set<ScreenId>([
  'journal',
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

      // 수업 장면·미니게임 중엔 단축키 무시(리듬 실습 Q/W/E/R 등과 동시 입력 방지)
      if (state.classScene) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const wanted = OVERLAY_HOTKEYS[e.code]
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
  }, [state.screen, state.classScene, dispatch])

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
      <ScreenGuard onCrash={() => dispatch({ type: 'CLOSE_OVERLAY' })}>
      <DialogueScreen />
      <InventoryScreen />
      {state.screen === 'shop' && <ShopScreen />}
      {state.screen === 'character' && <CharacterScreen />}
      {state.screen === 'party' && <PartyScreen />}
      {state.screen === 'tamer' && <TamerScreen />}
      {state.screen === 'craft' && <CraftScreen />}
      {state.screen === 'settings' && <SettingsScreen />}
      {state.screen === 'worldmap' && <WorldMapScreen />}
      {state.screen === 'journal' && <JournalScreen />}
      </ScreenGuard>
      {state.storyQueue.length > 0 && <StoryOverlay />}
      {state.fishing && <FishingOverlay />}
      {state.passage && <PassageOverlay />}
      {state.classScene && <ClassSceneOverlay />}
    </div>
  )
}

export function GameRoot() {
  // 관리자가 고친 맵 오브젝트·대사(배포본 public/*.json + 이 브라우저 기록) 불러오기
  useEffect(() => {
    initMapOverrides()
    initDialogueOverrides()
  }, [])
  return (
    <GameProvider>
      <div className="fixed inset-0 h-dvh w-dvw select-none overflow-hidden bg-background">
        <GameShell />
      </div>
    </GameProvider>
  )
}
