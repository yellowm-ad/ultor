// ============================================================================
// 천공 콜로세움 — 멀티플레이 비동기 대전(2026-10-15)
//  · 내 팀(주인공 + 파티 동료 + 펫)을 "스냅숏"으로 서버에 올려 두면, 다른 플레이어가 그 팀과 싸운다(상대 팀은 AI 가 조종).
//  · 승패로 점수(Elo)가 오르내리고 랭킹이 갈린다. 서버 = app/api/arena/route.api.ts (Upstash Redis)
//  · 이 파일 = 서버·클라이언트 공용(게임 데이터를 끌어오지 않는다) — 팀 스냅숏 형식·검증·점수 계산. 게임 쪽은 lib/arena.ts
// ============================================================================
import type { AiProfile, Combatant, Gender, PlayerElement, Position, SkillElement, Stats } from '@/lib/types'

export const ARENA_MAP_ID = 'sky-colosseum'
/** 처음 등록한 팀의 점수 */
export const ARENA_START_RATING = 1000
/** 한 판에 오르내리는 점수의 최대 폭(Elo K) */
export const ARENA_K = 32
/** 광장에 "지금 있는" 플레이어로 치는 시간 — 마지막 신호 뒤 이만큼 */
export const ARENA_LOBBY_TTL_MS = 3 * 60 * 1000
export const ARENA_SHOUT_MAX = 60
export const ARENA_NAME_MAX = 16

/** 팀 한 명 — 전투원에서 전투 중 값(HP·ATB·효과)을 뺀 것. 싸울 때마다 꽉 찬 HP 로 다시 만든다 */
export interface ArenaUnit {
  kind: 'hero' | 'ally' | 'pet'
  refId: string
  name: string
  icon: string
  element: SkillElement
  level: number
  /** 포지션 보너스 적용 전 스탯 */
  stats: Stats
  skills: string[]
  position?: Position
  weaponElement?: PlayerElement
  appearance?: Combatant['appearance']
  aiProfile?: AiProfile
}

export interface ArenaTeam {
  pid: string
  name: string
  gender: Gender
  level: number
  units: ArenaUnit[]
  /** 대략의 전투력 — 목록 표시용 */
  power: number
  updatedAt: number
}

/** 광장에 있는 플레이어(가벼운 정보만) */
export interface ArenaLobbyPlayer {
  pid: string
  name: string
  gender: Gender
  level: number
  rating: number
  power: number
}

export interface ArenaShout {
  pid: string
  name: string
  text: string
  at: number
}

export interface ArenaRankRow {
  rank: number
  pid: string
  name: string
  level: number
  rating: number
  wins: number
  losses: number
}

/** 대전 상대(도전 티켓과 함께) */
export interface ArenaOpponent {
  team: ArenaTeam
  rating: number
  wins: number
  losses: number
}

/** 이 저장 기록의 콜로세움 신분 — 저장 파일에 함께 들어간다(캐릭터마다 따로 랭킹) */
export interface ArenaIdentity {
  pid: string
  token: string
}

/** 진행 중인 대전 — BattleState.pvp */
export interface ArenaMatch {
  opponentPid: string
  opponentName: string
  /** 서버가 내준 도전 티켓(연습 상대면 없음) */
  ticket?: string
  practice?: boolean
}

export function teamPower(units: ArenaUnit[]): number {
  return Math.round(
    units.reduce((a, u) => a + u.stats.maxHp / 8 + u.stats.maxMp / 12 + u.stats.atk + u.stats.matk + u.stats.def + u.stats.mdef + u.stats.spd + u.stats.luck / 2, 0),
  )
}

/** Elo — 이긴 쪽이 얻는 점수(진 쪽은 같은 만큼 잃는다). 최소 1점 */
export function eloDelta(winner: number, loser: number, k = ARENA_K): number {
  const expected = 1 / (1 + Math.pow(10, (loser - winner) / 400))
  return Math.max(1, Math.round(k * (1 - expected)))
}

// ── 서버 입력 검증 — 숫자가 터무니없는 팀(조작)을 막는 최소한의 상한 ──
const STAT_CAP: Stats = { maxHp: 60000, maxMp: 9999, atk: 9999, def: 9999, matk: 9999, mdef: 9999, spd: 999, luck: 999 }
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
const num = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : lo)

export function sanitizeTeam(raw: unknown, pid: string): ArenaTeam | null {
  if (!raw || typeof raw !== 'object') return null
  const t = raw as Partial<ArenaTeam>
  if (!Array.isArray(t.units) || t.units.length === 0) return null
  const units: ArenaUnit[] = []
  for (const r of t.units.slice(0, 6)) {
    if (!r || typeof r !== 'object') continue
    const u = r as Partial<ArenaUnit>
    const kind = u.kind === 'hero' || u.kind === 'pet' ? u.kind : 'ally'
    const stats = {} as Stats
    for (const k of Object.keys(STAT_CAP) as (keyof Stats)[]) stats[k] = num(u.stats?.[k], 1, STAT_CAP[k])
    const position = u.position === 'front' || u.position === 'rear' || u.position === 'support' ? u.position : undefined
    const app = u.appearance
    const appearance: Combatant['appearance'] =
      app && app.kind === 'hero' && typeof app.sheet === 'string'
        ? { kind: 'hero', sheet: str(app.sheet, 40) }
        : app && app.kind === 'npc' && typeof app.npcId === 'string'
          ? { kind: 'npc', npcId: str(app.npcId, 40) }
          : undefined
    units.push({
      kind,
      refId: str(u.refId, 40),
      name: str(u.name, ARENA_NAME_MAX) || '???',
      icon: str(u.icon, 120),
      element: (typeof u.element === 'string' ? str(u.element, 12) : null) as SkillElement,
      level: num(u.level, 1, 100),
      stats,
      skills: Array.isArray(u.skills) ? u.skills.filter((s): s is string => typeof s === 'string').slice(0, 12).map((s) => s.slice(0, 40)) : [],
      ...(position ? { position } : {}),
      ...(typeof u.weaponElement === 'string' ? { weaponElement: str(u.weaponElement, 12) as PlayerElement } : {}),
      ...(appearance ? { appearance } : {}),
      ...(typeof u.aiProfile === 'string' ? { aiProfile: str(u.aiProfile, 16) as AiProfile } : {}),
    })
  }
  if (!units.some((u) => u.kind === 'hero')) return null
  return {
    pid,
    name: str(t.name, ARENA_NAME_MAX).trim() || '이름 없는 견습생',
    gender: t.gender === 'female' ? 'female' : 'male',
    level: num(t.level, 1, 100),
    units,
    power: teamPower(units),
    updatedAt: Date.now(),
  }
}
