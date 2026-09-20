import type { FieldMonster, GameMap, MonsterDef, NpcDef } from '@/lib/types'
import { MONSTERS, monsterById, monstersForZoneKind } from '@/lib/mock-data'
import { mulberry32 } from '@/lib/rng'

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

  const place = (id: string, cx: number, cy: number, prefix: string) => {
    let home = { x: cx + rand() * 0.8 + 0.1, y: cy + rand() * 0.8 + 0.1 }
    for (let attempt = 0; attempt < 6; attempt++) {
      const tooClose = result.some((r) => Math.hypot(r.homeCell.x - home.x, r.homeCell.y - home.y) < spacing)
      if (!tooClose) break
      home = { x: cx + rand() * 0.8 + 0.1, y: cy + rand() * 0.8 + 0.1 }
    }
    result.push({
      uid: `${prefix}-${uidCounter++}`,
      monsterId: id,
      cell: { ...home },
      homeCell: { ...home },
      wanderSeed: Math.floor(rand() * 100000),
    })
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
    place(testMonster.id, Math.floor(map.spawn.x) - 1, Math.floor(map.spawn.y) - 1, 'fm-test')
  }

  // 중간보스/필드보스 — 랜덤 풀과 별개로 지정된 위치에 항상 고정 배치(재입장 시 재도전 가능)
  if (map.bossSpawns) {
    for (const boss of map.bossSpawns) place(boss.monsterId, Math.floor(boss.cell.x), Math.floor(boss.cell.y), 'fm-boss')
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

/** 배회 애니메이션: 홈 셀 주변을 실제로 걷는 것처럼 맴도는 위치 계산 (시간 기반, 결정론적) */
export function wanderPosition(fm: FieldMonster, timeMs: number, blockers?: Blocker[]): { x: number; y: number } {
  const t = timeMs / 1000 + fm.wanderSeed
  const { effectiveT } = pauseCycle(t, 7, 0.6)
  const radius = 1.1
  const speed = 0.22
  const pos = {
    x: fm.homeCell.x + Math.cos(effectiveT * speed) * radius,
    y: fm.homeCell.y + Math.sin(effectiveT * speed * 1.35) * radius * 0.85,
  }
  return avoidBlockers(pos, fm.homeCell, blockers, MONSTER_BODY_R)
}

/** 지금 이 순간 걷는 중인지(정지 구간이면 false) — CreatureSprite의 walking prop에 그대로 연결 */
export function wanderIsMoving(fm: FieldMonster, timeMs: number): boolean {
  return pauseCycle(timeMs / 1000 + fm.wanderSeed, 7, 0.6).moving
}

/** wanderPosition의 순간 이동 방향(도트 스프라이트 걷기용, down/up/left/right). 정지 중엔 정면(down) */
export function wanderFacing(fm: FieldMonster, timeMs: number, blockers?: Blocker[]): 'down' | 'up' | 'left' | 'right' {
  const a = wanderPosition(fm, timeMs, blockers)
  const b = wanderPosition(fm, timeMs + 100, blockers)
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return 'down'
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
}

function facingFromDelta(dx: number, dy: number): 'down' | 'up' | 'left' | 'right' {
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return 'down'
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
}

/**
 * wanderPosition/wanderFacing/wanderIsMoving을 렌더 프레임마다 각각 따로 부르면
 * pauseCycle·avoidBlockers 가 3배로 중복 계산된다(iso-world.tsx가 몬스터마다 매 틱 호출).
 * 같은 값을 한 번만 계산해 세 결과를 함께 돌려주는 합本(合本) 버전 — 결과는 기존 함수들과 100% 동일.
 */
export function wanderState(
  fm: FieldMonster,
  timeMs: number,
  blockers?: Blocker[],
): { pos: { x: number; y: number }; facing: 'down' | 'up' | 'left' | 'right'; moving: boolean } {
  const t = timeMs / 1000 + fm.wanderSeed
  const { effectiveT, moving } = pauseCycle(t, 7, 0.6)
  const radius = 1.1
  const speed = 0.22
  const pos = avoidBlockers(
    { x: fm.homeCell.x + Math.cos(effectiveT * speed) * radius, y: fm.homeCell.y + Math.sin(effectiveT * speed * 1.35) * radius * 0.85 },
    fm.homeCell,
    blockers,
    MONSTER_BODY_R,
  )
  const next = wanderPosition(fm, timeMs + 100, blockers)
  return { pos, facing: facingFromDelta(next.x - pos.x, next.y - pos.y), moving }
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

/** 작업대 등 사람이 아닌 오브젝트형 NPC — 완전히 고정, 배회 애니메이션 없음 */
const NPC_STATIC_ROLES = new Set(['craftStation'])

/** NPC 배회 반경(그리드 셀) — 자기 발밑 넓이(~1셀)의 16배 면적 ≈ 선형 4배 → flavor는 반경 2셀. */
export function npcWanderRadius(npc: NpcDef): number {
  if (NPC_STATIC_ROLES.has(npc.role)) return 0
  return NPC_FULL_ROAM_ROLES.has(npc.role) ? 2.0 : 0.4
}

const NPC_BODY_R = 0.28

export function npcWanderPosition(npc: NpcDef, timeMs: number, blockers?: Blocker[]): { x: number; y: number } {
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
