// ============================================================================
// 길드 서브 퀘스트(2026-11-05) — 마을 길드관의 안내원·의뢰 표지판에서 골라 받는 주민 의뢰.
//
//   · 주간 마감과 무관하다. 받고 싶은 만큼(동시 GUILD_ACTIVE_MAX 개) 받아서 언제든 개별로 끝낸다.
//   · 목표를 다 채우면 그 자리에서 보상(따로 보고할 필요 없음).
//   · 여기 = 마을 사람과 얽히는 의뢰(대화 사슬 · 물건 전하기 · 토벌 후 보고). 예전 주간 보조 미션 풀
//     (lib/quests QUEST_TEMPLATES 의 전투·생활·자유)도 지역에 맞는 길드 게시판에 함께 걸린다.
//   · DELIVER 목표 = 그 NPC 에게 말을 걸 때 가방에 물건이 있으면 건네고 진행(lib/progression talkTo).
//   · cooldownWeeks 999 = 한 번만 / 그 외 = 끝낸 뒤 그만큼 주가 지나면 다시 게시.
// ============================================================================

import type { QuestCategory, QuestObjective, QuestReward } from '@/lib/types'

export type GuildKey = 'village' | 'atlantis' | 'sky' | 'ruin' | 'aurora' | 'demon'

export interface GuildQuestDef {
  id: string
  guild: GuildKey
  category: QuestCategory
  /** 의뢰인(게시판에 보이는 이름) */
  giver: string
  title: string
  description: string
  objectives: QuestObjective[]
  rewards: QuestReward[]
  minLevel: number
  requiredFlags?: string[]
  cooldownWeeks?: number
}

const talk = (npcId: string, label: string): QuestObjective => ({ type: 'TALK', targetId: npcId, count: 1, label })
const give = (npcId: string, itemId: string, count: number, label: string): QuestObjective => ({ type: 'DELIVER', targetId: npcId, itemId, count, label })
const kill = (target: string, count: number, label: string): QuestObjective => ({ type: 'KILL', targetId: target, count, label })
const visit = (mapId: string, label: string): QuestObjective => ({ type: 'VISIT', targetId: mapId, count: 1, label })
const gather = (target: string, count: number, label: string): QuestObjective => ({ type: 'GATHER', targetId: target, count, label })
const exp = (amount: number): QuestReward => ({ type: 'EXP', amount })
const gold = (amount: number): QuestReward => ({ type: 'GOLD', amount })
const item = (itemId: string, amount = 1): QuestReward => ({ type: 'ITEM', itemId, amount })
const rel = (npcId: string, amount: number): QuestReward => ({ type: 'RELATIONSHIP', npcId, amount })
const ONCE = 999

export const GUILD_QUESTS: GuildQuestDef[] = [
  // ── 울토르 마을 · 성역 대성당 길드 ────────────────────────────────────────────
  { id: 'GQ_V_BREAD', guild: 'village', category: 'NPC', giver: '제빵사 폴코', title: '새벽 빵 배달', minLevel: 1, cooldownWeeks: 3,
    description: '갓 구운 빵을 농부 하름과 촌장 헬가에게 전해 달란다. 식기 전에!',
    objectives: [talk('npc-duo-baker', '폴코에게 빵 받기'), talk('npc-farmer', '농부 하름에게 배달'), talk('npc-elder', '촌장 헬가에게 배달')],
    rewards: [exp(50), gold(70), rel('npc-duo-baker', 4), rel('npc-elder', 2)] },
  { id: 'GQ_V_FLOWER', guild: 'village', category: 'NPC', giver: '꽃집 로잔', title: '숲박하 꽃다발', minLevel: 2, cooldownWeeks: 3,
    description: '향이 좋은 숲박하를 섞어 꽃다발을 만들고 싶대요. 숲에서 몇 줌 따다 주세요.',
    objectives: [give('npc-duo-florist', 'herb-mint', 4, '로잔에게 숲박하 4개 전하기')],
    rewards: [exp(60), gold(90), rel('npc-duo-florist', 5), item('potion-mp-s', 1)] },
  { id: 'GQ_V_MOUSE', guild: 'village', category: 'COMBAT', giver: '농부 하름', title: '창고의 들쥐 소동', minLevel: 1, cooldownWeeks: 2,
    description: '숲에서 내려온 들쥐들이 곡식 창고를 노린다. 숲 어귀에서 정리하고 알려 다오.',
    objectives: [kill('mon-field-mouse', 5, '들쥐 처치'), talk('npc-farmer', '하름에게 보고')],
    rewards: [exp(70), gold(80), rel('npc-farmer', 4)] },
  { id: 'GQ_V_LOSTBOOK', guild: 'village', category: 'NPC', giver: '사서 오웬', title: '돌아오지 않은 책', minLevel: 3, cooldownWeeks: ONCE,
    description: '기록관에서 빌려 간 책이 반납되지 않았다. 기록관지기 엘다에게 대출 장부를 확인해 달란다.',
    objectives: [talk('npc-librarian', '오웬에게 사정 듣기'), talk('npc-archivist', '엘다에게 장부 확인'), talk('npc-tool', '만물상 토비에게 책 찾기'), talk('npc-librarian', '오웬에게 책 돌려주기')],
    rewards: [exp(120), gold(120), rel('npc-librarian', 6), rel('npc-archivist', 4)] },
  { id: 'GQ_V_SMITH', guild: 'village', category: 'NPC', giver: '대장장이 반', title: '풀무에 넣을 참나무', minLevel: 4, cooldownWeeks: 3,
    description: '풀무 불을 살릴 단단한 참나무 가지가 필요하다.',
    objectives: [give('npc-weapon', 'wood-oak', 4, '반에게 참나무 가지 4개 전하기')],
    rewards: [exp(70), gold(110), rel('npc-weapon', 5)] },
  { id: 'GQ_V_WOLF', guild: 'village', category: 'COMBAT', giver: '경비 신관 세드릭', title: '이끼 동굴의 늑대 울음', minLevel: 11, cooldownWeeks: 3,
    description: '이끼 동굴 쪽에서 밤마다 늑대 울음이 들린다. 동굴에 들어가 무리를 흩어 놓아라.',
    objectives: [visit('cave', '이끼 동굴 도착'), kill('mon-grey-wolf', 4, '회색 늑대 처치'), talk('npc-priest', '세드릭에게 보고')],
    rewards: [exp(160), gold(160), rel('npc-priest', 4), item('potion-hp-m', 2)] },
  { id: 'GQ_V_STEW', guild: 'village', category: 'COOK', giver: '요리 장인 마르코', title: '버섯 스튜 시식단', minLevel: 6, cooldownWeeks: 3,
    description: '새 스튜 레시피에 쓸 갈색 버섯을 모아 오면 시식단에 넣어 주겠단다.',
    objectives: [give('npc-kitchen', 'mush-button', 3, '마르코에게 갈색 버섯 3개'), talk('npc-alchemy-pot', '이졸데에게 간 보기 부탁')],
    rewards: [exp(90), gold(100), rel('npc-kitchen', 5), item('food-mushroom-stew', 2)] },
  { id: 'GQ_V_GOLEM', guild: 'village', category: 'COMBAT', giver: '마도구 장인 핀', title: '움직이는 나무의 핵', minLevel: 13, cooldownWeeks: 4,
    description: '나무 골렘의 심장부를 연구하고 싶다. 안개 늪지에서 골렘을 쓰러뜨려 다오.',
    objectives: [kill('mon-bark-golem', 3, '나무 골렘 처치'), talk('npc-workbench', '핀에게 보고')],
    rewards: [exp(200), gold(180), rel('npc-workbench', 5), item('mat-lifewood-chip', 1)] },

  // 농사(lib/farming) — 햇살 농가 밭에서 기른 것을 전한다
  { id: 'GQ_V_HARVEST', guild: 'village', category: 'NPC', giver: '농부 하름', title: '첫 수확', minLevel: 1, cooldownWeeks: ONCE,
    description: '밭 한 칸 내줬으니 뭐든 길러서 보여 주게. 감자면 더 좋고. 흙이 정직하다는 걸 직접 봐야 알지.',
    objectives: [give('npc-farmer', 'crop-potato', 3, '하름에게 직접 기른 감자 3개')],
    rewards: [exp(60), gold(60), rel('npc-farmer', 6), item('seed-carrot', 3), item('seed-wheat', 3)] },
  { id: 'GQ_V_BAKE', guild: 'village', category: 'NPC', giver: '제빵사 폴코', title: '햇밀 빵', minLevel: 2, cooldownWeeks: 2,
    description: '올해 첫 햇밀로 빵을 굽고 싶은데, 방앗간 밀이 다 떨어졌다네.',
    objectives: [give('npc-duo-baker', 'crop-wheat', 5, '폴코에게 밀 이삭 5개')],
    rewards: [exp(70), gold(90), rel('npc-duo-baker', 4), item('food-trail-lunch', 1)] },
  { id: 'GQ_V_PUMPKIN', guild: 'village', category: 'NPC', giver: '꽃집 로잔', title: '수확제 장식', minLevel: 4, cooldownWeeks: 3,
    description: '광장 수확제에 호박 등불을 걸고 싶어요. 크고 동그란 걸로요!',
    objectives: [give('npc-duo-florist', 'crop-pumpkin', 2, '로잔에게 호박 2개'), talk('npc-elder', '촌장 헬가에게 장식 허락받기')],
    rewards: [exp(120), gold(140), rel('npc-duo-florist', 5), rel('npc-elder', 3)] },
  { id: 'GQ_V_BERRY', guild: 'village', category: 'NPC', giver: '요리 장인 마르코', title: '베리 타르트 시식', minLevel: 3, cooldownWeeks: 2,
    description: '타르트에 올릴 달콤 베리가 모자라. 덤불째 길러 오면 첫 조각은 자네 거야.',
    objectives: [give('npc-kitchen', 'crop-berry', 6, '마르코에게 달콤 베리 6개')],
    rewards: [exp(80), gold(80), rel('npc-kitchen', 4), item('food-berry-tart', 2)] },

  // ── 아틀란티스 마을 회관 ──────────────────────────────────────────────────────
  { id: 'GQ_A_SHELL', guild: 'atlantis', category: 'NPC', giver: '진주상인 카로', title: '진주 고르는 눈', minLevel: 8, cooldownWeeks: 3,
    description: '해변 조개껍데기를 모아 오면 진주 고르는 법을 알려 주겠대요.',
    objectives: [give('npc-atlantis-merchant', 'sea-shell', 5, '카로에게 조개껍데기 5개')],
    rewards: [exp(100), gold(130), rel('npc-atlantis-merchant', 5), item('sea-pearl', 1)] },
  { id: 'GQ_A_CHILD', guild: 'atlantis', category: 'NPC', giver: '해류사제 넬리아', title: '피오는 어디에?', minLevel: 8, cooldownWeeks: ONCE,
    description: '인어 아이 피오가 또 사라졌다. 얼음과자 장수 소르와 잠수부 보글에게 물어보라.',
    objectives: [talk('npc-atlantis-elder', '넬리아에게 사정 듣기'), talk('npc-duo-ice', '소르에게 묻기'), talk('npc-duo-diver', '보글에게 묻기'), talk('npc-atlantis-child', '피오 찾기'), talk('npc-atlantis-elder', '넬리아에게 알리기')],
    rewards: [exp(160), gold(140), rel('npc-atlantis-elder', 6), rel('npc-atlantis-child', 6)] },
  { id: 'GQ_A_CRAB', guild: 'atlantis', category: 'COMBAT', giver: '잠수부 보글', title: '잠수 구역 청소', minLevel: 9, cooldownWeeks: 2,
    description: '게 껍질병정들이 잠수 구역을 점거했다. 몰아내 주면 다시 들어갈 수 있다.',
    objectives: [kill('mon-crab-soldier', 5, '게 껍질병정 처치'), talk('npc-duo-diver', '보글에게 보고')],
    rewards: [exp(140), gold(140), rel('npc-duo-diver', 4)] },
  { id: 'GQ_A_KELP', guild: 'atlantis', category: 'NPC', giver: '얼음과자 장수 소르', title: '다시마 얼음과자', minLevel: 10, cooldownWeeks: 3,
    description: '새 맛을 시험해 본다나. 다시마를 가져다주면 첫 개를 준대요.',
    objectives: [give('npc-duo-ice', 'sea-kelp', 4, '소르에게 다시마 4개')],
    rewards: [exp(110), gold(120), rel('npc-duo-ice', 5), item('candy-mana-s', 2)] },
  { id: 'GQ_A_SIREN', guild: 'atlantis', category: 'COMBAT', giver: '해류사제 넬리아', title: '노랫소리를 잠재워라', minLevel: 12, cooldownWeeks: 3,
    description: '세이렌 유충의 노랫소리에 어부들이 길을 잃는다.',
    objectives: [kill('mon-siren-larva', 4, '세이렌 유충 처치'), talk('npc-atlantis-elder', '넬리아에게 보고')],
    rewards: [exp(170), gold(160), rel('npc-atlantis-elder', 4), item('mat-siren-scale', 1)] },
  { id: 'GQ_A_DEEP', guild: 'atlantis', category: 'EXPLORE', giver: '잠수부 보글', title: '심해의 빛', minLevel: 17, cooldownWeeks: ONCE,
    description: '심해 바닥에서 뭔가 빛난다. 직접 내려가 보고 와서 얘기해 줘.',
    objectives: [visit('deepsea', '심해 도착'), kill('mon-tide-elemental', 3, '밀물 정령 처치'), talk('npc-duo-diver', '보글에게 이야기')],
    rewards: [exp(260), gold(220), rel('npc-duo-diver', 6), item('mat-tide-essence', 2)] },

  // ── 천공 신전 · 바람의 교단 회관 ─────────────────────────────────────────────
  { id: 'GQ_S_BALLOON', guild: 'sky', category: 'NPC', giver: '풍선 장수 파랑', title: '구름꽃 풍선', minLevel: 15, cooldownWeeks: 3,
    description: '구름꽃을 넣으면 풍선이 더 오래 뜬대요. 몇 송이만 구해 주세요.',
    objectives: [give('npc-duo-balloon', 'flower-cloud', 3, '파랑에게 구름꽃 3개')],
    rewards: [exp(150), gold(160), rel('npc-duo-balloon', 5)] },
  { id: 'GQ_S_HARP', guild: 'sky', category: 'NPC', giver: '하프 수리공 리라', title: '바람 결정 현', minLevel: 16, cooldownWeeks: 3,
    description: '종탑의 하프 현이 끊어졌다. 바람 결정으로 새 현을 꼬아야 한다.',
    objectives: [give('npc-duo-harp', 'crystal-wind', 2, '리라에게 바람 결정 2개'), talk('npc-sky-keeper', '종지기 하나에게 시험 연주 부탁')],
    rewards: [exp(170), gold(170), rel('npc-duo-harp', 5), rel('npc-sky-keeper', 3)] },
  { id: 'GQ_S_BELL', guild: 'sky', category: 'NPC', giver: '종지기 하나', title: '울리지 않는 종', minLevel: 15, cooldownWeeks: ONCE,
    description: '새벽 종이 울리지 않는다. 바람사제와 종지기, 수리공 모두의 말을 들어 봐야 한다.',
    objectives: [talk('npc-sky-keeper', '하나에게 사정 듣기'), talk('npc-sky-priest', '바람사제 이엘에게 묻기'), talk('npc-duo-harp', '리라에게 도움 청하기'), talk('npc-sky-keeper', '하나에게 알리기')],
    rewards: [exp(220), gold(180), rel('npc-sky-keeper', 6), rel('npc-sky-priest', 4)] },
  { id: 'GQ_S_RIFT', guild: 'sky', category: 'COMBAT', giver: '바람사제 이엘', title: '구름 협곡 정찰', minLevel: 21, cooldownWeeks: 3,
    description: '구름 협곡에 잿빛 사냥개가 무리 지어 나타났다. 정찰하고 몰아내라.',
    objectives: [visit('cloud-rift', '구름 협곡 도착'), kill('mon-ash-hound', 4, '잿빛 사냥개 처치'), talk('npc-sky-priest', '이엘에게 보고')],
    rewards: [exp(260), gold(230), rel('npc-sky-priest', 4), item('potion-hp-m', 2)] },
  { id: 'GQ_S_ARENA', guild: 'sky', category: 'NPC', giver: '투기장장 그로먼', title: '콜로세움 초대장', minLevel: 18, cooldownWeeks: ONCE,
    description: '천공 콜로세움에 새 도전자를 모은다. 그로먼을 찾아가 이름을 올려라.',
    objectives: [visit('sky-colosseum', '천공 콜로세움 도착'), talk('npc-arena', '그로먼에게 등록')],
    rewards: [exp(200), gold(200), rel('npc-arena', 5)] },
  { id: 'GQ_S_ROOT', guild: 'sky', category: 'GATHER', giver: '바람사제 이엘', title: '하늘뿌리 의례', minLevel: 16, cooldownWeeks: 2,
    description: '바람 의례에 쓸 하늘뿌리를 캐 와라.',
    objectives: [gather('herb-skyroot', 4, '하늘뿌리 채집')],
    rewards: [exp(160), gold(150), rel('npc-sky-priest', 3)] },

  // ── 버려진 신전 · 수도자의 관리 건물 ─────────────────────────────────────────
  { id: 'GQ_R_CANDLE', guild: 'ruin', category: 'NPC', giver: '양초 장수 미미', title: '꺼지지 않는 초', minLevel: 21, cooldownWeeks: 3,
    description: '묘지버섯 기름으로 초를 만들면 밤새 꺼지지 않는대요.',
    objectives: [give('npc-duo-candle', 'mush-grave', 3, '미미에게 묘지버섯 3개')],
    rewards: [exp(220), gold(200), rel('npc-duo-candle', 5)] },
  { id: 'GQ_R_SEXTON', guild: 'ruin', category: 'COMBAT', giver: '묘지기 돌브', title: '잠 못 드는 망자', minLevel: 30, cooldownWeeks: 3,
    description: '묘지의 원귀들이 다시 일어났다. 잠재운 뒤 돌브에게 알려라.',
    objectives: [kill('mon-wraith', 5, '원귀 처치'), talk('npc-duo-sexton', '돌브에게 보고')],
    rewards: [exp(340), gold(300), rel('npc-duo-sexton', 5), item('mat-wraith-echo', 1)] },
  { id: 'GQ_R_SCHOLAR', guild: 'ruin', category: 'NPC', giver: '유물학자 세라', title: '석상 파편의 문양', minLevel: 23, cooldownWeeks: ONCE,
    description: '석상 파편에 새겨진 문양을 맞춰 보려 한다. 파편을 모아 오고, 수도자 그림의 해석도 들어 와라.',
    objectives: [give('npc-abandoned-scholar', 'mat-statue-fragment', 2, '세라에게 석상 파편 2개'), talk('npc-abandoned-monk', '은둔수도자 그림에게 해석 듣기'), talk('npc-abandoned-scholar', '세라에게 전하기')],
    rewards: [exp(320), gold(260), rel('npc-abandoned-scholar', 6), rel('npc-abandoned-monk', 4)] },
  { id: 'GQ_R_ARCHER', guild: 'ruin', category: 'COMBAT', giver: '은둔수도자 그림', title: '성곽의 해골 궁수', minLevel: 24, cooldownWeeks: 2,
    description: '무너진 성곽에서 화살이 날아온다. 순례자들이 지나갈 수 있게 해 다오.',
    objectives: [kill('mon-bone-archer', 4, '해골 궁수 처치'), talk('npc-abandoned-monk', '그림에게 보고')],
    rewards: [exp(280), gold(240), rel('npc-abandoned-monk', 4)] },
  { id: 'GQ_R_LETTER', guild: 'ruin', category: 'NPC', giver: '묘지기 돌브', title: '전하지 못한 편지', minLevel: 22, cooldownWeeks: ONCE,
    description: '묘지에서 주운 오래된 편지. 받는 이를 아는 사람이 있을까?',
    objectives: [talk('npc-duo-sexton', '돌브에게 편지 받기'), talk('npc-duo-candle', '미미에게 묻기'), talk('npc-abandoned-scholar', '세라에게 글씨 감정'), talk('npc-abandoned-monk', '그림에게 전하기')],
    rewards: [exp(300), gold(220), rel('npc-abandoned-monk', 6), item('mat-old-arrowhead', 2)] },
  { id: 'GQ_R_CATACOMB', guild: 'ruin', category: 'EXPLORE', giver: '유물학자 세라', title: '납골당 아래로', minLevel: 33, cooldownWeeks: ONCE,
    description: '지하 납골당에 미발굴 구역이 있다는 소문. 어둠의 수련생이 먼저 들어갔다.',
    objectives: [visit('catacomb', '지하 납골당 도착'), kill('mon-dark-acolyte', 4, '어둠의 수련생 처치'), talk('npc-abandoned-scholar', '세라에게 보고')],
    rewards: [exp(420), gold(360), rel('npc-abandoned-scholar', 5), item('mat-dark-ink', 1)] },

  // ── 오로라 마을 · 설인족 마을 회관 ───────────────────────────────────────────
  { id: 'GQ_W_SAUNA', guild: 'aurora', category: 'NPC', giver: '사우나 지기 올가', title: '사우나 장작', minLevel: 31, cooldownWeeks: 3,
    description: '설원 소나무 장작이 다 떨어졌어. 몸 녹이고 싶으면 장작부터!',
    objectives: [give('npc-duo-sauna', 'wood-pine', 5, '올가에게 설원 소나무 5개')],
    rewards: [exp(360), gold(320), rel('npc-duo-sauna', 5), item('potion-hp-l', 1)] },
  { id: 'GQ_W_CARVER', guild: 'aurora', category: 'NPC', giver: '얼음 조각가 니플', title: '서리 결정 조각', minLevel: 33, cooldownWeeks: 3,
    description: '축제 조각상에 박을 서리 결정이 필요하다.',
    objectives: [give('npc-duo-carver', 'mat-frost-crystal', 2, '니플에게 서리 결정 2개'), talk('npc-aurora-chief', '족장 보르에게 조각 보여 주기')],
    rewards: [exp(380), gold(330), rel('npc-duo-carver', 5), rel('npc-aurora-chief', 3)] },
  { id: 'GQ_W_TRADER', guild: 'aurora', category: 'NPC', giver: '설원상인 미카', title: '눈보라 속 짐수레', minLevel: 32, cooldownWeeks: ONCE,
    description: '눈보라 언덕에서 짐수레가 멈췄다. 길을 뚫고, 족장과 사우나 지기에게 소식을 전해라.',
    objectives: [visit('snowfield-2', '눈보라 언덕 도착'), kill('mon-dark-acolyte', 3, '어둠의 수련생 처치'), talk('npc-aurora-trader', '미카에게 알리기'), talk('npc-aurora-chief', '보르에게 알리기'), talk('npc-duo-sauna', '올가에게 알리기')],
    rewards: [exp(460), gold(380), rel('npc-aurora-trader', 6), rel('npc-aurora-chief', 3)] },
  { id: 'GQ_W_REVENANT', guild: 'aurora', category: 'COMBAT', giver: '설인족장 보르', title: '얼음 동굴의 망령', minLevel: 41, cooldownWeeks: 3,
    description: '서리 망령이 사냥꾼을 덮쳤다. 동굴 입구를 지켜라.',
    objectives: [kill('mon-frost-revenant', 4, '서리 망령 처치'), talk('npc-aurora-chief', '보르에게 보고')],
    rewards: [exp(480), gold(420), rel('npc-aurora-chief', 4), item('potion-elixir', 1)] },
  { id: 'GQ_W_MINT', guild: 'aurora', category: 'GATHER', giver: '설원상인 미카', title: '서리박하 차', minLevel: 31, cooldownWeeks: 2,
    description: '서리박하로 우린 차가 원정대에 잘 팔린다.',
    objectives: [gather('herb-frostmint', 5, '서리박하 채집'), talk('npc-aurora-trader', '미카에게 넘기기')],
    rewards: [exp(340), gold(360), rel('npc-aurora-trader', 3)] },
  { id: 'GQ_W_LAKE', guild: 'aurora', category: 'EXPLORE', giver: '얼음 조각가 니플', title: '얼어붙은 호수의 그림자', minLevel: 44, cooldownWeeks: ONCE,
    description: '호수 얼음 아래 사람 그림자가 비친다고. 확인해 줘.',
    objectives: [visit('frozen-lake', '얼어붙은 호수 도착'), kill('mon-dark-mage', 2, '흑마법사 처치'), talk('npc-duo-carver', '니플에게 이야기')],
    rewards: [exp(560), gold(460), rel('npc-duo-carver', 6), item('mat-frost-crystal', 2)] },

  // ── 마물 마을 · 마물 회의관 ──────────────────────────────────────────────────
  { id: 'GQ_D_PIYAK', guild: 'demon', category: 'NPC', giver: '꼬마 마물 삐약', title: '삐약의 심부름', minLevel: 41, cooldownWeeks: 3,
    description: '삐약이 장로님께 드릴 불씨풀을 구하러 가겠대요. 혼자 보내긴 불안하니 대신…',
    objectives: [give('npc-demon-child', 'herb-ember', 3, '삐약에게 불씨풀 3개'), talk('npc-demon-elder', '장로 카즈에게 함께 가기')],
    rewards: [exp(460), gold(420), rel('npc-demon-child', 6), rel('npc-demon-elder', 3)] },
  { id: 'GQ_D_SMITH', guild: 'demon', category: 'NPC', giver: '용암대장장이 그롯', title: '흑요석 담금질', minLevel: 42, cooldownWeeks: 3,
    description: '흑요석을 가져오면 인간 녀석 칼도 한번 봐 주지.',
    objectives: [give('npc-demon-smith', 'ore-obsidian', 4, '그롯에게 흑요석 4개')],
    rewards: [exp(480), gold(460), rel('npc-demon-smith', 5)] },
  { id: 'GQ_D_PEDDLER', guild: 'demon', category: 'NPC', giver: '행상 로비', title: '국경 너머 장사', minLevel: 41, cooldownWeeks: ONCE,
    description: '인간 마을에 마물 물건을 팔아 보려는 로비. 토비 형님과 뿔리에게 다리를 놓아 줘.',
    objectives: [talk('npc-duo-peddler', '로비에게 계획 듣기'), talk('npc-duo-imp', '뿔리에게 견본 받기'), talk('npc-tool', '울토르 마을 토비에게 견본 보여 주기'), talk('npc-duo-peddler', '로비에게 답 전하기')],
    rewards: [exp(520), gold(500), rel('npc-duo-peddler', 6), rel('npc-tool', 3)] },
  { id: 'GQ_D_WARDEN', guild: 'demon', category: 'COMBAT', giver: '온건파 장로 카즈', title: '폭주한 파수꾼', minLevel: 45, cooldownWeeks: 3,
    description: '화염 파수꾼들이 마을 길목까지 내려온다. 우리 손으로는 해칠 수 없다.',
    objectives: [kill('mon-flame-warden', 4, '화염 파수꾼 처치'), talk('npc-demon-elder', '카즈에게 보고')],
    rewards: [exp(560), gold(500), rel('npc-demon-elder', 5), item('mat-flame-core', 1)] },
  { id: 'GQ_D_IMP', guild: 'demon', category: 'NPC', giver: '수습 점원 뿔리', title: '첫 손님 맞이', minLevel: 41, cooldownWeeks: 3,
    description: '인간 손님에게 물건 파는 연습! 짐승 고기를 사 가는 척해 주세요.',
    objectives: [give('npc-duo-imp', 'hunt-meat', 3, '뿔리에게 짐승 고기 3개'), talk('npc-duo-peddler', '로비에게 칭찬 전하기')],
    rewards: [exp(440), gold(420), rel('npc-duo-imp', 6)] },
  { id: 'GQ_D_MINE', guild: 'demon', category: 'EXPLORE', giver: '용암대장장이 그롯', title: '폐광산의 저주받은 갑주', minLevel: 50, cooldownWeeks: ONCE,
    description: '옛 광맥에서 저주받은 갑주가 돌아다닌다. 화염석을 캐 오는 김에 정리해라.',
    objectives: [visit('mine', '폐광산 도착'), kill('mon-cursed-armor', 4, '저주받은 갑주 처치'), give('npc-demon-smith', 'ore-firestone', 2, '그롯에게 화염석 2개')],
    rewards: [exp(680), gold(600), rel('npc-demon-smith', 6), item('mat-cursed-metal', 2)] },
]

/** 지역(lib/regions) → 그 지역 퀘스트를 거는 길드 */
export const GUILD_OF_REGION: Record<string, GuildKey> = {
  ACADEMY: 'village',
  ERDIA: 'village',
  COAST: 'atlantis',
  STORMHAVEN: 'sky',
  RUINS: 'ruin',
  SNOWFIELD: 'aurora',
  VOLCANO: 'demon',
  MORS: 'demon',
}

/** 길드 게시판 기본 레벨(그 마을에 도착할 즈음) */
export const GUILD_BASE_LEVEL: Record<GuildKey, number> = { village: 1, atlantis: 8, sky: 15, ruin: 21, aurora: 31, demon: 41 }

export const GUILD_LABEL: Record<GuildKey, string> = {
  village: '울토르 마을 길드',
  atlantis: '아틀란티스 마을 회관',
  sky: '바람의 교단 회관',
  ruin: '수도자의 관리 건물',
  aurora: '설인족 마을 회관',
  demon: '마물 회의관',
}

/** 동시에 받아 둘 수 있는 길드 의뢰 수 */
export const GUILD_ACTIVE_MAX = 6
