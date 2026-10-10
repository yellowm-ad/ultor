// ============================================================================
// 퀘스트 길찾기(2026-10-10) — 이번 주에 해야 할 일 하나를 골라, 거기까지 가는 길을 바닥에 노란 반짝이로 깔아 준다.
//
//   · guideGoal   : 지금 따라갈 목표(메인 스토리 미션 → 이번 주 수업 → 수락한 의뢰 순). 목표가 있는 맵·칸까지 정한다.
//   · guideRoute  : 지금 맵에서 걸어갈 곳 — 목표가 같은 맵이면 그 칸, 다른 맵이면 그쪽으로 이어지는 포탈(맵 그래프 BFS).
//   · guidePath   : 맵 안 경로 — 목적지에서 퍼뜨린 거리장(0.5칸 격자 다익스트라)을 캐시해 두고 플레이어 자리에서 내려간다.
//   그리는 쪽은 components/game/guide-trail.tsx(안내선) · world-screen 의 목표 칩.
// ============================================================================

import type { GameMap, GameState, MapId, NpcDef, Portal, QuestObjective } from '@/lib/types'
import { MAPS } from '@/lib/maps'
import { NPCS, npcById } from '@/lib/mock-data'
import { questTemplateById } from '@/lib/quests'
import { classForWeek, classMetaFor } from '@/lib/curriculum'
import { REGIONS, regionOfMap } from '@/lib/regions'
import { schoolRoster } from '@/lib/school-roster'

export interface GuideGoal {
  /** 무엇을 하는가 — '사서 오웬과 기록 대조' */
  label: string
  /** 어디서 — '학교 도서관' */
  place: string
  kind: 'talk' | 'visit' | 'class' | 'battle' | 'life' | 'claim'
  /** 목표가 있는 맵(없으면 길 안내 없이 문구만) */
  mapId?: MapId
  /** 맵 안의 목표 칸(없으면 그 맵에 도착하는 것이 목표) */
  cell?: { x: number; y: number }
  /** 말 걸 NPC — 머리 위에 표식 */
  npcId?: string
  /** 어느 미션의 목표인가(수첩 제목) */
  quest: string
}

type S = Pick<GameState, 'weekly' | 'calendar' | 'storyFlags' | 'playerSeed' | 'currentMapId' | 'position' | 'classScene'>

const ZONE_MAP = new Map<string, MapId>()
for (const m of Object.values(MAPS)) for (const z of m.zones) if (!ZONE_MAP.has(z.id)) ZONE_MAP.set(z.id, m.id)

/** NPC 가 지금 서 있는 맵·칸(학교 동료는 이번 주 배치) */
export function npcSpot(state: S, npcId: string): { mapId: MapId; cell: { x: number; y: number } } | null {
  const fixed = NPCS.find((n) => n.id === npcId && ZONE_MAP.has(n.zoneId) && (!n.visibleFlag || !!state.storyFlags[n.visibleFlag]))
  if (fixed) return { mapId: ZONE_MAP.get(fixed.zoneId)!, cell: fixed.cell }
  const r = schoolRoster(state).find((s) => s.npcId === npcId)
  return r ? { mapId: r.mapId, cell: { x: r.x, y: r.y } } : null
}

/** 지금 맵에서 가장 가까운 사람(‘아무에게나 말 걸기’ 목표용) */
function nearestNpc(state: S): NpcDef | undefined {
  const map = MAPS[state.currentMapId]
  const here = NPCS.filter((n) => map.zones.some((z) => z.id === n.zoneId) && (!n.visibleFlag || !!state.storyFlags[n.visibleFlag]))
  const d = (n: NpcDef) => Math.hypot(n.cell.x - state.position.x, n.cell.y - state.position.y)
  return here.sort((a, b) => d(a) - d(b))[0]
}

/** 그 몬스터가 나오는 맵 */
function monsterMap(monsterId: string, regionId?: string): MapId | undefined {
  // 같은 몬스터가 여러 지역에 나오면 그 미션의 지역 맵이 먼저
  const maps = Object.values(MAPS).sort((a, b) => Number(regionOfMap(b.id) === regionId) - Number(regionOfMap(a.id) === regionId))
  return (maps.find((m) => m.bossSpawns?.some((b) => b.monsterId === monsterId)) ?? maps.find((m) => m.monsterPool?.includes(monsterId)))?.id
}

const STATION_NPC: Record<string, string> = { COOK: 'npc-kitchen', ALCHEMY: 'npc-alchemy-pot', CRAFT: 'npc-workbench' }

/** prevVisit = 같은 미션에서 앞서 '도착'하라고 한 맵 — 이어지는 전투·처치 목표는 그 자리에서 한다고 본다 */
function objectiveGoal(state: S, ob: QuestObjective, quest: string, regionId?: string, prevVisit?: MapId): GuideGoal {
  const base = { label: ob.label, quest }
  const region = REGIONS.find((r) => r.id === regionId)
  const fieldOf = () => {
    // 이미 그 지역의 야생에 있으면 길 안내 없이 문구만
    if (region && regionOfMap(state.currentMapId) === region.id && MAPS[state.currentMapId].kind === 'field') return undefined
    if (prevVisit && MAPS[prevVisit]?.kind === 'field') return prevVisit === state.currentMapId ? undefined : prevVisit
    // 지역이 정해지지 않은 전투·채집(‘아무 데서나’)은 첫 실습지인 숲으로
    return region?.maps.find((m) => MAPS[m]?.kind === 'field' && m !== 'testroom') ?? 'forest'
  }
  switch (ob.type) {
    case 'TALK': {
      if (ob.targetId === 'any') {
        const n = nearestNpc(state) ?? npcById('npc-elder')
        const spot = n && npcSpot(state, n.id)
        return { ...base, kind: 'talk', place: spot ? MAPS[spot.mapId].name : '사람이 있는 곳', mapId: spot?.mapId, cell: spot?.cell, npcId: n?.id }
      }
      const spot = npcSpot(state, ob.targetId)
      const def = npcById(ob.targetId)
      const name = def?.name ?? ''
      // 아직 그 자리에 나타나지 않은 사람(스토리 플래그 전)은 머무는 맵까지만 안내
      const home = !spot && def ? ZONE_MAP.get(def.zoneId) : undefined
      return { ...base, kind: 'talk', place: spot ? `${MAPS[spot.mapId].name} · ${name}` : home ? `${MAPS[home].name} — ${name}을(를) 찾아보자` : `${name} — 지금은 만날 수 없다`, mapId: spot?.mapId ?? home, cell: spot?.cell, npcId: ob.targetId }
    }
    case 'VISIT': {
      const m = MAPS[ob.targetId as MapId]
      return { ...base, kind: 'visit', place: m?.name ?? '', mapId: m?.id }
    }
    case 'KILL': {
      const found = ob.targetId.startsWith('family:') || ob.targetId === 'any' ? undefined : monsterMap(ob.targetId, regionId)
      // 다른 지역에서만 찾아지는 몬스터(스토리 전투로 나오는 적 등)는 앞서 도착한 맵에서
      const mapId = found && (!regionId || regionOfMap(found) === regionId) ? found : (prevVisit ?? fieldOf())
      const boss = mapId ? MAPS[mapId].bossSpawns?.find((b) => b.monsterId === ob.targetId) : undefined
      return { ...base, kind: 'battle', place: mapId ? MAPS[mapId].name : (region?.name ?? '야생'), mapId, cell: boss?.cell }
    }
    case 'WIN_BATTLE':
    case 'GATHER':
    case 'HUNT':
    case 'FISH': {
      const mapId = fieldOf()
      return { ...base, kind: ob.type === 'WIN_BATTLE' ? 'battle' : 'life', place: mapId ? MAPS[mapId].name : (region?.name ?? '야생'), mapId }
    }
    case 'COOK':
    case 'ALCHEMY':
    case 'CRAFT': {
      const spot = npcSpot(state, STATION_NPC[ob.type])
      return { ...base, kind: 'life', place: spot ? `${MAPS[spot.mapId].name} · ${npcById(STATION_NPC[ob.type])?.name}` : '제작대', mapId: spot?.mapId, cell: spot?.cell, npcId: STATION_NPC[ob.type] }
    }
    case 'PLACE_FURNITURE':
      return { ...base, kind: 'life', place: MAPS['personal-space'].name, mapId: 'personal-space' }
  }
}

// ── 따라갈 미션 고르기(학사 수첩의 '길 안내' 버튼) — 'class' 또는 퀘스트 instanceId. 브라우저에 기억 ──
const PIN_KEY = 'ultor-guide-pin'
let pinned: string | null | undefined
const pinListeners = new Set<() => void>()
export function guidePin(): string | null {
  if (pinned === undefined) {
    try {
      pinned = typeof window === 'undefined' ? null : window.localStorage.getItem(PIN_KEY)
    } catch {
      pinned = null
    }
  }
  return pinned ?? null
}
export function setGuidePin(id: string | null) {
  pinned = id
  try {
    if (id) window.localStorage.setItem(PIN_KEY, id)
    else window.localStorage.removeItem(PIN_KEY)
  } catch {
    // 저장소 접근 불가 — 이번 실행 동안만 기억
  }
  pinListeners.forEach((f) => f())
}
export function subscribeGuidePin(f: () => void) {
  pinListeners.add(f)
  return () => void pinListeners.delete(f)
}

/** 지금 따라갈 목표 — (수첩에서 고른 미션) → 메인 스토리 미션 → 이번 주 수업 → 수락한 의뢰 → 보상 수령 */
export function guideGoal(state: S, pin: string | null = null): GuideGoal | null {
  if (state.classScene) return null
  const quests = state.weekly?.quests ?? []
  const open = (q: (typeof quests)[number]) => {
    const t = questTemplateById(q.templateId)
    if (!t || q.status !== 'active') return null
    const i = t.objectives.findIndex((ob, k) => (q.progress[k] ?? 0) < ob.count)
    if (i < 0) return null
    const prev = t.objectives.slice(0, i).reverse().find((ob) => ob.type === 'VISIT')?.targetId as MapId | undefined
    return objectiveGoal(state, t.objectives[i], t.title, t.regionId, prev)
  }
  const wc = classForWeek(state.calendar.globalWeek)
  const classGoal = (): GuideGoal | null => {
    if (!wc || state.weekly?.classDone) return null
    const room = classMetaFor(wc.courseId).room
    return { label: `${wc.label} 수업 듣기`, place: `${MAPS[room].name} — 교실에 들어가면 수업이 시작된다`, kind: 'class', mapId: room, quest: '이번 주 수업' }
  }
  if (pin) {
    const q = quests.find((q) => q.instanceId === pin)
    const g = pin === 'class' ? classGoal() : q ? open(q) : null
    if (g) return g
  }
  for (const q of quests.filter((q) => q.slot === 'MAIN')) {
    const g = open(q)
    if (g) return g
  }
  const cg = classGoal()
  if (cg) return cg
  for (const q of quests.filter((q) => q.slot !== 'MAIN')) {
    const g = open(q)
    if (g) return g
  }
  const done = quests.find((q) => q.status === 'complete')
  if (done) return { label: '미션 보상 받기', place: '학사 수첩(J)', kind: 'claim', quest: questTemplateById(done.templateId)?.title ?? '' }
  return null
}

// ── 맵 사이 경로 ────────────────────────────────────────────────────────────────
/** 지금 맵에서 목표 맵으로 가려면 타야 하는 포탈(맵 그래프 BFS) + 거쳐 갈 맵 이름들 */
export function nextPortal(from: MapId, to: MapId): { portal: Portal; via: MapId[] } | null {
  if (from === to) return null
  const prev = new Map<MapId, { map: MapId; portal: Portal }>()
  const queue: MapId[] = [from]
  const seen = new Set<MapId>([from])
  while (queue.length) {
    const cur = queue.shift()!
    if (cur === to) break
    for (const p of MAPS[cur]?.portals ?? []) {
      if (seen.has(p.to) || !MAPS[p.to]) continue
      seen.add(p.to)
      prev.set(p.to, { map: cur, portal: p })
      queue.push(p.to)
    }
  }
  if (!prev.has(to)) return null
  const via: MapId[] = []
  let at = to
  let first = prev.get(to)!
  while (at !== from) {
    const s = prev.get(at)!
    via.unshift(at)
    first = s
    at = s.map
  }
  return { portal: first.portal, via }
}

export interface GuideRoute {
  /** 지금 맵에서 걸어갈 칸 */
  target: { x: number; y: number } | null
  /** 그 칸이 다른 맵으로 가는 포탈이면 */
  portal?: Portal
  /** 화면에 보여 줄 한 줄 — '군 통문 → 에르디아 숲 → 깊은 숲' */
  hint: string
  /** 목표가 지금 맵에 있는가 */
  here: boolean
}

export function guideRoute(state: Pick<GameState, 'currentMapId'>, goal: GuideGoal): GuideRoute {
  if (!goal.mapId) return { target: null, hint: goal.place, here: false }
  if (goal.mapId === state.currentMapId) return { target: goal.cell ?? null, hint: goal.place, here: true }
  const hop = nextPortal(state.currentMapId, goal.mapId)
  if (!hop) return { target: null, hint: goal.place, here: false }
  const p = hop.portal
  const target = p.walkArea ? { x: (p.walkArea.x0 + p.walkArea.x1) / 2, y: (p.walkArea.y0 + p.walkArea.y1) / 2 } : p.cell
  const names = hop.via.map((m) => MAPS[m].name)
  const first = p.kind === 'gate' ? `군 통문에서 「${p.label}」 선택` : p.secret ? `${p.label}(가까이에서 E)` : p.label
  return { target, portal: p, hint: [first, ...names.slice(1)].join(' → '), here: false }
}

// ── 맵 안 경로 ──────────────────────────────────────────────────────────────────
const RES = 2 // 한 칸을 2×2 로 쪼갠 격자
const BODY = 0.3
const fieldCache = new Map<string, { w: number; h: number; dist: Float64Array }>()

function walkGrid(map: GameMap): { w: number; h: number; ok: Uint8Array } {
  const w = map.grid.w * RES + 1
  const h = map.grid.h * RES + 1
  const ok = new Uint8Array(w * h)
  const bl = map.blockers ?? []
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const x = i / RES
      const y = j / RES
      if (x < 0.2 || y < 0.2 || x > map.grid.w - 0.2 || y > map.grid.h - 0.2) continue
      if (bl.some((r) => x > r.x0 - BODY && x < r.x1 + BODY && y > r.y0 - BODY && y < r.y1 + BODY)) continue
      const t = map.tileAt?.(x, y)
      if (t === 'academy-void' || (map.kind === 'field' && t === 'demon-lava')) continue
      ok[j * w + i] = 1
    }
  return { w, h, ok }
}

/** 목적지에서 퍼뜨린 거리장 — 막힌 목적지(가게 안 NPC·포탈)는 둘레 1.2칸 안의 설 수 있는 칸들을 시작점으로 */
function distField(map: GameMap, goal: { x: number; y: number }) {
  const key = `${map.id}|${goal.x.toFixed(1)},${goal.y.toFixed(1)}|${map.blockers?.length ?? 0}`
  const hit = fieldCache.get(key)
  if (hit) return hit
  const { w, h, ok } = walkGrid(map)
  const dist = new Float64Array(w * h).fill(Infinity)
  // 이진 힙(거리, 칸)
  const heap: number[] = []
  const hd: number[] = []
  const push = (d: number, n: number) => {
    let i = heap.length
    heap.push(n)
    hd.push(d)
    while (i > 0) {
      const p = (i - 1) >> 1
      if (hd[p] <= d) break
      heap[i] = heap[p]; hd[i] = hd[p]
      heap[p] = n; hd[p] = d
      i = p
    }
  }
  const pop = () => {
    const n = heap[0]
    const ln = heap.pop()!
    const ld = hd.pop()!
    if (heap.length) {
      let i = 0
      heap[0] = ln; hd[0] = ld
      for (;;) {
        const l = i * 2 + 1, r = l + 1
        let m = i
        if (l < heap.length && hd[l] < hd[m]) m = l
        if (r < heap.length && hd[r] < hd[m]) m = r
        if (m === i) break
        const tn = heap[i], td = hd[i]
        heap[i] = heap[m]; hd[i] = hd[m]
        heap[m] = tn; hd[m] = td
        i = m
      }
    }
    return n
  }
  for (let rad = 0.6; rad <= 3.1 && heap.length === 0; rad += 0.6) {
    for (let j = Math.max(0, Math.floor((goal.y - rad) * RES)); j <= Math.min(h - 1, Math.ceil((goal.y + rad) * RES)); j++)
      for (let i = Math.max(0, Math.floor((goal.x - rad) * RES)); i <= Math.min(w - 1, Math.ceil((goal.x + rad) * RES)); i++) {
        const d = Math.hypot(i / RES - goal.x, j / RES - goal.y)
        if (d > rad || !ok[j * w + i]) continue
        dist[j * w + i] = d
        push(d, j * w + i)
      }
  }
  const STEP = 1 / RES
  while (heap.length) {
    const dn = hd[0]
    const n = pop()
    if (dn > dist[n]) continue
    const i = n % w, j = (n - i) / w
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue
        const ni = i + di, nj = j + dj
        if (ni < 0 || nj < 0 || ni >= w || nj >= h || !ok[nj * w + ni]) continue
        // 모서리를 끼고 대각으로 빠져나가지 않는다
        if (di && dj && (!ok[j * w + ni] || !ok[nj * w + i])) continue
        const nd = dn + (di && dj ? STEP * 1.4142 : STEP)
        if (nd < dist[nj * w + ni]) {
          dist[nj * w + ni] = nd
          push(nd, nj * w + ni)
        }
      }
  }
  const out = { w, h, dist }
  if (fieldCache.size > 12) fieldCache.delete(fieldCache.keys().next().value!)
  fieldCache.set(key, out)
  return out
}

/** 플레이어 자리 → 목적지까지의 길(셀 좌표 점들, 최대 maxLen 칸). 길이 없으면 빈 배열 */
export function guidePath(map: GameMap, from: { x: number; y: number }, goal: { x: number; y: number }, maxLen = 26): { x: number; y: number }[] {
  const { w, h, dist } = distField(map, goal)
  let i = Math.round(from.x * RES), j = Math.round(from.y * RES)
  // 서 있는 칸이 격자상 막혀 있으면(벽에 바짝 붙음) 둘레에서 가장 가까운 열린 칸부터
  if (!(dist[j * w + i] < Infinity)) {
    let best = -1
    for (let dj = -2; dj <= 2; dj++)
      for (let di = -2; di <= 2; di++) {
        const ni = i + di, nj = j + dj
        if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue
        if (dist[nj * w + ni] < Infinity && (best < 0 || dist[nj * w + ni] < dist[best])) best = nj * w + ni
      }
    if (best < 0) return []
    i = best % w
    j = (best - i) / w
  }
  const pts: { x: number; y: number }[] = [{ x: from.x, y: from.y }]
  for (let n = 0; n < maxLen * RES; n++) {
    const d0 = dist[j * w + i]
    if (d0 < 0.8) break
    let bi = i, bj = j, bd = d0
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        const ni = i + di, nj = j + dj
        if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue
        // 모서리를 끼고 대각으로 빠지는 칸은 건너뛴다(거리장을 만들 때와 같은 규칙)
        if (di && dj && !(dist[j * w + ni] < Infinity && dist[nj * w + i] < Infinity)) continue
        const d = dist[nj * w + ni]
        if (d < bd) { bd = d; bi = ni; bj = nj }
      }
    if (bi === i && bj === j) break
    i = bi
    j = bj
    pts.push({ x: i / RES, y: j / RES })
  }
  // 계단 모양을 한 번 둥글린다(Chaikin)
  if (pts.length < 3) return pts
  const sm: { x: number; y: number }[] = [pts[0]]
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k], b = pts[k + 1]
    sm.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 })
  }
  sm.push(pts[pts.length - 1])
  return sm
}
