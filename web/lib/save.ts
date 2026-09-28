// ============================================================================
// 세이브/로드 (§학사 PRD 78, 80, 82-15)
//
// 브라우저 localStorage 에 GameState 를 통째로 저장한다(서버 DB 도입 전 단계).
// 불러올 때는 항상 createInitialGameState() 기본값 위에 덮어써서(마이그레이션), 나중에 필드가
// 늘어나도 예전 세이브가 깨지지 않게 한다. 전투 중·오버레이 같은 일시 상태는 저장하지 않는다.
// ============================================================================

import type { GameState } from '@/lib/types'

export const SAVE_KEY = 'ultor-save-v1'
const SAVE_VERSION = 1

interface SaveFile {
  version: number
  savedAt: number
  state: Partial<GameState>
}

/** 저장 대상에서 빼는 일시 상태 */
function strip(state: GameState): Partial<GameState> {
  const {
    battle: _battle,
    toast: _toast,
    pendingEncounterUid: _pe,
    pendingPortalId: _pp,
    gateOpen: _g,
    activeNpcId: _an,
    activeShopId: _as,
    fishing: _f,
    fieldMonsters: _fm,
    ...rest
  } = state
  return { ...rest, screen: 'world', previousScreen: 'world' }
}

export function writeSave(state: GameState): boolean {
  if (typeof window === 'undefined') return false
  // 타이틀/캐릭터 생성 단계는 아직 게임이 시작되지 않은 상태
  if (state.screen === 'title' || state.screen === 'create') return false
  try {
    const file: SaveFile = { version: SAVE_VERSION, savedAt: Date.now(), state: strip(state) }
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(file))
    return true
  } catch {
    return false
  }
}

export function readSave(): SaveFile | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const file = JSON.parse(raw) as SaveFile
    if (!file || typeof file !== 'object' || !file.state) return null
    return file
  } catch {
    return null
  }
}

export function hasSave(): boolean {
  return readSave() != null
}

export function deleteSave() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(SAVE_KEY)
  } catch {
    // 저장소 접근 불가(프라이빗 모드 등) — 무시
  }
}

/** 기본 상태 위에 세이브를 얹는다. 중첩 객체는 한 단계 병합(새로 생긴 하위 필드 보존) */
export function mergeSave(base: GameState, saved: Partial<GameState>): GameState {
  const out = { ...base } as Record<string, unknown>
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) continue
    const b = (base as unknown as Record<string, unknown>)[k]
    if (b && typeof b === 'object' && !Array.isArray(b) && v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = { ...(b as object), ...(v as object) }
    } else {
      out[k] = v
    }
  }
  return out as unknown as GameState
}
