// ============================================================================
// 학사·생활·동료 진행 로직 — 게임 리듀서(game-state.tsx)가 호출하는 순수 함수 모음.
// 전부 (GameState, ...) → GameState 형태라 리듀서 케이스는 한 줄 위임만 한다.
// ============================================================================

import type { BattleState, GameState, MapId, Position, Stats } from '@/lib/types'
import { calendarInfo, calendarLabel, TOTAL_WEEKS, WEEKS_PER_TERM } from '@/lib/calendar'
import { beatById, beatsFor, STORY_CYCLE, type StoryTrigger } from '@/lib/story'
import { acceptSideQuest, applyQuestEvents, dropSideQuest, generateWeeklyQuests, questTemplateById, weekCompletion, yearRewardMult, type QuestEvent } from '@/lib/quests'
import { addCourseScore, courseName, settleTerm, skillsFromCourses } from '@/lib/academics'
import { classForWeek, classGrade, classMetaFor, examGames, GRADE_REWARD, MASTERY_LABEL, masteryLevel, professorById, type MiniGameType } from '@/lib/curriculum'
import { mulberry32 } from '@/lib/rng'
import { isSemesterStoryWeek } from '@/lib/story-episodes'
import {
  ACTIVITY_META,
  activityUnlockWeek,
  gatherNodesForMap,
  isActivityUnlocked,
  isNearWater,
  isNodeReady,
  rollFish,
  rollGather,
  type ActivityId,
} from '@/lib/life'
import {
  canRecruit,
  combatantFromCompanion,
  combatantFromGuest,
  COMBAT_NPCS,
  companionStats,
  COMPANION_SLOTS,
  createCompanionProgress,
  createGuestMember,
  guestNpcById,
  guestStats,
  isCompanionAway,
  schoolNpcById,
} from '@/lib/companions'
import { addToInventory, hasItem, removeFromInventory } from '@/lib/inventory'
import { applyExp, questExpMult } from '@/lib/exp-table'
import { getEffectiveStats } from '@/lib/derived'
import { itemById, monsterById, SKILLS } from '@/lib/mock-data'
import { computeStatsForLevel, expSharePerMember, formationError, FORMATION_LIMITS, MAX_GUESTS, SKILL_LOADOUT_SIZE } from '@/lib/constants'
import { combatantFromPet, combatantFromPlayer, expShareMemberCount, type PartyMemberInput } from '@/lib/battle-engine'
import { petDefById } from '@/lib/pets'
import { MAPS } from '@/lib/maps'
import { regionOfMap } from '@/lib/regions'

// ─────────────────────────────────────────────────────────────────────────────
// 공용
// ─────────────────────────────────────────────────────────────────────────────
function joinToast(a: string | null | undefined, b: string | null | undefined): string | null {
  if (a && b) return `${a} · ${b}`
  return a || b || null
}

/** 조건 맞는 스토리 비트를 큐에 넣고, 재생 표시 플래그 + setFlags 를 즉시 켠다(재발생 방지 §82-10) */
export function queueBeats(state: GameState, match: (t: StoryTrigger) => boolean, depth = 0): GameState {
  const beats = beatsFor(state, match)
  if (beats.length === 0) return state
  const storyFlags = { ...state.storyFlags }
  const newFlags: string[] = []
  for (const b of beats) {
    // 보스전을 여는 장면은 이겼을 때 '봤음' 처리(afterBattleVictory) — 전투 중에 끄고 다시 켜도 재도전 가능
    if (!b.battle) storyFlags[`beat:${b.id}`] = true
    for (const f of b.setFlags ?? []) {
      if (!storyFlags[f]) newFlags.push(f)
      storyFlags[f] = true
    }
  }
  let next: GameState = { ...state, storyFlags, storyQueue: [...state.storyQueue, ...beats.map((b) => b.id)] }
  // 켜진 플래그로 이어지는 FLAG 트리거(연쇄는 3단계까지만)
  if (depth < 3 && newFlags.length) next = queueBeats(next, (t) => t.type === 'FLAG' && newFlags.includes(t.flag), depth + 1)
  return next
}

export function setStoryFlag(state: GameState, flag: string, value: boolean | number = true): GameState {
  const was = state.storyFlags[flag]
  const next = refreshSkills({ ...state, storyFlags: { ...state.storyFlags, [flag]: value } })
  if (!was && value) return queueBeats(next, (t) => t.type === 'FLAG' && t.flag === flag)
  return next
}

export function dismissStory(state: GameState): GameState {
  return { ...state, storyQueue: state.storyQueue.slice(1) }
}

/** 스토리 선택지 — 현재 비트를 닫고 고른 쪽 플래그를 켠다(FLAG 트리거로 다음 장면이 이어짐) */
export function chooseStory(state: GameState, flags: string[]): GameState {
  return flags.reduce((s, f) => setStoryFlag(s, f), dismissStory(state))
}

/** 퀘스트 진행 이벤트 적용 + 완료 알림 토스트 */
export function withQuestEvents(state: GameState, events: QuestEvent[], toast?: string | null): GameState {
  if (events.length === 0) return toast !== undefined ? { ...state, toast } : state
  const { weekly, completed } = applyQuestEvents(state.weekly, events)
  const doneMsg = completed.length ? `미션 달성: ${completed.join(', ')}` : null
  return { ...state, weekly, toast: joinToast(toast ?? null, doneMsg) ?? state.toast }
}

// ─────────────────────────────────────────────────────────────────────────────
// 주간 진행 (§66)
// ─────────────────────────────────────────────────────────────────────────────
/** 현재 globalWeek 의 주간 퀘스트가 없으면 생성하고 WEEK_START 비트를 큐잉 */
export function ensureWeek(state: GameState): GameState {
  const gw = state.calendar.globalWeek
  if (state.weekly.week === gw && state.weekly.format === 2) return state
  const weekly = generateWeeklyQuests(state)
  return queueBeats({ ...state, weekly }, (t) => t.type === 'WEEK_START' && t.week === gw)
}

export function newGameProgress(state: GameState): GameState {
  const playerSeed = Math.floor(Math.random() * 2 ** 31)
  const fresh: GameState = {
    ...state,
    playerSeed,
    calendar: { globalWeek: 1 },
    weekly: { week: 0, quests: [], lastSeen: {}, format: 2 },
    academics: { courseScore: {}, totalCredits: 0, history: [], mastery: {}, classLog: [] },
    classScene: null,
    storyFlags: {},
    storyQueue: [],
    relationships: {},
    companions: { recruited: {}, party: [] },
    formation: { positions: { hero: 'front' } },
    life: { gatheredAt: {} },
    collections: { fish: {}, monsters: {}, gathered: {}, crafted: {} },
    mealBuff: null,
    fishing: null,
  }
  // 1학년 동기(리안·셀라·도란)가 입학과 함께 파티에 들어와 4인 편성을 채운다(§16)
  return refreshSkills(ensureParty(ensureWeek(fresh)))
}

export function claimQuest(state: GameState, instanceId: string): GameState {
  const q = state.weekly.quests.find((x) => x.instanceId === instanceId)
  if (!q || q.status !== 'complete') return state
  const t = questTemplateById(q.templateId)
  if (!t) return state
  const mult = yearRewardMult(state.calendar.globalWeek)
  let next: GameState = {
    ...state,
    weekly: { ...state.weekly, quests: state.weekly.quests.map((x) => (x.instanceId === instanceId ? { ...x, status: 'claimed' as const } : x)) },
  }
  const parts: string[] = []
  for (const r of t.rewards) {
    switch (r.type) {
      case 'EXP': {
        // 같은 보상이 고레벨에서도 의미를 갖도록 레벨 비례(Lv.100 곡선)
        const amount = Math.round(r.amount * mult * questExpMult(next.player.level))
        next = grantHeroExp(next, amount)
        parts.push(`EXP ${amount}`)
        break
      }
      case 'GOLD': {
        const amount = Math.round(r.amount * mult)
        next = { ...next, player: { ...next.player, gold: next.player.gold + amount } }
        parts.push(`${amount}G`)
        break
      }
      case 'ITEM':
        next = { ...next, inventory: addToInventory(next.inventory, r.itemId, r.amount) }
        parts.push(`${itemById(r.itemId)?.name ?? r.itemId} x${r.amount}`)
        break
      case 'COURSE':
        next = { ...next, academics: addCourseScore(next.academics, next.calendar.globalWeek, r.amount, r.courseId) }
        parts.push(`수업 점수 +${r.amount}`)
        break
      case 'RELATIONSHIP':
        next = addAffinity(next, r.npcId, r.amount)
        break
      case 'FLAG':
        next = setStoryFlag(next, r.flag, r.value ?? true)
        break
    }
  }
  next = queueBeats(next, (tr) => tr.type === 'QUEST_CLAIMED' && tr.templateId === t.id)
  const before = next.player.learnedSkills.length
  next = refreshSkills(next)
  const learned = next.player.learnedSkills.slice(before)
  if (learned.length) parts.push(`새 마법: ${skillNames(learned)}`)
  return { ...next, toast: `「${t.title}」 보상 — ${parts.join(', ')}` }
}

// ─────────────────────────────────────────────────────────────────────────────
// 외부활동 수락/취소(통합 PRD §27)
// ─────────────────────────────────────────────────────────────────────────────
export function acceptQuest(state: GameState, instanceId: string): GameState {
  const r = acceptSideQuest(state.weekly, instanceId)
  if (r.error) return { ...state, toast: r.error }
  return { ...state, weekly: r.weekly }
}
export function dropQuest(state: GameState, instanceId: string): GameState {
  return { ...state, weekly: dropSideQuest(state.weekly, instanceId) }
}

// ─────────────────────────────────────────────────────────────────────────────
// 수업 장면(통합 PRD §2.1, §14~22) — 교실 착석 → 5초 강의 → 미니게임 → 수업 종료 → 평가
// ─────────────────────────────────────────────────────────────────────────────
/** 교실 안 플레이어 자리 — 앞줄 가운데 책상 뒤(칠판을 향해) */
export function classSeatFor(room: MapId): { x: number; y: number } {
  if (room === 'practice-lab') return { x: 10.5, y: 11.1 }
  if (room === 'practice-lab-adv') return { x: 11, y: 14.2 }
  return { x: 10.4, y: 9.5 }
}

/** test = 관리자 미니게임 테스트(주간 수업 완료 여부 무시, 지정 게임으로) */
export function startClass(state: GameState, test?: { game: MiniGameType }): GameState {
  if (state.classScene) return state
  const gw = state.calendar.globalWeek
  const wc = classForWeek(gw) ?? (test ? { kind: 'lecture' as const, courseId: 'FIRE_101', courseIds: ['FIRE_101'], label: '테스트 수업' } : null)
  if (!wc) return { ...state, toast: isSemesterStoryWeek(gw) ? '이번 주는 수업 대신 최종장 과제를 진행합니다. 학사 수첩(J)을 확인하세요.' : '방학에는 수업이 없습니다.' }
  if (state.weekly.classDone && !test) return { ...state, toast: '이번 주 수업은 이미 들었습니다.' }
  const meta = classMetaFor(wc.courseId)
  const seed = (state.playerSeed ^ (gw * 2654435761)) >>> 0
  const rand = mulberry32(seed)
  // 지난 수업과 같은 미니게임은 피한다 — 매주 다른 실습이 나오게(2026-10-07)
  const lastGame = state.academics.classLog?.at(-1)?.games?.[0]?.type
  const pool = meta.games.filter((g) => g !== lastGame)
  const choices = pool.length ? pool : meta.games
  const games: MiniGameType[] =
    test ? [test.game] : wc.kind === 'midterm' || wc.kind === 'final' ? examGames(wc.kind, wc.courseIds, rand) : [choices[Math.floor(rand() * choices.length)]]
  const seat = classSeatFor(meta.room)
  return {
    ...state,
    classScene: {
      courseId: wc.courseId,
      courseIds: wc.courseIds,
      kind: wc.kind,
      label: wc.label,
      professorId: meta.professorId,
      room: meta.room,
      games,
      index: 0,
      scores: [],
      phase: 'lecture',
      seed,
      returnTo: { mapId: state.currentMapId, position: { ...state.position } },
    },
    currentMapId: meta.room,
    position: seat,
    facing: 'up',
    fieldMonsters: [],
    pendingEncounterUid: null,
    pendingPortalId: null,
    screen: 'world',
    toast: null,
  }
}

export function classBeginGames(state: GameState): GameState {
  if (!state.classScene || state.classScene.phase !== 'lecture') return state
  return { ...state, classScene: { ...state.classScene, phase: 'game' } }
}

/** 미니게임 하나 끝 — 마지막이면 정산(보상 즉시 지급)하고 결과 단계로 */
export function classGameDone(state: GameState, score: number, label: string): GameState {
  const sc = state.classScene
  if (!sc || sc.phase !== 'game') return state
  const scores = [...sc.scores, { type: sc.games[sc.index], score: Math.max(0, Math.min(100, Math.round(score))), label }]
  if (sc.index + 1 < sc.games.length) return { ...state, classScene: { ...sc, scores, index: sc.index + 1 } }
  return settleClass({ ...state, classScene: { ...sc, scores } })
}

function settleClass(state: GameState): GameState {
  const sc = state.classScene!
  const gw = state.calendar.globalWeek
  const info = calendarInfo(gw)
  const score = Math.round(sc.scores.reduce((a, b) => a + b.score, 0) / Math.max(1, sc.scores.length))
  const grade = classGrade(score)
  const R = GRADE_REWARD[grade]
  const isExam = sc.kind === 'midterm' || sc.kind === 'final'
  const meta = classMetaFor(sc.courseId)
  const lines: string[] = []
  let next: GameState = state

  // 과목 점수(스킬 습득 진도) — 시험은 이번 학기 전 과목에 80%씩
  let academics = next.academics
  for (const id of sc.courseIds) {
    const amt = isExam ? Math.round(R.course * 0.8) : R.course
    academics = addCourseScore(academics, gw, amt, id)
  }
  lines.push(isExam ? `학기 전 과목 수업 점수 +${Math.round(R.course * 0.8)}` : `${courseName(sc.courseId)} 수업 점수 +${R.course}`)
  // 분야 숙련도
  const fields = Array.from(new Set(sc.courseIds.map((id) => classMetaFor(id).field)))
  const mastery = { ...(academics.mastery ?? {}) }
  for (const f of fields) {
    const before = masteryLevel(mastery[f] ?? 0).level
    mastery[f] = (mastery[f] ?? 0) + (isExam ? Math.round(R.mastery * 1.2) : R.mastery)
    const after = masteryLevel(mastery[f]).level
    lines.push(`${MASTERY_LABEL[f]} 숙련도 +${isExam ? Math.round(R.mastery * 1.2) : R.mastery}${after > before ? ` (Lv.${after} 달성!)` : ''}`)
  }
  const classLog = [...(academics.classLog ?? []), { week: gw, courseId: sc.courseId, kind: sc.kind, games: sc.scores.map((x) => ({ type: x.type, score: x.score })), score, grade }].slice(-200)
  academics = { ...academics, mastery, classLog }
  next = { ...next, academics, weekly: { ...next.weekly, classDone: true } }

  // EXP · 골드 · 교수 관계도
  const mult = yearRewardMult(gw)
  const exp = Math.round(R.exp * mult * questExpMult(next.player.level) * (isExam ? 1.5 : 1))
  const gold = Math.round(R.gold * mult * (isExam ? 1.5 : 1))
  const prevLv = next.player.level
  next = grantHeroExp({ ...next, player: { ...next.player, gold: next.player.gold + gold } }, exp)
  lines.push(`EXP +${exp}${next.player.level > prevLv ? ` · 레벨 업! Lv.${next.player.level}` : ''}`, `골드 +${gold}`)
  const prof = professorById(meta.professorId)
  if (prof && R.affinity > 0) {
    next = addAffinity(next, prof.npcId, R.affinity)
    lines.push(`${prof.name} 관계도 +${R.affinity}`)
  }
  // 시험 통과 플래그(§34) — 낙제해도 스토리는 막히지 않는다
  if (isExam && grade !== 'D') next = setStoryFlag(next, `${sc.kind === 'midterm' ? 'MIDTERM' : 'FINAL'}_Y${info.year}${info.termType === 'semester1' ? 'S1' : 'S2'}_PASSED`)
  // 새 스킬
  const before = next.player.learnedSkills.length
  next = refreshSkills(next)
  const learned = next.player.learnedSkills.slice(before)
  if (learned.length) lines.push(`새 마법 습득: ${skillNames(learned)}`)
  return { ...next, classScene: { ...sc, phase: 'result', result: { score, grade, lines } } }
}

/** 평가창 '다음' — 원래 있던 곳으로 돌아간다 */
export function finishClass(state: GameState): GameState {
  const sc = state.classScene
  if (!sc) return state
  if (sc.phase !== 'result') return { ...state, classScene: null, currentMapId: sc.returnTo.mapId, position: { ...sc.returnTo.position } }
  const back = MAPS[sc.returnTo.mapId] ? sc.returnTo : { mapId: 'school-hall' as MapId, position: { x: 24, y: 30 } }
  return {
    ...state,
    classScene: null,
    currentMapId: back.mapId,
    position: { ...back.position },
    facing: 'down',
    toast: `${sc.label} 수업을 마쳤다 — 평가 ${sc.result?.grade ?? '-'}`,
  }
}

/** 주 마감 → 다음 주. force = 관리자/테스트 모드 강제 진행 */
export function endWeek(state: GameState, force = false): GameState {
  const gw = state.calendar.globalWeek
  const wc = weekCompletion(state.weekly)
  if (!force && !wc.canEnd) {
    const why = !wc.classDone
      ? '이번 주 수업을 먼저 들어야 합니다. (학사 수첩 → 수업 참석)'
      : !wc.mainDone
        ? wc.storyWeek ? '스토리 미션의 보상을 먼저 받아야 합니다. (학사 수첩 J)' : '필수 미션의 보상을 먼저 받아야 합니다.'
        : `외부활동 ${wc.requiredOptional}개의 보상을 받아야 이번 주를 마칠 수 있습니다.`
    return { ...state, toast: why }
  }
  if (gw >= TOTAL_WEEKS) return { ...state, toast: '4학년 겨울방학 — 마지막 주입니다. (후일담 구간)' }
  const info = calendarInfo(gw)
  const msgs: string[] = []
  // 주간 보상(§1) — 학년 배율
  const mult = yearRewardMult(gw)
  const wExp = Math.round(30 * mult * questExpMult(state.player.level))
  const wGold = Math.round(80 * mult)
  let next = grantHeroExp({ ...state, player: { ...state.player, gold: state.player.gold + wGold } }, wExp)
  msgs.push(`주간 보상 EXP ${wExp} · ${wGold}G`)
  next = queueBeats(next, (t) => t.type === 'WEEK_END' && t.week === gw)
  // 3주 메인스토리 슬롯(§3) — 주차를 소비하지 않고 보상 직후 재생
  if (info.week % 3 === 0) {
    next = queueBeats(next, (t) => t.type === 'STORY_SLOT' && t.week === gw)
    const fixed = STORY_CYCLE[gw]
    if (fixed && beatById(fixed) && !next.storyFlags[`beat:${fixed}`] && !next.storyQueue.includes(fixed)) next = { ...next, storyQueue: [...next.storyQueue, fixed] }
  }
  if (info.week === WEEKS_PER_TERM) {
    const settled = settleTerm(next.academics, gw)
    next = { ...next, academics: settled.academics }
    if (settled.summary) msgs.push(settled.summary)
    // 과목 이수 플래그(통합 PRD §34) — D 이상(학점 획득)이면 COURSE_<과목>_PASSED
    const rec = settled.academics.history[settled.academics.history.length - 1]
    for (const c of rec?.courses ?? []) if (c.credit > 0) next = setStoryFlag(next, `COURSE_${c.courseId}_PASSED`)
  }
  const ngw = gw + 1
  next = { ...next, calendar: { globalWeek: ngw } }
  next = ensureWeek(next)
  const beforeSkills = next.player.learnedSkills.length
  next = ensureParty(refreshSkills(next))
  const newSkills = next.player.learnedSkills.slice(beforeSkills)
  if (newSkills.length) msgs.push(`새 마법 습득: ${skillNames(newSkills)}`)
  // 이번 주에 새로 열린 생활 활동 안내
  const unlocked = (Object.keys(ACTIVITY_META) as ActivityId[]).filter((a) => activityUnlockWeek(a) === ngw)
  if (unlocked.length) msgs.push(`새로 해금: ${unlocked.map((a) => ACTIVITY_META[a].name).join(', ')}`)
  return { ...next, toast: [`${calendarLabel(ngw)} 시작`, ...msgs].join(' · ') }
}

export function adminSetWeek(state: GameState, week: number): GameState {
  const gw = Math.max(1, Math.min(TOTAL_WEEKS, Math.round(week)))
  return ensureParty(refreshSkills(ensureWeek({ ...state, calendar: { globalWeek: gw }, weekly: { ...state.weekly, week: 0 } })))
}

// ─────────────────────────────────────────────────────────────────────────────
// 스킬 습득(§4, §23~24) — 수업·레벨·스토리·아이템 조건. 전직 없음.
// ─────────────────────────────────────────────────────────────────────────────
/** 조건을 모두 만족한 학생 스킬 목록 */
export function earnedSkillIds(state: GameState): string[] {
  const fromCourses = new Set(skillsFromCourses(state.academics, state.calendar.globalWeek))
  const unlockAll = !!state.storyFlags.DEBUG_UNLOCK_ALL
  return SKILLS.filter((s) => {
    if (s.owner || !s.learnRequirements?.length) return false // 펫·모르스 전용, 수업 외 스킬
    return s.learnRequirements.every((r) => {
      switch (r.type) {
        case 'course':
          return unlockAll || fromCourses.has(s.id)
        case 'level':
          return state.player.level >= r.level
        case 'storyFlag':
          return !!state.storyFlags[r.id]
        case 'item':
          return hasItem(state.inventory, r.id)
      }
    })
  }).map((s) => s.id)
}

/**
 * 배운 스킬 갱신 — 새로 배운 스킬은 장착 슬롯이 남아 있으면 자동 장착.
 * 이미 배운 스킬은 잃지 않는다(펫·모르스 전용처럼 학생이 가질 수 없는 스킬만 걸러낸다).
 */
export function refreshSkills(state: GameState): GameState {
  const valid = (id: string) => {
    const s = SKILLS.find((x) => x.id === id)
    return !!s && !s.owner
  }
  const learned = state.player.learnedSkills.filter(valid)
  const add = earnedSkillIds(state).filter((id) => !learned.includes(id))
  const learnedSkills = [...learned, ...add]
  const equipped = state.player.equippedSkills.filter((id) => learnedSkills.includes(id))
  for (const id of add) if (equipped.length < SKILL_LOADOUT_SIZE) equipped.push(id)
  if (add.length === 0 && learnedSkills.length === state.player.learnedSkills.length && equipped.length === state.player.equippedSkills.length) return state
  return { ...state, player: { ...state.player, learnedSkills, equippedSkills: equipped } }
}

/** 스킬 장착/해제 */
export function toggleEquipSkill(state: GameState, skillId: string): GameState {
  const { learnedSkills, equippedSkills } = state.player
  if (!learnedSkills.includes(skillId)) return state
  if (equippedSkills.includes(skillId)) return { ...state, player: { ...state.player, equippedSkills: equippedSkills.filter((id) => id !== skillId) } }
  if (equippedSkills.length >= SKILL_LOADOUT_SIZE) return { ...state, toast: `전투 스킬은 최대 ${SKILL_LOADOUT_SIZE}개까지 장착할 수 있습니다.` }
  return { ...state, player: { ...state.player, equippedSkills: [...equippedSkills, skillId] } }
}

function skillNames(ids: string[]): string {
  return ids.map((id) => SKILLS.find((s) => s.id === id)?.name ?? id).join(', ')
}

// ─────────────────────────────────────────────────────────────────────────────
// 관계 · 대화 · 방문
// ─────────────────────────────────────────────────────────────────────────────
export function addAffinity(state: GameState, id: string, amount: number): GameState {
  const cur = state.relationships[id] ?? { affinity: 0, lastTalkWeek: 0 }
  const affinity = Math.max(0, Math.min(100, cur.affinity + amount))
  return { ...state, relationships: { ...state.relationships, [id]: { ...cur, affinity } } }
}

/** NPC 대화 — 주 1회 관계도 +2, TALK 퀘스트 이벤트 */
export function talkTo(state: GameState, npcId: string): GameState {
  const gw = state.calendar.globalWeek
  const cur = state.relationships[npcId] ?? { affinity: 0, lastTalkWeek: 0 }
  let next = state
  if (cur.lastTalkWeek !== gw) {
    next = {
      ...next,
      relationships: { ...next.relationships, [npcId]: { affinity: Math.min(100, cur.affinity + 2), lastTalkWeek: gw } },
    }
  }
  // 이 NPC 에게 말을 걸면 열리는 스토리 장면(대본의 '셀린의 약초실'·'오웬의 기록' 등)
  next = queueBeats(next, (t) => t.type === 'TALK' && t.npcId === npcId)
  return withQuestEvents(next, [{ type: 'TALK', npcId }], next.toast)
}

export function visitMap(state: GameState, mapId: MapId): GameState {
  // 방문 기록 — 전체 지도 텔레포트 대상
  const visited = state.visitedMaps ?? []
  const withVisit = visited.includes(mapId) ? state : { ...state, visitedMaps: [...visited, mapId] }
  const next = queueBeats(withVisit, (t) => t.type === 'VISIT' && t.mapId === mapId)
  const out = withQuestEvents(next, [{ type: 'VISIT', mapId }], next.toast)
  // 이번 주 수업이 열리는 교실에 걸어 들어오면 바로 수업 시작(길 안내 '수업 듣기'의 도착점)
  const wc = classForWeek(out.calendar.globalWeek)
  if (wc && !out.weekly.classDone && !out.classScene && out.storyQueue.length === 0 && out.currentMapId === mapId && classMetaFor(wc.courseId).room === mapId) return startClass(out)
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// 채집 · 낚시 (§33, §35)
// ─────────────────────────────────────────────────────────────────────────────
export function gatherAt(state: GameState, nodeKey: string): GameState {
  if (!isActivityUnlocked(state, 'gathering')) return { ...state, toast: '채집은 아직 할 수 없습니다.' }
  const map = MAPS[state.currentMapId]
  const node = gatherNodesForMap(map).find((n) => n.key === nodeKey)
  if (!node || !isNodeReady(state.life, nodeKey)) return state
  if (Math.hypot(node.cell.x - state.position.x, node.cell.y - state.position.y) > 1.6) return state
  const got = rollGather(state.currentMapId, node.kind, hasItem(state.inventory, 'tool-gather-sickle'))
  let inventory = state.inventory
  const gathered = { ...state.collections.gathered }
  for (const g of got) {
    inventory = addToInventory(inventory, g.itemId, g.qty)
    gathered[g.itemId] = (gathered[g.itemId] ?? 0) + g.qty
  }
  const next: GameState = {
    ...state,
    inventory,
    life: { ...state.life, gatheredAt: { ...state.life.gatheredAt, [nodeKey]: Date.now() } },
    collections: { ...state.collections, gathered },
  }
  const label = got.map((g) => `${itemById(g.itemId)?.name ?? g.itemId} x${g.qty}`).join(', ')
  return withQuestEvents(next, got.map((g) => ({ type: 'GATHER' as const, itemId: g.itemId, qty: g.qty })), `채집: ${label}`)
}

/** atSpot = 마을 낚시터(lib/activity-spots) — 낚싯대를 빌려 주므로 해금·낚싯대·물가 조건을 보지 않는다 */
export function startFishing(state: GameState, atSpot = false): GameState {
  if (atSpot) {
    const roll = rollFish(state.currentMapId, hasItem(state.inventory, 'tool-rod-silver'))
    return { ...state, fishing: { fishId: roll.fishId, difficulty: roll.difficulty } }
  }
  if (!isActivityUnlocked(state, 'fishing')) return { ...state, toast: `낚시는 ${ACTIVITY_META.fishing.year}학년 겨울방학에 해금됩니다.` }
  const hasRod = hasItem(state.inventory, 'tool-rod-basic') || hasItem(state.inventory, 'tool-rod-silver')
  if (!hasRod) return { ...state, toast: '낚싯대가 필요합니다. (별빛 상점가 만물상 토비)' }
  if (!isNearWater(MAPS[state.currentMapId], state.position)) return { ...state, toast: '물가에서만 낚시할 수 있습니다.' }
  const roll = rollFish(state.currentMapId, hasItem(state.inventory, 'tool-rod-silver'))
  return { ...state, fishing: { fishId: roll.fishId, difficulty: roll.difficulty } }
}

export function resolveFishing(state: GameState, success: boolean): GameState {
  if (!state.fishing) return state
  const { fishId } = state.fishing
  if (!success) return { ...state, fishing: null, toast: '물고기가 도망갔다…' }
  const next: GameState = {
    ...state,
    fishing: null,
    inventory: addToInventory(state.inventory, fishId, 1),
    collections: { ...state.collections, fish: { ...state.collections.fish, [fishId]: (state.collections.fish[fishId] ?? 0) + 1 } },
  }
  return withQuestEvents(next, [{ type: 'FISH', fishId }], `${itemById(fishId)?.name ?? fishId}을(를) 낚았다!`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 요리 버프 (§36)
// ─────────────────────────────────────────────────────────────────────────────
export function eatFood(state: GameState, itemId: string): GameState {
  const item = itemById(itemId)
  if (!item || item.type !== 'food' || !hasItem(state.inventory, itemId)) return state
  const eff = getEffectiveStats(state.player)
  const hp = Math.min(eff.maxHp, state.player.hp + (item.useEffect?.healHp ?? 0))
  const mp = Math.min(eff.maxMp, state.player.mp + (item.useEffect?.healMp ?? 0))
  return {
    ...state,
    player: { ...state.player, hp, mp },
    inventory: removeFromInventory(state.inventory, itemId, 1),
    mealBuff: item.mealBuff ? { itemId, battlesLeft: item.mealBuff.battles } : state.mealBuff,
    toast: item.mealBuff ? `${item.name}을(를) 먹었다 — ${item.mealBuff.battles}전투 동안 버프` : `${item.name}을(를) 먹었다.`,
  }
}

/** 장비 + 식사 버프 반영 스탯(전투 진입용) */
export function battleStats(state: GameState): Stats {
  const eff = getEffectiveStats(state.player)
  const buff = state.mealBuff ? itemById(state.mealBuff.itemId)?.mealBuff : null
  if (!buff) return eff
  const out = { ...eff }
  for (const k of Object.keys(buff.statPct) as (keyof Stats)[]) out[k] = Math.round(out[k] * (1 + (buff.statPct[k] ?? 0)))
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// 파티 · 진형 · 펫 (PRD v2.0 §16~20, 2026-10-02 개편)
//   진형 6칸(전위 2 · 후위 2 · 지원 2) + 펫 고정 1칸.
//   파티 = 주인공 + 학교 NPC 0~3명(솔로 가능). 남는 2칸은 임시 합류 NPC(호위·동행).
//   펫은 주인공만(보유 펫 중 1마리, state.pet) — 포지션과 무관하게 고정 펫 슬롯으로 참가.
// ─────────────────────────────────────────────────────────────────────────────
export function recruitCompanion(state: GameState, id: string): GameState {
  const def = schoolNpcById(id)
  if (!def || state.companions.recruited[id]) return state
  const check = canRecruit(state, def)
  if (!check.ok) return { ...state, toast: check.reason ?? '아직 합류할 수 없습니다.' }
  const recruited = { ...state.companions.recruited, [id]: createCompanionProgress(def, state.player.level) }
  const party = state.companions.party.length < COMPANION_SLOTS ? [...state.companions.party, id] : state.companions.party
  const next = normalizeFormation({ ...state, companions: { recruited, party } })
  return { ...next, toast: `${def.name}이(가) 파티에 합류했다!` }
}

/** 파티 편성 — 파티에 없으면 넣고(빈 자리가 있을 때), 있으면 뺀다(동료 0명 = 솔로도 허용) */
/** 동료가 쓸 수 있는 자리 — 4칸 중 주인공·임시 NPC 를 뺀 나머지 */
export function companionSlotsFor(state: Pick<GameState, 'companions'>): number {
  return Math.max(0, COMPANION_SLOTS - (state.companions.guests ?? []).length)
}

export function togglePartyMember(state: GameState, id: string): GameState {
  if (!state.companions.recruited[id]) return state
  const inParty = state.companions.party.includes(id)
  if (inParty) {
    return normalizeFormation({ ...state, companions: { ...state.companions, party: state.companions.party.filter((p) => p !== id) } })
  }
  if (state.companions.party.length >= companionSlotsFor(state)) return { ...state, toast: `동료 자리가 없습니다(4대4 — 임시 동행 NPC 포함). 교체할 자리를 먼저 고르세요.` }
  return normalizeFormation({ ...state, companions: { ...state.companions, party: [...state.companions.party, id] } })
}

/** 파티 슬롯 교체 — slot 자리의 동료를 대기 동료 id 로 바꾼다(포지션은 물려받는다) */
export function swapPartyMember(state: GameState, slot: number, id: string): GameState {
  if (!state.companions.recruited[id] || state.companions.party.includes(id)) return state
  const party = [...state.companions.party]
  const outgoing = party[slot]
  if (outgoing) party[slot] = id
  else party.push(id)
  const positions = { ...state.formation.positions }
  if (outgoing && positions[outgoing]) {
    positions[id] = positions[outgoing]
    delete positions[outgoing]
  }
  return normalizeFormation({ ...state, companions: { ...state.companions, party: party.slice(0, COMPANION_SLOTS) }, formation: { positions } })
}

/** 파티원 id 목록(주인공 'hero' 포함, 최대 4) — 경험치·조작 대상 */
export function partyMemberIds(state: Pick<GameState, 'companions'>): string[] {
  return ['hero', ...state.companions.party.slice(0, COMPANION_SLOTS)]
}

/** 진형에 서는 전원(파티 + 임시 NPC, 최대 6) */
export function formationMemberIds(state: Pick<GameState, 'companions'>): string[] {
  return [...partyMemberIds(state), ...(state.companions.guests ?? []).slice(0, MAX_GUESTS).map((g) => g.id)].slice(0, COMPANION_SLOTS + 1)
}

/** 주인공 펫 교체 — 펫은 주인공만 데리고 다닌다(동료 펫 없음) */
export function setMemberPet(state: GameState, memberId: string, defId: string | null): GameState {
  if (memberId !== 'hero' || !defId) return state
  const found = state.ownedPets.find((p) => p.defId === defId)
  if (!found) return state
  return { ...state, pet: found }
}

function defaultPositionOf(id: string): Position {
  if (id === 'hero') return 'front'
  return schoolNpcById(id)?.combat?.defaultPosition ?? guestNpcById(id)?.defaultPosition ?? 'rear'
}

/** 포지션 변경 — 인원 제한(전위 1~2 · 후위 0~2 · 보조 0~2)을 어기면 거절 */
export function setMemberPosition(state: GameState, memberId: string, position: Position): GameState {
  const ids = formationMemberIds(state)
  if (!ids.includes(memberId)) return state
  const positions = { ...state.formation.positions, [memberId]: position }
  const err = formationError(ids.map((id) => positions[id] ?? 'rear'))
  if (err) return { ...state, toast: err }
  return { ...state, formation: { positions } }
}

/**
 * 진형 정리 — 진형 인원 모두에게 포지션을 주고 인원 제한을 맞춘다.
 * 기존 배치를 최대한 유지하고, 넘치는 자리는 남는 자리로 옮긴다(뒤에 들어온 인원부터 밀려난다).
 */
export function normalizeFormation(state: GameState): GameState {
  const ids = formationMemberIds(state)
  const positions: Record<string, Position> = {}
  for (const id of ids) positions[id] = state.formation.positions[id] ?? defaultPositionOf(id)
  const order: Position[] = ['front', 'rear', 'support']
  const count = () => {
    const c: Record<Position, number> = { front: 0, rear: 0, support: 0 }
    for (const id of ids) c[positions[id]] += 1
    return c
  }
  // 1) 최대치 초과 → 다른 자리로(주인공은 마지막에 옮긴다)
  for (const p of order) {
    while (count()[p] > FORMATION_LIMITS[p].max) {
      const mover = [...ids].reverse().find((id) => positions[id] === p && id !== 'hero') ?? ids.find((id) => positions[id] === p)!
      positions[mover] = order.find((q) => q !== p && count()[q] < FORMATION_LIMITS[q].max) ?? 'rear'
    }
  }
  // 2) 전위가 비었으면 → 주인공을 전위로(전위가 0명이었으니 넘칠 일은 없다)
  if (count().front < FORMATION_LIMITS.front.min && ids.length > 0) positions.hero = 'front'
  // 펫은 주인공 전용(state.pet) — 옛 세이브의 동료 펫 배정(formation.pets)은 버린다
  return { ...state, formation: { positions } }
}

/**
 * 파티 보장 — 합류 가능한 1학년 동기를 자동 합류(합류 순간에만 파티에 넣는다).
 * 플레이어가 동료를 빼서 솔로/소수로 다니는 선택은 그대로 존중한다(빈 자리를 다시 채우지 않음).
 */
export function ensureParty(state: GameState): GameState {
  let next = state
  for (const def of COMBAT_NPCS) {
    if (!def.starter || next.companions.recruited[def.id]) continue
    if (!canRecruit(next, def).ok) continue
    const party = next.companions.party.length < COMPANION_SLOTS ? [...next.companions.party, def.id] : next.companions.party
    next = {
      ...next,
      companions: { ...next.companions, party, recruited: { ...next.companions.recruited, [def.id]: createCompanionProgress(def, next.player.level) } },
    }
  }
  const guests = (next.companions.guests ?? []).filter((g) => !!guestNpcById(g.id)).slice(0, MAX_GUESTS)
  // 4대4 — 동료 + 임시 NPC ≤ 3
  // 스토리상 자리를 비운 동료(폭주 후 도주한 루스벨 등)는 파티에서 빠진다
  const party = next.companions.party
    .filter((id) => !!next.companions.recruited[id] && !!schoolNpcById(id)?.combat && !isCompanionAway(next, schoolNpcById(id)))
    .slice(0, Math.max(0, COMPANION_SLOTS - guests.length))
  return normalizeFormation({ ...next, companions: { ...next.companions, party, guests } })
}

// ── 임시 합류 NPC(호위 대상·임시 동행) — 스토리/퀘스트에서 호출 ────────────────
export function addGuest(state: GameState, id: string): GameState {
  const def = guestNpcById(id)
  const guests = state.companions.guests ?? []
  if (!def || guests.some((g) => g.id === id)) return state
  if (guests.length >= MAX_GUESTS) return { ...state, toast: `임시 합류 자리는 최대 ${MAX_GUESTS}명입니다.` }
  if (state.companions.party.length + guests.length >= COMPANION_SLOTS) return { ...state, toast: '4대4 자리가 꽉 찼습니다 — 동료 한 명을 빼야 합류할 수 있습니다.' }
  const next = normalizeFormation({ ...state, companions: { ...state.companions, guests: [...guests, createGuestMember(def, state.player.level)] } })
  return { ...next, toast: `${def.name}이(가) ${def.role === 'escort' ? '호위 대상으로' : '임시로'} 동행한다.` }
}

export function removeGuest(state: GameState, id: string): GameState {
  const guests = (state.companions.guests ?? []).filter((g) => g.id !== id)
  const positions = { ...state.formation.positions }
  delete positions[id]
  return normalizeFormation({ ...state, companions: { ...state.companions, guests }, formation: { positions } })
}

/**
 * 전투 진형 구성 — 주인공(+고정 펫) · 파티 동료 · 임시 NPC 와 각자의 포지션.
 */
export function battleParty(state: GameState): PartyMemberInput[] {
  const pos = (id: string): Position => state.formation.positions[id] ?? defaultPositionOf(id)
  const weapon = state.player.equipped.weapon ? itemById(state.player.equipped.weapon)?.weaponElement : undefined
  const hero = combatantFromPlayer(state.player, battleStats(state), weapon)
  const heroPet = petDefById(state.pet.defId) ? combatantFromPet(state.pet, 'hero') : null
  const members: PartyMemberInput[] = [{ combatant: hero, position: pos('hero'), pet: heroPet }]
  for (const id of state.companions.party.slice(0, COMPANION_SLOTS)) {
    const def = schoolNpcById(id)
    const prog = state.companions.recruited[id]
    if (!def?.combat || !prog) continue
    members.push({ combatant: combatantFromCompanion(def, prog), position: pos(id) })
  }
  for (const g of (state.companions.guests ?? []).slice(0, MAX_GUESTS)) {
    const def = guestNpcById(g.id)
    if (def) members.push({ combatant: combatantFromGuest(def, g), position: pos(g.id) })
  }
  return members
}

/** 전투가 끝난 뒤 동료 HP/MP 를 전투 결과로 되돌려 적는다(쓰러졌으면 1). 보조 포지션 HP 보너스는 비율로 환산 */
function syncCompanionsFromBattle(state: GameState, battle: BattleState, ratioOnDefeat?: number): GameState {
  const recruited = { ...state.companions.recruited }
  for (const c of battle.combatants) {
    if (c.kind !== 'ally' || c.guest) continue
    const prog = recruited[c.refId]
    const def = schoolNpcById(c.refId)
    if (!prog || !def) continue
    const baseMax = companionStats(def, prog.level).maxHp
    const ratio = ratioOnDefeat != null ? ratioOnDefeat : c.hp / Math.max(1, c.stats.maxHp)
    const hp = Math.max(1, Math.min(baseMax, Math.round(baseMax * ratio)))
    recruited[c.refId] = { ...prog, hp, mp: c.mp }
  }
  // 임시 NPC HP/MP — 호위 임무가 여러 전투에 걸쳐 이어지므로 남긴다
  const guests = (state.companions.guests ?? []).map((g) => {
    const c = battle.combatants.find((x) => x.guest && x.refId === g.id)
    const def = guestNpcById(g.id)
    if (!c || !def) return g
    const baseMax = guestStats(def, g.level).maxHp
    const ratio = ratioOnDefeat != null ? ratioOnDefeat : c.hp / Math.max(1, c.stats.maxHp)
    return { ...g, hp: Math.max(1, Math.min(baseMax, Math.round(baseMax * ratio))), mp: c.mp }
  })
  return { ...state, companions: { ...state.companions, recruited, guests } }
}

export function healCompanions(state: GameState): GameState {
  const recruited = { ...state.companions.recruited }
  for (const [id, prog] of Object.entries(recruited)) {
    const def = schoolNpcById(id)
    if (!def) continue
    const s = companionStats(def, prog.level)
    recruited[id] = { ...prog, hp: s.maxHp, mp: s.maxMp }
  }
  const guests = (state.companions.guests ?? []).map((g) => {
    const def = guestNpcById(g.id)
    if (!def) return g
    const s = guestStats(def, g.level)
    return { ...g, hp: s.maxHp, mp: s.maxMp }
  })
  return { ...state, companions: { ...state.companions, recruited, guests } }
}

// ─────────────────────────────────────────────────────────────────────────────
// 전투 종료 후처리 — 리듀서의 기존 승리/패배 처리 "다음에" 호출
// ─────────────────────────────────────────────────────────────────────────────
/** 퀘스트 보상 경험치 — 레벨업 시 전투 승리 경로와 같은 규칙으로 스탯·스킬 갱신 */
export function grantHeroExp(state: GameState, amount: number): GameState {
  const r = applyExp(state.player.level, state.player.exp, amount)
  if (!r.leveledUp) return { ...state, player: { ...state.player, exp: r.newExp } }
  const stats = computeStatsForLevel(r.newLevel)
  return refreshSkills({
    ...state,
    player: { ...state.player, level: r.newLevel, exp: r.newExp, stats, hp: stats.maxHp, mp: stats.maxMp },
  })
}

/** 이번 전투의 1인당 경험치(주인공·동료·펫 공통) */
export function battleExpShare(battle: BattleState): number {
  return battle.rewardExpShare ?? expSharePerMember(battle.rewardExp ?? 0, expShareMemberCount(battle.combatants))
}

/** 동료 경험치 지급(전투 분배·마력캔디 공용) — 레벨업 시 HP/MP 가득 */
export function grantCompanionExp(state: GameState, id: string, amount: number): { state: GameState; leveledTo: number | null } {
  const prog = state.companions.recruited[id]
  const def = schoolNpcById(id)
  if (!prog || !def || amount <= 0) return { state, leveledTo: null }
  const r = applyExp(prog.level, prog.exp, amount)
  const next = r.leveledUp
    ? (() => {
        const s = companionStats(def, r.newLevel)
        return { level: r.newLevel, exp: r.newExp, hp: s.maxHp, mp: s.maxMp }
      })()
    : { ...prog, exp: r.newExp }
  return {
    state: { ...state, companions: { ...state.companions, recruited: { ...state.companions.recruited, [id]: next } } },
    leveledTo: r.leveledUp ? r.newLevel : null,
  }
}

/** 마력캔디 — 주인공('hero') 또는 합류한 동료에게 경험치. 필드 전용 */
export function useExpCandy(state: GameState, itemId: string, targetId: string): GameState {
  const item = itemById(itemId)
  const amount = item?.useEffect?.grantExp ?? 0
  if (!item || amount <= 0 || !hasItem(state.inventory, itemId)) return state
  const inventory = removeFromInventory(state.inventory, itemId, 1)
  if (targetId === 'hero') {
    const prev = state.player.level
    const next = grantHeroExp({ ...state, inventory }, amount)
    const lv = next.player.level > prev ? ` 레벨 업! Lv.${next.player.level}` : ''
    return { ...next, toast: `${item.name}을(를) 먹었다 — 경험치 +${amount}.${lv}` }
  }
  const def = schoolNpcById(targetId)
  if (!def || !state.companions.recruited[targetId]) return state
  const r = grantCompanionExp({ ...state, inventory }, targetId, amount)
  const lv = r.leveledTo ? ` 레벨 업! Lv.${r.leveledTo}` : ''
  return { ...addAffinity(r.state, targetId, 1), toast: `${def.name}이(가) ${item.name}을(를) 먹었다 — 경험치 +${amount}.${lv}` }
}

/** 주인공 경험치는 리듀서(BATTLE_END_CONTINUE)가 battleExpShare 로 먼저 지급한 뒤 이 함수를 부른다 */
export function afterBattleVictory(state: GameState, battle: BattleState): GameState {
  let next = syncCompanionsFromBattle(state, battle)
  if (battle.storyBeatId) next = { ...next, storyFlags: { ...next.storyFlags, [`beat:${battle.storyBeatId}`]: true } }
  const share = battleExpShare(battle)
  // 동료 경험치 — 이번 전투에 출전한 파티 동료가 1인당 몫을 받는다(임시 NPC 제외)
  const levelUps: string[] = []
  for (const c of battle.combatants) {
    if (c.kind !== 'ally' || c.guest || !next.companions.recruited[c.refId]) continue
    const r = grantCompanionExp(next, c.refId, share)
    next = addAffinity(r.state, c.refId, 1)
    if (r.leveledTo) levelUps.push(`${c.name} Lv.${r.leveledTo}`)
  }
  if (levelUps.length) next = { ...next, toast: joinToast(next.toast, `동료 레벨 업! ${levelUps.join(', ')}`) }

  // 펫 경험치 — 이번 전투에 참가한 펫(전위 주인) 각각 1인 몫(나누는 인원에는 포함되지 않음)
  for (const pc of battle.combatants.filter((c) => c.kind === 'pet')) {
    const owned = next.ownedPets.find((p) => p.defId === pc.refId)
    if (!owned) continue
    const r = applyExp(owned.level, owned.exp, share)
    const upd = { ...owned, level: r.newLevel, exp: r.newExp, hp: Math.max(1, pc.hp), mp: pc.mp }
    next = { ...next, ownedPets: next.ownedPets.map((p) => (p.defId === upd.defId ? upd : p)), pet: next.pet.defId === upd.defId ? { ...next.pet, level: upd.level, exp: upd.exp } : next.pet }
  }

  // 사냥 부산물
  let inventory = next.inventory
  for (const id of battle.huntDrops ?? []) inventory = addToInventory(inventory, id, 1)

  // 도감 + 퀘스트 이벤트
  const monsters = { ...next.collections.monsters }
  const events: QuestEvent[] = []
  for (const c of battle.combatants) {
    if (c.side !== 'enemy') continue
    const def = monsterById(c.refId)
    if (!def || def.isTestMonster) continue
    monsters[def.id] = (monsters[def.id] ?? 0) + 1
    events.push({ type: 'KILL', monsterId: def.id, family: def.family })
  }
  events.push({ type: 'WIN_BATTLE', regionId: regionOfMap(next.currentMapId) })
  for (const id of battle.huntDrops ?? []) events.push({ type: 'HUNT', itemId: id, qty: 1 })

  const mealBuff = next.mealBuff && next.mealBuff.battlesLeft > 1 ? { ...next.mealBuff, battlesLeft: next.mealBuff.battlesLeft - 1 } : null
  next = { ...next, inventory, mealBuff, collections: { ...next.collections, monsters } }
  // 전투 승리 스토리 비트(보스 처치 후 장면 등)
  const defeated = new Set(battle.combatants.filter((c) => c.side === 'enemy').map((c) => c.refId))
  const mapId = next.currentMapId
  next = queueBeats(next, (t) => t.type === 'DEFEAT' && (!t.monsterId || defeated.has(t.monsterId)) && (!t.mapId || t.mapId === mapId))
  return withQuestEvents(next, events, next.toast)
}

export function afterBattleDefeat(state: GameState, battle: BattleState): GameState {
  const next = syncCompanionsFromBattle(state, battle, 0.2)
  const mealBuff = next.mealBuff && next.mealBuff.battlesLeft > 1 ? { ...next.mealBuff, battlesLeft: next.mealBuff.battlesLeft - 1 } : null
  return { ...next, mealBuff }
}

export function afterBattleFled(state: GameState, battle: BattleState | null): GameState {
  return battle ? syncCompanionsFromBattle(state, battle) : state
}
