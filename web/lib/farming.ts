// ============================================================================
// 농사(2026-11-05) — 울토르 마을 햇살 농가(농부 하름)의 밭 24칸에서 작물을 심고 기르고 거둔다.
//
//   · 작물: 마인크래프트식 밭작물(밀·감자·당근·비트·호박·수박·사탕수수·베리) + 기존 생활 재료(꽃·버섯·약초) + 나무(참나무)
//   · 성장: 실시간 4단계(새싹 → 자람 → 거의 다 → 수확). 물을 주면 그때부터 두 배로 자란다(수확하면 물기 초기화).
//   · 다시 자라는 작물(베리·사탕수수·나무)은 거둔 뒤 '자람' 단계로 돌아가 또 열린다.
//   · 씨앗은 하름의 농가 상점에서 산다. 거둘 때 씨앗이 함께 나오기도 한다(밀·비트처럼).
//   · 거둔 것은 채집(GATHER) 퀘스트 이벤트와 채집 도감에도 잡힌다.
//   · 그림: scripts/gen-farm-art.mjs → public/images/farm/<crop>-<stage>.svg · 아이콘 public/images/items/life/<id>.svg
// ============================================================================

import type { GameState, ItemDef, MaterialTag } from '@/lib/types'
import { villageShift } from '@/lib/village-layout'

export const FARM_MAP = 'village'
/** 거둔 뒤 물을 주면 그때부터 이 배수로 자란다 */
export const WATER_SPEED = 2
const MIN = 60 * 1000

export interface CropDef {
  id: string
  name: string
  /** 심는 씨앗 아이템 */
  seedId: string
  seedName: string
  seedPrice: number
  /** 다 자라기까지(물 없이, 분) */
  growMin: number
  /** 거두는 것 — 수량 [최소, 최대] */
  yields: { itemId: string; qty: [number, number]; chance?: number }[]
  /** 거둔 뒤 다시 '자람' 단계부터 열린다(베리·사탕수수·나무) */
  regrow?: boolean
  /** 그림 계열(gen-farm-art) */
  art: 'grain' | 'root' | 'vine' | 'cane' | 'bush' | 'flower' | 'shroom' | 'herb' | 'tree'
  /** 열매·꽃 색(그림) */
  color: string
  desc: string
}

export const CROPS: CropDef[] = [
  // ── 밭작물 ──
  { id: 'wheat', name: '밀', seedId: 'seed-wheat', seedName: '밀 씨앗', seedPrice: 10, growMin: 6, art: 'grain', color: '#e2c25a',
    yields: [{ itemId: 'crop-wheat', qty: [1, 2] }, { itemId: 'seed-wheat', qty: [1, 2] }], desc: '가장 빨리 자라는 곡식. 거두면 씨앗도 함께 나온다.' },
  { id: 'potato', name: '감자', seedId: 'seed-potato', seedName: '씨감자', seedPrice: 14, growMin: 8, art: 'root', color: '#c79a5a',
    yields: [{ itemId: 'crop-potato', qty: [2, 4] }, { itemId: 'seed-potato', qty: [1, 1], chance: 0.4 }], desc: '흙만 있으면 어디서든 자란다. 땅에서 처음 꺼낼 때의 묵직함이 좋다.' },
  { id: 'carrot', name: '당근', seedId: 'seed-carrot', seedName: '당근 씨앗', seedPrice: 14, growMin: 8, art: 'root', color: '#ec8a2c',
    yields: [{ itemId: 'crop-carrot', qty: [2, 3] }, { itemId: 'seed-carrot', qty: [1, 1], chance: 0.35 }], desc: '주황빛 뿌리 채소. 말도, 학생도 좋아한다.' },
  { id: 'beetroot', name: '비트', seedId: 'seed-beetroot', seedName: '비트 씨앗', seedPrice: 16, growMin: 10, art: 'root', color: '#a8304a',
    yields: [{ itemId: 'crop-beetroot', qty: [1, 2] }, { itemId: 'seed-beetroot', qty: [1, 2] }], desc: '붉은 뿌리. 수프에 넣으면 색이 예쁘다.' },
  { id: 'pumpkin', name: '호박', seedId: 'seed-pumpkin', seedName: '호박씨', seedPrice: 24, growMin: 16, art: 'vine', color: '#e07a1a',
    yields: [{ itemId: 'crop-pumpkin', qty: [1, 1] }, { itemId: 'seed-pumpkin', qty: [1, 2], chance: 0.6 }], desc: '덩굴 끝에 하나 열리는 커다란 호박.' },
  { id: 'melon', name: '수박', seedId: 'seed-melon', seedName: '수박씨', seedPrice: 26, growMin: 16, art: 'vine', color: '#3f9a3a',
    yields: [{ itemId: 'crop-melon', qty: [3, 5] }, { itemId: 'seed-melon', qty: [1, 1], chance: 0.5 }], desc: '쪼개면 조각이 여럿 나온다.' },
  { id: 'sugarcane', name: '사탕수수', seedId: 'seed-sugarcane', seedName: '사탕수수 모종', seedPrice: 20, growMin: 12, art: 'cane', color: '#8ccf5a', regrow: true,
    yields: [{ itemId: 'crop-sugarcane', qty: [2, 3] }], desc: '베어도 밑동에서 다시 자란다.' },
  { id: 'berry', name: '달콤 베리', seedId: 'seed-berry', seedName: '베리 묘목', seedPrice: 22, growMin: 12, art: 'bush', color: '#d6334f', regrow: true,
    yields: [{ itemId: 'crop-berry', qty: [2, 4] }], desc: '덤불에 다시 열리는 붉은 열매.' },
  // ── 꽃 · 버섯 · 약초(기존 채집 재료를 밭에서) ──
  { id: 'dew', name: '이슬꽃', seedId: 'seed-dew', seedName: '이슬꽃 씨앗', seedPrice: 8, growMin: 5, art: 'flower', color: '#9fd8ff',
    yields: [{ itemId: 'flower-dew', qty: [2, 3] }], desc: '아침 이슬을 머금고 피는 작은 꽃.' },
  { id: 'cloudflower', name: '구름꽃', seedId: 'seed-cloud', seedName: '구름꽃 씨앗', seedPrice: 22, growMin: 9, art: 'flower', color: '#f2f2ff',
    yields: [{ itemId: 'flower-cloud', qty: [1, 2] }], desc: '하늘 마을에서 건너온 하얀 꽃.' },
  { id: 'button', name: '갈색 버섯', seedId: 'spore-button', seedName: '갈색 버섯 포자', seedPrice: 10, growMin: 6, art: 'shroom', color: '#9a6a3c',
    yields: [{ itemId: 'mush-button', qty: [2, 3] }], desc: '그늘진 이랑에서 잘 자란다.' },
  { id: 'glowshroom', name: '빛버섯', seedId: 'spore-glow', seedName: '빛버섯 포자', seedPrice: 26, growMin: 12, art: 'shroom', color: '#7ff0d0',
    yields: [{ itemId: 'mush-glow', qty: [1, 2] }], desc: '밤이면 은은하게 빛나는 버섯.' },
  { id: 'mint', name: '숲박하', seedId: 'seed-mint', seedName: '숲박하 씨앗', seedPrice: 8, growMin: 5, art: 'herb', color: '#5cc46a',
    yields: [{ itemId: 'herb-mint', qty: [2, 4] }], desc: '회복약의 기본 재료.' },
  { id: 'moonleaf', name: '달잎풀', seedId: 'seed-moonleaf', seedName: '달잎풀 씨앗', seedPrice: 30, growMin: 14, art: 'herb', color: '#b9b4ff',
    yields: [{ itemId: 'herb-moonleaf', qty: [1, 2] }], desc: '달빛을 머금은 희귀 약초.' },
  // ── 나무 ──
  { id: 'oak', name: '참나무', seedId: 'sapling-oak', seedName: '참나무 묘목', seedPrice: 40, growMin: 30, art: 'tree', color: '#3f8a3a', regrow: true,
    yields: [{ itemId: 'wood-oak', qty: [3, 4] }, { itemId: 'crop-apple', qty: [1, 2], chance: 0.4 }], desc: '다 자라면 가지를 거두고, 가끔 사과도 열린다. 베어도 다시 자란다.' },
]
const CROP_BY_ID = new Map(CROPS.map((c) => [c.id, c]))
const CROP_BY_SEED = new Map(CROPS.map((c) => [c.seedId, c]))
export const cropById = (id: string) => CROP_BY_ID.get(id)
export const cropBySeed = (seedId: string) => CROP_BY_SEED.get(seedId)

// ── 아이템(씨앗 · 새 수확물) ────────────────────────────────────────────────
const icon = (id: string) => `/images/items/life/${id}.svg`
const seedItem = (c: CropDef): ItemDef => ({
  id: c.seedId, name: c.seedName, type: 'material', icon: icon(c.seedId), description: `햇살 농가 밭에 심는다 — ${c.name}(${c.growMin}분, 물 주면 더 빨리). ${c.desc}`,
  price: c.seedPrice, sellPrice: Math.max(1, Math.round(c.seedPrice / 3)), stackable: true, maxStack: 99, shopBuyable: true, tags: ['seed'],
})
const produce = (id: string, name: string, sellPrice: number, description: string, tags: MaterialTag[] = ['crop']): ItemDef => ({
  id, name, type: 'material', icon: icon(id), description, price: 0, sellPrice, stackable: true, maxStack: 99, shopBuyable: false, tags,
})
export const FARM_ITEMS: ItemDef[] = [
  ...CROPS.map(seedItem),
  produce('crop-wheat', '밀 이삭', 6, '빵과 사료의 재료. 햇살 농가에서 거둔 곡식.'),
  produce('crop-potato', '감자', 8, '땅에서 꺼낸 묵직한 감자. 굽기만 해도 맛있다.'),
  produce('crop-carrot', '당근', 8, '아삭한 주황빛 뿌리 채소.'),
  produce('crop-beetroot', '비트', 10, '붉은 뿌리 채소. 수프 재료.'),
  produce('crop-pumpkin', '호박', 26, '덩굴에서 거둔 커다란 호박.'),
  produce('crop-melon', '수박 조각', 7, '시원하고 달다.'),
  produce('crop-sugarcane', '사탕수수', 9, '단맛의 원료. 연금술 촉매로도 쓴다.'),
  produce('crop-berry', '달콤 베리', 9, '덤불에서 딴 붉은 열매.'),
  produce('crop-apple', '사과', 12, '참나무에 드물게 열리는 붉은 사과.'),
]

// ── 밭 24칸 — 허수아비(26.6) 줄은 통로로 비우고 서·동 3열 × 4행 ───────────────
export interface FarmPlotDef {
  id: string
  cell: { x: number; y: number }
}
const COLS = [23.3, 24.4, 25.5, 27.7, 28.8, 29.9]
const ROWS = [33.3, 34.4, 35.5, 36.6]
export const FARM_PLOTS: FarmPlotDef[] = ROWS.flatMap((y, r) => COLS.map((x, c) => ({ id: `p${r}${c}`, cell: villageShift({ x, y }) })))
const PLOT_BY_ID = new Map(FARM_PLOTS.map((p) => [p.id, p]))
export const plotById = (id: string) => PLOT_BY_ID.get(id)

export interface FarmPlotState {
  crop: string
  plantedAt: number
  /** 물 준 시각 — 그때부터 WATER_SPEED 배로 자란다 */
  waterAt?: number
}
export type FarmState = { plots: Record<string, FarmPlotState> }

/** 0~1 성장도(1 = 수확 가능) */
export function growth(p: FarmPlotState, now = Date.now()): number {
  const c = cropById(p.crop)
  if (!c) return 0
  const ms = now - p.plantedAt + (p.waterAt ? (now - p.waterAt) * (WATER_SPEED - 1) : 0)
  return Math.min(1, ms / (c.growMin * MIN))
}
/** 0 새싹 · 1 자람 · 2 거의 다 · 3 수확 */
export const stageOf = (g: number) => (g >= 1 ? 3 : g >= 0.6 ? 2 : g >= 0.25 ? 1 : 0)
export const STAGE_LABEL = ['새싹', '자라는 중', '거의 다 자람', '수확할 때']

/** 남은 시간(분, 올림) */
export function minutesLeft(p: FarmPlotState, now = Date.now()): number {
  const c = cropById(p.crop)
  if (!c) return 0
  const left = (1 - growth(p, now)) * c.growMin * MIN
  const speed = p.waterAt ? WATER_SPEED : 1
  return Math.max(0, Math.ceil(left / speed / MIN))
}

/** 플레이어 가까이(1.1칸)의 밭 칸 */
export function nearestPlot(mapId: string, pos: { x: number; y: number }): FarmPlotDef | null {
  if (mapId !== FARM_MAP) return null
  let best: FarmPlotDef | null = null
  let bd = 1.1
  for (const p of FARM_PLOTS) {
    const d = Math.hypot(p.cell.x - pos.x, p.cell.y - pos.y)
    if (d < bd) {
      bd = d
      best = p
    }
  }
  return best
}

export const farmOf = (state: Pick<GameState, 'farm'>): FarmState => state.farm ?? { plots: {} }

/** 밭 칸의 E 안내 문구 */
export function plotPrompt(state: Pick<GameState, 'farm'>, plotId: string, now = Date.now()): string {
  const p = farmOf(state).plots[plotId]
  if (!p) return '밭 — 씨앗 심기'
  const c = cropById(p.crop)
  const g = growth(p, now)
  if (g >= 1) return `${c?.name ?? ''} 거두기`
  if (!p.waterAt) return `${c?.name ?? ''} 물 주기 (${STAGE_LABEL[stageOf(g)]} · ${minutesLeft(p, now)}분 남음)`
  return `${c?.name ?? ''} — ${STAGE_LABEL[stageOf(g)]} · 약 ${minutesLeft(p, now)}분`
}
