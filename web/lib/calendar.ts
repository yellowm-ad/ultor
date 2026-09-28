// ============================================================================
// 4년제 학사 캘린더 (§학사 PRD 3, 41~42, 65)
//
//   1년 = 1학기 · 여름방학 · 2학기 · 겨울방학, 각 12주  → 1년 48주, 4년 192주.
//   게임 전체의 "지금"은 CalendarState.globalWeek(1~192) 하나로만 관리하고,
//   학년/학기/주차/계절은 전부 여기서 파생한다(§82-7 단일 관리).
// ============================================================================

import type { CalendarState, TermType } from '@/lib/types'

export const WEEKS_PER_TERM = 12
export const TERMS_PER_YEAR = 4
export const TOTAL_YEARS = 4
export const TOTAL_WEEKS = WEEKS_PER_TERM * TERMS_PER_YEAR * TOTAL_YEARS // 192

export const TERM_ORDER: TermType[] = ['semester1', 'summer', 'semester2', 'winter']

export const TERM_META: Record<TermType, { label: string; short: string; season: '봄' | '여름' | '가을' | '겨울'; isVacation: boolean }> = {
  semester1: { label: '1학기', short: '1학기', season: '봄', isVacation: false },
  summer: { label: '여름방학', short: '여름', season: '여름', isVacation: true },
  semester2: { label: '2학기', short: '2학기', season: '가을', isVacation: false },
  winter: { label: '겨울방학', short: '겨울', season: '겨울', isVacation: true },
}

export interface CalendarInfo {
  globalWeek: number // 1~192
  year: number // 1~4
  termType: TermType
  /** 0~15 — academic_terms 인덱스 */
  termIndex: number
  /** 'Y1_SEMESTER1' 형식(§41 term_id) */
  termId: string
  week: number // 학기 내 주차 1~12
  season: CalendarInfoSeason
  isVacation: boolean
  /** 본편 종료(4학년 2학기) 이후 후일담 구간 */
  isPostGame: boolean
}
type CalendarInfoSeason = (typeof TERM_META)[TermType]['season']

export function calendarInfo(globalWeek: number): CalendarInfo {
  const gw = Math.max(1, Math.min(TOTAL_WEEKS, Math.round(globalWeek)))
  const termIndex = Math.floor((gw - 1) / WEEKS_PER_TERM)
  const year = Math.floor(termIndex / TERMS_PER_YEAR) + 1
  const termType = TERM_ORDER[termIndex % TERMS_PER_YEAR]
  const week = ((gw - 1) % WEEKS_PER_TERM) + 1
  return {
    globalWeek: gw,
    year,
    termType,
    termIndex,
    termId: termIdOf(year, termType),
    week,
    season: TERM_META[termType].season,
    isVacation: TERM_META[termType].isVacation,
    isPostGame: year === 4 && termType === 'winter',
  }
}

export function termIdOf(year: number, termType: TermType): string {
  return `Y${year}_${termType.toUpperCase()}`
}

/** globalWeek ← (학년, 학기, 주차) */
export function globalWeekOf(year: number, termType: TermType, week: number): number {
  const termIndex = (year - 1) * TERMS_PER_YEAR + TERM_ORDER.indexOf(termType)
  return termIndex * WEEKS_PER_TERM + Math.max(1, Math.min(WEEKS_PER_TERM, week))
}

/** "1학년 1학기 3주차" */
export function calendarLabel(c: CalendarState | number): string {
  const info = calendarInfo(typeof c === 'number' ? c : c.globalWeek)
  return `${info.year}학년 ${TERM_META[info.termType].label} ${info.week}주차`
}

/** 짧은 HUD 표기 "1-1학기 3주" */
export function calendarShortLabel(c: CalendarState | number): string {
  const info = calendarInfo(typeof c === 'number' ? c : c.globalWeek)
  return `${info.year}학년 ${TERM_META[info.termType].short} · ${info.week}주`
}

/** 학기 비교용 — (year, termType) 이 현재 시점 이전이거나 같은가 */
export function isOnOrAfter(current: number, year: number, termType: TermType, week = 1): boolean {
  return current >= globalWeekOf(year, termType, week)
}

export function createInitialCalendar(): CalendarState {
  return { globalWeek: 1 }
}
