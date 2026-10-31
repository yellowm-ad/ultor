// ============================================================================
// 스킬 숙련도(2026-10-31 개편) — 설계: 울토르_시스템_개편_PRD_v2.1 §S1
//   · 배운 스킬마다 숙련도 Lv.1 ~ Lv.10. 등급(하급·중급·상급·최상급)이 높을수록 다음 레벨까지 더 많이 쌓아야 한다.
//   · 숙련 경험치는 세 갈래로 쌓인다: ① 전투에서 그 스킬을 쓸 때마다 ② 그 스킬을 다루는 수업(실습 주제)을 들을 때
//     ③ 「스킬 숙련의 스크롤」을 읽을 때(옛 펫 먹이를 대신하는 아이템).
//   · 숙련도가 오르면 위력 +4%/Lv, MP 소모 −2%/Lv(Lv.10 = 위력 +36%, MP −18%). 소환 마법은 Lv.7부터 3턴 머문다.
// ============================================================================
import type { PlayerCharacter, Skill } from '@/lib/types'

export const MASTERY_MAX = 10

export type SkillGrade = 1 | 2 | 3 | 4
export const GRADE_LABEL: Record<SkillGrade, string> = { 1: '하급', 2: '중급', 3: '상급', 4: '최상급' }

/** 스킬 등급 — id 접미어(basic/adv/high/master) 우선, 없으면 MP 소모로 가늠 */
export function skillGrade(s: Pick<Skill, 'id' | 'mpCost' | 'grade'>): SkillGrade {
  if (s.grade) return s.grade
  if (s.id.includes('-basic-')) return 1
  if (s.id.includes('-adv-')) return 2
  if (s.id.includes('-high-')) return 3
  if (s.id.includes('-master-')) return 4
  if (s.mpCost <= 7) return 1
  if (s.mpCost <= 12) return 2
  if (s.mpCost <= 20) return 3
  return 4
}

/** 등급별 기본 요구치 — Lv.L → L+1 에 BASE × (1 + 0.5·(L−1)) */
const GRADE_BASE: Record<SkillGrade, number> = { 1: 5, 2: 8, 3: 12, 4: 18 }

export function masteryNeed(grade: SkillGrade, level: number): number {
  if (level >= MASTERY_MAX) return 0
  return Math.ceil(GRADE_BASE[grade] * (1 + 0.5 * (level - 1)))
}

export interface MasteryRec {
  lv: number
  xp: number
}

export function masteryOf(player: Pick<PlayerCharacter, 'skillMastery'>, skillId: string): MasteryRec {
  return player.skillMastery?.[skillId] ?? { lv: 1, xp: 0 }
}

/** 숙련 경험치 더하기 — 레벨이 넘치면 올린다. 오른 레벨 수를 돌려준다 */
export function addMasteryXp(rec: MasteryRec, grade: SkillGrade, xp: number): { rec: MasteryRec; gained: number } {
  let { lv, xp: cur } = rec
  const before = lv
  cur += Math.max(0, Math.round(xp))
  while (lv < MASTERY_MAX && cur >= masteryNeed(grade, lv)) {
    cur -= masteryNeed(grade, lv)
    lv += 1
  }
  if (lv >= MASTERY_MAX) cur = 0
  return { rec: { lv, xp: cur }, gained: lv - before }
}

/** 숙련도 → 위력 배율 */
export const masteryPowerMult = (lv: number) => 1 + 0.04 * (Math.max(1, lv) - 1)
/** 숙련도 → MP 소모 배율 */
export const masteryMpMult = (lv: number) => 1 - 0.02 * (Math.max(1, lv) - 1)
/** 숙련도를 반영한 MP 소모(전투 엔진·UI 공용) */
export function masteredMpCost(skill: Pick<Skill, 'mpCost'>, lv = 1): number {
  return skill.mpCost <= 0 ? 0 : Math.max(1, Math.round(skill.mpCost * masteryMpMult(lv)))
}
/** 소환 마법이 머무는 턴 — 기본 2턴, 숙련도 7부터 3턴 */
export const summonTurnsFor = (lv: number, base = 2) => base + (lv >= 7 ? 1 : 0)

/** 플레이어 숙련도에 경험치 반영(여러 스킬 한 번에). 레벨이 오른 스킬 이름 목록과 새 플레이어 */
export function grantMastery(
  player: PlayerCharacter,
  gains: Record<string, number>,
  skillOf: (id: string) => Skill | undefined,
): { player: PlayerCharacter; ups: { skillId: string; lv: number }[] } {
  const table = { ...(player.skillMastery ?? {}) }
  const ups: { skillId: string; lv: number }[] = []
  for (const [id, xp] of Object.entries(gains)) {
    const s = skillOf(id)
    if (!s || !player.learnedSkills.includes(id) || xp <= 0) continue
    const r = addMasteryXp(table[id] ?? { lv: 1, xp: 0 }, skillGrade(s), xp)
    table[id] = r.rec
    if (r.gained > 0) ups.push({ skillId: id, lv: r.rec.lv })
  }
  return { player: { ...player, skillMastery: table }, ups }
}

/** 전투 1회 사용 = 숙련 경험치 1 */
export const MASTERY_XP_PER_USE = 1
/** 수업 평가별 숙련 경험치(실습 주제 스킬) — 강의는 0.6배, 실습 주간은 1.5배 */
export const CLASS_MASTERY_XP: Record<'S' | 'A' | 'B' | 'C' | 'D', number> = { S: 14, A: 10, B: 7, C: 5, D: 2 }
