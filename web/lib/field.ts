import type { FieldMonster, GameMap, MonsterDef, NpcDef } from '@/lib/types'
import { MONSTERS, monsterById, monstersForZoneKind } from '@/lib/mock-data'
import { mulberry32 } from '@/lib/rng'
import { poolBlocks } from '@/lib/terrain'

/** 맵 id 별로 고정 시드를 뽑아 배치가 재현되도록 한다 */
function seedForMap(mapId: string): number {
  let h = 20260828
  for (let i = 0; i < mapId.length; i++) h = (h * 31 + mapId.charCodeAt(i)) | 0
  return h >>> 0
}

/**
 * 현재 맵의 필드 몬스터 배치.
 * field 맵의 각 셀에 density 만큼 실제 몬스터 풀에서 배치. 테스트용 허수아비는 셀마다
 * 흩뿌리지 않고, 접근성 테스트용으로 스폰 지점(입구) 바로 근처에 딱 1마리만 남긴다.
 * town 맵(마을·아틀란티스)은 항상 빈 배열.
 */
export function generateFieldMonsters(map: GameMap, testMode: boolean): FieldMonster[] {
  if (map.kind !== 'field') return []

  // 관리자 테스트룸 — 랜덤 배치 대신 실존 몬스터 전종을 그리드에 결정론적으로 1마리씩.
  if (map.id === 'testroom') {
    const cols = 6
    return MONSTERS.filter((m) => !m.isTestMonster).map((m, i) => ({
      uid: `tr-${m.id}`,
      monsterId: m.id,
      cell: { x: 3 + (i % cols) * 3, y: 18 + Math.floor(i / cols) * 3 },
      homeCell: { x: 3 + (i % cols) * 3, y: 18 + Math.floor(i / cols) * 3 },
      wanderSeed: i * 137,
    }))
  }

  const pool: MonsterDef[] = map.monsterPool
    ? map.monsterPool.map(monsterById).filter((m): m is MonsterDef => !!m)
    : monstersForZoneKind(map.monsterZoneKind ?? 'field')

  const rand = mulberry32(seedForMap(map.id))
  const result: FieldMonster[] = []
  let uidCounter = 0
  // 셀당 기대 마리수(소수 허용). 12×10 맵에서 0.28 ≈ 34마리.
  const density = map.monsterDensity ?? 0.28
  // 몬스터끼리 이 거리보다 가까우면 재배치 시도 — 배치가 뭉치지 않고 퍼지게 한다.
  const spacing = map.monsterSpacing ?? 1.2
  const testMonster = MONSTERS.find((m) => m.isTestMonster)

  const rollCount = (d: number) => Math.floor(d) + (rand() < d % 1 ? 1 : 0)

  // 넓어진 맵에서 몹이 뭉치지 않도록: 서로 spacing 이상 · 스폰/포탈 주변 비움 · 길 위는 피함.
  // 셀 안에서 못 찾으면 주변 2셀까지 흔들어 보고, 끝내 자리가 없으면 그 마리는 건너뛴다.
  const clearOf = (x: number, y: number) =>
    Math.hypot(x - map.spawn.x, y - map.spawn.y) > 3.2 &&
    map.portals.every((p) => Math.hypot(p.cell.x - x, p.cell.y - y) > 2.4) &&
    !(map.roadAt?.(x, y) ?? false) &&
    !poolBlocks(map.terrain?.pool(x, y)) &&
    !result.some((r) => Math.hypot(r.homeCell.x - x, r.homeCell.y - y) < spacing)
  const place = (id: string, cx: number, cy: number, prefix: string, force = false) => {
    let home = { x: cx + rand() * 0.8 + 0.1, y: cy + rand() * 0.8 + 0.1 }
    let ok = force || clearOf(home.x, home.y)
    for (let attempt = 0; !ok && attempt < 10; attempt++) {
      const x = Math.min(map.grid.w - 0.6, Math.max(0.6, cx + 0.5 + (rand() - 0.5) * 4))
      const y = Math.min(map.grid.h - 0.6, Math.max(0.6, cy + 0.5 + (rand() - 0.5) * 4))
      home = { x, y }
      ok = clearOf(x, y)
    }
    if (!ok) return
    result.push({
      uid: `${prefix}-${uidCounter++}`,
      monsterId: id,
      cell: { ...home },
      homeCell: { ...home },
      wanderSeed: Math.floor(rand() * 100000),
    })
  }

  // 중간보스/필드보스 — 먼저 고정 배치(일반 몹 간격 판정에 밀려 빠지지 않게). 재입장 시 재도전 가능
  if (map.bossSpawns) {
    for (const boss of map.bossSpawns) place(boss.monsterId, Math.floor(boss.cell.x), Math.floor(boss.cell.y), 'fm-boss', true)
  }

  if (pool.length > 0) {
    for (let cx = 0; cx < map.grid.w; cx++) {
      for (let cy = 0; cy < map.grid.h; cy++) {
        const n = rollCount(density)
        for (let i = 0; i < n; i++) place(pool[Math.floor(rand() * pool.length)].id, cx, cy, 'fm')
      }
    }
  }

  if (testMode && testMonster) {
    // 입구(스폰 지점) 바로 근처에 테스트용 허수아비 1마리만 배치
    place(testMonster.id, Math.floor(map.spawn.x) - 1, Math.floor(map.spawn.y) - 1, 'fm-test', true)
  }

  return result
}

type Blocker = { x0: number; y0: number; x1: number; y1: number }

/**
 * 배회 위치가 구조물(blocker) 안으로 파고들면 집(home) 위치로 되돌린다 —
 * 몬스터/NPC가 나무·건물을 뚫고 걷는 것처럼 보이는 걸 막는 저비용 방지책.
 * 정교한 경로탐색 대신 "막히면 그 프레임은 집에 서 있는다" 방식이라 부드럽지는 않지만,
 * 배회 반경이 작고(1.1~2.0셀) blocker 는 드물게 겹치므로 시각적으로 자연스럽다.
 */
function avoidBlockers(pos: { x: number; y: number }, home: { x: number; y: number }, blockers: Blocker[] | undefined, r: number): { x: number; y: number } {
  if (!blockers || blockers.length === 0) return pos
  for (const b of blockers) {
    if (pos.x > b.x0 - r && pos.x < b.x1 + r && pos.y > b.y0 - r && pos.y < b.y1 + r) return home
  }
  return pos
}

const MONSTER_BODY_R = 0.3

/**
 * 쉴 새 없이 움직이면 기괴해 보여서, "한동안 걷다 잠깐 멈춰 서기"를 주기적으로 반복하게 만드는
 * 공용 시간 변환. 이동 구간에서는 실제 시간을 그대로 쓰고, 정지 구간에서는 이동 구간이 끝난
 * 시점의 시간에 멈춰 세워(effectiveT 고정) 위치가 그대로 붙박이가 되게 한다.
 */
function pauseCycle(t: number, period: number, moveFrac: number): { effectiveT: number; moving: boolean } {
  const cyclePos = t % period
  const moveEnd = period * moveFrac
  if (cyclePos < moveEnd) return { effectiveT: t, moving: true }
  return { effectiveT: t - cyclePos + moveEnd, moving: false }
}

// ── 몬스터 배회(2026-10-07 개편) ────────────────────────────────────────────────
// 예전: 모든 몬스터가 같은 속도·같은 모양(리사주 곡선)으로 맴돌고, 구조물에 닿으면 집으로 순간이동했다.
// 지금: 몬스터마다 정해진 박자(4~6.5초)로 "집 주변의 다음 지점"을 골라 걸어가고(가속·감속), 도착하면 잠깐 서서 두리번거린다.
//   · 다음 지점은 막힌 곳(나무·연못·건물)을 피해 고른다 → 순간이동 없음
//   · 플레이어가 가까이 오면(3.2칸) 고개를 돌려 조금 다가온다(집에서 너무 멀어지지 않게) — 보스는 제자리 위엄 유지
//   · 전부 시간·시드만으로 정해져서(상태 없음) 렌더와 접촉 판정이 같은 위치를 본다(game-state MOVE)
type Pt2 = { x: number; y: number }
type Facing4 = 'down' | 'up' | 'left' | 'right'

const hash01 = (a: number, b: number, c = 0) => {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2246822519)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const smooth = (t: number) => t * t * (3 - 2 * t)
const blockedAt = (p: Pt2, blockers: Blocker[] | undefined, r: number) => !!blockers?.some((b) => p.x > b.x0 - r && p.x < b.x1 + r && p.y > b.y0 - r && p.y < b.y1 + r)

interface WanderProfile {
  /** 한 박자(초) — 걷기 + 쉬기 */
  slot: number
  /** 걷는 속도(칸/초) */
  speed: number
  /** 집에서 돌아다니는 반경(칸) */
  radius: number
  /** 플레이어에게 다가오는가 */
  curious: boolean
}
const PROFILE_CACHE = new Map<string, WanderProfile>()
function profileOf(fm: FieldMonster): WanderProfile {
  const key = `${fm.uid}:${fm.monsterId}`
  const hit = PROFILE_CACHE.get(key)
  if (hit) return hit
  const p = makeProfile(fm)
  if (PROFILE_CACHE.size > 2000) PROFILE_CACHE.clear()
  PROFILE_CACHE.set(key, p)
  return p
}
function makeProfile(fm: FieldMonster): WanderProfile {
  const s = Math.floor(fm.wanderSeed * 1000)
  const rank = monsterRank(fm.monsterId)
  const boss = rank === 'fieldBoss' || rank === 'storyBoss' || rank === 'miniBoss'
  return {
    slot: 4 + hash01(s, 11) * 2.5,
    speed: (boss ? 0.35 : 0.55) + hash01(s, 13) * 0.45,
    radius: boss ? 0.7 : 1.2 + hash01(s, 17) * 0.5,
    curious: !boss,
  }
}

/** 몬스터 등급(보스는 덜 움직이고 다가오지 않는다) */
const monsterRank = (id: string): string | undefined => monsterById(id)?.rank

/** k번째 박자의 목적지 — 막힌 곳이면 다른 후보, 끝내 없으면 집 */
const WP_CACHE = new Map<string, Pt2>()
function waypoint(fm: FieldMonster, k: number, pr: WanderProfile, blockers: Blocker[] | undefined): Pt2 {
  const key = `${fm.uid}:${fm.homeCell.x.toFixed(2)}:${k}`
  const hit = WP_CACHE.get(key)
  if (hit) return hit
  const s = Math.floor(fm.wanderSeed * 1000)
  let out: Pt2 = fm.homeCell
  for (let tries = 0; tries < 6; tries++) {
    const a = hash01(s, k, tries * 2 + 1) * Math.PI * 2
    const r = pr.radius * Math.sqrt(0.15 + 0.85 * hash01(s, k, tries * 2 + 2))
    const p = { x: fm.homeCell.x + Math.cos(a) * r, y: fm.homeCell.y + Math.sin(a) * r * 0.85 }
    if (!blockedAt(p, blockers, MONSTER_BODY_R)) {
      out = p
      break
    }
  }
  if (WP_CACHE.size > 4000) WP_CACHE.clear()
  WP_CACHE.set(key, out)
  return out
}

/** 플레이어를 신경 쓰지 않은 기본 배회 위치 */
function basePos(fm: FieldMonster, tSec: number, pr: WanderProfile, blockers: Blocker[] | undefined): { pos: Pt2; moving: boolean; dir: Pt2 } {
  const t = tSec + fm.wanderSeed * 37
  const k = Math.floor(t / pr.slot)
  const local = t - k * pr.slot
  const from = waypoint(fm, k - 1, pr, blockers)
  const to = waypoint(fm, k, pr, blockers)
  const dist = Math.hypot(to.x - from.x, to.y - from.y)
  const moveT = Math.min(pr.slot * 0.65, Math.max(0.4, dist / pr.speed))
  const dir = { x: to.x - from.x, y: to.y - from.y }
  if (local >= moveT) return { pos: to, moving: false, dir }
  const e = smooth(local / moveT)
  return { pos: { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e }, moving: dist > 0.05, dir }
}

const AWARE_R = 3.2
const facingFromDelta = (dx: number, dy: number): Facing4 => facingOf({ x: dx, y: dy })
function facingOf(v: Pt2): Facing4 {
  if (Math.abs(v.x) < 1e-6 && Math.abs(v.y) < 1e-6) return 'down'
  return Math.abs(v.x) > Math.abs(v.y) ? (v.x > 0 ? 'right' : 'left') : v.y > 0 ? 'down' : 'up'
}

/**
 * 몬스터 위치·방향·걷는 중 여부 — 렌더(iso-world)와 접촉 판정(game-state MOVE)이 같은 값을 쓴다.
 * player 를 주면 가까울 때 그쪽을 보고 조금 다가온다.
 */
export function wanderState(fm: FieldMonster, timeMs: number, blockers?: Blocker[], player?: Pt2): { pos: Pt2; facing: Facing4; moving: boolean } {
  const pr = profileOf(fm)
  const base = basePos(fm, timeMs / 1000, pr, blockers)
  let pos = base.pos
  let moving = base.moving
  let face = base.dir
  if (player && pr.curious) {
    const dx = player.x - pos.x
    const dy = player.y - pos.y
    const d = Math.hypot(dx, dy)
    if (d < AWARE_R && d > 0.01) {
      // 가까울수록 더 다가온다(최대 0.6칸) — 단, 집에서 반경+0.9칸 밖으로는 안 나간다
      const pull = (1 - d / AWARE_R) * 0.6
      let p = { x: pos.x + (dx / d) * pull, y: pos.y + (dy / d) * pull }
      const hx = p.x - fm.homeCell.x
      const hy = p.y - fm.homeCell.y
      const hd = Math.hypot(hx, hy)
      const lim = pr.radius + 0.9
      if (hd > lim) p = { x: fm.homeCell.x + (hx / hd) * lim, y: fm.homeCell.y + (hy / hd) * lim }
      if (!blockedAt(p, blockers, MONSTER_BODY_R)) {
        pos = p
        moving = moving || pull > 0.08
      }
      face = { x: dx, y: dy }
    }
  }
  return { pos, facing: facingOf(face), moving }
}

/** 예전 API 호환 — 위치만 */
export function wanderPosition(fm: FieldMonster, timeMs: number, blockers?: Blocker[]): Pt2 {
  return wanderState(fm, timeMs, blockers).pos
}
export function wanderIsMoving(fm: FieldMonster, timeMs: number): boolean {
  return wanderState(fm, timeMs).moving
}
export function wanderFacing(fm: FieldMonster, timeMs: number, blockers?: Blocker[]): Facing4 {
  return wanderState(fm, timeMs, blockers).facing
}


// ── NPC 자유 이동(배회) ── npc.cell(홈 위치) 주변을 몬스터와 동일한 방식(결정론적 리사주 곡선)으로
// 맴돈다. 상점/훈련 등 기능형 NPC는 카운터를 이탈하면 상호작용이 어려워지므로 반경을 아주 작게(제자리
// 서성임) 두고, flavor(장식용 주민) NPC만 넓게 돌아다니게 한다.
const NPC_FULL_ROAM_ROLES = new Set(['flavor'])

function npcSeed(id: string): number {
  let h = 20260909
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return h >>> 0
}

/** 사람이 아닌 오브젝트형 NPC — 완전히 고정(roam 을 직접 주면 그 값). 제작 장인은 사람이 되어 roam 을 갖는다 */
const NPC_STATIC_ROLES = new Set(['craftStation'])

/** NPC 배회 반경(그리드 셀) — 자기 발밑 넓이(~1셀)의 16배 면적 ≈ 선형 4배 → flavor는 반경 2셀. */
export function npcWanderRadius(npc: NpcDef): number {
  if (npc.roam != null) return npc.roam
  if (NPC_STATIC_ROLES.has(npc.role)) return 0
  return NPC_FULL_ROAM_ROLES.has(npc.role) ? 2.0 : 0.4
}

const NPC_BODY_R = 0.28

/** 순찰(NpcDef.patrol) — 한쪽 끝에서 쉬고 → 걸어가고 → 반대쪽에서 쉬고 → 돌아온다 */
const PATROL_SPEED = 0.85 // 칸/초
const PATROL_REST = 4
function patrolState(npc: NpcDef, timeMs: number): { pos: { x: number; y: number }; dx: number; dy: number; moving: boolean } {
  const [a, b] = npc.patrol!
  const walk = Math.hypot(b.x - a.x, b.y - a.y) / PATROL_SPEED
  const phase = (timeMs / 1000 + (npcSeed(npc.id) % 17)) % (2 * (walk + PATROL_REST))
  const at = (k: number) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k })
  if (phase < PATROL_REST) return { pos: a, dx: b.x - a.x, dy: b.y - a.y, moving: false }
  if (phase < PATROL_REST + walk) return { pos: at((phase - PATROL_REST) / walk), dx: b.x - a.x, dy: b.y - a.y, moving: true }
  if (phase < 2 * PATROL_REST + walk) return { pos: b, dx: a.x - b.x, dy: a.y - b.y, moving: false }
  return { pos: at(1 - (phase - 2 * PATROL_REST - walk) / walk), dx: a.x - b.x, dy: a.y - b.y, moving: true }
}

export function npcWanderPosition(npc: NpcDef, timeMs: number, blockers?: Blocker[]): { x: number; y: number } {
  if (npc.patrol) return patrolState(npc, timeMs).pos
  const seed = npcSeed(npc.id)
  const t = timeMs / 1000 + (seed % 1000)
  const { effectiveT } = pauseCycle(t, 6 + (seed % 4), 0.55)
  const radius = npcWanderRadius(npc)
  const speed = 0.14 + (seed % 53) / 1000 // NPC마다 살짝 다른 속도로 동기화된 움직임 방지
  const pos = {
    x: npc.cell.x + Math.cos(effectiveT * speed) * radius,
    y: npc.cell.y + Math.sin(effectiveT * speed * 1.35) * radius * 0.85,
  }
  return avoidBlockers(pos, npc.cell, blockers, NPC_BODY_R)
}

/** 지금 이 순간 걷는 중인지(정지 구간이면 false) — NpcSprite의 walking prop에 그대로 연결 */
export function npcWanderIsMoving(npc: NpcDef, timeMs: number): boolean {
  const seed = npcSeed(npc.id)
  const t = timeMs / 1000 + (seed % 1000)
  return pauseCycle(t, 6 + (seed % 4), 0.55).moving
}

/** npcWanderPosition의 순간 이동 방향(도트 스프라이트 걷기용) */
export function npcWanderFacing(npc: NpcDef, timeMs: number, blockers?: Blocker[]): 'down' | 'up' | 'left' | 'right' {
  const a = npcWanderPosition(npc, timeMs, blockers)
  const b = npcWanderPosition(npc, timeMs + 100, blockers)
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return 'down'
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
}

/** npcWanderPosition/Facing/IsMoving 3중 호출로 인한 pauseCycle·avoidBlockers 중복 계산을 합쳐 한 번만 — wanderState와 동일 취지 */
export function npcWanderState(
  npc: NpcDef,
  timeMs: number,
  blockers?: Blocker[],
): { pos: { x: number; y: number }; facing: 'down' | 'up' | 'left' | 'right'; moving: boolean } {
  if (npc.patrol) {
    const p = patrolState(npc, timeMs)
    return { pos: p.pos, facing: p.moving ? facingFromDelta(p.dx, p.dy) : 'down', moving: p.moving }
  }
  const seed = npcSeed(npc.id)
  const t = timeMs / 1000 + (seed % 1000)
  const { effectiveT, moving } = pauseCycle(t, 6 + (seed % 4), 0.55)
  const radius = npcWanderRadius(npc)
  const speed = 0.14 + (seed % 53) / 1000
  const pos = avoidBlockers(
    { x: npc.cell.x + Math.cos(effectiveT * speed) * radius, y: npc.cell.y + Math.sin(effectiveT * speed * 1.35) * radius * 0.85 },
    npc.cell,
    blockers,
    NPC_BODY_R,
  )
  const next = npcWanderPosition(npc, timeMs + 100, blockers)
  return { pos, facing: facingFromDelta(next.x - pos.x, next.y - pos.y), moving }
}
