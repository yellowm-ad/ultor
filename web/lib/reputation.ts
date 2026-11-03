// ============================================================================
// 평판(v3.2 §5 · Phase 2 1차, 2026-11-03) — 6거점 분수대가 허브. 분수대에서 주민 의뢰(납품·기부)를 들어주면 평판이 오른다.
//   · 저장: storyFlags[`repPts:<hubId>`] = 평판 점수, storyFlags[hub.repFlag] = 평판 Lv(1~5, 기존 플래그 뜻 그대로),
//           storyFlags[`repReq:<hubId>:<주>:<칸>`] = 그 주 그 의뢰를 마쳤는가, storyFlags[hub.emblemFlag] = 상징(Lv.5).
//   · 의뢰판: 주(globalWeek)마다 거점별로 3건이 결정적으로 뽑힌다(같은 주엔 같은 의뢰). 주가 바뀌면 새 의뢰.
//   · Lv.1~4 는 점수로 오르고, Lv.5(마을의 대변자 · 상징)는 4학년 2학기(EP48 「마을의 이름으로」, 171주)부터 열리는
//     최종 평판 의뢰를 마쳐야 한다 — 상징은 엔딩 루트(B/C)를 바꾸므로 이야기 시점 전에는 주지 않는다.
// ============================================================================

import type { GameState } from '@/lib/types'
import { REPUTATION_HUBS, REPUTATION_LEVELS, type ReputationHub } from '@/lib/story'
import { ownedFor } from '@/lib/inventory'

/** Lv.1~4 에 필요한 누적 점수(Lv.5 는 최종 의뢰) */
export const REP_THRESHOLDS = [0, 20, 60, 120] as const
/** 최종 평판 의뢰가 열리는 주(EP48 · 4학년 2학기) */
export const REP_FINAL_WEEK = 171

export type RepRequest =
  | { kind: 'deliver'; who: string; text: string; itemId: string; qty: number; pts: number; gold: number }
  | { kind: 'donate'; who: string; text: string; gold: number; pts: number }

/** 거점별 의뢰 후보(주민 + 지역 채집·낚시 성과). itemId 는 'tag:herb' 처럼 태그도 된다 */
const POOL: Record<string, RepRequest[]> = {
  SAFE_VILLAGE: [
    { kind: 'deliver', who: '빵집 주인', text: '허브빵에 넣을 박하가 모자라요.', itemId: 'herb-mint', qty: 5, pts: 6, gold: 40 },
    { kind: 'deliver', who: '농가 할머니', text: '겨울 땔감용 참나무를 부탁해요.', itemId: 'wood-oak', qty: 4, pts: 6, gold: 40 },
    { kind: 'deliver', who: '여관 요리사', text: '버섯 수프 재료가 다 떨어졌다네.', itemId: 'mush-button', qty: 4, pts: 6, gold: 45 },
    { kind: 'deliver', who: '연못지기', text: '연못에 풀 잉어를 구해다 주게.', itemId: 'fish-carp', qty: 2, pts: 8, gold: 60 },
    { kind: 'deliver', who: '꽃집 아이', text: '이슬꽃으로 축제 화관을 만들래요!', itemId: 'flower-dew', qty: 2, pts: 7, gold: 50 },
    { kind: 'donate', who: '마을 경비대', text: '울타리 수리비를 모으고 있습니다.', gold: 120, pts: 6 },
  ],
  ATLANTIS: [
    { kind: 'deliver', who: '그물 수선공', text: '다시마로 그물 매듭을 감아야 해.', itemId: 'sea-kelp', qty: 5, pts: 6, gold: 50 },
    { kind: 'deliver', who: '조개 공예가', text: '예쁜 조개껍데기를 모으는 중이에요.', itemId: 'sea-shell', qty: 5, pts: 6, gold: 50 },
    { kind: 'deliver', who: '생선 장수', text: '고등어가 오늘따라 안 잡히네.', itemId: 'fish-mackerel', qty: 3, pts: 8, gold: 70 },
    { kind: 'deliver', who: '브라더 모렌', text: '제단에 올릴 진주 한 알이 필요합니다.', itemId: 'sea-pearl', qty: 1, pts: 10, gold: 90 },
    { kind: 'deliver', who: '등대지기', text: '소금풀로 등잔 심지를 말려야 하오.', itemId: 'herb-saltgrass', qty: 3, pts: 6, gold: 45 },
    { kind: 'donate', who: '방파제 보수단', text: '폭풍에 무너진 방파제를 고칩니다.', gold: 150, pts: 7 },
  ],
  SKY_SANCTUARY: [
    { kind: 'deliver', who: '바람 신관', text: '풍령 수정이 의식에 필요합니다.', itemId: 'crystal-wind', qty: 2, pts: 9, gold: 80 },
    { kind: 'deliver', who: '하늘정원 정원사', text: '구름꽃 모종을 옮겨 심으려 해요.', itemId: 'flower-cloud', qty: 3, pts: 7, gold: 60 },
    { kind: 'deliver', who: '약초 수녀', text: '하늘뿌리로 고산병 약을 달여야 해요.', itemId: 'herb-skyroot', qty: 3, pts: 7, gold: 60 },
    { kind: 'deliver', who: '순례자', text: '아무 약초라도 좋으니 나눠 주시오.', itemId: 'tag:herb', qty: 5, pts: 6, gold: 40 },
    { kind: 'donate', who: '성역 보수회', text: '부서진 날개 석상을 다시 세웁니다.', gold: 180, pts: 8 },
  ],
  RUIN_VILLAGE: [
    { kind: 'deliver', who: '대장장이', text: '무너진 문 경첩을 새로 벼려야 해.', itemId: 'ore-iron', qty: 4, pts: 7, gold: 55 },
    { kind: 'deliver', who: '등불지기', text: '마나 수정으로 길등을 다시 밝힐 거요.', itemId: 'crystal-mana', qty: 2, pts: 9, gold: 80 },
    { kind: 'deliver', who: '묘지기', text: '무덤버섯으로 액막이 향을 만듭니다.', itemId: 'mush-grave', qty: 3, pts: 7, gold: 55 },
    { kind: 'deliver', who: '피난민 가족', text: '아이들 먹일 생선이 있으면…', itemId: 'tag:fish', qty: 3, pts: 8, gold: 50 },
    { kind: 'donate', who: '신전 복원회', text: '메마른 분수에 물길을 다시 냅니다.', gold: 160, pts: 7 },
  ],
  AURORA: [
    { kind: 'deliver', who: '사우나 주인', text: '서리박하를 증기에 띄우면 좋아요.', itemId: 'herb-frostmint', qty: 3, pts: 7, gold: 60 },
    { kind: 'deliver', who: '얼음 세공사', text: '은광석으로 썰매 날을 갈아야 하네.', itemId: 'ore-silver', qty: 2, pts: 8, gold: 70 },
    { kind: 'deliver', who: '나무꾼', text: '녹은 길에 깔 소나무가 필요해.', itemId: 'wood-pine', qty: 4, pts: 7, gold: 55 },
    { kind: 'deliver', who: '셀린', text: '눈토끼들 먹일 얼음대구를 구해 줄래?', itemId: 'fish-icecod', qty: 2, pts: 9, gold: 70 },
    { kind: 'donate', who: '지붕 수리단', text: '눈 무게에 꺼진 지붕을 고칩니다.', gold: 170, pts: 8 },
  ],
  MONSTER_VILLAGE: [
    { kind: 'deliver', who: '용암 대장장이', text: '흑요석으로 아이들 장난감을 깎을 거야.', itemId: 'ore-obsidian', qty: 4, pts: 8, gold: 70 },
    { kind: 'deliver', who: '화로지기', text: '화염석 하나면 겨울을 난다.', itemId: 'ore-firestone', qty: 1, pts: 10, gold: 90 },
    { kind: 'deliver', who: '약사 고블린', text: '불씨풀로 화상 연고를 만들어.', itemId: 'herb-ember', qty: 3, pts: 8, gold: 60 },
    { kind: 'deliver', who: '용암 낚시꾼', text: '용암장어… 사람한텐 못 잡는다고들 하지.', itemId: 'fish-lavaeel', qty: 1, pts: 12, gold: 110 },
    { kind: 'donate', who: '마물 마을 촌장', text: '사람들과 나눌 잔치 비용을 모읍니다.', gold: 200, pts: 9 },
  ],
}

/** 최종 평판 의뢰(Lv.4 → Lv.5 · 상징) — 거점마다 지역 특산 묶음 */
const FINAL: Record<string, { who: string; text: string; items: { itemId: string; qty: number }[]; gold: number; emblem: string }> = {
  SAFE_VILLAGE: { who: '빵집 주인', text: '첫 주에 빵 배달 틀린 것까지 기억하오. 마지막으로 축제 빵을 같이 구웁시다.', items: [{ itemId: 'herb-mint', qty: 10 }, { itemId: 'wood-oak', qty: 8 }, { itemId: 'fish-moonkoi', qty: 1 }], gold: 3000, emblem: '안전지대의 밀 이삭' },
  ATLANTIS: { who: '브라더 모렌', text: '바다의 기도를 다시 올리려 합니다. 진주와 바다의 선물을 모아 주십시오.', items: [{ itemId: 'sea-pearl', qty: 3 }, { itemId: 'fish-pearlray', qty: 1 }, { itemId: 'sea-kelp', qty: 10 }], gold: 3000, emblem: '아틀란티스의 조가비' },
  SKY_SANCTUARY: { who: '바람 신관', text: '성역의 종을 다시 울리려면 바람과 구름의 정수가 필요합니다.', items: [{ itemId: 'crystal-wind', qty: 4 }, { itemId: 'flower-cloud', qty: 6 }, { itemId: 'herb-skyroot', qty: 6 }], gold: 3000, emblem: '천공의 깃털' },
  RUIN_VILLAGE: { who: '신전 복원회', text: '메마른 분수에 마지막 물길을 냅니다. 철과 수정이 많이 필요해요.', items: [{ itemId: 'ore-iron', qty: 10 }, { itemId: 'crystal-mana', qty: 4 }, { itemId: 'mush-grave', qty: 5 }], gold: 3000, emblem: '폐허의 등불' },
  AURORA: { who: '셀린', text: '분수대 돌판에 네 이름도 새기자. 대신 마지막 겨울 준비를 같이 해 줘.', items: [{ itemId: 'fish-frostsalmon', qty: 1 }, { itemId: 'ore-silver', qty: 4 }, { itemId: 'wood-pine', qty: 10 }], gold: 3000, emblem: '오로라의 눈꽃' },
  MONSTER_VILLAGE: { who: '마물 마을 촌장', text: '사람과 마물이 한 상에 앉는 잔치를 엽니다. 용암 땅의 선물로 상을 차려 주시오.', items: [{ itemId: 'ore-firestone', qty: 3 }, { itemId: 'fish-lavaeel', qty: 2 }, { itemId: 'herb-ember', qty: 6 }], gold: 3000, emblem: '마물 마을의 불씨' },
}

export const hubById = (id: string): ReputationHub | undefined => REPUTATION_HUBS.find((h) => h.id === id)
export const hubOfMap = (mapId: string): ReputationHub | undefined => REPUTATION_HUBS.find((h) => h.mapId === mapId)
export const repFinal = (hubId: string) => FINAL[hubId]
export const repPool = (hubId: string) => POOL[hubId] ?? []

export function repPoints(state: Pick<GameState, 'storyFlags'>, hubId: string): number {
  const v = state.storyFlags[`repPts:${hubId}`]
  return typeof v === 'number' ? v : 0
}

/** 평판 Lv(1~5) — 상징이 있으면 5 */
export function repLevel(state: Pick<GameState, 'storyFlags'>, hub: ReputationHub): number {
  if (state.storyFlags[hub.emblemFlag]) return 5
  const pts = repPoints(state, hub.id)
  let lv = 1
  REP_THRESHOLDS.forEach((t, i) => {
    if (pts >= t) lv = i + 1
  })
  return lv
}
export const repLevelName = (lv: number) => REPUTATION_LEVELS[Math.max(0, Math.min(4, lv - 1))]

/** 다음 Lv 까지 [지금 구간에서 모은 점수, 구간 크기] — Lv.4 이상이면 null */
export function repProgress(state: Pick<GameState, 'storyFlags'>, hub: ReputationHub): [number, number] | null {
  const lv = repLevel(state, hub)
  if (lv >= 4) return null
  const pts = repPoints(state, hub.id)
  return [pts - REP_THRESHOLDS[lv - 1], REP_THRESHOLDS[lv] - REP_THRESHOLDS[lv - 1]]
}

/** 이번 주 의뢰판 — 같은 주·같은 거점이면 늘 같은 3건 */
export function weeklyRequests(hubId: string, week: number): RepRequest[] {
  const pool = repPool(hubId)
  if (!pool.length) return []
  let seed = (week * 2654435761 + hubId.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) >>> 0
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  const idx = pool.map((_, i) => i)
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  return idx.slice(0, 3).map((i) => pool[i])
}

export const reqDoneKey = (hubId: string, week: number, slot: number) => `repReq:${hubId}:${week}:${slot}`

/** 의뢰를 들어줄 수 있는가 — 이유(못 하면) 또는 null */
export function requestBlocker(state: Pick<GameState, 'storyFlags' | 'inventory' | 'player'>, req: RepRequest): string | null {
  if (req.kind === 'donate') return state.player.gold >= req.gold ? null : '골드가 부족합니다.'
  return ownedFor(state.inventory, req.itemId) >= req.qty ? null : '납품할 물건이 부족합니다.'
}

export function finalOpen(state: Pick<GameState, 'storyFlags' | 'calendar'>, hub: ReputationHub): boolean {
  return state.calendar.globalWeek >= REP_FINAL_WEEK && repLevel(state, hub) === 4
}
