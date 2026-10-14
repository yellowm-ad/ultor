// ============================================================================
// 몬스터 돌진(2026-10-14) — 야생 몬스터가 가끔 플레이어를 알아채고(머리 위 「!」) 달려와 부딪히면 바로 전투.
//   · 평소 위치는 lib/field wanderState(시간만으로 정해짐). 돌진 중인 몬스터만 여기서 위치를 따로 들고 있다.
//   · 단계: alert(멈춰 서서 「!」) → run(플레이어 쪽으로 달림) → 닿으면 전투 / 놓치면 retreat(집으로 돌아감) → 한동안 쉼
//   · 보스·테스트 몬스터는 돌진하지 않는다(보스는 제자리 위엄 — field.ts 배회와 같은 원칙)
//   · 렌더(iso-world)·접촉 판정(game-state MOVE)·돌진 갱신(world-screen 이동 루프)이 모두 monsterView 한 곳을 본다
// ============================================================================

import type { Blocker } from '@/lib/field'
import { wanderState } from '@/lib/field'
import { groundBlocked } from '@/lib/collision'
import { monsterById } from '@/lib/mock-data'
import type { FieldMonster, GameMap } from '@/lib/types'

type Pt = { x: number; y: number }
type Facing4 = 'down' | 'up' | 'left' | 'right'

export const CHARGE = {
  /** 알아채는 거리(칸) */
  aware: 4.2,
  /** 알아챌 수 있는 거리 안에서 1초마다 돌진을 시작할 확률 */
  chancePerSec: 0.2,
  /** 「!」 뜨고 멈춰 있는 시간 */
  alertMs: 650,
  /** 달리는 속도(칸/초) — 걷기(4.3)보다 빠르고 달리기(8.6)보다 느리다 → 달리면 따돌릴 수 있다 */
  speed: 5.4,
  /** 돌아가는 속도 */
  retreatSpeed: 2.6,
  /** 이만큼 달려도 못 잡으면 포기 */
  maxRunMs: 3200,
  /** 집에서 이만큼 멀어지면 포기 */
  leash: 8,
  /** 포기하거나 돌아온 뒤 다시 돌진하기까지 */
  cooldownMs: 9000,
  /** 닿았다고 보는 거리 */
  hitR: 0.42,
  /** 맵에 들어온 직후엔 잠깐 봐준다 */
  graceMs: 2500,
}

type Charge = { phase: 'alert' | 'run' | 'retreat'; t0: number; pos: Pt; face: Facing4 }
const charges = new Map<string, Charge>()
const cooldown = new Map<string, number>()
let mapKey = ''
let enteredAt = 0

const facingOf = (dx: number, dy: number): Facing4 => {
  // 셀 축 → 화면 방향(쿼터뷰): 화면 x = dx - dy, 화면 y = dx + dy
  const sx = dx - dy
  const sy = dx + dy
  return Math.abs(sx) > Math.abs(sy) ? (sx > 0 ? 'right' : 'left') : sy > 0 ? 'down' : 'up'
}

const BODY = 0.3
function blocked(map: GameMap, p: Pt): boolean {
  if (p.x < 0.2 || p.y < 0.2 || p.x > map.grid.w - 0.2 || p.y > map.grid.h - 0.2) return true
  for (const b of (map.blockers ?? []) as Blocker[]) if (p.x > b.x0 - BODY && p.x < b.x1 + BODY && p.y > b.y0 - BODY && p.y < b.y1 + BODY) return true
  return groundBlocked(map, p.x, p.y)
}

/** 막히면 축 하나로 미끄러지며 한 걸음 — 못 가면 null */
function step(map: GameMap, from: Pt, to: Pt, dist: number): Pt | null {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const d = Math.hypot(dx, dy)
  if (d < 1e-4) return from
  const k = Math.min(1, dist / d)
  const n = { x: from.x + dx * k, y: from.y + dy * k }
  if (!blocked(map, n)) return n
  const sx = { x: n.x, y: from.y }
  if (Math.abs(dx) > 1e-3 && !blocked(map, sx)) return sx
  const sy = { x: from.x, y: n.y }
  if (Math.abs(dy) > 1e-3 && !blocked(map, sy)) return sy
  return null
}

const canCharge = (fm: FieldMonster) => {
  const def = monsterById(fm.monsterId)
  if (!def || def.isTestMonster) return false
  return !def.rank || def.rank === 'normal' || def.rank === 'elite'
}

/** 화면에 보이는(그리고 부딪히는) 몬스터 상태 — 돌진 중이면 그 위치, 아니면 평소 배회 */
export function monsterView(fm: FieldMonster, now: number, map: GameMap, player?: Pt): { pos: Pt; facing: Facing4; moving: boolean; alert: boolean; charging: boolean } {
  const c = charges.get(fm.uid)
  if (!c) return { ...wanderState(fm, now, map.blockers as Blocker[] | undefined, player), alert: false, charging: false }
  return { pos: c.pos, facing: c.face, moving: c.phase !== 'alert', alert: c.phase === 'alert', charging: c.phase !== 'retreat' }
}

export function resetCharges() {
  charges.clear()
  cooldown.clear()
}

/**
 * 이동 루프에서 매 프레임 — 돌진을 시작·진행시키고, 플레이어에게 닿은 몬스터 uid 를 돌려준다.
 * active = 지금 돌아다닐 수 있는 상태(대화·컷신·창이 열려 있지 않음)
 */
export function tickCharges(dtSec: number, now: number, map: GameMap, monsters: FieldMonster[], player: Pt, active: boolean): string | null {
  if (map.id !== mapKey) {
    mapKey = map.id
    enteredAt = now
    resetCharges()
  }
  if (map.kind !== 'field') return null
  // 창이 열려 있는 동안은 돌진을 멈춰 둔다(닫으면 그대로 이어서)
  if (!active) return null
  const alive = new Set(monsters.map((m) => m.uid))
  for (const uid of charges.keys()) if (!alive.has(uid)) charges.delete(uid)
  let hit: string | null = null
  for (const fm of monsters) {
    const c = charges.get(fm.uid)
    if (!c) {
      if (now - enteredAt < CHARGE.graceMs || (cooldown.get(fm.uid) ?? 0) > now || !canCharge(fm)) continue
      if (Math.hypot(fm.homeCell.x - player.x, fm.homeCell.y - player.y) > CHARGE.aware + 3) continue
      const w = wanderState(fm, now, map.blockers as Blocker[] | undefined, player)
      const d = Math.hypot(w.pos.x - player.x, w.pos.y - player.y)
      if (d < CHARGE.aware && Math.random() < CHARGE.chancePerSec * dtSec) {
        charges.set(fm.uid, { phase: 'alert', t0: now, pos: w.pos, face: facingOf(player.x - w.pos.x, player.y - w.pos.y) })
      }
      continue
    }
    if (c.phase === 'alert') {
      c.face = facingOf(player.x - c.pos.x, player.y - c.pos.y)
      if (now - c.t0 >= CHARGE.alertMs) {
        c.phase = 'run'
        c.t0 = now
      }
      continue
    }
    if (c.phase === 'run') {
      const d = Math.hypot(player.x - c.pos.x, player.y - c.pos.y)
      if (d < CHARGE.hitR) {
        hit ??= fm.uid
        continue
      }
      const n = step(map, c.pos, player, CHARGE.speed * dtSec)
      const far = Math.hypot((n ?? c.pos).x - fm.homeCell.x, (n ?? c.pos).y - fm.homeCell.y) > CHARGE.leash
      if (!n || far || now - c.t0 > CHARGE.maxRunMs) {
        c.phase = 'retreat'
        c.t0 = now
        continue
      }
      c.face = facingOf(n.x - c.pos.x, n.y - c.pos.y)
      c.pos = n
      if (Math.hypot(player.x - n.x, player.y - n.y) < CHARGE.hitR) hit ??= fm.uid
      continue
    }
    // retreat — 지금 배회하고 있어야 할 자리로 걸어 돌아간다
    const home = wanderState(fm, now, map.blockers as Blocker[] | undefined).pos
    const n = step(map, c.pos, home, CHARGE.retreatSpeed * dtSec)
    if (!n || Math.hypot(home.x - c.pos.x, home.y - c.pos.y) < 0.15 || now - c.t0 > 6000) {
      charges.delete(fm.uid)
      cooldown.set(fm.uid, now + CHARGE.cooldownMs)
      continue
    }
    c.face = facingOf(n.x - c.pos.x, n.y - c.pos.y)
    c.pos = n
  }
  return hit
}
