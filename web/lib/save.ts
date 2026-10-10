// ============================================================================
// 세이브/로드 (§학사 PRD 78, 80, 82-15)
//
// 브라우저 localStorage 에 GameState 를 통째로 저장한다(서버 DB 도입 전 단계).
// 불러올 때는 항상 createInitialGameState() 기본값 위에 덮어써서(마이그레이션), 나중에 필드가
// 늘어나도 예전 세이브가 깨지지 않게 한다. 전투 중·오버레이 같은 일시 상태는 저장하지 않는다.
// ============================================================================

import type { GameState, Gender } from '@/lib/types'
import { computeStatsForLevel } from '@/lib/constants'
import { MAX_LEVEL } from '@/lib/exp-table'
import { defaultAppearance, STARTER_SKILLS } from '@/lib/player-factory'
import { ensureParty, refreshSkills } from '@/lib/progression'
import { itemById } from '@/lib/mock-data'

// 버전은 키가 아니라 값(SaveFile.version) 안에 둔다 — 키에 버전을 붙이면 버전이 바뀔 때 옛 세이브를 못 찾는다.
/** 세이브 슬롯 수(타이틀 CONTINUE · 설정 저장 화면) */
export const SAVE_SLOTS = 4
const slotKey = (slot: number) => `ultor-save-${slot}`
/** 지금 플레이 중인 슬롯 — 자동 저장 대상. 타이틀에서 고른 슬롯 / 설정에서 마지막으로 저장한 슬롯 */
const ACTIVE_KEY = 'ultor-save-active'
/** 슬롯 도입 전 단일 세이브 키 — 읽을 때 1번 슬롯으로 옮긴다 */
const LEGACY_KEYS = ['ultor-save', 'ultor-save-v1']
/** 2 = PRD v2.0 개편(커마 주인공·5속성·전직 폐지·4대4 포지션) */
const SAVE_VERSION = 2

export interface SaveFile {
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
    classScene: _cs,
    passage: _pg,
    ...rest
  } = state
  // 수업 도중 저장되면 교실이 아니라 수업 들어가기 전 자리로(수업은 다시 듣게 된다)
  if (state.classScene) return { ...rest, currentMapId: state.classScene.returnTo.mapId, position: { ...state.classScene.returnTo.position } }
  return { ...rest, screen: 'world', previousScreen: 'world' }
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** 옛 단일 세이브 → 1번 슬롯(1번이 비어 있을 때만). 한 번 옮기면 옛 키는 지운다 */
function migrateLegacy(ls: Storage) {
  for (const k of LEGACY_KEYS) {
    const old = ls.getItem(k)
    if (!old) continue
    if (!ls.getItem(slotKey(1))) {
      ls.setItem(slotKey(1), old)
      if (!ls.getItem(ACTIVE_KEY)) ls.setItem(ACTIVE_KEY, '1')
    }
    ls.removeItem(k)
  }
}

export function getActiveSlot(): number | null {
  const ls = storage()
  if (!ls) return null
  try {
    migrateLegacy(ls)
    const n = Number(ls.getItem(ACTIVE_KEY))
    return n >= 1 && n <= SAVE_SLOTS ? n : null
  } catch {
    return null
  }
}

/** null = 자동 저장 끔(새 게임인데 빈 슬롯이 없을 때 — 설정에서 직접 저장하면 그 슬롯이 활성화된다) */
export function setActiveSlot(slot: number | null) {
  const ls = storage()
  if (!ls) return
  try {
    if (slot == null) ls.removeItem(ACTIVE_KEY)
    else ls.setItem(ACTIVE_KEY, String(slot))
  } catch {
    // 저장소 접근 불가 — 무시
  }
}

/** 세이브 쓰기. slot 을 안 주면 활성 슬롯(자동 저장)에, 활성 슬롯이 없으면 저장하지 않는다 */
export function writeSave(state: GameState, slot?: number): boolean {
  const ls = storage()
  if (!ls) return false
  // 타이틀/캐릭터 생성 단계는 아직 게임이 시작되지 않은 상태
  if (state.screen === 'title' || state.screen === 'create') return false
  const target = slot ?? getActiveSlot()
  if (!target) return false
  try {
    const file: SaveFile = { version: SAVE_VERSION, savedAt: Date.now(), state: strip(state) }
    ls.setItem(slotKey(target), JSON.stringify(file))
    return true
  } catch {
    return false
  }
}

export function readSave(slot: number): SaveFile | null {
  const ls = storage()
  if (!ls) return null
  try {
    migrateLegacy(ls)
    const raw = ls.getItem(slotKey(slot))
    return raw ? parseSaveFile(raw) : null
  } catch {
    return null
  }
}

/** 슬롯 1..SAVE_SLOTS 의 세이브(빈 슬롯은 null) */
export function listSaves(): (SaveFile | null)[] {
  return Array.from({ length: SAVE_SLOTS }, (_, i) => readSave(i + 1))
}

export function firstEmptySlot(): number | null {
  const i = listSaves().findIndex((f) => !f)
  return i < 0 ? null : i + 1
}

/** 세이브 문자열 검증 — 불러오기(파일)에도 같이 쓴다 */
export function parseSaveFile(raw: string): SaveFile | null {
  try {
    const file = JSON.parse(raw) as SaveFile
    if (!file || typeof file !== 'object' || !file.state || typeof file.version !== 'number') return null
    if (file.version > SAVE_VERSION) return null // 더 새 버전 게임에서 만든 세이브
    return file
  } catch {
    return null
  }
}

/** 백업 파일로 내보내기(JSON 다운로드) — 브라우저 데이터가 지워져도 복구할 수 있게 */
export function exportSave(state: GameState): boolean {
  if (typeof window === 'undefined') return false
  const file: SaveFile = { version: SAVE_VERSION, savedAt: Date.now(), state: strip(state) }
  const blob = new Blob([JSON.stringify(file)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const d = new Date()
  a.href = url
  a.download = `ultor-save-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`
  a.click()
  URL.revokeObjectURL(url)
  return true
}

export function hasSave(): boolean {
  return listSaves().some(Boolean)
}

/** 슬롯 하나 지우기 — 지운 슬롯이 활성 슬롯이면 자동 저장도 끈다 */
export function deleteSave(slot: number) {
  const ls = storage()
  if (!ls) return
  try {
    ls.removeItem(slotKey(slot))
    if (getActiveSlot() === slot) ls.removeItem(ACTIVE_KEY)
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

/**
 * 불러온 상태를 PRD v2.0 규칙으로 정리한다(멱등 — 이미 새 형식이어도 안전).
 *   · 주인공: 고정 속성/전직 필드 제거 → 외형은 성별만(흑발 금안 고정 주인공 protag-<gender>)
 *   · 스탯: Lv.100 공용 성장식으로 다시 계산
 *   · 스킬: 전직 자동 습득분을 버리고 수업 이수 기록으로 다시 계산(+ 시작 스킬), 장착 슬롯 재구성
 *   · 파티: 1학년 동기 자동 합류 + 4인 편성 + 진형 정리
 *   · 장비: 존재하지 않는 아이템 해제
 * 이후 런타임은 신규 규칙만 쓴다.
 */
export function migrateLoadedState(state: GameState, raw: Partial<GameState>): GameState {
  const legacy = raw.player as unknown as { element?: string; gender?: Gender; jobTierId?: string; appearance?: unknown } | undefined
  let player = state.player
  const wasLegacy = !!legacy && (!legacy.appearance || legacy.jobTierId != null || legacy.element != null)
  if (wasLegacy) {
    const { element: _e, gender: _g, jobTierId: _j, ...rest } = player as unknown as Record<string, unknown>
    player = {
      ...(rest as unknown as GameState['player']),
      appearance: defaultAppearance({ gender: legacy?.gender ?? 'male' }),
      learnedSkills: [...STARTER_SKILLS],
      equippedSkills: [...STARTER_SKILLS],
    }
  }
  const level = Math.max(1, Math.min(MAX_LEVEL, player.level || 1))
  const stats = computeStatsForLevel(level)
  const equipped = { ...player.equipped }
  for (const [slot, id] of Object.entries(equipped)) if (id && !itemById(id)) delete equipped[slot as keyof typeof equipped]
  player = {
    ...player,
    level,
    stats,
    hp: Math.max(1, Math.min(stats.maxHp, player.hp)),
    mp: Math.max(0, Math.min(stats.maxMp, player.mp)),
    equipped,
    learnedSkills: player.learnedSkills ?? [...STARTER_SKILLS],
    equippedSkills: player.equippedSkills ?? (player.learnedSkills ?? []).slice(0, 8),
    appearance: defaultAppearance(player.appearance ?? {}),
  }
  const formation = state.formation?.positions ? state.formation : { positions: { hero: 'front' as const } }
  return ensureParty(refreshSkills({ ...state, player, formation }))
}
