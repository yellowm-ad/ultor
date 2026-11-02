// ============================================================================
// 코스튬 = 스킨 통째 갈아입기(2026-11-02)
//
//   · 부분별 커스터마이징(머리·옷 따로)과 코스튬 '제작'은 폐기. 대신 캐릭터마다 옷장(옷 한 벌 = 스프라이트 시트 한 장)을 둔다.
//   · 주인공과 동료 NPC 모두 같은 방식 — 입은 코스튬의 시트가 월드·전투·창·첫 이동 스테이지 어디서나 그대로 쓰인다.
//   · 시트 규격은 기존과 같다: public/images/sprites/<sheet>.png, 88px 칸 · 8열(row0 회전, row1~3 걷기).
//     주인공 코스튬은 성별마다 시트가 따로 있으니 sheet 에 {male, female} 을 준다.
//   · 기본 복장(교복 / 각 NPC 기본 도트)은 처음부터 가지고 있고, 나머지는 owned 에 들어와야 입을 수 있다
//     (얻는 경로 — 상점·이벤트·스토리 보상 — 는 콘텐츠를 만들 때 정한다. 지금은 관리자 지급만).
//
//   새 코스튬 추가: 시트를 public/images/sprites 에 넣고 아래 COSTUMES 에 한 줄.
//     { id: 'hero-festival', owner: 'hero', name: '축제 예복', description: '…', sheet: { male: 'protag-festival-male', female: 'protag-festival-female' } }
//     { id: 'rian-summer', owner: 'comp-rian', name: '여름 교복', description: '…', sheet: 'npc-rian-summer' }
// ============================================================================

import type { GameState, Gender, SpriteSheet } from '@/lib/types'
import { SCHOOL_NPCS, schoolNpcById } from '@/lib/companions'

/** 'hero' = 주인공, 그 밖에는 학교 NPC(동료) id */
export type CostumeOwner = string

export interface CostumeDef {
  id: string
  owner: CostumeOwner
  name: string
  description: string
  /** 시트 키 — 주인공은 성별별 */
  sheet: SpriteSheet | Record<Gender, SpriteSheet>
  /** 기본 복장(처음부터 가짐 · 벗으면 이걸로) */
  base?: boolean
}

export interface WardrobeState {
  /** 얻은 코스튬 id(기본 복장은 넣지 않아도 늘 가진 것으로 친다) */
  owned: string[]
  /** 주인(owner) → 입은 코스튬 id. 없으면 기본 복장 */
  worn: Record<CostumeOwner, string>
}

export const HERO: CostumeOwner = 'hero'

const BASE_COSTUMES: CostumeDef[] = [
  { id: 'hero-uniform', owner: HERO, name: '울토르 교복', description: '입학 때 받은 울토르 마법학교 교복.', sheet: { male: 'protag-male', female: 'protag-female' }, base: true },
  ...SCHOOL_NPCS.map((n) => ({ id: `${n.id}-base`, owner: n.id, name: '기본 복장', description: `${n.name}의 평소 차림.`, sheet: n.sprite, base: true })),
]

/** 추가 코스튬(스킨) — 시트가 준비되는 대로 여기에 더한다 */
const EXTRA_COSTUMES: CostumeDef[] = []

export const COSTUMES: CostumeDef[] = [...BASE_COSTUMES, ...EXTRA_COSTUMES]
const BY_ID = new Map(COSTUMES.map((c) => [c.id, c]))
export const costumeById = (id: string) => BY_ID.get(id)
export const costumesOf = (owner: CostumeOwner) => COSTUMES.filter((c) => c.owner === owner)
export const baseCostumeOf = (owner: CostumeOwner) => COSTUMES.find((c) => c.owner === owner && c.base)

export const emptyWardrobe = (): WardrobeState => ({ owned: [], worn: {} })

type S = Pick<GameState, 'wardrobe' | 'player'>

export function ownsCostume(state: Pick<GameState, 'wardrobe'>, id: string): boolean {
  const c = costumeById(id)
  return !!c && (!!c.base || !!state.wardrobe?.owned.includes(id))
}

/** 지금 입은 코스튬(없거나 잃었으면 기본 복장) */
export function wornCostume(state: Pick<GameState, 'wardrobe'>, owner: CostumeOwner): CostumeDef | undefined {
  const id = state.wardrobe?.worn[owner]
  const c = id ? costumeById(id) : undefined
  return c && c.owner === owner && ownsCostume(state, c.id) ? c : baseCostumeOf(owner)
}

function sheetFor(c: CostumeDef | undefined, gender: Gender): SpriteSheet | undefined {
  if (!c) return undefined
  return typeof c.sheet === 'string' ? c.sheet : c.sheet[gender]
}

/** 주인공 시트 키(public/images/sprites/<키>.png) */
export function heroSheet(state: S): SpriteSheet {
  return sheetFor(wornCostume(state, HERO), state.player.appearance.gender) ?? `protag-${state.player.appearance.gender}`
}

/** 동료 NPC 시트 키 — 코스튬을 입었으면 그 시트 */
export function npcSheet(state: S, npcId: string): SpriteSheet | undefined {
  return sheetFor(wornCostume(state, npcId), state.player.appearance.gender) ?? schoolNpcById(npcId)?.sprite
}

/** 시트 키 → 이미지 경로 */
export const sheetSrc = (sheet: SpriteSheet) => `/images/sprites/${sheet}.png`
