// ============================================================================
// 야생 전투맵 구성표 — 지역별  기본 1 → 기본 2 → 기본 3(갈림길: 특수 A · 특수 B · 마을)
//
// 포탈 방향: 앞 맵 출구 변의 "반대편"이 다음 맵 입구. 출구 변은 맵마다 동서남북으로 흩었고,
// 입구와 직각인 출구(꺾는 길)를 섞어 일직선 진행이 되지 않게 했다.
// requiredLevel 은 안내용(입장 제한 아님). 레벨은 100레벨 축.
// ============================================================================

import type { MapId } from '@/lib/types'
import { buildFieldMap, oppositeSide, type BuiltFieldMap, type FieldMapSpec, type Side } from '@/lib/field-maps'

/** 마을 군 통문 앞(야생 1단계 → 마을 복귀 위치) */
export const VILLAGE_GATE_ARRIVAL = { x: 43.5, y: 35.4 }

type Node = Omit<FieldMapSpec, 'entry' | 'exits'> & {
  entryLabel: string
  exits: { to: MapId; side: Side; t: number; label: string; requiredLevel?: number; kind?: 'portal' | 'exit' }[]
}

// 한 지역의 맵 목록 — 부모가 자식보다 먼저 와야 한다(입구 방향·귀환 위치를 부모에서 계산)
const REGION_TREES: { root: MapId; nodes: Node[] }[] = [
  // ── 에르디아 (마을 없음 → 갈림길은 특수맵 둘) ────────────────────────────────
  {
    root: 'forest',
    nodes: [
      { id: 'forest', name: '에르디아 숲', bg: 'forest', theme: 'forest1', entryLabel: '마을로 돌아가기', exits: [{ to: 'forest-2', side: 'E', t: 0.35, label: '깊은 숲으로', requiredLevel: 5 }], monsterPool: ['mon-field-mouse', 'mon-glow-moth', 'mon-field-mouse', 'mon-forest-raccoon'], recommendedLevel: 3, seed: 11001 },
      { id: 'forest-2', name: '에르디아 깊은 숲', bg: 'forest', theme: 'forest2', entryLabel: '숲 어귀로', exits: [{ to: 'forest-3', side: 'N', t: 0.62, label: '고목숲으로', requiredLevel: 9 }], monsterPool: ['mon-forest-raccoon', 'mon-thorn-vine', 'mon-sprite-green', 'mon-glow-moth'], recommendedLevel: 5, seed: 11002 },
      {
        id: 'forest-3', name: '에르디아 고목숲', bg: 'forest', theme: 'forest3', entryLabel: '깊은 숲으로',
        exits: [
          { to: 'cave', side: 'N', t: 0.72, label: '이끼 동굴', requiredLevel: 13 },
          { to: 'swamp', side: 'W', t: 0.3, label: '안개 늪지', requiredLevel: 15 },
          { to: 'village', side: 'E', t: 0.7, label: '마을 귀환 마법진', kind: 'exit' },
        ],
        monsterPool: ['mon-sprite-green', 'mon-grey-wolf', 'mon-mush-cap', 'mon-thorn-vine'], boss: 'mon-thorn-matriarch', recommendedLevel: 9, seed: 11003,
      },
      { id: 'cave', name: '이끼 동굴', bg: 'cave', theme: 'cave', special: true, entryLabel: '고목숲으로', exits: [], monsterPool: ['mon-mush-cap', 'mon-bark-golem', 'mon-grey-wolf'], recommendedLevel: 13, seed: 11004 },
      { id: 'swamp', name: '안개 늪지', bg: 'swamp', theme: 'swamp', special: true, entryLabel: '고목숲으로', exits: [], monsterPool: ['mon-thorn-vine', 'mon-mush-cap', 'mon-bark-golem'], boss: 'mon-ancient-bark-golem', recommendedLevel: 15, seed: 11005 },
    ],
  },
  // ── 바다 해안 · 아틀란티스 ────────────────────────────────────────────────
  {
    root: 'sea',
    nodes: [
      { id: 'sea', name: '바다 해안', bg: 'sea', theme: 'sea1', entryLabel: '마을로 돌아가기', exits: [{ to: 'sea-2', side: 'W', t: 0.4, label: '산호 여울로', requiredLevel: 9 }], monsterPool: ['mon-bubble-spirit', 'mon-crab-soldier', 'mon-bubble-spirit'], recommendedLevel: 5, seed: 12001 },
      { id: 'sea-2', name: '산호 여울', bg: 'sea', theme: 'sea2', entryLabel: '해안으로', exits: [{ to: 'sea-3', side: 'W', t: 0.62, label: '암초 해안으로', requiredLevel: 13 }], monsterPool: ['mon-crab-soldier', 'mon-shallows-eel', 'mon-siren-larva'], recommendedLevel: 9, seed: 12002 },
      {
        id: 'sea-3', name: '암초 해안', bg: 'sea', theme: 'sea3', entryLabel: '산호 여울로',
        exits: [
          { to: 'atlantis', side: 'N', t: 0.5, label: '아틀란티스 마을' },
          { to: 'deepsea', side: 'W', t: 0.35, label: '심해로', requiredLevel: 19 },
          { to: 'sea-cave', side: 'S', t: 0.3, label: '해식 동굴', requiredLevel: 17 },
        ],
        monsterPool: ['mon-siren-larva', 'mon-reef-turtle', 'mon-shallows-eel'], boss: 'mon-jelly-queen', recommendedLevel: 13, seed: 12003,
      },
      { id: 'deepsea', name: '심해', bg: 'deepsea', theme: 'deepsea', special: true, entryLabel: '암초 해안으로', exits: [], monsterPool: ['mon-reef-turtle', 'mon-tide-elemental'], boss: 'mon-reef-king', recommendedLevel: 19, seed: 12004 },
      { id: 'sea-cave', name: '해식 동굴', bg: 'sea', theme: 'seaCave', special: true, entryLabel: '암초 해안으로', exits: [], monsterPool: ['mon-siren-larva', 'mon-reef-turtle', 'mon-tide-elemental'], recommendedLevel: 17, seed: 12005 },
    ],
  },
  // ── 스톰헤이븐 · 천공 신전 ────────────────────────────────────────────────
  {
    root: 'stormhaven',
    nodes: [
      { id: 'stormhaven', name: '스톰헤이븐', bg: 'sky', theme: 'storm1', entryLabel: '마을로 돌아가기', exits: [{ to: 'stormhaven-2', side: 'N', t: 0.66, label: '폭풍 구름다리로', requiredLevel: 19 }], monsterPool: ['mon-siren-larva', 'mon-reef-turtle', 'mon-tide-elemental'], recommendedLevel: 15, seed: 13001 },
      { id: 'stormhaven-2', name: '폭풍 구름다리', bg: 'sky', theme: 'storm2', entryLabel: '스톰헤이븐으로', exits: [{ to: 'stormhaven-3', side: 'E', t: 0.3, label: '뇌운 고원으로', requiredLevel: 21 }], monsterPool: ['mon-reef-turtle', 'mon-tide-elemental', 'mon-ember-imp'], recommendedLevel: 19, seed: 13002 },
      {
        id: 'stormhaven-3', name: '뇌운 고원', bg: 'sky', theme: 'storm3', entryLabel: '구름다리로',
        exits: [
          { to: 'sky-temple', side: 'N', t: 0.5, label: '천공 신전' },
          { to: 'cloud-rift', side: 'E', t: 0.6, label: '구름 협곡', requiredLevel: 23 },
          { to: 'thunder-spire', side: 'S', t: 0.72, label: '뇌운 첨탑', requiredLevel: 25 },
        ],
        monsterPool: ['mon-tide-elemental', 'mon-ember-imp', 'mon-ash-hound'], recommendedLevel: 21, seed: 13003,
      },
      { id: 'cloud-rift', name: '구름 협곡', bg: 'sky', theme: 'cloudRift', special: true, entryLabel: '뇌운 고원으로', exits: [], monsterPool: ['mon-tide-elemental', 'mon-ash-hound'], recommendedLevel: 23, seed: 13004 },
      { id: 'thunder-spire', name: '뇌운 첨탑', bg: 'sky', theme: 'thunderSpire', special: true, entryLabel: '뇌운 고원으로', exits: [], monsterPool: ['mon-ash-hound', 'mon-bone-archer', 'mon-cursed-armor'], recommendedLevel: 25, seed: 13005 },
    ],
  },
  // ── 버려진 폐허 · 버려진 신전 ──────────────────────────────────────────────
  {
    root: 'ruins',
    nodes: [
      { id: 'ruins', name: '버려진 폐허', bg: 'ruins', theme: 'ruins1', entryLabel: '마을로 돌아가기', exits: [{ to: 'ruins-2', side: 'W', t: 0.3, label: '무너진 성곽으로', requiredLevel: 25 }], monsterPool: ['mon-ember-imp', 'mon-ash-hound', 'mon-ember-imp'], recommendedLevel: 21, seed: 14001 },
      { id: 'ruins-2', name: '무너진 성곽', bg: 'ruins', theme: 'ruins2', entryLabel: '폐허로', exits: [{ to: 'ruins-3', side: 'N', t: 0.4, label: '망각의 광장으로', requiredLevel: 29 }], monsterPool: ['mon-ash-hound', 'mon-bone-archer', 'mon-cursed-armor'], recommendedLevel: 25, seed: 14002 },
      {
        id: 'ruins-3', name: '망각의 광장', bg: 'ruins', theme: 'ruins3', entryLabel: '무너진 성곽으로',
        exits: [
          { to: 'temple-ruin', side: 'N', t: 0.5, label: '버려진 신전' },
          { to: 'graveyard', side: 'W', t: 0.55, label: '버려진 묘지', requiredLevel: 33 },
          { to: 'catacomb', side: 'E', t: 0.4, label: '지하 납골당', requiredLevel: 35 },
        ],
        monsterPool: ['mon-cursed-armor', 'mon-wraith', 'mon-dark-acolyte'], boss: 'mon-stone-titan', recommendedLevel: 29, seed: 14003,
      },
      { id: 'graveyard', name: '버려진 묘지', bg: 'graveyard', theme: 'graveyard', special: true, entryLabel: '망각의 광장으로', exits: [], monsterPool: ['mon-wraith', 'mon-bone-archer', 'mon-dark-acolyte'], boss: 'mon-stone-titan-king', recommendedLevel: 33, seed: 14004 },
      { id: 'catacomb', name: '지하 납골당', bg: 'ruins', theme: 'catacomb', special: true, entryLabel: '망각의 광장으로', exits: [], monsterPool: ['mon-wraith', 'mon-dark-acolyte', 'mon-cursed-armor'], recommendedLevel: 35, seed: 14005 },
    ],
  },
  // ── 루미나 설원 · 오로라 마을 ──────────────────────────────────────────────
  {
    root: 'snowfield',
    nodes: [
      { id: 'snowfield', name: '루미나 설원', bg: 'snow', theme: 'snow1', entryLabel: '마을로 돌아가기', exits: [{ to: 'snowfield-2', side: 'E', t: 0.4, label: '눈보라 언덕으로', requiredLevel: 35 }], monsterPool: ['mon-cursed-armor', 'mon-wraith', 'mon-bone-archer'], recommendedLevel: 31, seed: 15001 },
      { id: 'snowfield-2', name: '눈보라 언덕', bg: 'snow', theme: 'snow2', entryLabel: '설원으로', exits: [{ to: 'snowfield-3', side: 'N', t: 0.55, label: '서리 침엽수림으로', requiredLevel: 39 }], monsterPool: ['mon-wraith', 'mon-dark-acolyte', 'mon-frost-revenant'], recommendedLevel: 35, seed: 15002 },
      {
        id: 'snowfield-3', name: '서리 침엽수림', bg: 'snow', theme: 'snow3', entryLabel: '눈보라 언덕으로',
        exits: [
          { to: 'aurora-village', side: 'N', t: 0.6, label: '오로라 마을' },
          { to: 'ice-cave', side: 'W', t: 0.35, label: '얼음 동굴', requiredLevel: 43 },
          { to: 'frozen-lake', side: 'E', t: 0.55, label: '얼어붙은 호수', requiredLevel: 45 },
        ],
        monsterPool: ['mon-frost-revenant', 'mon-dark-acolyte', 'mon-flame-warden'], recommendedLevel: 39, seed: 15003,
      },
      { id: 'ice-cave', name: '얼음 동굴', bg: 'snow', theme: 'iceCave', special: true, entryLabel: '서리 침엽수림으로', exits: [], monsterPool: ['mon-frost-revenant', 'mon-wraith'], recommendedLevel: 43, seed: 15004 },
      { id: 'frozen-lake', name: '얼어붙은 호수', bg: 'snow', theme: 'frozenLake', special: true, entryLabel: '서리 침엽수림으로', exits: [], monsterPool: ['mon-frost-revenant', 'mon-dark-mage'], recommendedLevel: 45, seed: 15005 },
    ],
  },
  // ── 화산지대 · 마물 마을 (+ 모르스의 성) ──────────────────────────────────
  {
    root: 'volcano',
    nodes: [
      { id: 'volcano', name: '화산지대', bg: 'volcano', theme: 'volcano1', entryLabel: '마을로 돌아가기', exits: [{ to: 'volcano-2', side: 'N', t: 0.3, label: '잿빛 협곡으로', requiredLevel: 45 }], monsterPool: ['mon-flame-warden', 'mon-dark-acolyte', 'mon-frost-revenant'], recommendedLevel: 41, seed: 16001 },
      { id: 'volcano-2', name: '잿빛 협곡', bg: 'volcano', theme: 'volcano2', entryLabel: '화산지대로', exits: [{ to: 'volcano-3', side: 'W', t: 0.4, label: '용암 평원으로', requiredLevel: 49 }], monsterPool: ['mon-flame-warden', 'mon-frost-revenant', 'mon-dark-mage'], recommendedLevel: 45, seed: 16002 },
      {
        id: 'volcano-3', name: '용암 평원', bg: 'volcano', theme: 'volcano3', entryLabel: '잿빛 협곡으로',
        exits: [
          { to: 'demon-village', side: 'N', t: 0.3, label: '마물 마을' },
          { to: 'mine', side: 'S', t: 0.35, label: '폐광산', requiredLevel: 51 },
          { to: 'lava-cave', side: 'W', t: 0.5, label: '용암 동굴', requiredLevel: 55 },
          { to: 'demon-castle', side: 'N', t: 0.82, label: '모르스의 성', requiredLevel: 63 },
        ],
        monsterPool: ['mon-dark-mage', 'mon-flame-warden', 'mon-frost-revenant'], recommendedLevel: 49, seed: 16003,
      },
      { id: 'mine', name: '폐광산', bg: 'mine', theme: 'mine', special: true, entryLabel: '용암 평원으로', exits: [], monsterPool: ['mon-cursed-armor', 'mon-flame-warden', 'mon-dark-mage'], recommendedLevel: 51, seed: 16004 },
      { id: 'lava-cave', name: '용암 동굴', bg: 'volcano', theme: 'lavaCave', special: true, entryLabel: '용암 평원으로', exits: [], monsterPool: ['mon-flame-warden', 'mon-dark-mage', 'mon-ember-imp'], recommendedLevel: 55, seed: 16005 },
      { id: 'demon-castle', name: '모르스의 성', bg: 'demon', theme: 'demonCastle', special: true, entryLabel: '용암 평원으로', exits: [], monsterPool: ['mon-azka-herald'], recommendedLevel: 63, seed: 16006 },
    ],
  },
]

/** 입구 방향 기본값 — 마을에서 오는 1단계 맵은 남쪽 입구 */
const ROOT_ENTRY: { side: Side; t: number } = { side: 'S', t: 0.5 }

export interface FieldAssembly {
  built: Record<string, BuiltFieldMap>
  /** 마을(안전지대) 출구가 돌아갈 야생 맵과 위치 — townId → { to, spawn } */
  townReturns: Record<string, { to: MapId; spawn: { x: number; y: number } }>
}

export function assembleFieldMaps(): FieldAssembly {
  const built: Record<string, BuiltFieldMap> = {}
  const townReturns: FieldAssembly['townReturns'] = {}
  for (const tree of REGION_TREES) {
    // 부모 찾기: 자식 id → { parentId, exit }
    const parentOf = new Map<MapId, { parent: MapId; side: Side; t: number }>()
    for (const n of tree.nodes) for (const e of n.exits) if (e.kind !== 'exit') parentOf.set(e.to, { parent: n.id, side: e.side, t: e.t })
    for (const n of tree.nodes) {
      const p = parentOf.get(n.id)
      const entry = p
        ? { side: oppositeSide(p.side), t: p.t, back: p.parent, label: n.entryLabel, backSpawn: built[p.parent]!.arrivalFor(n.id) }
        : { ...ROOT_ENTRY, back: 'village' as MapId, label: n.entryLabel, backSpawn: { ...VILLAGE_GATE_ARRIVAL } }
      const spec: FieldMapSpec = {
        id: n.id,
        name: n.name,
        bg: n.bg,
        theme: n.theme,
        special: n.special,
        entry,
        exits: n.exits.map((e) => (e.to === 'village' ? { ...e, kind: 'exit' as const } : e)),
        monsterPool: n.monsterPool,
        boss: n.boss,
        recommendedLevel: n.recommendedLevel,
        seed: n.seed,
      }
      const b = buildFieldMap(spec)
      // 마을 귀환 마법진은 군 통문 앞으로
      b.map.portals = b.map.portals.map((pt) => (pt.to === 'village' && pt.kind === 'exit' && !pt.toSpawn ? { ...pt, toSpawn: { ...VILLAGE_GATE_ARRIVAL } } : pt))
      built[n.id] = b
      // 이 맵에서 갈라지는 안전 마을 → 마을 출구가 여기로 돌아오게
      for (const e of n.exits) {
        if (e.kind === 'exit' || tree.nodes.some((x) => x.id === e.to)) continue
        townReturns[e.to] = { to: n.id, spawn: b.arrivalFor(e.to) }
      }
    }
  }
  return { built, townReturns }
}
