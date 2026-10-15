'use client'
// 천공 콜로세움 — 브라우저 쪽. 서버 호출(/api/arena/), 광장 신호(접속자·한마디), 서버가 없을 때 연습 상대.
import { useSyncExternalStore } from 'react'
import type { ArenaIdentity, ArenaLobbyPlayer, ArenaOpponent, ArenaRankRow, ArenaShout, ArenaTeam } from '@/lib/arena-core'
import { teamPower } from '@/lib/arena-core'
import type { NpcDef } from '@/lib/types'
import { COLOSSEUM_LOBBY_SPOTS } from '@/lib/colosseum-map'

export interface ArenaStanding {
  rating: number
  rank: number | null
  wins: number
  losses: number
}

/** 서버가 없거나(정적 실행) 저장소가 연결되지 않음 — 연습 상대로 대신한다 */
export class ArenaOffline extends Error {}
export class ArenaError extends Error {}

export async function arenaCall<T = Record<string, unknown>>(op: string, body: Record<string, unknown> = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch('/api/arena/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op, ...body }) })
  } catch {
    throw new ArenaOffline('콜로세움 서버에 닿지 않습니다')
  }
  // 정적 실행에는 API 가 없다(404/405), 저장소 미연결은 503
  if (res.status === 404 && !res.headers.get('content-type')?.includes('json')) throw new ArenaOffline('콜로세움 서버가 없는 실행입니다')
  if (res.status === 405 || res.status === 503) throw new ArenaOffline('콜로세움 서버가 아직 열리지 않았습니다')
  let data: { ok?: boolean; error?: string } & Record<string, unknown>
  try {
    data = await res.json()
  } catch {
    throw new ArenaOffline('콜로세움 서버 응답을 읽지 못했습니다')
  }
  if (!res.ok || !data.ok) throw new ArenaError(data.error ?? `오류 ${res.status}`)
  return data as T
}

const idBody = (id?: ArenaIdentity) => (id ? { pid: id.pid, token: id.token } : {})

export const arenaApi = {
  register: (id: ArenaIdentity, team: ArenaTeam) => arenaCall<{ team: ArenaTeam; me: ArenaStanding }>('register', { ...idBody(id), team }),
  ping: (id?: ArenaIdentity) => arenaCall<{ players: ArenaLobbyPlayer[]; shouts: ArenaShout[]; me: ArenaStanding | null }>('ping', idBody(id)),
  shout: (id: ArenaIdentity, text: string) => arenaCall<{ shouts: ArenaShout[] }>('shout', { ...idBody(id), text }),
  opponents: (id: ArenaIdentity) => arenaCall<{ players: ArenaLobbyPlayer[]; me: ArenaStanding }>('opponents', idBody(id)),
  challenge: (id: ArenaIdentity, opp: string) => arenaCall<{ opponent: ArenaOpponent; ticket: string }>('challenge', { ...idBody(id), opp }),
  report: (id: ArenaIdentity, ticket: string, won: boolean) => arenaCall<{ delta: number; me: ArenaStanding }>('report', { ...idBody(id), ticket, won }),
  ranking: (id?: ArenaIdentity) => arenaCall<{ rows: ArenaRankRow[]; me: ArenaStanding | null }>('ranking', idBody(id)),
  history: (id: ArenaIdentity) => arenaCall<{ rows: { vs: string; won: boolean; attack: boolean; delta: number; at: number }[] }>('history', idBody(id)),
}

// ── 광장 상태(접속자·한마디) — 콜로세움 맵에 있는 동안 15초마다 신호 ──
export interface ArenaLobbyState {
  online: 'unknown' | 'online' | 'offline'
  players: ArenaLobbyPlayer[]
  shouts: ArenaShout[]
  me: ArenaStanding | null
  note?: string
}
let lobby: ArenaLobbyState = { online: 'unknown', players: [], shouts: [], me: null }
const listeners = new Set<() => void>()
export function setArenaLobby(patch: Partial<ArenaLobbyState>) {
  lobby = { ...lobby, ...patch }
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
export const useArenaLobby = () => useSyncExternalStore(subscribe, () => lobby, () => lobby)

export async function pingArena(id?: ArenaIdentity) {
  try {
    const r = await arenaApi.ping(id)
    setArenaLobby({ online: 'online', players: r.players, shouts: r.shouts, me: r.me ?? lobby.me, note: undefined })
  } catch (e) {
    if (e instanceof ArenaOffline) setArenaLobby({ online: 'offline', players: [], note: e.message })
    else setArenaLobby({ note: (e as Error).message })
  }
}

// ── 연습 상대(서버 없이) — 내 팀을 바탕으로 이름·능력치를 조금씩 바꾼 그로먼의 수련생들 ──
const PRACTICE_NAMES = ['수련생 카이', '수련생 베라', '수련생 도윤', '수련생 하나', '수련생 루크', '수련생 미아']
export function practiceOpponents(mine: ArenaTeam): ArenaOpponent[] {
  return [0.86, 0.95, 1.04].map((k, i) => {
    const name = PRACTICE_NAMES[(Math.floor(Math.random() * PRACTICE_NAMES.length) + i) % PRACTICE_NAMES.length]
    const gender = Math.random() < 0.5 ? 'male' : 'female'
    const units = mine.units.map((u) => ({
      ...u,
      name: u.kind === 'hero' ? name.replace('수련생 ', '') : u.name,
      stats: Object.fromEntries(Object.entries(u.stats).map(([s, v]) => [s, Math.max(1, Math.round(v * k))])) as unknown as typeof u.stats,
      ...(u.kind === 'hero' ? { appearance: { kind: 'hero' as const, sheet: `protag-${gender}` } } : {}),
    }))
    return {
      team: { pid: `practice${i}`, name, gender, level: mine.level, units, power: teamPower(units), updatedAt: Date.now() },
      rating: Math.round(1000 * k),
      wins: 0,
      losses: 0,
    }
  })
}

// ── 광장에서 다른 플레이어를 눌렀을 때 — 콜로세움 창이 열리면 그 사람을 대전 목록 맨 위에 ──
let focus: ArenaLobbyPlayer | null = null
export const setArenaFocus = (p: ArenaLobbyPlayer) => {
  focus = p
}
export const takeArenaFocus = () => {
  const f = focus
  focus = null
  return f
}

/** 광장의 다른 플레이어 → 맵 위 자리(배회용 가짜 NPC). iso-world(그리기)와 world-screen(E 도전)이 같은 자리를 쓴다 */
export function rivalGhosts(players: ArenaLobbyPlayer[], myPid?: string): { player: ArenaLobbyPlayer; npc: NpcDef }[] {
  return players
    .filter((p) => p.pid !== myPid)
    .sort((a, b) => (a.pid < b.pid ? -1 : 1))
    .slice(0, COLOSSEUM_LOBBY_SPOTS.length)
    .map((p, i) => ({
      player: p,
      npc: { id: `rival-${p.pid}`, name: p.name, role: 'flavor', icon: '', zoneId: '', cell: COLOSSEUM_LOBBY_SPOTS[i], greeting: [], roam: 0.9 },
    }))
}
