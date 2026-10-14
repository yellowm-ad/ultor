// ============================================================================
// 배경음(BGM) — 상황별 "칸(slot)"에 곡을 넣어 두면 게임이 상황에 맞는 칸을 골라 튼다.
//   · 칸 목록(BGM_GROUPS): 기본 / 마을·거점(지역별) / 전투맵(지역별 야생) / 전투 진입(지역별·보스·최종전)
//     / 스토리(장별·막별) / 기타(수업·미니게임)
//   · 고르는 순서(bgmChain): 더 구체적인 칸 → 기본 칸. 앞에서부터 곡이 들어 있는 첫 칸을 튼다.
//       예) 설원 야생에서 보스 전투 = 보스 전투 → 전투(루미나 설원) → 전투 기본
//       예) EP12 스토리 장면   = 스토리 EP12 → 스토리 CH1 → 스토리 기본 → (없으면 지금 맵의 곡을 그대로)
//   · 곡의 출처 두 가지(컷신 이미지와 같은 방식):
//       ① 관리자 「브금 관리」 창에서 넣은 파일 — 이 브라우저 IndexedDB 에만 저장(바로 들어 볼 수 있다)
//       ② 배포 파일 — web/public/bgm/<파일> + web/public/bgm/manifest.json ({ "칸 id": "파일 이름" })
//     관리 창의 「파일로 저장」·「목록(manifest) 저장」으로 받은 것을 web/public/bgm/ 에 넣고 배포하면 ②가 된다.
//   · 재생은 components/game/bgm-player.tsx.
// ============================================================================

import { MORS_MONSTER_ID } from '@/lib/constants'
import { MAPS } from '@/lib/maps'
import { REGIONS, regionOfMap, type RegionId } from '@/lib/regions'
import { STORY_ARCS, arcForWeek } from '@/lib/story'
import { STORY_EPISODES } from '@/lib/story-episodes'
import type { GameState, MapId } from '@/lib/types'

export interface BgmSlot {
  id: string
  label: string
  /** 언제 나오는 곡인지 한 줄 */
  hint?: string
  /** 한 번만 재생(되풀이하지 않음) */
  once?: boolean
}
export interface BgmGroup {
  id: string
  title: string
  note: string
  slots: BgmSlot[]
  /** 칸이 많아 접어 두는 묶음 */
  collapsed?: boolean
}

/** 관리자 테스트룸은 칸 목록에서 뺀다(기본 곡을 쓴다) */
const NO_SLOT_MAPS = new Set<string>(['testroom'])
const mapsOfKind = (r: RegionId, kind: 'town' | 'field') =>
  REGIONS.find((x) => x.id === r)!.maps.filter((m) => !NO_SLOT_MAPS.has(m) && MAPS[m as keyof typeof MAPS]?.kind === kind)
const mapNames = (ids: MapId[]) => {
  const names = ids.map((m) => MAPS[m as keyof typeof MAPS]?.name).filter(Boolean)
  return names.slice(0, 5).join(' · ') + (names.length > 5 ? ` 외 ${names.length - 5}곳` : '')
}

const TOWN_SLOTS: BgmSlot[] = REGIONS.filter((r) => mapsOfKind(r.id, 'town').length).map((r) => ({ id: `town:${r.id}`, label: r.name, hint: mapNames(mapsOfKind(r.id, 'town')) }))
const FIELD_SLOTS: BgmSlot[] = REGIONS.filter((r) => mapsOfKind(r.id, 'field').length).map((r) => ({ id: `field:${r.id}`, label: r.name, hint: mapNames(mapsOfKind(r.id, 'field')) }))
const BATTLE_SLOTS: BgmSlot[] = REGIONS.filter((r) => mapsOfKind(r.id, 'field').length).map((r) => ({ id: `battle:${r.id}`, label: `${r.name} 전투`, hint: '이 지역 야생에서 전투에 들어갈 때' }))

export const BGM_GROUPS: BgmGroup[] = [
  {
    id: 'base',
    title: '기본',
    note: '지역·장면 전용 곡이 없을 때 대신 나오는 곡. 여기부터 채우면 게임 전체에 소리가 깔린다.',
    slots: [
      { id: 'title', label: '타이틀 화면', hint: '게임 시작 화면 · 캐릭터 만들기' },
      { id: 'town-default', label: '마을 기본', hint: '전용 곡이 없는 마을·실내' },
      { id: 'field-default', label: '전투맵 기본', hint: '전용 곡이 없는 야생' },
      { id: 'battle-default', label: '전투 기본', hint: '전용 곡이 없는 전투' },
      { id: 'story-default', label: '스토리 기본', hint: '전용 곡이 없는 스토리 장면(비워 두면 지금 맵의 곡이 그대로 이어진다)' },
    ],
  },
  { id: 'town', title: '마을 · 거점', note: '몬스터가 없는 안전지대(마을·학교·신전 등)에서 나오는 곡 — 지역별.', slots: TOWN_SLOTS },
  { id: 'field', title: '전투맵(야생)', note: '몬스터가 돌아다니는 야생 맵에서 걸어 다닐 때 나오는 곡 — 지역별.', slots: FIELD_SLOTS },
  {
    id: 'battle',
    title: '전투 진입',
    note: '전투 화면으로 넘어가면 나오는 곡 — 지역별. 보스·최종전 곡이 있으면 그쪽이 먼저다.',
    slots: [
      ...BATTLE_SLOTS,
      { id: 'battle-boss', label: '보스 전투', hint: '중간보스·필드보스·스토리 보스' },
      { id: 'battle-final', label: '최종전(모르스)', hint: '모르스와의 전투' },
      { id: 'battle-win', label: '승리', hint: '전투에서 이겼을 때 한 번', once: true },
      { id: 'battle-lose', label: '패배', hint: '전투에서 졌을 때 한 번', once: true },
    ],
  },
  {
    id: 'story-chapter',
    title: '스토리 — 장(파트)별',
    note: '스토리 장면(대사·컷신)이 나오는 동안의 곡 — 장별. 막 전용 곡이 있으면 그쪽이 먼저다.',
    slots: STORY_ARCS.map((a) => ({ id: `story:${a.id}`, label: `${a.id} · ${a.name}`, hint: `${a.startWeek}~${a.endWeek}주차` })),
  },
  {
    id: 'story-episode',
    title: '스토리 — 막(EP)별',
    note: '특정 막에서만 쓰는 곡. 비워 두면 그 막이 속한 장의 곡이 나온다.',
    collapsed: true,
    slots: [{ id: 'story:EP00', label: 'EP00 · 프롤로그(입학식)' }, ...STORY_EPISODES.map((e) => ({ id: `story:${e.id}`, label: `${e.id} · ${e.title}`, hint: `${e.chapter} · ${e.week}주차` }))],
  },
  {
    id: 'etc',
    title: '기타',
    note: '수업·미니게임처럼 잠깐 바뀌는 장면. 비워 두면 지금 맵의 곡이 그대로 이어진다.',
    slots: [
      { id: 'class', label: '수업 시간', hint: '교실 수업 장면 · 실습 미니게임' },
      { id: 'class-end', label: '수업 종료', hint: '수업이 끝날 때 한 번', once: true },
      { id: 'minigame', label: '낚시 · 이동 미니게임', hint: '낚시, 첫 항해·나선 계단·미로·설원 횡단' },
    ],
  },
]

export const BGM_SLOTS: BgmSlot[] = BGM_GROUPS.flatMap((g) => g.slots)
const SLOT_BY_ID = new Map(BGM_SLOTS.map((s) => [s.id, s]))
export const bgmSlot = (id: string) => SLOT_BY_ID.get(id)

/** 배포 파일 이름의 몸통 — 칸 id 의 ':' 는 파일 이름에 못 쓰므로 '-' 로 */
export const bgmFileBase = (slotId: string) => slotId.replace(/:/g, '-')
export const BGM_DIR = '/bgm/'
export const BGM_MANIFEST = BGM_DIR + 'manifest.json'

// ── 지금 상황에 맞는 칸 고르기 ────────────────────────────────────────────────

const EP_BY_WEEK = new Map(STORY_EPISODES.map((e) => [e.week, e]))
const EP_BY_NO = new Map(STORY_EPISODES.map((e) => [e.no, e]))

/** 스토리 장면(beat id) → [막 칸, 장 칸]. id 형식: 'EP_<주차>_OPEN|END'(막 오프닝·결말) · 'EP<번호>_…'(막 중간 장면) */
function storySlots(beatId: string, globalWeek: number): string[] {
  const byWeek = /^EP_(\d+)_/.exec(beatId)
  const byNo = /^EP(\d\d)_/.exec(beatId)
  const ep = byWeek ? EP_BY_WEEK.get(Number(byWeek[1])) : byNo ? EP_BY_NO.get(Number(byNo[1])) : undefined
  if (ep) return [`story:${ep.id}`, `story:${ep.chapter}`]
  if (byNo && Number(byNo[1]) === 0) return ['story:EP00', 'story:CH0']
  return [`story:${arcForWeek(globalWeek).id}`]
}

function regionOf(mapId: MapId): RegionId | null {
  if (NO_SLOT_MAPS.has(mapId)) return null
  try {
    return regionOfMap(mapId)
  } catch {
    return null
  }
}

function mapSlots(mapId: MapId): string[] {
  const kind = MAPS[mapId as keyof typeof MAPS]?.kind === 'field' ? 'field' : 'town'
  const region = regionOf(mapId)
  return [region ? `${kind}:${region}` : '', `${kind}-default`].filter((s) => s && SLOT_BY_ID.has(s))
}

const BOSS_RANKS = new Set(['miniBoss', 'fieldBoss', 'storyBoss'])

type BgmState = Pick<GameState, 'screen' | 'currentMapId' | 'storyQueue' | 'battle' | 'calendar' | 'fishing' | 'passage' | 'classScene'>

/**
 * 지금 틀 곡 후보 — 앞에서부터 곡이 들어 있는 첫 칸을 튼다.
 * 한 번만 나오는 곡(once)이 맨 앞에 오면 그 곡이 끝난 뒤 다음 후보로 넘어가지 않고 조용히 둔다(결과 화면).
 */
export function bgmChain(state: BgmState): string[] {
  if (state.screen === 'title' || state.screen === 'create') return ['title']
  const map = mapSlots(state.currentMapId)
  if (state.screen === 'battle' && state.battle) {
    const b = state.battle
    const foes = b.combatants.filter((c) => c.side === 'enemy')
    const chain: string[] = []
    if (foes.some((c) => c.refId === MORS_MONSTER_ID)) chain.push('battle-final')
    if (foes.some((c) => c.rank && BOSS_RANKS.has(c.rank))) chain.push('battle-boss')
    const region = regionOf(state.currentMapId)
    if (region && SLOT_BY_ID.has(`battle:${region}`)) chain.push(`battle:${region}`)
    chain.push('battle-default')
    // 결과 화면 — 승리·패배 곡이 있으면 한 번 틀고 조용히, 없으면 전투 곡을 그대로
    return b.isOver ? [b.victory ? 'battle-win' : 'battle-lose', ...chain] : chain
  }
  if (state.storyQueue.length > 0) return [...storySlots(state.storyQueue[0], state.calendar.globalWeek), 'story-default', ...map]
  if (state.classScene) return ['class', ...map]
  if (state.fishing || state.passage) return ['minigame', ...map]
  return map
}

// ── 곡 저장소(IndexedDB + 배포 목록) ──────────────────────────────────────────

const DB_NAME = 'ultor-bgm'
const STORE = 'tracks'
const EVENT = 'ultor-bgm-store'

export interface BgmSource {
  url: string
  /** 'override' = 이 브라우저에 직접 넣은 곡 · 'static' = 배포 파일 */
  from: 'override' | 'static'
  /** 파일 이름(표시·내려받기용) */
  name: string
}

let manifest: Record<string, string> = {}
const overrides = new Map<string, { url: string; name: string; blob: Blob }>()
let ready: Promise<void> | null = null

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }).finally(() => db.close())
}

const EXT_BY_TYPE: Record<string, string> = { 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/flac': 'flac' }
/** 넣은 파일의 확장자 — 원래 이름에서, 없으면 형식에서 */
const extOf = (file: { name?: string; type: string }) => /\.([a-z0-9]{2,5})$/i.exec(file.name ?? '')?.[1].toLowerCase() ?? EXT_BY_TYPE[file.type] ?? 'mp3'

type Stored = { blob: Blob; name: string }

function setOverride(id: string, v: Stored | null) {
  const old = overrides.get(id)
  if (old) URL.revokeObjectURL(old.url)
  if (v) overrides.set(id, { url: URL.createObjectURL(v.blob), name: v.name, blob: v.blob })
  else overrides.delete(id)
}

/** 배포 목록과 이 브라우저에 넣어 둔 곡을 읽어 온다(한 번만) */
export function initBgm(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  ready ??= (async () => {
    try {
      const res = await fetch(BGM_MANIFEST, { cache: 'no-cache' })
      if (res.ok) manifest = (await res.json()) as Record<string, string>
    } catch {
      manifest = {}
    }
    try {
      const keys = (await tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys())).map(String)
      for (const k of keys) {
        const v = await tx<Stored | undefined>('readonly', (s) => s.get(k) as IDBRequest<Stored | undefined>)
        if (v?.blob) setOverride(k, v)
      }
    } catch {
      /* 저장소를 못 쓰는 환경 — 배포 파일만 쓴다 */
    }
    window.dispatchEvent(new CustomEvent(EVENT))
  })()
  return ready
}

/** 이 칸에 들어 있는 곡 — 직접 넣은 것이 배포 파일보다 먼저 */
export function bgmSource(slotId: string): BgmSource | null {
  const o = overrides.get(slotId)
  if (o) return { url: o.url, from: 'override', name: o.name }
  const f = manifest[slotId]
  return f ? { url: BGM_DIR + encodeURIComponent(f), from: 'static', name: f } : null
}

/** 후보 칸들 중 곡이 들어 있는 첫 칸 */
export function resolveBgm(chain: string[]): { slot: string; src: BgmSource } | null {
  for (const slot of chain) {
    const src = bgmSource(slot)
    if (src) return { slot, src }
  }
  return null
}

export async function setBgmOverride(slotId: string, file: File): Promise<void> {
  const v: Stored = { blob: file, name: `${bgmFileBase(slotId)}.${extOf(file)}` }
  await tx('readwrite', (s) => s.put(v, slotId))
  setOverride(slotId, v)
  window.dispatchEvent(new CustomEvent(EVENT))
}

export async function clearBgmOverride(slotId: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(slotId))
  setOverride(slotId, null)
  window.dispatchEvent(new CustomEvent(EVENT))
}

/** 직접 넣은 곡의 원본 파일(내려받기용) */
export const bgmOverrideFile = (slotId: string) => {
  const o = overrides.get(slotId)
  return o ? { blob: o.blob, name: o.name } : null
}

/** 배포용 목록 — 배포 파일 + 이 브라우저에 넣은 곡(같은 칸이면 넣은 곡의 파일 이름으로) */
export function buildBgmManifest(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const s of BGM_SLOTS) {
    const name = overrides.get(s.id)?.name ?? manifest[s.id]
    if (name) out[s.id] = name
  }
  return out
}

/** 짧은 효과 곡(수업 종료 등)을 배경음 위에 한 번 — 곡이 없으면 아무것도 안 한다 */
export function playBgmJingle(slotId: string, volume01: number) {
  if (typeof window === 'undefined' || volume01 <= 0) return
  void initBgm().then(() => {
    const src = bgmSource(slotId)
    if (!src) return
    const el = new Audio(src.url)
    el.volume = Math.min(1, volume01)
    el.play().catch(() => {})
  })
}

/** 곡이 바뀌면(넣기·지우기·처음 읽기) 호출 — 해제 함수를 돌려준다 */
export function onBgmChange(fn: () => void): () => void {
  window.addEventListener(EVENT, fn)
  return () => window.removeEventListener(EVENT, fn)
}
