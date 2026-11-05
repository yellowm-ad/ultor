// ============================================================================
// 주간 퀘스트 시스템 (§학사 PRD 4~7, 45~49, 66~68, 72)
//
//   [통합 PRD v1.0 §2, §27] 매주 = 필수 수업 1회(lib/curriculum.ts) + 외부활동 후보 5~6개 중 2개 선택 수행.
//   수업(학기 중) + 외부활동 2개 보상을 받으면 그 주를 마감한다. 방학은 수업 없이 외부활동 2개.
//   CLASS 카테고리 템플릿은 더 이상 후보로 나오지 않는다(수업 자체가 필수 항목). 스토리 지정 MAIN 은 있으면 추가 필수.
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
  QuestObjective,
  QuestReward,
  QuestSlot,
  TermType,
  WeeklyState,
} from '@/lib/types'
import { calendarInfo } from '@/lib/calendar'
import { classForWeek } from '@/lib/curriculum'
import { episodeQuestId, STORY_EPISODES } from '@/lib/story-episodes'
import { flagsAllOn } from '@/lib/story'
import { GUILD_BASE_LEVEL, GUILD_OF_REGION, GUILD_QUESTS, type GuildKey } from '@/lib/guild-quest-data'
import { REGIONS, type RegionId } from '@/lib/regions'
import { isActivityUnlocked, itemMatches, type ActivityId } from '@/lib/life'
import { itemById } from '@/lib/mock-data'

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
  /** 길드 게시판 — 이 길드에만 건다(생략 시 regionId 로 정하고, 둘 다 없으면 모든 길드) */
  guild?: GuildKey
  /** 길드 게시판에 걸리는 최소 레벨(생략 시 길드 기본 레벨 · minYear 보정) */
  minLevel?: number
  /** 의뢰인 이름(게시판 표시) */
  giver?: string
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
  { id: 'MAIN_ROUTINE_SEMESTER', category: 'MAIN', title: '주간 학사 보고', description: '이번 주 수업 일정을 에드릭 교수에게 보고한다.', objectives: [o('TALK', 'npc-job-trainer', 1, '에드릭 교수와 대화')], rewards: [exp(40), gold(60), course(10)], terms: ['semester1', 'semester2'] },
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

// 메인 스토리 EP01~EP52 미션(lib/story-episodes.ts, v3.0) — 에피소드마다 필수(MAIN) 템플릿 하나. 스토리 주에도 수업이 있어 과목 점수는 기본 0
for (const ep of STORY_EPISODES) {
  const year = calendarInfo(ep.week).year
  const r = ep.rewards
  QUEST_TEMPLATES.push({
    id: episodeQuestId(ep.week),
    category: 'MAIN',
    title: `${ep.id} — ${ep.title}`,
    // 요약이 없으면 오프닝의 교수·나레이션 대사(학생들의 말장난은 장면에서만)
    description: ep.summary || ep.brief.filter((l) => !l.hero).map((l) => l.text).join(' '),
    objectives: ep.objectives,
    rewards: [exp(r.exp ?? 120 + year * 40), gold(r.gold ?? 120 + year * 40), ...(r.course ? [course(r.course)] : []), ...(r.items ?? []).map((it) => item(it.itemId, it.qty))],
    regionId: ep.region,
    cooldownWeeks: 999,
  })
}

// 길드 서브 퀘스트(lib/guild-quest-data) — 마을 사람과 얽히는 의뢰
for (const g of GUILD_QUESTS) QUEST_TEMPLATES.push({ ...g })

const TEMPLATE_BY_ID = new Map(QUEST_TEMPLATES.map((t) => [t.id, t]))
export function questTemplateById(id: string): QuestTemplate | undefined {
  return TEMPLATE_BY_ID.get(id)
}

/** 학년이 오를수록 보상 배율(§69 난이도는 내부 값) */
export function yearRewardMult(globalWeek: number): number {
  return 1 + (calendarInfo(globalWeek).year - 1) * 0.8
}

type GenState = Pick<GameState, 'playerSeed' | 'calendar' | 'storyFlags' | 'settings' | 'weekly'>

/** 쉬어가는 주 — 학기마다 1회(5주차). 축제·동아리·기숙사 행사 같은 저강도 주간 */
export function isRestWeek(globalWeek: number): boolean {
  const info = calendarInfo(globalWeek)
  return !info.isVacation && info.week === 5
}

/** 주간 보조 미션 수 — 고르지 않고 랜덤으로 이만큼 바로 주어진다(2026-10-14) */
export const SIDE_CANDIDATES = 2

/**
 * 이번 주 목록 — 2026-11-05 개편: 주간 보조 미션은 없다(서브 퀘스트는 길드 게시판에서 개별로).
 * 지난 주에서 아직 끝나지 않은 메인 스토리 미션과 받아 둔 길드 의뢰만 그대로 이어 온다.
 */
export function generateWeeklyQuests(state: GenState): WeeklyState {
  const gw = state.calendar.globalWeek
  const carried = state.weekly.quests.filter(
    (q) => (q.slot === 'MAIN' && q.templateId.startsWith('STORY_EP_') && q.status !== 'claimed') || (!!q.guild && (q.status === 'active' || q.status === 'complete')),
  )
  return { week: gw, quests: carried, lastSeen: { ...state.weekly.lastSeen }, format: 4, classDone: false }
}

// ─────────────────────────────────────────────────────────────────────────────
// 길드 게시판(lib/guild-quest-data) — 마을 길드에서 골라 받는 서브 퀘스트
// ─────────────────────────────────────────────────────────────────────────────
/** 이 템플릿을 거는 길드(null = 모든 길드) */
export function guildOfTemplate(t: QuestTemplate): GuildKey | null {
  if (t.guild) return t.guild
  if (t.regionId) return GUILD_OF_REGION[t.regionId] ?? 'village'
  return null
}

/** 길드 게시판에 걸 수 있는 템플릿인가(메인·수업은 제외) */
const BOARD_CATEGORIES = new Set<QuestCategory>(['COMBAT', 'GATHER', 'HUNT', 'FISH', 'ALCHEMY', 'COOK', 'CRAFT', 'NPC', 'EXPLORE', 'HOUSING'])

export function templateMinLevel(t: QuestTemplate, guild: GuildKey): number {
  if (t.minLevel) return t.minLevel
  const byYear = t.minYear ? [1, 1, 20, 35, 50][t.minYear] ?? 1 : 1
  return Math.max(GUILD_BASE_LEVEL[guild], byYear)
}

export type BoardEntry = { t: QuestTemplate; minLevel: number; locked: string | null }

type BoardState = Pick<GameState, 'storyFlags' | 'calendar' | 'weekly' | 'player' | 'settings'> & Parameters<typeof isActivityUnlocked>[0]

/** 이 길드 게시판 목록 — 받을 수 있는 것 + 레벨이 조금 모자란 것(잠김 표시). 진행 중·쿨다운 중인 것은 뺀다 */
export function guildBoard(state: BoardState, guild: GuildKey): BoardEntry[] {
  const gw = state.calendar.globalWeek
  const active = new Set(state.weekly.quests.filter((q) => q.guild && (q.status === 'active' || q.status === 'complete')).map((q) => q.templateId))
  const out: BoardEntry[] = []
  for (const t of QUEST_TEMPLATES) {
    if (!BOARD_CATEGORIES.has(t.category)) continue
    const g = guildOfTemplate(t)
    if (g && g !== guild) continue
    if (active.has(t.id)) continue
    const last = state.weekly.lastSeen[`guild:${t.id}`]
    if (last != null && gw - last < (t.cooldownWeeks ?? 2)) continue
    if (!flagsAllOn(state, t.requiredFlags)) continue
    const minLevel = templateMinLevel(t, guild)
    if (state.player.level + 6 < minLevel) continue // 너무 먼 의뢰는 아직 걸지 않는다
    const locked = state.player.level < minLevel ? `Lv.${minLevel} 필요` : t.activity && !isActivityUnlocked(state, t.activity) ? '생활 활동 해금 필요' : null
    out.push({ t, minLevel, locked })
  }
  // 마을 사람 의뢰(giver) 먼저, 그다음 레벨 순
  return out.sort((a, b) => Number(!!b.t.giver) - Number(!!a.t.giver) || Number(!!a.locked) - Number(!!b.locked) || a.minLevel - b.minLevel)
}

/** 받아 둔 길드 의뢰(진행 중) */
export const activeGuildQuests = (weekly: WeeklyState) => weekly.quests.filter((q) => !!q.guild && q.status === 'active')

/**
 * 예전 형식(후보 5개 중 2개 고르기, format 2)의 이번 주 목록을 새 형식으로 — 진행 상황은 그대로 두고,
 * 고른 것이 2개보다 적으면 후보에서 채우고 남은 후보는 버린다
 */
export function migrateWeekly(weekly: WeeklyState): WeeklyState {
  if (weekly.format !== 2) return weekly
  const keep = weekly.quests.filter((q) => q.slot === 'MAIN' || q.status !== 'offered')
  const need = Math.max(0, SIDE_CANDIDATES - keep.filter((q) => q.slot !== 'MAIN').length)
  const fill = weekly.quests.filter((q) => q.slot !== 'MAIN' && q.status === 'offered').slice(0, need).map((q) => ({ ...q, status: 'active' as const }))
  return { ...weekly, quests: [...keep, ...fill], format: 3 }
}

/** 이번 주 수락한(진행/완료/수령) 외부활동 수 */
export function acceptedSideCount(weekly: WeeklyState): number {
  return weekly.quests.filter((q) => q.slot !== 'MAIN' && q.status !== 'offered').length
}

/** 외부활동 수락 — 최대 REQUIRED_OPTIONAL 개 */
export function acceptSideQuest(weekly: WeeklyState, instanceId: string): { weekly: WeeklyState; error?: string } {
  const q = weekly.quests.find((x) => x.instanceId === instanceId)
  if (!q || q.status !== 'offered') return { weekly }
  if (acceptedSideCount(weekly) >= REQUIRED_OPTIONAL) return { weekly, error: `외부활동은 한 주에 ${REQUIRED_OPTIONAL}개까지 수락할 수 있습니다.` }
  return { weekly: { ...weekly, quests: weekly.quests.map((x) => (x.instanceId === instanceId ? { ...x, status: 'active' as const } : x)) } }
}

/** 수락 취소(완료 전만) */
export function dropSideQuest(weekly: WeeklyState, instanceId: string): WeeklyState {
  return { ...weekly, quests: weekly.quests.map((x) => (x.instanceId === instanceId && x.status === 'active' ? { ...x, status: 'offered' as const, progress: x.progress.map(() => 0) } : x)) }
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
  | { type: 'DELIVER'; npcId: string; itemId: string; qty: number }

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
    case 'DELIVER':
      return obj.targetId === ev.npcId && obj.itemId === ev.itemId ? ev.qty : 0
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
    // 길드 의뢰는 이야기 순서대로(받기 → 전하기 → 보고) — 차례가 된 목표만 오른다
    const firstOpen = q.guild ? t.objectives.findIndex((ob, i) => (q.progress[i] ?? 0) < ob.count) : -1
    const progress = q.progress.map((p, i) => {
      const obj = t.objectives[i]
      if (p >= obj.count) return p
      if (q.guild && i !== firstOpen) return p
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

/** 주 마감에 필요한 외부활동 수 — 2026-11-05 개편으로 없음(서브 퀘스트는 길드에서 개별로) */
export const requiredOptionalFor = (_week: number) => 0

/** 주 마감 조건 — 이번 주 수업만 들으면 된다. 메인 스토리·길드 의뢰는 주와 상관없이 이어진다 */
export function weekCompletion(weekly: WeeklyState): { classRequired: boolean; classDone: boolean; mainDone: boolean; optionalDone: number; requiredOptional: number; storyWeek: boolean; canEnd: boolean } {
  const classRequired = classForWeek(weekly.week) != null
  const classDone = !classRequired || !!weekly.classDone
  const mainDone = !weekly.quests.some((q) => q.slot === 'MAIN' && q.status !== 'claimed')
  return { classRequired, classDone, mainDone, optionalDone: 0, requiredOptional: 0, storyWeek: false, canEnd: classDone }
}

export function regionIds(): RegionId[] {
  return REGIONS.map((r) => r.id)
}
