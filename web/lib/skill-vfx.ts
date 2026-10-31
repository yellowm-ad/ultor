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
}

export interface SkillVfx {
  layers: VfxLayer[]
  /** battle-screen 이 기다리는 시간(속도 1 기준) — 생략 시 skill-motion 기본값 */
  castMs: number
  impactMs: number
  totalMs: number
  /** 화면 흔들림(시각 ms → 세기 px) */
  shakes?: { at: number; px: number }[]
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
  'fire-master-1': {
    castMs: 1700,
    impactMs: 2350,
    totalMs: 5000,
    layers: [
      L('fire-master-1-dragon', 'caster', 400, 900, 1500, { dx: 110, dy: -175, z: 4 }),
      L('fire-master-1-wall', 'screen', 440, 2050, 1400, { opacity: 0.92, z: 2 }),
      L('fire-master-1-nova', 'center', 520, 2350, 1200, { blend: 'screen', z: 5, scatter: { count: 3, spreadX: 260, spreadY: 90, jitterMs: 260 } }),
      // 잔불 — 「발화」의 불씨 레이어를 대상 주변에 흩뿌린다
      L('fire-adv-3-burn', 'targetGround', 150, 3000, 700, { repeat: 3, z: 1, scatter: { count: 3, spreadX: 90, spreadY: 26, jitterMs: 240 } }),
    ],
    shakes: [{ at: 2050, px: 6 }, { at: 2350, px: 12 }, { at: 2650, px: 8 }, { at: 3000, px: 5 }],
  },
  'fire-master-2': {
    castMs: 1700,
    impactMs: 2300,
    totalMs: 5000,
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
      L('ice-adv-2-snow', 'screen', 420, 300, 700, { repeat: 2, opacity: 0.45, blend: 'screen' }),
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
      L('ice-high-1-storm', 'screen', 440, 600, 800, { repeat: 2, opacity: 0.55, blend: 'screen' }),
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
    layers: [
      L('ice-master-1-circle', 'center', 680, 700, 1000, { dy: 60, repeat: 3, blend: 'screen', z: 1 }),
      L('ice-master-1-beams', 'center', 520, 1500, 1100, { dy: -40, blend: 'screen', z: 2, scatter: { count: 3, spreadX: 260, spreadY: 40, jitterMs: 200 } }),
      L('ice-master-1-prison', 'targetGround', 360, 2100, 1400, { dy: -150, z: 4 }),
      // 서리 덮개 — 화면 전체 눈폭풍을 옅게(전용 시트는 배경이 안 빠져 쓰지 않음)
      L('ice-high-1-storm', 'screen', 440, 2200, 750, { repeat: 2, opacity: 0.45, blend: 'screen', z: 5 }),
      L('ice-master-1-shatter', 'target', 380, 3350, 1000, { blend: 'screen', z: 6 }),
    ],
    shakes: [{ at: 2300, px: 9 }, { at: 3400, px: 12 }],
  },
  'ice-master-2': {
    castMs: 1700,
    impactMs: 2450,
    totalMs: 5000,
    layers: [
      L('ice-master-2-glacier', 'center', 620, 1650, 900, { dy: -170, z: 4 }),
      L('ice-master-2-crash', 'center', 660, 2400, 1200, { dy: 10, z: 5 }),
      L('ice-master-2-avalanche', 'screen', 420, 2550, 1300, { opacity: 0.85, blend: 'screen', z: 6 }),
      L('ice-master-2-cracks', 'targetGround', 280, 2650, 1100, { dy: -40, z: 3 }),
    ],
    shakes: [{ at: 2450, px: 14 }, { at: 2750, px: 9 }, { at: 3100, px: 6 }],
  },
}

export function skillVfx(skillId: string | undefined): SkillVfx | undefined {
  return skillId ? SKILL_VFX[skillId] : undefined
}

/** 시트 이름 전체(점검·자르기 스크립트용) */
export const VFX_SHEETS = Array.from(new Set(Object.values(SKILL_VFX).flatMap((v) => v.layers.map((l) => l.sheet))))
