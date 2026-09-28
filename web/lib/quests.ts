// ============================================================================
// 주간 퀘스트 시스템 (§학사 PRD 4~7, 45~49, 66~68, 72)
//
//   매주 = 필수(MAIN) 1개 + 조건부 랜덤 4개(CLASS · COMBAT · LIFE · FREE).
//   필수 + 선택 2개 이상 보상을 받으면 그 주를 마감하고 다음 주로 넘어갈 수 있다(§5, §66).
//
//   · 템플릿(QUEST_TEMPLATES)은 순수 데이터 — 새 퀘스트는 여기에 한 줄 추가하면 끝(§82-5, 13)
//   · 생성은 시드 고정(Hash(PlayerSeed + GlobalWeek + Region + StoryProgress), §67):
//     같은 세이브를 다시 불러와도 이번 주 퀘스트가 바뀌지 않는다.
//   · 필터: 학년 · 학기/방학 · 활동 해금 · 스토리 플래그 · 지역(아직 이야기상 도달 전 지역 제외) · 최근 등장(§6.1)
//   · 가중치: 카테고리 기본값(§7) × 지역 보정(§72) × 최근 등장 감쇠
//   · 진행: 게임 곳곳에서 QuestEvent 를 던지면(applyQuestEvent) 목표 진행도가 오른다.
// ============================================================================

import type {
  GameState,
  MonsterFamily,
  QuestCategory,
  QuestInstance,
  QuestObjective,
  QuestReward,
  QuestSlot,
  TermType,
  WeeklyState,
} from '@/lib/types'
import { calendarInfo } from '@/lib/calendar'
import { arcForWeek, flagsAllOn, MAIN_QUEST_BY_WEEK, STORY_ARCS } from '@/lib/story'
import { REGIONS, type RegionId } from '@/lib/regions'
import { isActivityUnlocked, itemMatches, type ActivityId } from '@/lib/life'
import { itemById } from '@/lib/mock-data'
import { mulberry32 } from '@/lib/rng'

export interface QuestTemplate {
  id: string
  category: QuestCategory
  title: string
  description: string
  objectives: QuestObjective[]
  rewards: QuestReward[]
  minYear?: number
  maxYear?: number
  /** 이 학기 종류에서만 등장(생략 시 전부) */
  terms?: TermType[]
  /** 이 지역 관련 퀘스트 — 지역 가중치(§72) 대상. 생략 = 어디서나 */
  regionId?: RegionId
  /** 해금이 필요한 생활 활동 */
  activity?: ActivityId
  /** 필요한 스토리 플래그 */
  requiredFlags?: string[]
  /** 기본 가중치 — 생략 시 카테고리 기본값(§7) */
  weight?: number
  /** 다시 나오기까지 최소 주 수(기본 3) */
  cooldownWeeks?: number
}

// §7 기본 가중치
export const CATEGORY_WEIGHT: Record<QuestCategory, number> = {
  MAIN: 0,
  CLASS: 20,
  COMBAT: 20,
  GATHER: 12,
  HUNT: 10,
  FISH: 8,
  ALCHEMY: 10,
  COOK: 7,
  CRAFT: 7,
  NPC: 8,
  EXPLORE: 12,
  HOUSING: 5,
}

export const CATEGORY_SLOT: Record<QuestCategory, QuestSlot> = {
  MAIN: 'MAIN',
  CLASS: 'CLASS',
  COMBAT: 'COMBAT',
  GATHER: 'LIFE',
  HUNT: 'LIFE',
  FISH: 'LIFE',
  ALCHEMY: 'LIFE',
  COOK: 'LIFE',
  CRAFT: 'LIFE',
  NPC: 'FREE',
  EXPLORE: 'FREE',
  HOUSING: 'FREE',
}

export const SLOT_LABEL: Record<QuestSlot, string> = {
  MAIN: '필수',
  CLASS: '수업',
  COMBAT: '전투',
  LIFE: '생활',
  FREE: '자유',
}

/** 필수 외에 보상을 받아야 하는 선택 퀘스트 수(§5) */
export const REQUIRED_OPTIONAL = 2

const o = (type: QuestObjective['type'], targetId: string, count: number, label: string): QuestObjective => ({ type, targetId, count, label })
const exp = (amount: number): QuestReward => ({ type: 'EXP', amount })
const gold = (amount: number): QuestReward => ({ type: 'GOLD', amount })
const course = (amount: number): QuestReward => ({ type: 'COURSE', amount })
const item = (itemId: string, amount = 1): QuestReward => ({ type: 'ITEM', itemId, amount })
const rel = (npcId: string, amount: number): QuestReward => ({ type: 'RELATIONSHIP', npcId, amount })

// ─────────────────────────────────────────────────────────────────────────────
// 템플릿 — 스토리 무관한 반복 풀. 스토리 전용 MAIN 은 story.ts MAIN_QUEST_BY_WEEK 로 지정.
// ─────────────────────────────────────────────────────────────────────────────
export const QUEST_TEMPLATES: QuestTemplate[] = [
  // ── MAIN 기본 일과(주차별 스토리 퀘스트가 없을 때) ─────────────────────────
  { id: 'MAIN_ROUTINE_SEMESTER', category: 'MAIN', title: '주간 학사 보고', description: '이번 주 수업 일정을 미르엘 교수에게 보고한다.', objectives: [o('TALK', 'npc-job-trainer', 1, '미르엘 교수와 대화')], rewards: [exp(40), gold(60), course(10)], terms: ['semester1', 'semester2'] },
  { id: 'MAIN_ROUTINE_VACATION', category: 'MAIN', title: '원정 일지', description: '방학 원정 중 전투 기록을 남긴다.', objectives: [o('WIN_BATTLE', 'any', 3, '전투 승리')], rewards: [exp(80), gold(90)], terms: ['summer', 'winter'] },

  // ── CLASS 수업(학기 중에만) ───────────────────────────────────────────────
  { id: 'CLASS_LIBRARY', category: 'CLASS', title: '이론 수업 — 자료 조사', description: '도서관 별관에서 이번 주 강의 자료를 찾는다.', objectives: [o('TALK', 'npc-librarian', 1, '사서 오웬과 대화')], rewards: [exp(30), course(25), rel('npc-librarian', 3)], terms: ['semester1', 'semester2'] },
  { id: 'CLASS_ELEMENT_DRILL', category: 'CLASS', title: '실습 — 원소 마법', description: '실전에서 계통 마법을 써 본다.', objectives: [o('WIN_BATTLE', 'any', 3, '전투 승리')], rewards: [exp(50), course(30)], terms: ['semester1', 'semester2'] },
  { id: 'CLASS_FIELD_STUDY', category: 'CLASS', title: '과제 — 현장 채집 보고', description: '약초를 채집해 표본을 제출한다.', objectives: [o('GATHER', 'tag:herb', 5, '약초 채집')], rewards: [exp(40), course(30)], terms: ['semester1', 'semester2'], activity: 'gathering' },
  { id: 'CLASS_CRAFT_LAB', category: 'CLASS', title: '실습 — 제작 기초', description: '작업대에서 무엇이든 하나 제작한다.', objectives: [o('CRAFT', 'any', 1, '아이템 제작')], rewards: [exp(50), course(35)], terms: ['semester1', 'semester2'], activity: 'crafting' },
  { id: 'CLASS_ALCHEMY_LAB', category: 'CLASS', title: '연금술 실습', description: '가마에서 물약을 조합한다.', objectives: [o('ALCHEMY', 'any', 2, '연금술 조합')], rewards: [exp(60), course(35)], terms: ['semester1', 'semester2'], activity: 'alchemy' },
  { id: 'CLASS_COOKING_LAB', category: 'CLASS', title: '요리학 실습', description: '실습 전에 학생들이 먹을 요리를 준비하자.', objectives: [o('COOK', 'any', 3, '요리')], rewards: [exp(60), course(35)], terms: ['semester1', 'semester2'], activity: 'cooking' },
  { id: 'CLASS_HUNT_LAB', category: 'CLASS', title: '사냥학 실습', description: '몬스터 부산물을 손질해 제출한다.', objectives: [o('HUNT', 'any', 4, '사냥 부산물 획득')], rewards: [exp(60), course(35)], terms: ['semester1', 'semester2'], activity: 'hunting' },

  // ── COMBAT 토벌 ────────────────────────────────────────────────────────────
  { id: 'COMBAT_ERDIA_BEASTS', category: 'COMBAT', title: '숲 짐승 토벌', description: '에르디아 숲의 짐승형 몬스터를 정리한다.', objectives: [o('KILL', 'family:beast', 5, '짐승형 처치')], rewards: [exp(70), gold(80)], regionId: 'ERDIA', maxYear: 2 },
  { id: 'COMBAT_ERDIA_PLANTS', category: 'COMBAT', title: '가시덩굴 제거', description: '길을 막는 식물형 몬스터를 걷어낸다.', objectives: [o('KILL', 'family:plant', 3, '식물형 처치')], rewards: [exp(60), gold(70)], regionId: 'ERDIA', maxYear: 2 },
  { id: 'COMBAT_WOLF', category: 'COMBAT', title: '회색 늑대 경보', description: '마을 근처까지 내려온 늑대 무리를 쫓아낸다.', objectives: [o('KILL', 'mon-grey-wolf', 3, '회색 늑대 처치')], rewards: [exp(90), gold(100)], regionId: 'ERDIA' },
  { id: 'COMBAT_COAST_AQUATIC', category: 'COMBAT', title: '해안 순찰', description: '해안에 출몰하는 수생 몬스터를 토벌한다.', objectives: [o('KILL', 'family:aquatic', 5, '수생형 처치')], rewards: [exp(110), gold(120)], regionId: 'COAST' },
  { id: 'COMBAT_RUINS_UNDEAD', category: 'COMBAT', title: '폐허의 망자', description: '폐허를 떠도는 언데드를 잠재운다.', objectives: [o('KILL', 'family:undead', 5, '언데드 처치')], rewards: [exp(160), gold(160)], regionId: 'RUINS', minYear: 2 },
  { id: 'COMBAT_CONSTRUCT', category: 'COMBAT', title: '석상 병사 조사', description: '움직이는 구조물을 파괴하고 핵을 조사한다.', objectives: [o('KILL', 'family:construct', 3, '구조물형 처치')], rewards: [exp(170), gold(170)], minYear: 2 },
  { id: 'COMBAT_DARKMAGE', category: 'COMBAT', title: '흑마법 흔적', description: '어둠의 마법사 세력을 추적한다.', objectives: [o('KILL', 'family:darkmage', 3, '흑마법사형 처치')], rewards: [exp(220), gold(200)], minYear: 3 },
  { id: 'COMBAT_WIN_ANY', category: 'COMBAT', title: '실전 감각', description: '어디서든 전투에서 5번 승리한다.', objectives: [o('WIN_BATTLE', 'any', 5, '전투 승리')], rewards: [exp(100), gold(90)] },

  // ── LIFE 생활 ──────────────────────────────────────────────────────────────
  { id: 'GATHER_HERB', category: 'GATHER', title: '약초 모으기', description: '약사 셀린이 약초를 찾고 있다.', objectives: [o('GATHER', 'tag:herb', 6, '약초 채집')], rewards: [exp(40), gold(70), rel('npc-potion', 3)], activity: 'gathering' },
  { id: 'GATHER_MUSHROOM', category: 'GATHER', title: '버섯 채집', description: '공동 식당에 쓸 버섯을 모은다.', objectives: [o('GATHER', 'tag:mushroom', 4, '버섯 채집')], rewards: [exp(40), gold(60)], activity: 'gathering', regionId: 'ERDIA' },
  { id: 'GATHER_WOOD', category: 'GATHER', title: '목재 조달', description: '작업대에 쓸 목재를 구한다.', objectives: [o('GATHER', 'tag:wood', 4, '목재 채집')], rewards: [exp(40), gold(60)], activity: 'gathering' },
  { id: 'GATHER_SHORE', category: 'GATHER', title: '갯바위 채집', description: '해안에서 해산물을 모은다.', objectives: [o('GATHER', 'tag:seafood', 5, '해산물 채집')], rewards: [exp(60), gold(90)], activity: 'gathering', regionId: 'COAST' },
  { id: 'GATHER_ORE', category: 'GATHER', title: '광석 채굴', description: '대장장이 반에게 광석을 가져다준다.', objectives: [o('GATHER', 'tag:ore', 4, '광석 채굴')], rewards: [exp(90), gold(120), rel('npc-weapon', 3)], activity: 'gathering', minYear: 2 },
  { id: 'FISH_ANY', category: 'FISH', title: '한가한 낚시', description: '물가에서 물고기를 낚는다.', objectives: [o('FISH', 'any', 2, '물고기 낚기')], rewards: [exp(40), gold(60)], activity: 'fishing' },
  { id: 'FISH_COAST', category: 'FISH', title: '해안 낚시 대회', description: '해안에서 물고기를 잔뜩 낚는다.', objectives: [o('FISH', 'any', 4, '물고기 낚기')], rewards: [exp(80), gold(120)], activity: 'fishing', regionId: 'COAST' },
  { id: 'HUNT_MEAT', category: 'HUNT', title: '식재료 사냥', description: '짐승 고기를 구해 온다.', objectives: [o('HUNT', 'tag:meat', 3, '고기 획득')], rewards: [exp(70), gold(90)], activity: 'hunting' },
  { id: 'HUNT_HIDE', category: 'HUNT', title: '가죽 손질', description: '장비 수선용 가죽을 모은다.', objectives: [o('HUNT', 'tag:hide', 2, '가죽 획득')], rewards: [exp(70), gold(90)], activity: 'hunting' },
  { id: 'ALCH_POTION', category: 'ALCHEMY', title: '물약 납품', description: '체력 물약을 조합해 납품한다.', objectives: [o('ALCHEMY', 'potion-hp-s', 2, '체력 물약(소) 조합')], rewards: [exp(60), gold(100), rel('npc-potion', 3)], activity: 'alchemy' },
  { id: 'COOK_MEAL', category: 'COOK', title: '든든한 한 끼', description: '공동 식당에서 요리를 만든다.', objectives: [o('COOK', 'any', 2, '요리')], rewards: [exp(50), gold(70)], activity: 'cooking' },
  { id: 'CRAFT_ANY', category: 'CRAFT', title: '작업대 정비', description: '무엇이든 하나 제작한다.', objectives: [o('CRAFT', 'any', 1, '아이템 제작')], rewards: [exp(60), gold(80)], activity: 'crafting' },
  { id: 'CRAFT_FURNITURE', category: 'CRAFT', title: '허브 화분 만들기', description: '방에 둘 화분을 만든다.', objectives: [o('CRAFT', 'furn-herb-pot', 1, '허브 화분 제작')], rewards: [exp(60), gold(80)], activity: 'furniture' },

  // ── FREE 자유(NPC · 탐험 · 하우징) ─────────────────────────────────────────
  { id: 'NPC_SHOP_ROUND', category: 'NPC', title: '상점가 인사', description: '상점가 사람들과 안면을 튼다.', objectives: [o('TALK', 'npc-potion', 1, '약사 셀린'), o('TALK', 'npc-weapon', 1, '대장장이 반')], rewards: [exp(30), gold(50), rel('npc-potion', 2), rel('npc-weapon', 2)] },
  { id: 'NPC_FARMER', category: 'NPC', title: '농가 일손 돕기', description: '농부 하름의 이야기를 들어 준다.', objectives: [o('TALK', 'npc-farmer', 1, '농부 하름과 대화')], rewards: [exp(30), item('potion-hp-s', 2), rel('npc-farmer', 4)] },
  { id: 'NPC_TEMPLE', category: 'NPC', title: '성역 참배', description: '성역 대성당을 찾아 기도한다.', objectives: [o('TALK', 'npc-priest', 1, '신관 세드릭과 대화')], rewards: [exp(30), item('potion-mp-s', 2), rel('npc-priest', 4)] },
  { id: 'NPC_ANY3', category: 'NPC', title: '마당발', description: '이번 주에 여러 사람과 이야기를 나눈다.', objectives: [o('TALK', 'any', 3, 'NPC와 대화')], rewards: [exp(40), gold(60)] },
  { id: 'EXPLORE_CAVE', category: 'EXPLORE', title: '이끼 동굴 탐사', description: '에르디아 숲 안쪽 이끼 동굴을 둘러본다.', objectives: [o('VISIT', 'cave', 1, '이끼 동굴 방문')], rewards: [exp(60), gold(60)], regionId: 'ERDIA' },
  { id: 'EXPLORE_SWAMP', category: 'EXPLORE', title: '안개 늪지 답사', description: '안개 늪지의 지형을 기록한다.', objectives: [o('VISIT', 'swamp', 1, '안개 늪지 방문')], rewards: [exp(60), gold(60)], regionId: 'ERDIA' },
  { id: 'EXPLORE_ATLANTIS', category: 'EXPLORE', title: '아틀란티스 방문', description: '바다 건너 아틀란티스 마을을 방문한다.', objectives: [o('VISIT', 'atlantis', 1, '아틀란티스 방문')], rewards: [exp(90), gold(90)], regionId: 'COAST' },
  { id: 'EXPLORE_SKYTEMPLE', category: 'EXPLORE', title: '천공 신전 순례', description: '폭풍 위 천공 신전에 오른다.', objectives: [o('VISIT', 'sky-temple', 1, '천공 신전 방문')], rewards: [exp(140), gold(120)], regionId: 'STORMHAVEN' },
  { id: 'EXPLORE_AURORA', category: 'EXPLORE', title: '오로라 마을 방문', description: '설원 너머 오로라 마을을 찾아간다.', objectives: [o('VISIT', 'aurora-village', 1, '오로라 마을 방문')], rewards: [exp(200), gold(160)], regionId: 'SNOWFIELD' },
  { id: 'HOUSING_DECORATE', category: 'HOUSING', title: '방 꾸미기', description: '개인 공간에 가구를 하나 배치한다.', objectives: [o('PLACE_FURNITURE', 'any', 1, '가구 배치')], rewards: [exp(30), gold(50)] },
]

const TEMPLATE_BY_ID = new Map(QUEST_TEMPLATES.map((t) => [t.id, t]))
export function questTemplateById(id: string): QuestTemplate | undefined {
  return TEMPLATE_BY_ID.get(id)
}

/** 학년이 오를수록 보상 배율(§69 난이도는 내부 값) */
export function yearRewardMult(globalWeek: number): number {
  return 1 + (calendarInfo(globalWeek).year - 1) * 0.8
}

// ─────────────────────────────────────────────────────────────────────────────
// 생성기 (§68)
// ─────────────────────────────────────────────────────────────────────────────
function hashSeed(...parts: (number | string)[]): number {
  let h = 2166136261
  for (const p of parts) {
    const str = String(p)
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    h ^= 0x9e3779b9
  }
  return h >>> 0
}

/** 이야기상 이미 도달한(현재 장 이하) 지역들 */
function reachedRegions(globalWeek: number): Set<RegionId> {
  const out = new Set<RegionId>(['ACADEMY'])
  for (const a of STORY_ARCS) if (a.startWeek <= globalWeek) out.add(a.mainRegion)
  // 3장은 스톰헤이븐 + 폐허를 함께 연다
  if (out.has('STORMHAVEN')) out.add('RUINS')
  return out
}

type GenState = Pick<GameState, 'playerSeed' | 'calendar' | 'storyFlags' | 'settings' | 'weekly'>

function eligible(t: QuestTemplate, state: GenState, reached: Set<RegionId>): boolean {
  const info = calendarInfo(state.calendar.globalWeek)
  if (t.minYear && info.year < t.minYear) return false
  if (t.maxYear && info.year > t.maxYear) return false
  if (t.terms && !t.terms.includes(info.termType)) return false
  if (t.activity && !isActivityUnlocked(state, t.activity)) return false
  if (!flagsAllOn(state, t.requiredFlags)) return false
  if (t.regionId && !reached.has(t.regionId) && !state.storyFlags.DEBUG_UNLOCK_ALL) return false
  const last = state.weekly.lastSeen[t.id]
  if (last != null && state.calendar.globalWeek - last < (t.cooldownWeeks ?? 3)) return false
  return true
}

function weightOf(t: QuestTemplate, state: GenState): number {
  const info = calendarInfo(state.calendar.globalWeek)
  const arcRegion = arcForWeek(state.calendar.globalWeek).mainRegion
  let w = t.weight ?? CATEGORY_WEIGHT[t.category]
  // §72 지역 가중치: 학기 = 학교 중심, 방학 = 원정 지역 중심
  if (t.regionId) {
    if (t.regionId === arcRegion) w *= info.isVacation ? 3.5 : 1.6
    else if (t.regionId === 'ACADEMY') w *= info.isVacation ? 0.4 : 2
    else w *= 0.5 // 이전 지역
  } else if (info.isVacation && t.category === 'CLASS') {
    w = 0
  }
  const last = state.weekly.lastSeen[t.id]
  if (last != null && state.calendar.globalWeek - last < 6) w *= 0.5
  return w
}

function pick<T>(list: T[], weights: number[], rand: () => number): T | null {
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return null
  let roll = rand() * total
  for (let i = 0; i < list.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return list[i]
  }
  return list[list.length - 1]
}

function instanceOf(t: QuestTemplate, slot: QuestSlot, week: number): QuestInstance {
  return { instanceId: `${week}-${t.id}`, templateId: t.id, slot, progress: t.objectives.map(() => 0), status: 'active' }
}

/** 이번 주 퀘스트 5개 생성 — 같은 입력이면 항상 같은 결과 */
export function generateWeeklyQuests(state: GenState): WeeklyState {
  const gw = state.calendar.globalWeek
  const info = calendarInfo(gw)
  const flagCount = Object.values(state.storyFlags).filter(Boolean).length
  const arc = arcForWeek(gw)
  const rand = mulberry32(hashSeed(state.playerSeed, gw, arc.mainRegion, flagCount))
  const reached = reachedRegions(gw)

  // MAIN — 스토리 지정이 있으면 그것, 없으면 학기/방학 기본 일과
  const mainId = MAIN_QUEST_BY_WEEK[gw] ?? (info.isVacation ? 'MAIN_ROUTINE_VACATION' : 'MAIN_ROUTINE_SEMESTER')
  const main = questTemplateById(mainId) ?? QUEST_TEMPLATES[0]
  const quests: QuestInstance[] = [instanceOf(main, 'MAIN', gw)]
  const used = new Set<string>([main.id])

  // 방학에는 수업이 없으므로 CLASS 슬롯 대신 전투/생활을 하나 더
  const slots: QuestSlot[] = info.isVacation ? ['COMBAT', 'LIFE', 'FREE', 'LIFE'] : ['CLASS', 'COMBAT', 'LIFE', 'FREE']
  for (const slot of slots) {
    const pool = QUEST_TEMPLATES.filter((t) => t.category !== 'MAIN' && CATEGORY_SLOT[t.category] === slot && !used.has(t.id) && eligible(t, state, reached))
    // 같은 계열(카테고리) 중복 억제(§6.1)
    const usedCats = new Set(quests.map((q) => questTemplateById(q.templateId)?.category))
    const weights = pool.map((t) => weightOf(t, state) * (usedCats.has(t.category) ? 0.3 : 1))
    let chosen = pick(pool, weights, rand)
    // 슬롯에 맞는 게 없으면(초반 생활 미해금 등) 어느 슬롯이든 남은 것에서
    if (!chosen) {
      const any = QUEST_TEMPLATES.filter((t) => t.category !== 'MAIN' && !used.has(t.id) && eligible(t, state, reached))
      chosen = pick(any, any.map((t) => weightOf(t, state)), rand)
    }
    if (!chosen) continue
    used.add(chosen.id)
    quests.push(instanceOf(chosen, slot, gw))
  }

  const lastSeen = { ...state.weekly.lastSeen }
  for (const q of quests) lastSeen[q.templateId] = gw
  return { week: gw, quests, lastSeen }
}

// ─────────────────────────────────────────────────────────────────────────────
// 진행 이벤트
// ─────────────────────────────────────────────────────────────────────────────
export type QuestEvent =
  | { type: 'KILL'; monsterId: string; family: MonsterFamily }
  | { type: 'WIN_BATTLE'; regionId: RegionId }
  | { type: 'GATHER'; itemId: string; qty: number }
  | { type: 'HUNT'; itemId: string; qty: number }
  | { type: 'FISH'; fishId: string }
  | { type: 'CRAFT' | 'COOK' | 'ALCHEMY'; itemId: string; qty: number }
  | { type: 'TALK'; npcId: string }
  | { type: 'VISIT'; mapId: string }
  | { type: 'PLACE_FURNITURE' }

function gainFor(obj: QuestObjective, ev: QuestEvent): number {
  if (obj.type !== ev.type) return 0
  switch (ev.type) {
    case 'KILL':
      if (obj.targetId === 'any' || obj.targetId === ev.monsterId || obj.targetId === `family:${ev.family}`) return 1
      return 0
    case 'WIN_BATTLE':
      return obj.targetId === 'any' || obj.targetId === ev.regionId ? 1 : 0
    case 'GATHER':
    case 'HUNT':
    case 'CRAFT':
    case 'COOK':
    case 'ALCHEMY':
      return itemMatches(itemById(ev.itemId), obj.targetId) ? ev.qty : 0
    case 'FISH':
      return obj.targetId === 'any' || obj.targetId === ev.fishId ? 1 : 0
    case 'TALK':
      return obj.targetId === 'any' || obj.targetId === ev.npcId ? 1 : 0
    case 'VISIT':
      return obj.targetId === ev.mapId ? 1 : 0
    case 'PLACE_FURNITURE':
      return 1
  }
}

/** 이벤트 적용 — 새로 완료된 퀘스트 제목 목록을 함께 돌려준다 */
export function applyQuestEvent(weekly: WeeklyState, ev: QuestEvent): { weekly: WeeklyState; completed: string[] } {
  const completed: string[] = []
  let changed = false
  const quests = weekly.quests.map((q) => {
    if (q.status !== 'active') return q
    const t = questTemplateById(q.templateId)
    if (!t) return q
    let touched = false
    const progress = q.progress.map((p, i) => {
      const obj = t.objectives[i]
      if (p >= obj.count) return p
      const g = gainFor(obj, ev)
      if (g <= 0) return p
      touched = true
      return Math.min(obj.count, p + g)
    })
    if (!touched) return q
    changed = true
    const done = progress.every((p, i) => p >= t.objectives[i].count)
    if (done) completed.push(t.title)
    return { ...q, progress, status: done ? ('complete' as const) : q.status }
  })
  return { weekly: changed ? { ...weekly, quests } : weekly, completed }
}

export function applyQuestEvents(weekly: WeeklyState, events: QuestEvent[]): { weekly: WeeklyState; completed: string[] } {
  let w = weekly
  const completed: string[] = []
  for (const ev of events) {
    const r = applyQuestEvent(w, ev)
    w = r.weekly
    completed.push(...r.completed)
  }
  return { weekly: w, completed }
}

export function weekCompletion(weekly: WeeklyState): { mainDone: boolean; optionalDone: number; canEnd: boolean } {
  const mainDone = weekly.quests.some((q) => q.slot === 'MAIN' && q.status === 'claimed')
  const optionalDone = weekly.quests.filter((q) => q.slot !== 'MAIN' && q.status === 'claimed').length
  return { mainDone, optionalDone, canEnd: mainDone && optionalDone >= REQUIRED_OPTIONAL }
}

export function regionIds(): RegionId[] {
  return REGIONS.map((r) => r.id)
}
