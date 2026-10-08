// ============================================================================
// 수업 커리큘럼 — 교수진 · 과목별 수업 장소/미니게임 · 주차별 수업 배정 · 성적/숙련도 (통합 PRD v1.0 §14~22, §30~31, §44~45)
//
//   한 주 = 필수 수업 1회 + 외부활동 2개. 방학에는 수업이 없다.
//   학기 12주 순환(§45 → 2026-10-08 v3.0: 스토리 주에도 수업 유지): 1·4주 = 1과목 / 2·5주 = 2과목 / 3·8·10주 = 3과목 / 6·9주 = 4과목 / 11주 = 기말 대비 실습
//                        3·6·9주 = 스토리 주간(수업 없음, lib/story-episodes.ts)
//                        7주 = 중간고사 / 12주 = 기말고사
//   수업 결과(S~D)는 메인스토리를 막지 않는다(§2.1, §56) — 실패(D)해도 수업은 수료.
//   좋은 결과 = 과목 점수(스킬 습득 진도) · 분야 숙련도 · 교수 관계도 · EXP · 골드를 더 준다.
// ============================================================================

import type { MapId } from '@/lib/types'
import { calendarInfo } from '@/lib/calendar'
import { coursesForWeek, courseById, type CourseDef } from '@/lib/academics'
import { isSemesterStoryWeek } from '@/lib/story-episodes'

// ─────────────────────────────────────────────────────────────────────────────
// 교수 / 강사진 (§15) — 전용 에셋 전까지 기존 NPC 도트 재사용
// ─────────────────────────────────────────────────────────────────────────────
export interface ProfessorDef {
  id: string
  name: string
  /** 담당 한 줄 */
  title: string
  /** 마을/학교에 서 있는 NPC id(대화·관계도 키) */
  npcId: string
  /** 수업 장면 강의 시트(public/images/class/<sheet>.png). 없으면 NPC 걷기 시트로 대신 */
  lectureSheet?: string
  /** 수업 시작 인사/이론 대사 — 5초 강의 동안 순서대로 말풍선 */
  lectureLines: string[]
}

export const PROFESSORS: ProfessorDef[] = [
  { id: 'mirel', name: '미르엘 교수', title: '삼원 마법 이론 · 봉인학', npcId: 'npc-mirel', lectureSheet: 'prof-mirel', lectureLines: ['자, 오늘은 술식의 구조부터 짚고 넘어가자.', '마나는 흐름이다. 억지로 밀어붙이면 반드시 되튄다.', '봉인은 문을 닫는 마법이 아니다… 그건 다음에 얘기하지.'] },
  { id: 'ignis', name: '이그니스 교수', title: '화염 마법', npcId: 'prof-ignis', lectureSheet: 'prof-ignis', lectureLines: ['불은 망설이는 자를 먼저 태운다.', '박자를 놓치지 마라. 화염은 빠르고 강하게!', '숨을 들이쉬고— 터뜨려라.'] },
  { id: 'kael', name: '카엘 조교', title: '빙결 응용 · 전술', npcId: 'prof-kael', lectureSheet: 'prof-kael', lectureLines: ['오늘은 내가 대신 강의한다.', '얼음은 느리지만 정확하다. 일정한 박자를 유지해.', '보고서는 수업 끝나고 바로 제출.'] },
  { id: 'terra', name: '테라 교수', title: '대지 마법', npcId: 'prof-terra', lectureSheet: 'prof-terra', lectureLines: ['땅은 서두르지 않는단다.', '무겁게, 그리고 길게. 대지의 박자를 느껴 보렴.', '뿌리가 깊어야 흔들리지 않지.'] },
  { id: 'noella', name: '노엘라 교수', title: '어둠 마법', npcId: 'prof-noella', lectureSheet: 'prof-noella', lectureLines: ['어둠은 악이 아니다. 보이지 않을 뿐이지.', '환영에 속지 마라. 진짜 신호만 붙잡아.', '즉사 술식은 강자에게는 통하지 않는다. 명심해.'] },
  { id: 'lumen', name: '루멘 교수', title: '빛 마법', npcId: 'prof-lumen', lectureSheet: 'prof-lumen', lectureLines: ['빛은 나누면 줄지 않는 마법이에요.', '여러 갈래의 빛을 동시에 붙잡아 보세요.', '동료를 지키는 마음이 술식을 완성한답니다.'] },
  { id: 'owen', name: '사서 오웬', title: '인마대전사 · 교양', npcId: 'npc-librarian', lectureSheet: 'prof-owen', lectureLines: ['교과서에는 전쟁이 1년 만에 끝났다고 되어 있지요.', '기록은 언제나 쓰는 사람의 편이랍니다.', '오늘은 간단한 확인 문제부터 풀어 봅시다.'] },
  { id: 'selin', name: '셀린 강사', title: '연금술 · 약초학', npcId: 'npc-potion', lectureSheet: 'prof-selin', lectureLines: ['재료는 순서가 생명이야.', '온도를 너무 올리면 펑! 알지?', '오늘 만든 시약은 다음 실습에 쓸 거야.'] },
  { id: 'ban', name: '반 강사', title: '마도구 · 장비 제작', npcId: 'npc-weapon', lectureSheet: 'prof-ban', lectureLines: ['쇠는 정직하다네. 들인 만큼 돌려주지.', '부품 상자에서 하나씩 꺼내 보게.', '손 조심하고.'] },
  { id: 'edric', name: '에드릭 교수', title: '실전 탐사 · 학사', npcId: 'npc-job-trainer', lectureSheet: 'prof-edric', lectureLines: ['현장에서는 교과서가 대신 싸워 주지 않는다.', '몬스터의 발자국부터 읽는 연습을 하자.', '오늘 배운 건 이번 주 외부활동에서 바로 써먹어라.'] },
]
const PROF_BY_ID = new Map(PROFESSORS.map((p) => [p.id, p]))
export const professorById = (id: string) => PROF_BY_ID.get(id)

// ─────────────────────────────────────────────────────────────────────────────
// 미니게임 종류(§16~20) — 실제 구현은 components/game/class-minigames.tsx
// ─────────────────────────────────────────────────────────────────────────────
export type MiniGameType = 'quiz' | 'rhythm' | 'chant' | 'draw' | 'alchemy' | 'match' | 'sigil' | 'sort'
export const MINIGAME_META: Record<MiniGameType, { name: string; desc: string }> = {
  quiz: { name: '지식 퀴즈', desc: '세계관 지식과 교양 문제를 푼다.' },
  rhythm: { name: '마법 리듬 실습', desc: '마력 노드가 판정선에 닿는 순간 입력한다.' },
  chant: { name: '영창 암기', desc: '주문 영창의 순서를 외워 다시 배열한다.' },
  draw: { name: '실습 도구 뽑기', desc: '수업용 상자에서 재료·도구를 무작위로 뽑는다.' },
  alchemy: { name: '시약 합성', desc: '재료·순서·온도·마나를 맞춰 시약을 만든다.' },
  // 2026-10-07 추가
  match: { name: '룬 짝맞추기', desc: '뒤집힌 룬 카드에서 같은 룬 두 장을 찾아낸다.' },
  sigil: { name: '마법진 따라 그리기', desc: '마법진 꼭짓점이 빛나는 순서를 기억해 그대로 잇는다.' },
  sort: { name: '분류 실습', desc: '나오는 카드를 제한 시간 안에 알맞은 쪽으로 나눈다.' },
}

/** 숙련도 분야 */
export type MasteryField = 'magic' | 'combat' | 'life' | 'craft' | 'liberal'
export const MASTERY_LABEL: Record<MasteryField, string> = { magic: '마법학', combat: '전투학', life: '연금·생활', craft: '제작', liberal: '교양' }
export type RhythmStyle = 'fire' | 'ice' | 'earth' | 'light' | 'dark' | 'neutral'

export interface CourseClassMeta {
  professorId: string
  room: MapId
  games: MiniGameType[]
  field: MasteryField
  /** 리듬 실습 패턴(§17) */
  rhythm: RhythmStyle
}

const M = (professorId: string, room: MapId, games: MiniGameType[], field: MasteryField, rhythm: RhythmStyle = 'neutral'): CourseClassMeta => ({ professorId, room, games, field, rhythm })
// 과목 계열별 미니게임 후보 — 매주 한 개를 고르되 지난 수업과 같은 종류는 피한다(progression.startClass)
const MAGIC: MiniGameType[] = ['rhythm', 'chant', 'quiz', 'sigil', 'match']
const LIFE: MiniGameType[] = ['alchemy', 'draw', 'quiz', 'sort']
const CRAFT: MiniGameType[] = ['draw', 'alchemy', 'chant', 'match']
const LIBERAL: MiniGameType[] = ['quiz', 'chant', 'sort', 'match']
const FIELD: MiniGameType[] = ['draw', 'quiz', 'rhythm', 'sort']
const TACTIC: MiniGameType[] = ['rhythm', 'quiz', 'chant', 'sigil']

export const COURSE_CLASS_META: Record<string, CourseClassMeta> = {
  // 1학년 — 1층 3원소 수업관 + 실습실
  FIRE_101: M('ignis', 'class-fire', MAGIC, 'magic', 'fire'),
  ICE_101: M('kael', 'class-ice', MAGIC, 'magic', 'ice'),
  EARTH_101: M('terra', 'class-earth', MAGIC, 'magic', 'earth'),
  FIELD_101: M('edric', 'practice-lab', FIELD, 'combat'),
  ELEMENT_102: M('mirel', 'class-fire', MAGIC, 'magic', 'fire'),
  CRAFT_101: M('ban', 'practice-lab', CRAFT, 'craft'),
  HISTORY_101: M('owen', 'class-earth', LIBERAL, 'liberal'),
  BIO_101: M('selin', 'practice-lab', LIFE, 'life'),
  // 2학년 — 2층 2학년 교실
  TRIAD_201: M('mirel', 'class-year2', MAGIC, 'magic', 'ice'),
  ALCHEMY_201: M('selin', 'practice-lab', LIFE, 'life'),
  ECOLOGY_201: M('selin', 'class-year2', ['quiz', 'draw', 'alchemy', 'sort'], 'life'),
  COOKING_201: M('selin', 'practice-lab', LIFE, 'life'),
  TRIAD_202: M('mirel', 'class-year2', MAGIC, 'magic', 'earth'),
  BATTLE_202: M('kael', 'class-year2', TACTIC, 'combat', 'ice'),
  RUINS_202: M('owen', 'class-year2', LIBERAL, 'liberal'),
  HUNT_202: M('edric', 'practice-lab', FIELD, 'combat'),
  // 3학년 — 3층(어둠·빛 수업관 개방)
  DARK_301: M('noella', 'class-dark', MAGIC, 'magic', 'dark'),
  LIGHT_301: M('lumen', 'class-light', MAGIC, 'magic', 'light'),
  HOUSING_301: M('ban', 'practice-lab', CRAFT, 'craft'),
  DEMON_301: M('owen', 'class-year3', LIBERAL, 'liberal'),
  ELEMENT_302: M('mirel', 'class-year3', MAGIC, 'magic', 'fire'),
  MAGITECH_302: M('ban', 'practice-lab', CRAFT, 'craft'),
  ALCHEMY_302: M('selin', 'practice-lab', LIFE, 'life'),
  COSTUME_302: M('ban', 'practice-lab', CRAFT, 'craft'),
  // 4학년 — 4층
  ANCIENT_MAGIC_401: M('mirel', 'class-year4', MAGIC, 'magic', 'earth'),
  DUSKDAWN_401: M('noella', 'class-dark', MAGIC, 'magic', 'dark'),
  SEAL_401: M('mirel', 'class-year4', ['chant', 'quiz', 'rhythm', 'sigil'], 'liberal', 'light'),
  WARHISTORY_401: M('owen', 'class-year4', LIBERAL, 'liberal'),
  ARCHMAGE_402: M('mirel', 'practice-lab-adv', MAGIC, 'magic', 'light'),
  TACTICS_402: M('kael', 'class-year4', TACTIC, 'combat', 'ice'),
  LOSTWIND_402: M('owen', 'class-year4', LIBERAL, 'liberal'),
  THESIS_402: M('owen', 'class-year4', ['chant', 'quiz', 'sort'], 'liberal'),
}

export function classMetaFor(courseId: string): CourseClassMeta {
  const meta = COURSE_CLASS_META[courseId]
  if (meta) return meta
  const c = courseById(courseId)
  const field: MasteryField = c?.department === 'life' ? 'life' : c?.department === 'craft' ? 'craft' : c?.department === 'history' ? 'liberal' : 'magic'
  return M('mirel', 'class-fire', field === 'magic' ? MAGIC : field === 'life' ? LIFE : field === 'craft' ? CRAFT : LIBERAL, field)
}

// ─────────────────────────────────────────────────────────────────────────────
// 주차별 수업 배정(§45)
// ─────────────────────────────────────────────────────────────────────────────
export type SessionKind = 'lecture' | 'practice' | 'midterm' | 'final'
export interface WeekClass {
  kind: SessionKind
  /** 대표 과목(시험은 이번 학기 첫 과목 — 결과는 학기 전 과목에 반영) */
  courseId: string
  /** 시험은 여러 과목 */
  courseIds: string[]
  label: string
}

const ROTATION: Record<number, number> = { 1: 0, 4: 0, 2: 1, 5: 1, 3: 2, 8: 2, 10: 2, 6: 3, 9: 3, 11: 3 }

/** 이번 주 필수 수업 — 방학이면 null */
export function classForWeek(globalWeek: number): WeekClass | null {
  const info = calendarInfo(globalWeek)
  if (info.isVacation) return null
  // v3.0 §10: 메인 스토리 주에도 필수 수업은 그대로(4학년 2학기 특수 루프 해제는 Phase 3 — isSemesterStoryWeek)
  if (isSemesterStoryWeek(globalWeek)) return null
  const open = coursesForWeek(globalWeek)
  if (open.length === 0) return null
  const ids = open.map((c) => c.id)
  if (info.week === 7) return { kind: 'midterm', courseId: ids[0], courseIds: ids, label: '중간고사' }
  if (info.week === 12) return { kind: 'final', courseId: ids[0], courseIds: ids, label: '기말고사' }
  const c: CourseDef = open[(ROTATION[info.week] ?? 0) % open.length]
  return { kind: info.week === 11 ? 'practice' : 'lecture', courseId: c.id, courseIds: [c.id], label: info.week === 11 ? `${c.name} — 기말 대비 실습` : c.name }
}

/** 시험 미니게임 구성 — 중간 = 이론(퀴즈) + 실기 1, 기말 = 이론 + 영창 + 실기 */
export function examGames(kind: 'midterm' | 'final', courseIds: string[], rand: () => number): MiniGameType[] {
  const practicals: MiniGameType[] = Array.from(new Set(courseIds.flatMap((id) => classMetaFor(id).games))).filter((g) => g !== 'quiz' && g !== 'chant')
  const prac = practicals[Math.floor(rand() * practicals.length)] ?? 'rhythm'
  return kind === 'midterm' ? ['quiz', prac] : ['quiz', 'chant', prac]
}

// ─────────────────────────────────────────────────────────────────────────────
// 성적 · 보상
// ─────────────────────────────────────────────────────────────────────────────
export type ClassGrade = 'S' | 'A' | 'B' | 'C' | 'D'
export function classGrade(score: number): ClassGrade {
  if (score >= 90) return 'S'
  if (score >= 75) return 'A'
  if (score >= 60) return 'B'
  if (score >= 40) return 'C'
  return 'D'
}
export const GRADE_REWARD: Record<ClassGrade, { course: number; mastery: number; exp: number; gold: number; affinity: number }> = {
  S: { course: 32, mastery: 40, exp: 60, gold: 120, affinity: 4 },
  A: { course: 26, mastery: 30, exp: 45, gold: 90, affinity: 3 },
  B: { course: 21, mastery: 22, exp: 35, gold: 60, affinity: 2 },
  C: { course: 16, mastery: 15, exp: 25, gold: 40, affinity: 1 },
  D: { course: 11, mastery: 8, exp: 15, gold: 20, affinity: 0 },
}

/** 숙련도 레벨 — 레벨 L 에 필요한 누적치 = 40·L·(L+1)/2 */
export function masteryLevel(xp: number): { level: number; into: number; need: number } {
  let level = 0
  let acc = 0
  while (acc + 40 * (level + 1) <= xp) {
    acc += 40 * (level + 1)
    level++
  }
  return { level, into: xp - acc, need: 40 * (level + 1) }
}
