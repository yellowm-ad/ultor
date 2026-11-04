// ============================================================================
// 등급 표기(2026-11-04) — 스킬 등급(하급~최상급)과 아이템 등급(일반~고유)을 한눈에 '좋은 것'으로 읽히게.
//   · 이름 + 수식 문구(epithet) + 색 단계(tone) — components/game/grade-badge 가 장식해서 그린다.
//   · 아이템 등급: 데이터에 rarity 가 없으면 tier → 가격 순으로 가늠한다(물약·재료 대부분이 rarity 없이 들어 있다).
// ============================================================================
import type { ItemDef, ItemRarity } from '@/lib/types'
import type { SkillGrade } from '@/lib/skill-mastery'

/** 색 단계 — 1 동 · 2 은 · 3 청 · 4 자 · 5 금 */
export type GradeTone = 1 | 2 | 3 | 4 | 5

export interface GradeInfo {
  label: string
  epithet: string
  tone: GradeTone
  /** 이름 양옆 장식 기호 */
  mark: string
}

export const SKILL_GRADE_INFO: Record<SkillGrade, GradeInfo> = {
  1: { label: '하급', epithet: '입문의 마법', tone: 1, mark: '' },
  2: { label: '중급', epithet: '숙련의 마법', tone: 2, mark: '◇' },
  3: { label: '상급', epithet: '비전의 마법', tone: 4, mark: '◆' },
  4: { label: '최상급', epithet: '전설로만 전해지는 비기', tone: 5, mark: '✦' },
}

export const ITEM_GRADE_INFO: Record<ItemRarity, GradeInfo> = {
  common: { label: '일반', epithet: '어디서나 볼 수 있는 물건', tone: 1, mark: '' },
  uncommon: { label: '고급', epithet: '장인의 손길이 닿은 물건', tone: 2, mark: '◇' },
  rare: { label: '희귀', epithet: '좀처럼 보기 힘든 보물', tone: 3, mark: '◆' },
  mythic: { label: '신화', epithet: '전설에 이름을 남긴 유물', tone: 4, mark: '✧' },
  unique: { label: '고유', epithet: '세상에 단 하나뿐인', tone: 5, mark: '✦' },
}

const TIER_RARITY: Record<number, ItemRarity> = { 1: 'common', 2: 'uncommon', 3: 'rare', 4: 'mythic', 5: 'mythic' }

/** 아이템 등급 — rarity > tier > 가격 */
export function itemRarity(it: Pick<ItemDef, 'rarity' | 'tier' | 'price' | 'type'>): ItemRarity {
  if (it.rarity) return it.rarity
  if (it.tier) return TIER_RARITY[it.tier] ?? 'common'
  const p = it.price ?? 0
  if (p >= 3000) return 'mythic'
  if (p >= 800) return 'rare'
  if (p >= 200) return 'uncommon'
  return 'common'
}
