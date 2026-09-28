// ============================================================================
// 학사 시스템 기초 (§학사 PRD 30~32, 59~61)
//
//   · 8개 정규학기 × 학기당 12학점 = 96학점(졸업 요건)
//   · 학기마다 과목 3개(필수 2 = 8학점, 선택 1 = 4학점)를 자동 수강
//   · 주간 CLASS 퀘스트 보상(COURSE)이 이번 학기 과목 점수를 올리고, 학기 마지막 주를 마감할 때
//     점수 → 성적(A~F) → 학점으로 정산된다. 방학에는 수업이 없다.
//   · 과목은 다른 시스템을 여는 역할도 한다(unlocks: 레시피 unlockCondition {type:'course'} 로 참조).
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
}

export const COURSES: CourseDef[] = [
  // 1학년
  { id: 'MAGIC_101', name: '삼원 기초', department: 'magic', year: 1, term: 'semester1', required: true, credit: 4, teacherNpcId: 'npc-job-trainer', description: '화염·빙결·대지 삼원의 기본 원리.' },
  { id: 'FIELD_101', name: '실전 탐사 I', department: 'life', year: 1, term: 'semester1', required: true, credit: 4, description: '에르디아 숲 견학과 채집 기초.' },
  { id: 'HISTORY_101', name: '마법사 역사 입문', department: 'history', year: 1, term: 'semester1', required: false, credit: 4, teacherNpcId: 'npc-librarian', description: '울토르의 건립과 인마대전 개요.' },
  { id: 'ELEMENT_102', name: '원소 상성', department: 'magic', year: 1, term: 'semester2', required: true, credit: 4, teacherNpcId: 'npc-job-trainer', description: '삼원 순환 상성과 전투 응용.' },
  { id: 'CRAFT_101', name: '기초 제작', department: 'craft', year: 1, term: 'semester2', required: true, credit: 4, description: '마도구 작업대 사용법과 장비 제작 기초.' },
  { id: 'BIO_101', name: '마법 생물학', department: 'life', year: 1, term: 'semester2', required: false, credit: 4, description: '물과 바다의 마법 생물.' },
  // 2학년
  { id: 'ALCHEMY_201', name: '연금술 I', department: 'life', year: 2, term: 'semester1', required: true, credit: 4, description: '약초 조합과 물약 제조.' },
  { id: 'ECOLOGY_201', name: '마법 생태학 I', department: 'life', year: 2, term: 'semester1', required: true, credit: 4, description: '해양·심해 생태계와 채집학.' },
  { id: 'COOKING_201', name: '요리학', department: 'life', year: 2, term: 'semester1', required: false, credit: 4, description: '전투 보조 요리와 식재료.' },
  { id: 'BATTLE_202', name: '마법 전투학', department: 'magic', year: 2, term: 'semester2', required: true, credit: 4, description: '파티 전투 전술과 동료 연계.' },
  { id: 'RUINS_202', name: '고대 유적학', department: 'history', year: 2, term: 'semester2', required: true, credit: 4, description: '하늘 유적과 고대 구조물.' },
  { id: 'HUNT_202', name: '사냥학', department: 'life', year: 2, term: 'semester2', required: false, credit: 4, description: '몬스터 부산물 채취와 손질.' },
  // 3학년
  { id: 'ELEMENT_301', name: '고급 원소학', department: 'magic', year: 3, term: 'semester1', required: true, credit: 4, description: '원소 심화와 복합 마법.' },
  { id: 'HOUSING_301', name: '하우징 제작', department: 'craft', year: 3, term: 'semester1', required: true, credit: 4, description: '가구 제작과 공간 설계.' },
  { id: 'DEMON_301', name: '마족학', department: 'history', year: 3, term: 'semester1', required: false, credit: 4, description: '마족의 생태와 역사.' },
  { id: 'MAGITECH_302', name: '마법 공학', department: 'craft', year: 3, term: 'semester2', required: true, credit: 4, description: '마도구 제작 II.' },
  { id: 'ALCHEMY_302', name: '고급 연금술', department: 'life', year: 3, term: 'semester2', required: true, credit: 4, description: '촉매와 재료 변환.' },
  { id: 'COSTUME_302', name: '의상 제작', department: 'craft', year: 3, term: 'semester2', required: false, credit: 4, description: '코스튬 제작.' },
  // 4학년
  { id: 'SEAL_401', name: '봉인학', department: 'history', year: 4, term: 'semester1', required: true, credit: 4, description: '인마대전의 봉인 방식.' },
  { id: 'ANCIENT_MAGIC_401', name: '고대 마법', department: 'magic', year: 4, term: 'semester1', required: true, credit: 4, description: '잊힌 고대 마법 체계.' },
  { id: 'WARHISTORY_401', name: '인마대전사', department: 'history', year: 4, term: 'semester1', required: false, credit: 4, description: '인마대전의 전말.' },
  { id: 'ARCHMAGE_402', name: '대마도사 실습', department: 'magic', year: 4, term: 'semester2', required: true, credit: 4, description: '졸업 실습.' },
  { id: 'TACTICS_402', name: '고급 전투학', department: 'magic', year: 4, term: 'semester2', required: true, credit: 4, description: '대규모 방어전 전술.' },
  { id: 'THESIS_402', name: '졸업 논문', department: 'history', year: 4, term: 'semester2', required: false, credit: 4, description: '4년간의 연구 정리.' },
]

const COURSE_BY_ID = new Map(COURSES.map((c) => [c.id, c]))
export function courseById(id: string): CourseDef | undefined {
  return COURSE_BY_ID.get(id)
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
    summary: `학기 종료 — ${courses.map((c) => `${courseById(c.courseId)?.name} ${c.grade}`).join(', ')} · 학점 +${gained}`,
  }
}

export function createInitialAcademics(): AcademicState {
  return { courseScore: {}, totalCredits: 0, history: [] }
}
