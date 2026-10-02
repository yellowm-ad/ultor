// ============================================================================
// 학사 시스템 (§학사 PRD 30~32, 59~61 · PRD v2.0 §4, §34~39)
//
//   · 8개 정규학기 × 학기당 12학점 = 96학점(졸업 요건)
//   · 학기마다 과목 4개(각 3학점)를 자동 수강한다. 방학에는 수업이 없다.
//   · 주간 CLASS 퀘스트 보상(COURSE)이 이번 학기 과목 점수를 올리고, 학기 마지막 주를 마감할 때
//     점수 → 성적(A~F) → 학점으로 정산된다.
//   · 수업이 곧 스킬 습득 경로다(§4): 과목의 teachesSkills 를 수업 진도(점수)에 따라 차례로 배운다.
//       - 수업 점수가 SKILL_SCORE_SPAN 까지 오르는 동안 균등 간격으로 하나씩(첫 스킬도 첫 과제 이후)
//       - 학기 정산에서 D 이상으로 이수하면 못 배운 스킬도 모두 습득(낙제 F 면 남은 스킬은 놓친다)
//   · 1학년 3원소 기초 → 2학년 3원소 심화(광역·상태이상·전술) → 3학년 어둠·빛 개방 + 상급 3원소
//     → 4학년 최상위 스킬. 바람은 끝까지 가르치지 않는다(모르스 전용).
//   · 과목은 다른 시스템을 여는 역할도 한다(unlocksActivities/unlocksRecipes — 해금 시점 자체는 lib/life.ts 캘린더 기준).
// ============================================================================

import type { AcademicState, TermType } from '@/lib/types'
import { calendarInfo } from '@/lib/calendar'

export type Department = 'magic' | 'life' | 'craft' | 'history'

export const DEPARTMENT_LABEL: Record<Department, string> = {
  magic: '마법 계열',
  life: '생활 계열',
  craft: '제작 계열',
  history: '역사 계열',
}

export interface CourseDef {
  id: string
  name: string
  department: Department
  year: number
  term: Extract<TermType, 'semester1' | 'semester2'>
  required: boolean
  credit: number
  /** 담당 NPC(없으면 미정) — 스토리 작업 시 채울 것 */
  teacherNpcId?: string
  description: string
  /** 수업 진도에 따라 차례로 배우는 스킬 id(순서 = 배우는 순서) */
  teachesSkills?: string[]
  /** 이 과목과 연결된 생활 활동(lib/life ActivityId) */
  unlocksActivities?: string[]
  /** 이 과목과 연결된 레시피 id */
  unlocksRecipes?: string[]
}

const C = 3 // 과목당 학점(4과목 × 3 = 학기당 12학점)

export const COURSES: CourseDef[] = [
  // ── 1학년 1학기 — 3원소 입문 ──────────────────────────────────────────────
  { id: 'FIRE_101', name: '화염마법 기초', department: 'magic', year: 1, term: 'semester1', required: true, credit: C, teacherNpcId: 'npc-job-trainer', description: '불씨를 다루는 법부터 화염 강타까지.', teachesSkills: ['fire-basic-1', 'fire-basic-2', 'fire-basic-3'] },
  { id: 'ICE_101', name: '빙결마법 기초', department: 'magic', year: 1, term: 'semester1', required: true, credit: C, description: '서리와 얼음 방패, 냉기 제어의 기초.', teachesSkills: ['ice-basic-1', 'ice-basic-2', 'ice-basic-3'] },
  { id: 'EARTH_101', name: '대지마법 기초', department: 'magic', year: 1, term: 'semester1', required: true, credit: C, description: '돌과 흙을 움직이고 몸을 굳히는 법.', teachesSkills: ['earth-basic-1', 'earth-basic-2', 'earth-basic-3'] },
  { id: 'FIELD_101', name: '실전 탐사 I', department: 'life', year: 1, term: 'semester1', required: false, credit: C, description: '에르디아 숲 견학과 채집·응급 처치 기초.', teachesSkills: ['n-firstaid', 'n-focus'], unlocksActivities: ['gathering'] },
  // ── 1학년 2학기 ──────────────────────────────────────────────────────────
  { id: 'ELEMENT_102', name: '원소 상성', department: 'magic', year: 1, term: 'semester2', required: true, credit: C, teacherNpcId: 'npc-job-trainer', description: '불꽃 > 얼음 > 대지 순환 상성과 상태이상 응용.', teachesSkills: ['fire-adv-1', 'ice-adv-1', 'earth-adv-1'] },
  { id: 'CRAFT_101', name: '기초 제작', department: 'craft', year: 1, term: 'semester2', required: true, credit: C, description: '마도구 작업대 사용법과 장비 제작 기초.', unlocksActivities: ['crafting'] },
  { id: 'HISTORY_101', name: '마법사 역사 입문', department: 'history', year: 1, term: 'semester2', required: false, credit: C, teacherNpcId: 'npc-librarian', description: '울토르의 건립과 인마대전 개요.' },
  { id: 'BIO_101', name: '마법 생물학', department: 'life', year: 1, term: 'semester2', required: false, credit: C, description: '물과 바다의 마법 생물.', unlocksActivities: ['fishing'] },
  // ── 2학년 1학기 — 3원소 심화 I(광역) ─────────────────────────────────────
  { id: 'TRIAD_201', name: '3원소 심화 I — 광역', department: 'magic', year: 2, term: 'semester1', required: true, credit: C, description: '한 번에 여러 적을 상대하는 광역 마법과 아군 보호.', teachesSkills: ['fire-adv-2', 'ice-adv-2', 'earth-adv-2'] },
  { id: 'ALCHEMY_201', name: '연금술 I', department: 'life', year: 2, term: 'semester1', required: true, credit: C, description: '약초 조합과 물약 제조.', unlocksActivities: ['alchemy'] },
  { id: 'ECOLOGY_201', name: '마법 생태학 I', department: 'life', year: 2, term: 'semester1', required: true, credit: C, description: '해양·심해 생태계와 채집학.' },
  { id: 'COOKING_201', name: '요리학', department: 'life', year: 2, term: 'semester1', required: false, credit: C, description: '전투 보조 요리와 식재료.', unlocksActivities: ['cooking'] },
  // ── 2학년 2학기 — 3원소 심화 II(상태이상·제어) + 전투학 ────────────────────
  { id: 'TRIAD_202', name: '3원소 심화 II — 제어', department: 'magic', year: 2, term: 'semester2', required: true, credit: C, description: '화상·마비·수면으로 전장을 지배하는 법.', teachesSkills: ['fire-adv-3', 'ice-adv-3', 'earth-adv-3', 'fire-adv-4'] },
  { id: 'BATTLE_202', name: '마법 전투학', department: 'magic', year: 2, term: 'semester2', required: true, credit: C, description: '전위·후위·보조 포지션과 파티 전술.', teachesSkills: ['n-rally', 'n-laststand'] },
  { id: 'RUINS_202', name: '고대 유적학', department: 'history', year: 2, term: 'semester2', required: false, credit: C, description: '하늘 유적과 고대 구조물.' },
  { id: 'HUNT_202', name: '사냥학', department: 'life', year: 2, term: 'semester2', required: false, credit: C, description: '몬스터 부산물 채취와 손질.', unlocksActivities: ['hunting'] },
  // ── 3학년 1학기 — 어둠·빛 개방 ───────────────────────────────────────────
  { id: 'DARK_301', name: '암흑마법 응용', department: 'magic', year: 3, term: 'semester1', required: true, credit: C, description: '약화·은신·환술, 그리고 잡몹을 한 번에 끝내는 사신의 낙인.', teachesSkills: ['dark-curse', 'dark-veil', 'dark-illusion', 'dark-execute'] },
  { id: 'LIGHT_301', name: '광휘마법 응용', department: 'magic', year: 3, term: 'semester1', required: true, credit: C, description: '치유·축복·정화·소생 — 동료를 지키는 빛.', teachesSkills: ['light-heal', 'light-might', 'light-purify', 'light-revive'] },
  { id: 'HOUSING_301', name: '하우징 제작', department: 'craft', year: 3, term: 'semester1', required: true, credit: C, description: '가구 제작과 공간 설계.', unlocksActivities: ['furniture'] },
  { id: 'DEMON_301', name: '마족학', department: 'history', year: 3, term: 'semester1', required: false, credit: C, description: '마족의 생태와 역사.' },
  // ── 3학년 2학기 — 상급 3원소 ─────────────────────────────────────────────
  { id: 'ELEMENT_302', name: '고급 원소학', department: 'magic', year: 3, term: 'semester2', required: true, credit: C, description: '3원소 상급 마법과 복합 운용.', teachesSkills: ['fire-high-1', 'ice-high-1', 'earth-high-1', 'fire-high-2', 'ice-high-2', 'earth-high-2'] },
  { id: 'MAGITECH_302', name: '마법 공학', department: 'craft', year: 3, term: 'semester2', required: true, credit: C, description: '마도구 제작 II.', unlocksActivities: ['magicTool'] },
  { id: 'ALCHEMY_302', name: '고급 연금술', department: 'life', year: 3, term: 'semester2', required: true, credit: C, description: '촉매와 재료 변환.' },
  { id: 'COSTUME_302', name: '의상 제작', department: 'craft', year: 3, term: 'semester2', required: false, credit: C, description: '코스튬 제작.', unlocksActivities: ['costume'] },
  // ── 4학년 1학기 — 최상위 3원소 + 암광 심화 ───────────────────────────────
  { id: 'ANCIENT_MAGIC_401', name: '고대 마법', department: 'magic', year: 4, term: 'semester1', required: true, credit: C, description: '잊힌 고대 마법 체계 — 3원소의 정점.', teachesSkills: ['fire-master-1', 'ice-master-1', 'earth-master-1'] },
  { id: 'DUSKDAWN_401', name: '암광 심화', department: 'magic', year: 4, term: 'semester1', required: true, credit: C, description: '어둠과 빛의 고급 운용 — 광역 약화·광역 회복·축복.', teachesSkills: ['dark-seal', 'light-sanctuary', 'dark-miasma', 'light-wisdom', 'light-bulwark', 'dark-gaze', 'light-ward', 'light-haste'] },
  { id: 'SEAL_401', name: '봉인학', department: 'history', year: 4, term: 'semester1', required: true, credit: C, description: '인마대전의 봉인 방식.' },
  { id: 'WARHISTORY_401', name: '인마대전사', department: 'history', year: 4, term: 'semester1', required: false, credit: C, description: '인마대전의 전말.' },
  // ── 4학년 2학기 — 졸업 실습·최종전 대비 ──────────────────────────────────
  { id: 'ARCHMAGE_402', name: '대마도사 실습', department: 'magic', year: 4, term: 'semester2', required: true, credit: C, description: '졸업 실습 — 각 속성의 마지막 장.', teachesSkills: ['fire-master-2', 'ice-master-2', 'earth-master-2', 'light-rebirth', 'dark-sentence'] },
  { id: 'TACTICS_402', name: '고급 전투학', department: 'magic', year: 4, term: 'semester2', required: true, credit: C, description: '대규모 방어전 전술.' },
  { id: 'LOSTWIND_402', name: '유실 속성 연구', department: 'history', year: 4, term: 'semester2', required: false, credit: C, description: '기록으로만 남은 "바람" 속성과 모르스. 바람 마법 자체는 가르치지 않는다.' },
  { id: 'THESIS_402', name: '졸업 논문', department: 'history', year: 4, term: 'semester2', required: false, credit: C, description: '4년간의 연구 정리.' },
]

const COURSE_BY_ID = new Map(COURSES.map((c) => [c.id, c]))
export function courseById(id: string): CourseDef | undefined {
  return COURSE_BY_ID.get(id)
}

/** 개편 전 커리큘럼 과목명(예전 세이브의 성적표 표시용) */
const RETIRED_COURSE_NAMES: Record<string, string> = {
  MAGIC_101: '삼원 기초',
  ELEMENT_301: '고급 원소학(구)',
}
/** 개편 전 과목을 이수했던 세이브 — 그 자리를 대신하는 새 과목들의 마법을 준다 */
const RETIRED_COURSE_REPLACED_BY: Record<string, string[]> = {
  MAGIC_101: ['FIRE_101', 'ICE_101', 'EARTH_101'],
  ELEMENT_301: ['ELEMENT_302'],
}

export function courseName(id: string): string {
  return courseById(id)?.name ?? RETIRED_COURSE_NAMES[id] ?? id
}

export const GRADUATION_CREDITS = 96

/** 현재 주차에 열려 있는 과목(방학이면 빈 배열) */
export function coursesForWeek(globalWeek: number): CourseDef[] {
  const info = calendarInfo(globalWeek)
  if (info.isVacation) return []
  return COURSES.filter((c) => c.year === info.year && c.term === info.termType)
}

export function gradeForScore(score: number): { grade: string; creditRatio: number } {
  if (score >= 90) return { grade: 'A+', creditRatio: 1 }
  if (score >= 80) return { grade: 'A', creditRatio: 1 }
  if (score >= 65) return { grade: 'B', creditRatio: 1 }
  if (score >= 50) return { grade: 'C', creditRatio: 1 }
  if (score >= 30) return { grade: 'D', creditRatio: 0.5 }
  return { grade: 'F', creditRatio: 0 }
}

/**
 * 과목 점수 가산 — courseId 가 없으면 이번 학기 과목 중 점수가 가장 낮은 과목에 준다
 * (한 과목만 편식하지 않게).
 */
export function addCourseScore(ac: AcademicState, globalWeek: number, amount: number, courseId?: string): AcademicState {
  const open = coursesForWeek(globalWeek)
  if (open.length === 0) return ac
  const target =
    (courseId ? open.find((c) => c.id === courseId) : undefined) ??
    open.slice().sort((a, b) => (ac.courseScore[a.id] ?? 0) - (ac.courseScore[b.id] ?? 0))[0]
  const next = Math.min(100, (ac.courseScore[target.id] ?? 0) + amount)
  return { ...ac, courseScore: { ...ac.courseScore, [target.id]: next } }
}

/** 학기 마지막 주 마감 시 호출 — 성적 기록 + 학점 합산 + 점수 초기화 */
export function settleTerm(ac: AcademicState, globalWeek: number): { academics: AcademicState; summary: string | null } {
  const info = calendarInfo(globalWeek)
  const open = coursesForWeek(globalWeek)
  if (open.length === 0) return { academics: ac, summary: null }
  let gained = 0
  const courses = open.map((c) => {
    const score = ac.courseScore[c.id] ?? 0
    const { grade, creditRatio } = gradeForScore(score)
    const credit = Math.round(c.credit * creditRatio)
    gained += credit
    return { courseId: c.id, score, grade, credit }
  })
  return {
    academics: {
      courseScore: {},
      totalCredits: ac.totalCredits + gained,
      history: [...ac.history, { termIndex: info.termIndex, courses }],
    },
    summary: `학기 종료 — ${courses.map((c) => `${courseName(c.courseId)} ${c.grade}`).join(', ')} · 학점 +${gained}`,
  }
}

export function createInitialAcademics(): AcademicState {
  return { courseScore: {}, totalCredits: 0, history: [] }
}

// ─────────────────────────────────────────────────────────────────────────────
// 수업 → 스킬 습득(§4)
// ─────────────────────────────────────────────────────────────────────────────
/** 이 점수까지 오르는 동안 과목의 스킬을 전부 배운다(C 이수선 50 보다 조금 높게) */
export const SKILL_SCORE_SPAN = 60

/**
 * 과목의 i번째 스킬을 배우는 데 필요한 수업 점수 — 첫 스킬도 첫 수업 과제(점수)를 해내야 배운다.
 * (입학 직후 주인공은 시작 물리 마술 하나만 쓴다. 예: 스킬 3개 과목 = 20 / 40 / 60점)
 */
export function skillScoreThreshold(course: CourseDef, index: number): number {
  const n = Math.max(1, course.teachesSkills?.length ?? 0)
  return Math.round((SKILL_SCORE_SPAN * (index + 1)) / n)
}

/**
 * 지금까지 수업으로 배운 스킬 — 지난 학기 이수 과목(D 이상) 전부 + 이번 학기 과목의 진도만큼.
 * 순수 함수라 세이브 마이그레이션·관리자 주차 변경에도 그대로 쓴다.
 */
export function skillsFromCourses(ac: AcademicState, globalWeek: number): string[] {
  const out: string[] = []
  for (const term of ac.history) {
    for (const rec of term.courses) {
      if (rec.credit <= 0) continue
      const ids = courseById(rec.courseId) ? [rec.courseId] : (RETIRED_COURSE_REPLACED_BY[rec.courseId] ?? [])
      for (const id of ids) out.push(...(courseById(id)?.teachesSkills ?? []))
    }
  }
  for (const c of coursesForWeek(globalWeek)) {
    const score = ac.courseScore[c.id] ?? 0
    ;(c.teachesSkills ?? []).forEach((id, i) => {
      if (score >= skillScoreThreshold(c, i)) out.push(id)
    })
  }
  return Array.from(new Set(out))
}

/** 이번 학기 과목별 다음에 배울 스킬과 필요 점수(UI 안내용) */
export function nextCourseSkill(course: CourseDef, score: number): { skillId: string; needScore: number } | null {
  const list = course.teachesSkills ?? []
  for (let i = 0; i < list.length; i++) {
    const need = skillScoreThreshold(course, i)
    if (score < need) return { skillId: list[i], needScore: need }
  }
  return null
}
