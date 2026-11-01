// ============================================================================
// 스킬별 도트 애니메이션 연출(2026-11-01) — PixelLab 「Create animated object」(64×64 · 16프레임)로 그린 레이어를 겹쳐 재생한다.
//   · 시트: public/images/battle/vfx/skills/<레이어 id>.png — 가로 16프레임 띠(1024×64), scripts/_pixellab/slice-vfx-atlas.mjs 가 만든다.
//   · 등급별 화려함: 하급 1~2장 · 중급 2장 · 상급 3장 · 최상급 4~5장(화면 전체 레이어 포함).
//   · 참고 자료: 게임 개발 파일/<스킬 이름> 참고.gif|jpg (불·얼음 계열). 다른 속성은 아직 절차형 연출(components/game/skill-fx.tsx).
//   · 이 표에 있는 스킬은 절차형 공격·지원 연출 대신 이 레이어를 쓰고, 기 모으기·궁극기 이름·화면 흔들림·비네트는 그대로 얹는다.
// ============================================================================

export type VfxAnchor =
  | 'caster' // 시전자 몸통
  | 'casterGround' // 시전자 발밑
  | 'target' // 대상마다(몸통)
  | 'targetGround' // 대상마다(발밑)
  | 'center' // 대상들 가운데
  | 'screen' // 전장 전체 — 같은 크기로 격자로 깔아 덮는다
  | 'travel' // 시전자 → 대상으로 날아간다(대상마다)
  | 'fall' // 하늘(대상 오른쪽 위 화면 밖)에서 대상으로 떨어진다(대상마다) — 운석 등

export interface VfxLayer {
  /** 시트 이름(확장자 없이) */
  sheet: string
  at: VfxAnchor
  /** 한 프레임의 화면 크기(px). screen 은 이 크기로 전장 전체에 격자로 깐다 */
  size: number
  startMs: number
  /** 16프레임 한 바퀴 시간 */
  cycleMs: number
  /** 반복 횟수(기본 1) */
  repeat?: number
  /** 기준점에서 비켜 놓기(px) */
  dx?: number
  dy?: number
  /** 좌우 반전 */
  flip?: boolean
  /** 화면 합성 — 'screen' 은 어두운 부분이 빠지고 빛만 더해진다 */
  blend?: 'screen' | 'normal'
  /** 같은 레이어를 흩뿌려 여러 개(화면을 채우는 도트의 향연) — 시작 시각도 조금씩 어긋난다 */
  scatter?: { count: number; spreadX: number; spreadY: number; jitterMs: number }
  opacity?: number
  /** 쌓는 순서(클수록 위) */
  z?: number
  /** 재생할 프레임 구간 [처음, 끝](0~15) — 생략 시 16프레임 전부 */
  range?: [number, number]
  /** 마지막 프레임을 이만큼 더 붙잡아 둔다(ms) — 기를 모으는 자세 유지 등 */
  holdMs?: number
  /** 가장자리 흐림 — 'radial'(기본) 64px 칸 경계가 안 보이게 둥글게 흐린다 · 'none' 그대로 */
  fade?: 'radial' | 'none'
}

/** 화염 방사 빔(도트) — 용의 입 같은 시작점에 에너지를 모았다가 대상들 가운데로 길게 뿜는다(skill-fx FlameBeam) */
export interface VfxBeam {
  /** 시전자 몸통 기준 입 위치(px) */
  dx: number
  dy: number
  /** 뿜기 시작 · 지속(ms) */
  startMs: number
  durMs: number
  /** 모으기 시트 — 뿜기 직전 chargeMs 동안 */
  charge: string
  chargeSize: number
  chargeMs: number
  /** 줄기 시트(가로로 이어 붙는 불길) — 한 조각 크기(px), 한 바퀴 시간 */
  stream: string
  segment: number
  streamMs: number
  /** 꽂히는 끝 */
  head: string
  headSize: number
  headMs: number
  /** 발사 순간 입(시작점)에서 터지는 섬광 — 반동 */
  muzzle?: string
  muzzleSize?: number
}

/** 전장 전체에 거는 화면 효과(절차형) */
export interface VfxScreen {
  /** invert 색 반전 · illusion 환술(흑백 반전 + 붉은 하늘) · tint 색 덮기 · void 심연(가장자리부터 어둠) */
  kind: 'invert' | 'illusion' | 'tint' | 'void'
  startMs: number
  durMs: number
  color?: string
}

export interface SkillVfx {
  layers: VfxLayer[]
  /** battle-screen 이 기다리는 시간(속도 1 기준) — 생략 시 skill-motion 기본값 */
  castMs: number
  impactMs: number
  totalMs: number
  /** 화면 흔들림(시각 ms → 세기 px) */
  shakes?: { at: number; px: number }[]
  beam?: VfxBeam
  screens?: VfxScreen[]
  /** 최상급 — 기를 모으는 동안 전장이 별이 흐르는 우주로 바뀌고(a = 성운 색, b = 별빛), invertAt 에 한 번 색이 뒤집힌다 */
  cosmic?: { a: string; b: string; invertAt: number }
}

export const vfxSheet = (name: string) => `/images/battle/vfx/skills/${name}.png`
export const VFX_FRAMES = 16

const L = (sheet: string, at: VfxAnchor, size: number, startMs: number, cycleMs: number, extra: Partial<VfxLayer> = {}): VfxLayer => ({ sheet, at, size, startMs, cycleMs, ...extra })

export const SKILL_VFX: Record<string, SkillVfx> = {
  // ── 불꽃 · 하급 ───────────────────────────────────────────────────────────
  'fire-basic-1': {
    castMs: 0,
    impactMs: 420,
    totalMs: 1350,
    layers: [L('fire-basic-1-proj', 'travel', 92, 0, 420), L('fire-basic-1-hit', 'target', 150, 380, 900, { z: 2 })],
    shakes: [{ at: 420, px: 3 }],
  },
  'fire-basic-2': {
    castMs: 120,
    impactMs: 300,
    totalMs: 1300,
    layers: [L('fire-basic-2-aura', 'target', 170, 80, 1100, { blend: 'screen' })],
  },
  'fire-basic-3': {
    castMs: 120,
    impactMs: 520,
    totalMs: 1500,
    layers: [L('fire-basic-3-fist', 'target', 210, 60, 1150, { dx: -40, z: 2 })],
    shakes: [{ at: 520, px: 5 }],
  },
  // ── 불꽃 · 중급 ───────────────────────────────────────────────────────────
  'fire-adv-1': {
    castMs: 300,
    impactMs: 700,
    totalMs: 1900,
    layers: [L('fire-adv-1-whip', 'center', 300, 260, 900, { dx: -60, blend: 'screen' }), L('fire-adv-1-hit', 'target', 190, 640, 900, { z: 2 })],
    shakes: [{ at: 700, px: 5 }],
  },
  'fire-adv-2': {
    castMs: 360,
    impactMs: 620,
    totalMs: 2000,
    layers: [L('fire-adv-2-ground', 'targetGround', 200, 420, 1100), L('fire-adv-2-ring', 'target', 190, 520, 1000, { blend: 'screen', z: 2 })],
    shakes: [{ at: 620, px: 4 }],
  },
  'fire-adv-3': {
    castMs: 360,
    impactMs: 600,
    totalMs: 2000,
    layers: [L('fire-adv-3-ignite', 'target', 190, 500, 950, { z: 2 }), L('fire-adv-3-burn', 'targetGround', 130, 900, 700, { repeat: 2, opacity: 0.9 })],
    shakes: [{ at: 600, px: 4 }],
  },
  'fire-adv-4': {
    castMs: 300,
    impactMs: 600,
    totalMs: 1900,
    layers: [L('fire-adv-4-heal', 'targetGround', 190, 300, 1100, { blend: 'screen' }), L('fire-adv-4-spears', 'target', 210, 420, 1150, { dy: -30, z: 2 })],
  },
  // ── 불꽃 · 상급 — 전장을 크게 쓴다 ────────────────────────────────────────
  'fire-high-1': {
    castMs: 700,
    impactMs: 1000,
    totalMs: 2700,
    layers: [
      L('fire-high-1-flash', 'screen', 400, 820, 900, { blend: 'screen', opacity: 0.85 }),
      L('fire-high-1-wave', 'center', 520, 940, 1000, { dy: 30, blend: 'screen' }),
      L('fire-high-1-boom', 'target', 300, 900, 1200, { z: 3, scatter: { count: 2, spreadX: 70, spreadY: 40, jitterMs: 220 } }),
    ],
    shakes: [{ at: 1000, px: 8 }, { at: 1250, px: 5 }],
  },
  'fire-high-2': {
    castMs: 700,
    impactMs: 1150,
    totalMs: 2700,
    layers: [
      L('fire-high-2-sigil', 'target', 230, 450, 1000, { dy: -20, blend: 'screen' }),
      L('fire-high-2-pillar', 'targetGround', 330, 1050, 1100, { dy: -150, z: 3 }),
      L('fire-high-2-embers', 'screen', 300, 1200, 800, { repeat: 2, opacity: 0.8, blend: 'screen' }),
    ],
    shakes: [{ at: 1150, px: 8 }],
  },
  // ── 불꽃 · 최상급 — 전투 화면을 꽉 채운다 ─────────────────────────────────
  // 멸화의 심판 — 용이 나타나 입에 화염 에너지를 모았다가(기 모으기) 한 번에 빔 형태의 화염 방사를 길게 뿜는다
  // 멸화의 심판 — 용이 나타나 고개를 젖히고 입을 크게 벌린 채(용 그림에는 불이 없다) 버틴다 →
  //   벌린 입 앞에 에너지가 응축(charge) → 입에서 섬광(muzzle)과 함께 굵은 에너지포가 대상들 가운데로 터져 나간다
  'fire-master-1': {
    castMs: 1700,
    impactMs: 2250,
    totalMs: 5000,
    cosmic: { a: '#ff6a2a', b: '#ffe7b0', invertAt: 2120 },
    beam: {
      dx: 195,
      dy: -194,
      startMs: 2100,
      durMs: 1750,
      charge: 'fire-master-1-cannon-charge',
      chargeSize: 300,
      chargeMs: 1200,
      stream: 'fire-master-1-cannon-stream',
      segment: 270,
      streamMs: 420,
      head: 'fire-master-1-cannon-head',
      headSize: 460,
      headMs: 620,
      muzzle: 'fire-master-1-cannon-muzzle',
      muzzleSize: 320,
    },
    shakes: [{ at: 2110, px: 16 }, ...Array.from({ length: 15 }, (_, i) => ({ at: 2230 + i * 100, px: 5 + (i % 3) * 1.5 })), { at: 3850, px: 9 }],
    layers: [
      // 용 — 등장해 고개를 젖히며 입을 벌린다(0~3) → 입을 벌린 채 버틴다(4~13 같은 그림) → 입을 닫는다(14~15)
      L('fire-master-1-dragon-open', 'caster', 440, 500, 900, { dx: 90, dy: -180, z: 4, range: [0, 3], holdMs: 700 }),
      L('fire-master-1-dragon-open', 'caster', 440, 2100, 1760, { dx: 90, dy: -180, z: 4, range: [4, 13] }),
      L('fire-master-1-dragon-open', 'caster', 440, 3860, 360, { dx: 90, dy: -180, z: 4, range: [14, 15] }),
      L('fire-master-1-nova', 'center', 460, 2250, 800, { blend: 'screen', z: 5, repeat: 2, scatter: { count: 2, spreadX: 150, spreadY: 60, jitterMs: 300 } }),
      L('fire-adv-3-burn', 'targetGround', 150, 3700, 700, { repeat: 2, z: 1, scatter: { count: 3, spreadX: 90, spreadY: 26, jitterMs: 240 } }),
    ],
  },
  'fire-master-2': {
    castMs: 1700,
    impactMs: 2300,
    totalMs: 5000,
    cosmic: { a: '#ff5a1f', b: '#ffd9a0', invertAt: 2280 },
    layers: [
      L('fire-master-2-gather', 'caster', 300, 200, 1400, { blend: 'screen', z: 3 }),
      L('fire-master-2-pillar', 'targetGround', 460, 1750, 1300, { dy: -220, z: 4 }),
      L('fire-master-2-flash', 'screen', 460, 2250, 800, { blend: 'screen', z: 6 }),
      L('fire-master-2-wave', 'center', 640, 2400, 1300, { dy: 40, z: 5, scatter: { count: 2, spreadX: 220, spreadY: 30, jitterMs: 200 } }),
      L('fire-adv-3-burn', 'targetGround', 150, 3100, 700, { repeat: 3, z: 1, scatter: { count: 3, spreadX: 90, spreadY: 26, jitterMs: 240 } }),
      L('fire-high-2-embers', 'screen', 340, 3000, 800, { repeat: 2, opacity: 0.85, blend: 'screen', z: 2 }),
    ],
    shakes: [{ at: 1900, px: 6 }, { at: 2300, px: 13 }, { at: 2600, px: 8 }],
  },

  // ── 얼음 · 하급 ───────────────────────────────────────────────────────────
  'ice-basic-1': {
    castMs: 0,
    impactMs: 420,
    totalMs: 1350,
    layers: [L('ice-basic-1-proj', 'travel', 96, 0, 420), L('ice-basic-1-hit', 'target', 150, 380, 900, { z: 2 })],
    shakes: [{ at: 420, px: 3 }],
  },
  'ice-basic-2': {
    castMs: 120,
    impactMs: 300,
    totalMs: 1300,
    layers: [L('ice-basic-2-shield', 'target', 180, 80, 1150, { blend: 'screen' })],
  },
  'ice-basic-3': {
    castMs: 120,
    impactMs: 600,
    totalMs: 1500,
    layers: [L('ice-basic-3-wave', 'travel', 130, 60, 560), L('ice-basic-3-hit', 'target', 170, 560, 900, { z: 2 })],
    shakes: [{ at: 600, px: 4 }],
  },
  // ── 얼음 · 중급 ───────────────────────────────────────────────────────────
  'ice-adv-1': {
    castMs: 300,
    impactMs: 800,
    totalMs: 1900,
    layers: [L('ice-adv-1-hand', 'targetGround', 230, 300, 1100, { dy: -90, z: 2 }), L('ice-adv-1-shards', 'target', 180, 800, 800, { z: 3 })],
    shakes: [{ at: 800, px: 5 }],
  },
  'ice-adv-2': {
    castMs: 360,
    impactMs: 640,
    totalMs: 2100,
    layers: [
      L('ice-adv-2-snow', 'screen', 420, 300, 700, { repeat: 2, opacity: 0.35, blend: 'screen' }),
      L('ice-adv-2-vortex', 'target', 200, 480, 700, { repeat: 2, z: 2 }),
    ],
    shakes: [{ at: 640, px: 4 }],
  },
  'ice-adv-3': {
    castMs: 360,
    impactMs: 820,
    totalMs: 2000,
    layers: [L('ice-adv-3-streaks', 'target', 200, 300, 600, { blend: 'screen' }), L('ice-adv-3-encase', 'target', 200, 700, 1150, { z: 2 })],
    shakes: [{ at: 820, px: 5 }],
  },
  // ── 얼음 · 상급 ───────────────────────────────────────────────────────────
  'ice-high-1': {
    castMs: 700,
    impactMs: 950,
    totalMs: 2800,
    layers: [
      L('ice-high-1-storm', 'screen', 440, 600, 800, { repeat: 2, opacity: 0.38, blend: 'screen' }),
      L('ice-high-1-icicles', 'target', 260, 850, 700, { repeat: 2, dy: -40, z: 3, scatter: { count: 2, spreadX: 80, spreadY: 20, jitterMs: 180 } }),
      L('ice-high-1-mist', 'targetGround', 280, 1300, 1000, { z: 1 }),
    ],
    shakes: [{ at: 950, px: 6 }, { at: 1350, px: 6 }, { at: 1750, px: 5 }],
  },
  'ice-high-2': {
    castMs: 700,
    impactMs: 1100,
    totalMs: 2800,
    layers: [
      L('ice-high-2-ring', 'center', 520, 650, 1000, { dy: 40, blend: 'screen', z: 1 }),
      L('ice-high-2-spikes', 'targetGround', 300, 1000, 1150, { dy: -110, z: 3, scatter: { count: 2, spreadX: 90, spreadY: 25, jitterMs: 160 } }),
      L('ice-high-2-burst', 'target', 260, 1700, 900, { z: 4 }),
    ],
    shakes: [{ at: 1100, px: 8 }, { at: 1750, px: 6 }],
  },
  // ── 얼음 · 최상급 ─────────────────────────────────────────────────────────
  'ice-master-1': {
    castMs: 1700,
    impactMs: 2300,
    totalMs: 5000,
    cosmic: { a: '#3a8cff', b: '#dff4ff', invertAt: 3380 },
    layers: [
      L('ice-master-1-circle', 'center', 680, 700, 1000, { dy: 60, repeat: 3, blend: 'screen', z: 1 }),
      L('ice-master-1-beams', 'center', 520, 1500, 1100, { dy: -40, blend: 'screen', z: 2, scatter: { count: 3, spreadX: 260, spreadY: 40, jitterMs: 200 } }),
      L('ice-master-1-prison', 'targetGround', 360, 2100, 1400, { dy: -150, z: 4 }),
      // 서리 덮개 — 화면 전체 눈폭풍을 옅게(전용 시트는 배경이 안 빠져 쓰지 않음)
      L('ice-high-1-storm', 'screen', 440, 2200, 750, { repeat: 2, opacity: 0.3, blend: 'screen', z: 5 }),
      L('ice-master-1-shatter', 'target', 380, 3350, 1000, { blend: 'screen', z: 6 }),
    ],
    shakes: [{ at: 2300, px: 9 }, { at: 3400, px: 12 }],
  },
  'ice-master-2': {
    castMs: 1700,
    impactMs: 2450,
    totalMs: 5000,
    cosmic: { a: '#4fa8ff', b: '#eaf8ff', invertAt: 2430 },
    layers: [
      L('ice-master-2-glacier', 'center', 620, 1650, 900, { dy: -170, z: 4 }),
      L('ice-master-2-crash', 'center', 660, 2400, 1200, { dy: 10, z: 5 }),
      L('ice-master-2-avalanche', 'screen', 420, 2550, 1300, { opacity: 0.85, blend: 'screen', z: 6 }),
      L('ice-master-2-cracks', 'targetGround', 280, 2650, 1100, { dy: -40, z: 3 }),
    ],
    shakes: [{ at: 2450, px: 14 }, { at: 2750, px: 9 }, { at: 3100, px: 6 }],
  },

  // ══ 대지 ═══════════════════════════════════════════════════════════════════
  // 참고 자료 없는 스킬(돌팔매·단단한 살갗·대지 강타·철벽 방어·최면 가루)은 불·얼음 시트에 흙빛만 입혔다(scripts/_pixellab/recolor-vfx.mjs)
  'earth-basic-1': {
    castMs: 0,
    impactMs: 420,
    totalMs: 1350,
    layers: [L('earth-basic-1-proj', 'travel', 92, 0, 420), L('earth-basic-1-hit', 'target', 150, 380, 900, { z: 2 })],
    shakes: [{ at: 420, px: 3 }],
  },
  'earth-basic-2': {
    castMs: 120,
    impactMs: 320,
    totalMs: 1350,
    layers: [L('earth-basic-2-shield', 'target', 170, 80, 1150, { z: 2 })],
  },
  'earth-basic-3': {
    castMs: 120,
    impactMs: 520,
    totalMs: 1500,
    layers: [L('earth-basic-3-fist', 'target', 210, 60, 1150, { dx: -40, z: 2 }), L('earth-high-1-rocks', 'targetGround', 150, 480, 900, { dy: -50, z: 1 })],
    shakes: [{ at: 520, px: 5 }],
  },
  // 모래 수렁 — 발밑이 모래 늪으로 꺼지고 모래 손이 솟아 움켜쥔다
  'earth-adv-1': {
    castMs: 300,
    impactMs: 900,
    totalMs: 2100,
    layers: [L('earth-adv-1-pit', 'targetGround', 240, 200, 1300, { dy: -10 }), L('earth-adv-1-hand', 'targetGround', 250, 480, 1200, { dy: -100, z: 2 })],
    shakes: [{ at: 900, px: 4 }],
  },
  'earth-adv-2': {
    castMs: 300,
    impactMs: 700,
    totalMs: 2000,
    layers: [
      L('earth-adv-2-ring', 'targetGround', 200, 150, 1100, { blend: 'screen' }),
      L('earth-adv-2-spikes', 'targetGround', 210, 320, 1150, { dy: -60, z: 1 }),
      L('earth-adv-2-shield', 'target', 170, 650, 1100, { z: 2 }),
    ],
    shakes: [{ at: 520, px: 3 }],
  },
  'earth-adv-3': {
    castMs: 300,
    impactMs: 700,
    totalMs: 1900,
    layers: [L('earth-adv-3-snow', 'target', 210, 150, 900, { repeat: 2, opacity: 0.8, blend: 'screen' }), L('earth-adv-3-dust', 'target', 190, 320, 1100, { z: 2 })],
  },
  // 지진 — 땅이 동심원으로 꺼지고 바위가 튀며, 붉은 번개 같은 균열이 내리친다
  'earth-high-1': {
    castMs: 700,
    impactMs: 950,
    totalMs: 2800,
    layers: [
      L('earth-high-1-quake', 'center', 600, 760, 1300, { dy: 70, z: 1 }),
      L('earth-high-1-quake', 'targetGround', 300, 900, 1200, { z: 1 }),
      L('earth-high-1-bolt', 'target', 260, 880, 700, { dy: -70, blend: 'screen', z: 3, scatter: { count: 1, spreadX: 60, spreadY: 10, jitterMs: 260 } }),
      L('earth-high-1-rocks', 'targetGround', 230, 980, 1100, { dy: -80, z: 2, scatter: { count: 2, spreadX: 80, spreadY: 20, jitterMs: 200 } }),
    ],
    shakes: [{ at: 950, px: 11 }, ...Array.from({ length: 10 }, (_, i) => ({ at: 1080 + i * 110, px: 3 + (i % 3) * 1.5 }))],
  },
  // 석화의 시선 — 어둠 속에서 눈이 뜨이고, 푸른 섬광이 소용돌이친 뒤 대상이 돌로 굳는다
  'earth-high-2': {
    castMs: 700,
    impactMs: 1150,
    totalMs: 2700,
    screens: [{ kind: 'void', startMs: 100, durMs: 1500 }],
    layers: [
      L('earth-high-2-eyes', 'target', 220, 200, 1000, { dy: -170, z: 3 }),
      L('earth-high-2-flash', 'target', 270, 900, 800, { blend: 'screen', z: 4 }),
      L('earth-high-2-stone', 'targetGround', 230, 1100, 1400, { dy: -80, z: 2 }),
    ],
    shakes: [{ at: 1150, px: 7 }],
  },
  // 대지의 분노 — 바위 소용돌이 → 땅이 터져 용암이 치솟고 → 황금빛 돔 폭발 → 갈라진 땅에 용암이 흐른다
  'earth-master-1': {
    castMs: 1700,
    impactMs: 2300,
    totalMs: 5000,
    cosmic: { a: '#ff9a3c', b: '#fff0c4', invertAt: 2280 },
    layers: [
      L('earth-master-1-vortex', 'center', 560, 300, 900, { dy: -40, repeat: 2, z: 2 }),
      L('earth-master-1-erupt', 'targetGround', 380, 1850, 1200, { dy: -150, z: 4, scatter: { count: 1, spreadX: 60, spreadY: 10, jitterMs: 160 } }),
      L('earth-master-1-dome', 'center', 660, 2300, 1300, { dy: 10, z: 5 }),
      L('earth-master-1-cracks', 'targetGround', 300, 2450, 1400, { dy: -10, z: 1 }),
      L('fire-high-2-embers', 'screen', 340, 3000, 800, { repeat: 2, opacity: 0.8, blend: 'screen', z: 2 }),
    ],
    shakes: [{ at: 1900, px: 7 }, { at: 2300, px: 15 }, ...Array.from({ length: 8 }, (_, i) => ({ at: 2450 + i * 130, px: 4 + (i % 2) * 2 }))],
  },
  // 대지의 장막 — 하늘에 불의 소용돌이가 열리고 운석이 쏟아진 뒤 거대한 충돌 폭발
  'earth-master-2': {
    castMs: 1700,
    impactMs: 2350,
    totalMs: 5000,
    cosmic: { a: '#ff7a2c', b: '#ffe2a6', invertAt: 2330 },
    layers: [
      L('earth-master-2-vortex', 'center', 560, 300, 900, { dy: -230, repeat: 3, blend: 'screen', z: 2 }),
      L('earth-master-2-meteor', 'fall', 230, 1400, 600, { z: 4, scatter: { count: 2, spreadX: 90, spreadY: 20, jitterMs: 500 } }),
      L('earth-master-2-meteor', 'fall', 200, 1800, 550, { z: 4, scatter: { count: 1, spreadX: 70, spreadY: 20, jitterMs: 300 } }),
      L('earth-master-2-crater', 'center', 700, 2350, 1300, { dy: 10, z: 5 }),
      L('fire-master-2-flash', 'screen', 460, 2300, 800, { blend: 'screen', z: 6, opacity: 0.8 }),
      L('earth-master-1-cracks', 'targetGround', 280, 2550, 1300, { dy: -10, z: 1 }),
    ],
    shakes: [{ at: 2000, px: 6 }, { at: 2200, px: 6 }, { at: 2350, px: 16 }, { at: 2650, px: 9 }, { at: 3000, px: 6 }],
  },

  // ══ 어둠 ═══════════════════════════════════════════════════════════════════
  'dark-curse': {
    castMs: 200,
    impactMs: 650,
    totalMs: 1700,
    layers: [L('dark-curse-fog', 'targetGround', 210, 100, 1200, { dy: -30, opacity: 0.85 }), L('dark-curse-skull', 'target', 190, 200, 1100, { dy: -20, z: 2 })],
  },
  // 그림자 장막 — 발밑에 그림자 고리가 번지고 유령 같은 기운이 감싸 오른다
  'dark-veil': {
    castMs: 250,
    impactMs: 650,
    totalMs: 1900,
    layers: [L('dark-veil-dome', 'targetGround', 270, 100, 1300), L('dark-veil-wisp', 'target', 180, 350, 1000, { blend: 'screen', z: 2, scatter: { count: 2, spreadX: 40, spreadY: 20, jitterMs: 250 } })],
  },
  // 혼란의 환술 — 세상이 흑백으로 뒤집히고 하늘이 붉게 물든 환술 세계, 소용돌이 눈
  'dark-illusion': {
    castMs: 300,
    impactMs: 1000,
    totalMs: 2300,
    screens: [{ kind: 'illusion', startMs: 250, durMs: 1650 }],
    layers: [L('dark-illusion-eye', 'target', 230, 300, 1300, { dy: -40, z: 3 })],
  },
  // 사신의 낙인 — 사신의 낫이 크게 휘둘러지고 검은 파편이 터지며 화면이 붉게 물든다
  'dark-execute': {
    castMs: 400,
    impactMs: 900,
    totalMs: 2400,
    screens: [{ kind: 'tint', startMs: 780, durMs: 1000, color: '#c0102a' }],
    layers: [L('dark-execute-scythe', 'target', 310, 350, 900, { dx: -30, dy: -20, z: 3 }), L('dark-execute-shards', 'target', 250, 850, 1000, { z: 4 })],
    shakes: [{ at: 900, px: 9 }],
  },
  // 침묵의 인장 — 인장이 새겨지고 어둠의 이빨이 콱 물어 봉인한다
  'dark-seal': {
    castMs: 250,
    impactMs: 800,
    totalMs: 1900,
    layers: [L('dark-seal-sigil', 'target', 210, 120, 1100, { dy: -10, blend: 'screen' }), L('dark-seal-jaws', 'target', 220, 480, 800, { z: 3 })],
    shakes: [{ at: 800, px: 5 }],
  },
  // 저주의 안개 — 보랏빛 안개가 전장을 덮고 거대한 그림자 날개가 펼쳐진 뒤 세상이 하얗게 뒤집힌다
  'dark-miasma': {
    castMs: 500,
    impactMs: 1250,
    totalMs: 2900,
    screens: [{ kind: 'invert', startMs: 1700, durMs: 800 }],
    layers: [
      L('dark-miasma-fog', 'screen', 380, 150, 1000, { repeat: 2, opacity: 0.3, blend: 'screen' }),
      L('dark-miasma-wings', 'center', 620, 350, 1400, { dy: -120, z: 3 }),
      L('dark-miasma-fog', 'targetGround', 260, 900, 1100, { dy: -40, z: 2 }),
    ],
    shakes: [{ at: 1250, px: 7 }],
  },
  // 심연의 시선 — 사방이 어두워지고 하늘 가득 거대한 눈이 천천히 뜨인다
  'dark-gaze': {
    castMs: 500,
    impactMs: 1300,
    totalMs: 2900,
    screens: [{ kind: 'void', startMs: 100, durMs: 2500 }],
    layers: [L('dark-gaze-eye', 'center', 540, 300, 1800, { dy: -160, z: 3 }), L('dark-miasma-fog', 'targetGround', 230, 1100, 1100, { dy: -30, opacity: 0.75, z: 2 })],
    shakes: [{ at: 1300, px: 6 }],
  },
  // 죽음의 선고 — 초록 죽음의 기운을 모아 번개 같은 광선을 쏘고, 세상이 하얗게 뒤집힌다
  'dark-sentence': {
    castMs: 1700,
    impactMs: 2300,
    totalMs: 4700,
    cosmic: { a: '#1fd47a', b: '#dcffe9', invertAt: 2900 },
    screens: [{ kind: 'tint', startMs: 1800, durMs: 1700, color: '#13b866' }],
    beam: {
      dx: 34,
      dy: -40,
      startMs: 1950,
      durMs: 1100,
      charge: 'dark-sentence-charge',
      chargeSize: 230,
      chargeMs: 1100,
      stream: 'dark-sentence-bolt',
      segment: 200,
      streamMs: 360,
      head: 'dark-sentence-hit',
      headSize: 380,
      headMs: 700,
    },
    layers: [L('dark-sentence-hit', 'target', 280, 2250, 900, { z: 5, scatter: { count: 1, spreadX: 40, spreadY: 20, jitterMs: 200 } })],
    shakes: [{ at: 1960, px: 10 }, ...Array.from({ length: 8 }, (_, i) => ({ at: 2080 + i * 120, px: 4 })), { at: 2900, px: 12 }],
  },

  // ══ 빛 — 금빛 고리·날개·빛기둥·깃털(참고: 빛 스킬 참고.gif), 축복마다 색만 조금씩 다르다 ══════════════
  'light-heal': {
    castMs: 250,
    impactMs: 600,
    totalMs: 1700,
    layers: [L('light-circle', 'targetGround', 220, 100, 1200, { blend: 'screen' }), L('light-heal', 'target', 190, 300, 1100, { blend: 'screen', z: 2 })],
  },
  'light-might': {
    castMs: 250,
    impactMs: 600,
    totalMs: 1650,
    layers: [L('light-halo-might', 'target', 210, 100, 1100, { dy: -20, blend: 'screen' }), L('light-burst-might', 'target', 180, 450, 900, { blend: 'screen', z: 2 })],
  },
  'light-wisdom': {
    castMs: 250,
    impactMs: 600,
    totalMs: 1650,
    layers: [L('light-halo-wisdom', 'target', 210, 100, 1100, { dy: -20, blend: 'screen' }), L('light-burst-wisdom', 'target', 180, 450, 900, { blend: 'screen', z: 2 })],
  },
  'light-bulwark': {
    castMs: 250,
    impactMs: 600,
    totalMs: 1700,
    layers: [L('light-circle-bulwark', 'targetGround', 220, 100, 1200, { blend: 'screen' }), L('light-halo-bulwark', 'target', 210, 350, 1100, { blend: 'screen', z: 2 })],
  },
  'light-ward': {
    castMs: 350,
    impactMs: 700,
    totalMs: 1900,
    layers: [
      L('light-circle-ward', 'targetGround', 220, 100, 1200, { blend: 'screen' }),
      L('light-halo-ward', 'target', 210, 350, 1100, { blend: 'screen', z: 2 }),
      L('light-feathers-ward', 'screen', 150, 500, 1000, { opacity: 0.45, blend: 'screen', z: 1 }),
    ],
  },
  'light-haste': {
    castMs: 350,
    impactMs: 700,
    totalMs: 1900,
    layers: [
      L('light-circle-haste', 'targetGround', 220, 100, 1100, { blend: 'screen' }),
      L('light-burst-haste', 'target', 190, 400, 900, { blend: 'screen', z: 2 }),
      L('light-feathers-haste', 'target', 190, 500, 1000, { dy: -30, blend: 'screen', z: 1 }),
    ],
  },
  'light-purify': {
    castMs: 200,
    impactMs: 500,
    totalMs: 1500,
    layers: [L('light-pillar-purify', 'target', 250, 100, 1000, { dy: -60, blend: 'screen' }), L('light-burst', 'target', 170, 400, 900, { blend: 'screen', z: 2 })],
  },
  'light-revive': {
    castMs: 1300,
    impactMs: 1600,
    totalMs: 3400,
    layers: [
      L('light-circle', 'targetGround', 270, 200, 1600, { blend: 'screen' }),
      L('light-pillar', 'target', 330, 600, 1200, { dy: -110, blend: 'screen', z: 2 }),
      L('light-wings', 'target', 310, 1000, 1300, { dy: -40, blend: 'screen', z: 3 }),
      L('light-feathers', 'target', 230, 1400, 1000, { dy: -40, repeat: 2, blend: 'screen', z: 4 }),
    ],
  },
  'light-sanctuary': {
    castMs: 1200,
    impactMs: 1500,
    totalMs: 3400,
    layers: [
      L('light-circle', 'center', 620, 200, 1500, { dy: 50, repeat: 2, blend: 'screen' }),
      L('light-pillar', 'target', 300, 900, 1200, { dy: -100, blend: 'screen', z: 2 }),
      L('light-heal', 'target', 200, 1300, 1100, { blend: 'screen', z: 3 }),
      L('light-feathers', 'screen', 170, 1100, 1000, { repeat: 2, opacity: 0.55, blend: 'screen', z: 1 }),
    ],
  },
  // 대부활 — 하늘에 성스러운 고리가 그려지고 거대한 날개가 펼쳐지며, 빛기둥과 깃털이 쏟아진다
  'light-rebirth': {
    castMs: 1700,
    impactMs: 2000,
    totalMs: 4400,
    cosmic: { a: '#ffcf5a', b: '#fffbe6', invertAt: 1950 },
    layers: [
      L('light-halo', 'center', 620, 300, 1400, { dy: -170, blend: 'screen', z: 2 }),
      L('light-wings', 'center', 700, 900, 1500, { dy: -130, blend: 'screen', z: 3 }),
      L('light-pillar', 'target', 360, 1500, 1200, { dy: -120, blend: 'screen', z: 4 }),
      L('light-burst', 'center', 540, 1900, 1000, { dy: -60, blend: 'screen', z: 5 }),
      L('light-feathers', 'screen', 180, 1700, 1000, { repeat: 3, opacity: 0.65, blend: 'screen', z: 1 }),
      L('light-heal', 'target', 230, 2100, 1100, { blend: 'screen', z: 6 }),
    ],
  },

  // ══ 무속성 — 빛 시트에 은빛·푸른빛·붉은빛을 입혀 결만 다르게 ═══════════════════════════════
  'n-focus': {
    castMs: 0,
    impactMs: 700,
    totalMs: 1700,
    layers: [L('neutral-halo', 'target', 210, 100, 1300, { dy: -10, blend: 'screen' }), L('neutral-burst', 'target', 160, 700, 900, { blend: 'screen', z: 2 })],
  },
  'n-firstaid': {
    castMs: 200,
    impactMs: 500,
    totalMs: 1500,
    layers: [L('neutral-circle', 'targetGround', 190, 50, 1100, { blend: 'screen' }), L('neutral-heal', 'target', 180, 150, 1100, { blend: 'screen', z: 2 })],
  },
  'n-rally': {
    castMs: 300,
    impactMs: 650,
    totalMs: 1750,
    layers: [
      L('neutral-circle', 'targetGround', 210, 100, 1100, { blend: 'screen' }),
      L('neutral-pillar', 'target', 230, 250, 1000, { dy: -60, opacity: 0.8, blend: 'screen', z: 1 }),
      L('neutral-burst', 'target', 180, 450, 900, { blend: 'screen', z: 2 }),
    ],
  },
  'n-laststand': {
    castMs: 250,
    impactMs: 600,
    totalMs: 1650,
    layers: [L('neutral-halo-crimson', 'target', 220, 100, 1100, { blend: 'screen' }), L('neutral-burst-crimson', 'target', 190, 480, 900, { blend: 'screen', z: 2 })],
    shakes: [{ at: 520, px: 4 }],
  },

  // ══ 바람 — 모르스 전용(참고: 바람 스킬 참고 1·2.gif — 초록 칼바람이 화면을 가른다) ═══════════════
  'wind-lost-gale': {
    castMs: 300,
    impactMs: 700,
    totalMs: 2100,
    layers: [
      L('wind-gust', 'screen', 300, 150, 700, { repeat: 2, opacity: 0.6, blend: 'screen' }),
      L('wind-ring', 'targetGround', 250, 300, 1000, { dy: -10 }),
      L('wind-cuts', 'target', 220, 600, 800, { blend: 'screen', z: 2, scatter: { count: 1, spreadX: 40, spreadY: 20, jitterMs: 200 } }),
    ],
    shakes: [{ at: 700, px: 5 }, { at: 950, px: 4 }],
  },
  'wind-vacuum-blade': {
    castMs: 400,
    impactMs: 950,
    totalMs: 2300,
    layers: [
      L('wind-slash', 'target', 270, 300, 700, { dx: -30, blend: 'screen', z: 2 }),
      L('wind-blade', 'target', 350, 620, 900, { z: 3 }),
      L('wind-cuts', 'target', 240, 950, 800, { blend: 'screen', z: 4 }),
    ],
    shakes: [{ at: 950, px: 10 }],
  },
  // 종언의 폭풍 — 바람의 고리가 전장을 휘감고 회오리가 솟은 뒤, 수십 갈래 칼바람이 화면을 가른다
  'wind-tempest': {
    castMs: 1700,
    impactMs: 2300,
    totalMs: 4800,
    cosmic: { a: '#2fe08a', b: '#eafff2', invertAt: 2280 },
    layers: [
      L('wind-ring', 'center', 640, 300, 900, { dy: 50, repeat: 3, opacity: 0.6, blend: 'screen', z: 1 }),
      L('wind-tornado', 'target', 360, 1500, 900, { dy: -110, repeat: 2, z: 3 }),
      L('wind-gust', 'screen', 230, 1500, 700, { repeat: 3, opacity: 0.4, blend: 'screen', z: 2 }),
      L('wind-slash', 'center', 520, 2200, 700, { blend: 'screen', z: 5, scatter: { count: 4, spreadX: 260, spreadY: 80, jitterMs: 360 } }),
      L('wind-cuts', 'screen', 240, 2350, 800, { repeat: 2, opacity: 0.65, blend: 'screen', z: 6 }),
    ],
    shakes: [{ at: 2300, px: 13 }, ...Array.from({ length: 9 }, (_, i) => ({ at: 2420 + i * 120, px: 4 + (i % 3) }))],
  },
}

export function skillVfx(skillId: string | undefined): SkillVfx | undefined {
  return skillId ? SKILL_VFX[skillId] : undefined
}

/** 시트 이름 전체(점검·자르기 스크립트용) */
export const VFX_SHEETS = Array.from(
  new Set(Object.values(SKILL_VFX).flatMap((v) => [...v.layers.map((l) => l.sheet), ...(v.beam ? [v.beam.charge, v.beam.stream, v.beam.head, ...(v.beam.muzzle ? [v.beam.muzzle] : [])] : [])])),
)
