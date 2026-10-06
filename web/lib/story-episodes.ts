// ============================================================================
// 3주 스토리 주간 — 52화 작성 파일
//
//   스토리 주간 = 학기 3·6·9주차(그 주는 수업 없음) + 방학 3·6·9·12주차. 학기 12주차는 기말고사라 제외,
//   4학년 겨울(후일담)도 제외 → 4년간 52화. 한 화의 흐름:
//     ① brief(오프닝)  — 그 주가 시작될 때 재생
//     ② objectives(미션) — 학사 수첩 '필수' 칸. 다 채우고 보상을 받으면
//     ③ outro(결말)    — 바로 재생. choices 가 있으면 마지막 대사에서 선택지
//     ④ 주를 마감할 때 대화집(story-script)의 그 주 장면이 있으면 이어서 재생
//
// ── 작성 형식(한 화 = 한 블록, 항목 순서 고정) ───────────────────────────────────
//   ep(학년, 학기, 주차, {
//     status:     '임시' | '완성'                      — 다 쓴 화는 '완성'으로
//     title:      '화 제목'                            — 수첩·장면 제목
//     region:     'ERDIA' 등 지역 id(lib/regions.ts)   — 미션 지역 표시
//     summary:    '한 줄 요약'                          — 수첩 미션 설명(비우면 오프닝의 교수·나레이션 대사로 대신)
//     brief:      [대사, …]                            — ① 오프닝
//     objectives: [목표, …]                            — ② 미션(아래 목표 함수)
//     outro:      [대사, …]                            — ③ 결말
//     choices:    [{ label: '선택지', setFlags: ['플래그'] }, …]  — 결말 선택지(없으면 [])
//     setFlags:   ['플래그', …]                         — 결말 후 켜질 플래그(EP_<주>_DONE 은 자동)
//     rewards:    { exp, gold, course, items: [{ itemId, qty }] }  — 비우면 기본 보상(학년 비례 EXP·골드 + 과목 점수 30)
//   }),
//
//   대사:  N('나레이션') · MIREL('…') 같은 화자 함수 · FIRE/ICE/EARTH('…') = 삼원 주인공
//          (플레이어와 같은 속성이면 플레이어 본인, 아니면 같은 속성 동기 리안·셀라·도란이 말함)
//          목록에 없는 인물은 say('이름', '초상화 id')('대사')
//   목표:  visit('맵 id', '맵 이름')        — 그 맵에 도착
//          kill('몬스터 id' | 'family:계열', 수, '표시 문구')
//          win('지역 id' | 'any', 수, '표시 문구')   — 전투 승리
//          talk('NPC id' | 'any', '표시 문구', 수?)
//   미션 목표를 대화집의 방문/전투 장면과 겹치게 잡으면, 미션 중에 그 장면들이 자연스럽게 터진다.
// ============================================================================

import type { QuestObjective, TermType } from '@/lib/types'
import type { StoryChoice, StoryLine } from '@/lib/story'
import type { RegionId } from '@/lib/regions'
import { calendarInfo, globalWeekOf } from '@/lib/calendar'

export interface EpisodeRewards {
  exp?: number
  gold?: number
  course?: number
  items?: { itemId: string; qty: number }[]
}

export interface StoryEpisode {
  /** globalWeek */
  week: number
  /** 몇 화(1~52) */
  no: number
  status: '임시' | '완성'
  title: string
  region: RegionId
  summary: string
  brief: StoryLine[]
  objectives: QuestObjective[]
  outro: StoryLine[]
  choices: StoryChoice[]
  setFlags: string[]
  rewards: EpisodeRewards
}

// ── 화자 ────────────────────────────────────────────────────────────────────
const N = (text: string): StoryLine => ({ speaker: '', text })
/** 목록에 없는 화자 — say('이름', '초상화 id')('대사') */
const say = (speaker: string, portraitId?: string) => (text: string): StoryLine => ({ speaker, portraitId, text })
const MIREL = say('미르엘 교수', 'npc-mirel')
const OWEN = say('사서 오웬', 'npc-librarian')
const EDRIC = say('에드릭 교수', 'npc-job-trainer')
const KAEL = say('카엘 조교', 'prof-kael')
const GROT = say('용암대장장이 그롯', 'npc-demon-smith')
// 아래는 대화집(story-script)의 인물 — 이번 초안엔 안 썼지만 작성용으로 미리 둔다
/* eslint-disable @typescript-eslint/no-unused-vars */
const VAN = say('대장장이 반', 'npc-weapon')
const CELINE = say('약사 셀린', 'npc-potion')
const MARENA = say('어부 마레나', 'story-marena')
const LEON = say('항만 길드장 레온', 'story-leon')
const NEREA = say('연구자 네레아', 'story-nerea')
const HART = say('설원 수렵가 하르트', 'story-hart')
const SER = say('마족 세르', 'story-ser')
const MORS = say('모르스', 'story-mors')
/* eslint-enable @typescript-eslint/no-unused-vars */
const FIRE = (text: string): StoryLine => ({ speaker: '화염 주인공', hero: 'fire', text })
const ICE = (text: string): StoryLine => ({ speaker: '빙결 주인공', hero: 'ice', text })
const EARTH = (text: string): StoryLine => ({ speaker: '대지 주인공', hero: 'earth', text })

// ── 목표 ────────────────────────────────────────────────────────────────────
const visit = (mapId: string, name: string): QuestObjective => ({ type: 'VISIT', targetId: mapId, count: 1, label: `${name} 도착` })
const kill = (target: string, count: number, label: string): QuestObjective => ({ type: 'KILL', targetId: target, count, label })
const win = (region: string, count: number, label: string): QuestObjective => ({ type: 'WIN_BATTLE', targetId: region, count, label })
const talk = (npcId: string, label: string, count = 1): QuestObjective => ({ type: 'TALK', targetId: npcId, count, label })

type EpisodeBody = Omit<StoryEpisode, 'week' | 'no'>
const ep = (year: number, term: TermType, week: number, body: EpisodeBody) => ({ ...body, week: globalWeekOf(year, term, week) })

/** 52화 — 주차 순서대로 */
const EPISODES: Omit<StoryEpisode, 'no'>[] = [
  // ════════════════════════════════════════════════════════════════════════
  // 1학년 1학기
  // ════════════════════════════════════════════════════════════════════════
  // ── 1화 · 1학년 1학기 3주차 ──
  ep(1, 'semester1', 3, {
    status: '임시',
    title: '숲의 이상행동',
    region: 'ERDIA',
    summary: '',
    brief: [
      EDRIC('이번 주 수업은 쉰다. 대신 현장 조사다.'),
      EDRIC('깊은 숲의 짐승들이 사람을 피하지 않고 달려든다는 보고가 들어왔어. 원인을 확인하고 와라.'),
      FIRE('수업이 없다고? 좋아, 바로 가자!'),
      ICE('…조사라고 했잖아. 싸우러 가는 게 아니야.'),
    ],
    objectives: [
      visit('forest-2', '에르디아 깊은 숲'),
      win('ERDIA', 3, '에르디아에서 전투 승리'),
    ],
    outro: [
      N('쓰러진 짐승의 몸에서 희미한 보랏빛 마력이 피어오르다 흩어진다.'),
      EARTH('이건… 짐승의 마력이 아니야.'),
      EDRIC('잘했다. 표본은 내가 미르엘 교수께 넘기마.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 2화 · 1학년 1학기 6주차 ──
  ep(1, 'semester1', 6, {
    status: '임시',
    title: '가시어미의 둥지',
    region: 'ERDIA',
    summary: '',
    brief: [
      MIREL('지난번 표본에서 이상한 술식의 흔적이 나왔다.'),
      MIREL('흔적은 고목숲 한가운데를 가리킨다. 가시덩굴이 둥지를 틀었다는 곳이지.'),
      MIREL('무리하지 마라. 위험하면 돌아와.'),
    ],
    objectives: [
      visit('forest-3', '에르디아 고목숲'),
      kill('mon-thorn-matriarch', 1, '가시어미 처치'),
    ],
    outro: [
      N('거대한 가시덩굴이 무너지며 뿌리 아래에서 금이 간 돌판이 드러난다.'),
      ICE('돌판에… 문양이 새겨져 있어.'),
      FIRE('교수님한테 가져가자. 이건 그냥 몬스터 둥지가 아니야.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 3화 · 1학년 1학기 9주차 ──
  ep(1, 'semester1', 9, {
    status: '임시',
    title: '봉인의 잔재',
    region: 'ERDIA',
    summary: '',
    brief: [
      OWEN('돌판의 문양은 인마대전 시절 봉인진의 일부와 닮았습니다.'),
      OWEN('같은 문양이 이끼 동굴 벽에서도 발견됐다는 기록이 있지요. 확인해 주시겠습니까?'),
    ],
    objectives: [
      talk('npc-librarian', '사서 오웬에게 돌판 보여 주기'),
      visit('cave', '이끼 동굴'),
      kill('family:construct', 2, '동굴의 구조물형 처치'),
    ],
    outro: [
      N('동굴 깊은 벽에 돌판과 같은 문양이 희미하게 빛나고 있다.'),
      EARTH('봉인이… 아직 살아 있는 거야?'),
      OWEN('기록에는 "완전히 끝났다"고 적혀 있었는데 말이지요.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),

  // ════════════════════════════════════════════════════════════════════════
  // 1학년 여름방학
  // ════════════════════════════════════════════════════════════════════════
  // ── 4화 · 1학년 여름방학 3주차 ──
  ep(1, 'summer', 3, {
    status: '임시',
    title: '안개 늪의 고대목',
    region: 'ERDIA',
    summary: '',
    brief: [
      MIREL('방학이지만 미안하게 됐다. 안개 늪에서 거대한 나무가 걸어다닌다는구나.'),
      MIREL('봉인 문양이 나온 곳과 이어져 있을지도 모른다.'),
    ],
    objectives: [
      visit('swamp', '안개 늪지'),
      kill('mon-ancient-bark-golem', 1, '고대목 골렘 처치'),
    ],
    outro: [
      N('쓰러진 고대목의 심재에서 문짝 모양의 문양이 떠오른다.'),
      ICE('문… 이 봉인은 무언가를 가두는 문이야.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 5화 · 1학년 여름방학 6주차 ──
  ep(1, 'summer', 6, {
    status: '임시',
    title: '해안 현장실습',
    region: 'COAST',
    summary: '',
    brief: [
      EDRIC('남은 방학은 해안 현장실습이다. 바람 좀 쐬고 와라.'),
      FIRE('바다다!'),
      EDRIC('…실습이라고 했다.'),
    ],
    objectives: [
      visit('sea', '바다 해안'),
      win('COAST', 3, '해안에서 전투 승리'),
    ],
    outro: [
      N('파도 사이로 낯선 물빛이 일렁인다. 바다 쪽 몬스터들도 어딘가 들떠 있다.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 6화 · 1학년 여름방학 9주차 ──
  ep(1, 'summer', 9, {
    status: '임시',
    title: '산호 여울의 이상 파도',
    region: 'COAST',
    summary: '',
    brief: [
      EDRIC('어부들이 산호 여울의 파도가 거꾸로 친다고 하더군.'),
      EARTH('파도가 거꾸로? 그게 말이 돼?'),
    ],
    objectives: [
      visit('sea-2', '산호 여울'),
      kill('family:aquatic', 4, '수생형 몬스터 처치'),
    ],
    outro: [
      N('바닷속에서 숲의 돌판과 같은 빛이 잠깐 번쩍였다 사라진다.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 7화 · 1학년 여름방학 12주차 ──
  ep(1, 'summer', 12, {
    status: '임시',
    title: '등대의 불빛',
    region: 'COAST',
    summary: '',
    brief: [
      EDRIC('방학 마지막 과제다. 암초 해안의 꺼진 등대를 확인해라.'),
    ],
    objectives: [
      visit('sea-3', '암초 해안'),
      win('COAST', 3, '암초 해안 일대 정리'),
    ],
    outro: [
      N('꺼진 등대 아래, 바다 쪽을 향해 새겨진 오래된 인장이 보인다.'),
      ICE('숲, 늪, 그리고 바다까지… 전부 이어져 있어.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),

  // ════════════════════════════════════════════════════════════════════════
  // 1학년 2학기
  // ════════════════════════════════════════════════════════════════════════
  // ── 8화 · 1학년 2학기 3주차 ──
  ep(1, 'semester2', 3, {
    status: '임시',
    title: '해식 동굴의 노래',
    region: 'COAST',
    summary: '',
    brief: [
      KAEL('해식 동굴에서 노랫소리가 들린다는 신고가 들어왔다. 세이렌 유충일 가능성이 높아.'),
      KAEL('귀를 막을 필요는 없지만 정신은 똑바로 차려.'),
    ],
    objectives: [
      visit('sea-cave', '해식 동굴'),
      kill('mon-siren-larva', 2, '세이렌 유충 처치'),
    ],
    outro: [
      N('노래가 그치자 동굴 바닥에서 바다 쪽 인장과 같은 문양이 드러난다.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 9화 · 1학년 2학기 6주차 ──
  ep(1, 'semester2', 6, {
    status: '임시',
    title: '해안 수호수의 경고',
    region: 'COAST',
    summary: '',
    brief: [
      MIREL('산호 여울을 지키던 수호수가 사람을 막아서기 시작했다.'),
      MIREL('적이라기보다는 경고에 가까운 행동이야. 이유를 알아내라.'),
    ],
    objectives: [
      visit('sea-2', '산호 여울'),
      win('COAST', 4, '해안에서 전투 승리'),
    ],
    outro: [
      N('수호수가 물러난 자리, 물속에 깨진 인장 조각이 반짝인다.'),
      EARTH('누가 일부러 깨뜨린 것 같아.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 10화 · 1학년 2학기 9주차 ──
  ep(1, 'semester2', 9, {
    status: '임시',
    title: '수중 도시의 손님',
    region: 'COAST',
    summary: '',
    brief: [
      KAEL('아틀란티스에서 정식 초대장이 왔다. 인장 조각에 대해 할 말이 있다는군.'),
    ],
    objectives: [
      visit('atlantis', '아틀란티스'),
      visit('atlantis-temple', '아틀란티스 대성당'),
    ],
    outro: [
      N('대성당의 벽화에는 "바다 깊은 곳에 잠든 두 번째 문"이 그려져 있다.'),
      ICE('두 번째 문… 첫 번째는 숲이었어.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),

  // ════════════════════════════════════════════════════════════════════════
  // 1학년 겨울방학
  // ════════════════════════════════════════════════════════════════════════
  // ── 11화 · 1학년 겨울방학 3주차 ──
  ep(1, 'winter', 3, {
    status: '임시',
    title: '해파리 여왕',
    region: 'COAST',
    summary: '',
    brief: [
      EDRIC('첫 대형 원정이다. 암초 해안의 해파리 여왕이 심해 입구를 막고 있다.'),
      EDRIC('파티를 꼭 4명으로 꾸려 가라.'),
    ],
    objectives: [
      visit('sea-3', '암초 해안'),
      kill('mon-jelly-queen', 1, '해파리 여왕 처치'),
    ],
    outro: [
      N('여왕의 왕관 속에 박혀 있던 인장이 깨지며 이름 하나가 떠오른다 — 모르스.'),
      FIRE('모르스…? 교과서에 나온 그 악마왕?'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 12화 · 1학년 겨울방학 6주차 ──
  ep(1, 'winter', 6, {
    status: '임시',
    title: '심해로',
    region: 'COAST',
    summary: '',
    brief: [
      MIREL('모르스의 인장이 바다에 있었다는 건, 봉인의 한쪽 끝이 심해에 있다는 뜻이다.'),
      MIREL('심해로 내려가 봐라. 숨은 내가 마법으로 붙들어 두마.'),
    ],
    objectives: [
      visit('deepsea', '심해'),
      win('COAST', 3, '심해에서 전투 승리'),
    ],
    outro: [
      N('가라앉은 신전의 기둥마다 사슬 문양이 감겨 있다.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 13화 · 1학년 겨울방학 9주차 ──
  ep(1, 'winter', 9, {
    status: '임시',
    title: '심해 암초왕',
    region: 'COAST',
    summary: '',
    brief: [
      EDRIC('사슬 문양의 중심에 암초왕이 자리를 잡았다. 그 녀석을 넘어야 봉인을 볼 수 있다.'),
    ],
    objectives: [
      visit('deepsea', '심해'),
      kill('mon-reef-king', 1, '심해 암초왕 처치'),
    ],
    outro: [
      N('암초왕이 지키던 자리에 봉인 장치의 일부가 남아 있다. 아직도 무언가를 빨아들이며 돌고 있다.'),
      EARTH('이 봉인… 계속 뭔가를 먹고 있어.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 14화 · 1학년 겨울방학 12주차 ──
  ep(1, 'winter', 12, {
    status: '임시',
    title: '인장의 파편',
    region: 'ACADEMY',
    summary: '',
    brief: [
      MIREL('원정 수고 많았다. 가져온 파편은 내 연구실로 가져와라.'),
    ],
    objectives: [
      talk('npc-mirel', '미르엘 교수에게 파편 전달'),
    ],
    outro: [
      MIREL('…이건 학교 지하 봉인과 같은 재질이다.'),
      MIREL('이 이야기는 아직 너희끼리만 알고 있어라.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),

  // ════════════════════════════════════════════════════════════════════════
  // 2학년 1학기
  // ════════════════════════════════════════════════════════════════════════
  // ── 15화 · 2학년 1학기 3주차 ──
  ep(2, 'semester1', 3, {
    status: '임시',
    title: '폭풍 위의 도시',
    region: 'STORMHAVEN',
    summary: '',
    brief: [
      OWEN('스톰헤이븐에는 인마대전의 "다른 기록"이 남아 있다고 합니다.'),
      OWEN('직접 보고 오시지요. 하늘은 생각보다 가깝습니다.'),
    ],
    objectives: [
      visit('stormhaven', '스톰헤이븐'),
      win('STORMHAVEN', 3, '스톰헤이븐에서 전투 승리'),
    ],
    outro: [
      N('구름 위 고원, 무너진 깃대마다 낯선 문장의 깃발이 펄럭인다.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 16화 · 2학년 1학기 6주차 ──
  ep(2, 'semester1', 6, {
    status: '임시',
    title: '구름다리의 이상 마력',
    region: 'STORMHAVEN',
    summary: '',
    brief: [
      KAEL('폭풍 구름다리에서 밀물 정령이 하늘로 거슬러 오른다. 바다의 마력이 하늘까지 끌려 올라오는 거야.'),
    ],
    objectives: [
      visit('stormhaven-2', '폭풍 구름다리'),
      kill('mon-tide-elemental', 3, '밀물 정령 처치'),
    ],
    outro: [
      N('정령이 흩어지며 남긴 물방울이 하늘의 한 점 — 천공 신전 — 쪽으로 빨려 간다.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 17화 · 2학년 1학기 9주차 ──
  ep(2, 'semester1', 9, {
    status: '임시',
    title: '천공 신전의 기록',
    region: 'STORMHAVEN',
    summary: '',
    brief: [
      OWEN('천공 신전의 서고를 열 수 있게 허가를 받아 두었습니다. 다녀오셔서 이야기를 들려주세요.'),
    ],
    objectives: [
      visit('sky-temple', '천공 신전'),
      talk('npc-librarian', '사서 오웬에게 보고'),
    ],
    outro: [
      OWEN('"전쟁은 1년 만에 끝났다"… 신전 기록에는 그 뒤로 30년의 공백이 있군요.'),
      ICE('누군가 30년을 지웠다는 거야?'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),

  // ════════════════════════════════════════════════════════════════════════
  // 2학년 여름방학
  // ════════════════════════════════════════════════════════════════════════
  // ── 18화 · 2학년 여름방학 3주차 ──
  ep(2, 'summer', 3, {
    status: '임시',
    title: '버려진 폐허',
    region: 'RUINS',
    summary: '',
    brief: [
      EDRIC('지워진 30년의 흔적이 폐허에 있다는 게 오웬의 추측이다. 언데드가 많으니 빛과 불을 챙겨라.'),
    ],
    objectives: [
      visit('ruins-2', '무너진 성곽'),
      kill('family:undead', 3, '언데드 처치'),
    ],
    outro: [
      N('성곽 벽에는 인간과 마족이 나란히 선 벽화가 반쯤 지워져 있다.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 19화 · 2학년 여름방학 6주차 ──
  ep(2, 'summer', 6, {
    status: '임시',
    title: '망각의 광장',
    region: 'RUINS',
    summary: '',
    brief: [
      MIREL('광장의 석상 거인이 깨어났다. 봉인 균열이 커지고 있다는 증거다.'),
    ],
    objectives: [
      visit('ruins-3', '망각의 광장'),
      kill('mon-stone-titan', 1, '석상 거인 처치'),
    ],
    outro: [
      N('거인의 가슴에 박힌 봉인석이 금 간 채로 떨고 있다.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 20화 · 2학년 여름방학 9주차 ──
  ep(2, 'summer', 9, {
    status: '임시',
    title: '묘지의 왕',
    region: 'RUINS',
    summary: '',
    brief: [
      EDRIC('묘지에 석상 거인왕이 있다. 이번 원정의 고비다.'),
    ],
    objectives: [
      visit('graveyard', '버려진 묘지'),
      kill('mon-stone-titan-king', 1, '석상 거인왕 처치'),
    ],
    outro: [
      N('거인왕이 무너지자 묘지 전체의 무덤에서 같은 사슬 문양이 동시에 빛난다.'),
      FIRE('여기 묻힌 사람들… 봉인을 지키다 죽은 거야?'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 21화 · 2학년 여름방학 12주차 ──
  ep(2, 'summer', 12, {
    status: '임시',
    title: '봉인 균열',
    region: 'RUINS',
    summary: '',
    brief: [
      MIREL('버려진 신전에서 균열이 시작됐다. 내가 가기 전에 상태만 확인해다오.'),
    ],
    objectives: [
      visit('temple-ruin', '버려진 신전'),
      talk('npc-mirel', '미르엘 교수에게 보고'),
    ],
    outro: [
      MIREL('균열은 막을 수 있다. 하지만 왜 생겼는지 모르면 또 생긴다.'),
      MIREL('…다음 학기엔 설원으로 가 보자.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),

  // ════════════════════════════════════════════════════════════════════════
  // 2학년 2학기
  // ════════════════════════════════════════════════════════════════════════
  // ── 22화 · 2학년 2학기 3주차 ──
  ep(2, 'semester2', 3, {
    status: '임시',
    title: '설원 관문',
    region: 'SNOWFIELD',
    summary: '',
    brief: [
      EDRIC('설원은 추위가 먼저 사람을 잡는다. 몸을 데울 요리나 물약을 챙겨라.'),
    ],
    objectives: [
      visit('snowfield', '루미나 설원'),
      win('SNOWFIELD', 3, '설원에서 전투 승리'),
    ],
    outro: [
      N('눈보라 사이로 사람이 아닌 발자국이 마을 쪽으로 이어져 있다.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 23화 · 2학년 2학기 6주차 ──
  ep(2, 'semester2', 6, {
    status: '임시',
    title: '오로라 마을',
    region: 'SNOWFIELD',
    summary: '',
    brief: [
      KAEL('설원 깊은 곳에 오로라 마을이 있다. 그 발자국이 마을로 갔다는 게 마음에 걸린다.'),
    ],
    objectives: [
      visit('snowfield-2', '눈보라 언덕'),
      visit('aurora-village', '오로라 마을'),
    ],
    outro: [
      N('마을 사람들은 발자국의 주인을 "손님"이라 부를 뿐 더 말하지 않는다.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 24화 · 2학년 2학기 9주차 ──
  ep(2, 'semester2', 9, {
    status: '임시',
    title: '서리 망령',
    region: 'SNOWFIELD',
    summary: '',
    brief: [
      EDRIC('서리 침엽수림에 망령이 늘었다. 마을 사람들이 숲에 들어가질 못한다.'),
    ],
    objectives: [
      visit('snowfield-3', '서리 침엽수림'),
      kill('mon-frost-revenant', 3, '서리 망령 처치'),
    ],
    outro: [
      N('망령이 걷힌 숲속, 누군가 망령을 막으려 세워 둔 작은 결계석이 보인다. 마족의 문양이다.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),

  // ════════════════════════════════════════════════════════════════════════
  // 2학년 겨울방학
  // ════════════════════════════════════════════════════════════════════════
  // ── 25화 · 2학년 겨울방학 3주차 ──
  ep(2, 'winter', 3, {
    status: '임시',
    title: '얼음 동굴',
    region: 'SNOWFIELD',
    summary: '',
    brief: [
      MIREL('결계석의 마력을 따라가면 얼음 동굴이 나온다. 조심해라, 동굴은 메아리가 크다.'),
    ],
    objectives: [
      visit('ice-cave', '얼음 동굴'),
      win('SNOWFIELD', 4, '설원에서 전투 승리'),
    ],
    outro: [
      N('동굴 깊은 곳에 누군가 머물다 간 흔적 — 꺼진 모닥불과 인간의 책.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 26화 · 2학년 겨울방학 6주차 ──
  ep(2, 'winter', 6, {
    status: '임시',
    title: '얼어붙은 호수',
    region: 'SNOWFIELD',
    summary: '',
    brief: [
      KAEL('얼어붙은 호수에 흑마법사들이 모였다. 결계석을 노리는 것 같다.'),
    ],
    objectives: [
      visit('frozen-lake', '얼어붙은 호수'),
      kill('mon-dark-mage', 2, '흑마법사 처치'),
    ],
    outro: [
      N('흑마법사의 품에서 "봉인을 먹이로 삼는 법"이라는 메모가 나온다.'),
      EARTH('봉인을… 먹이로?'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 27화 · 2학년 겨울방학 9주차 ──
  ep(2, 'winter', 9, {
    status: '임시',
    title: '손님의 정체',
    region: 'SNOWFIELD',
    summary: '',
    brief: [
      MIREL('설원 성소에 다녀와라. 마을이 숨기는 "손님"이 거기 있다.'),
    ],
    objectives: [
      visit('aurora-sanctum', '설원 성소'),
      win('SNOWFIELD', 3, '성소 주변 정리'),
    ],
    outro: [
      N('성소의 제단에는 인간과 마족이 함께 새긴 맹세문이 남아 있다.'),
      ICE('적이었던 게 아니라… 함께 봉인을 만든 거야?'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 28화 · 2학년 겨울방학 12주차 ──
  ep(2, 'winter', 12, {
    status: '임시',
    title: '설원의 진실',
    region: 'ACADEMY',
    summary: '',
    brief: [
      OWEN('맹세문의 사본을 가져오셨다고요. 도서관에서 기다리겠습니다.'),
    ],
    objectives: [
      talk('npc-librarian', '사서 오웬에게 맹세문 전달'),
    ],
    outro: [
      OWEN('…교과서의 첫 장을 다시 써야 할지도 모르겠습니다.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),

  // ════════════════════════════════════════════════════════════════════════
  // 3학년 1학기
  // ════════════════════════════════════════════════════════════════════════
  // ── 29화 · 3학년 1학기 3주차 ──
  ep(3, 'semester1', 3, {
    status: '임시',
    title: '화산지대',
    region: 'VOLCANO',
    summary: '',
    brief: [
      EDRIC('이번 학기는 화산이다. 용암 웅덩이에 발 담그지 마라. 농담 아니다.'),
    ],
    objectives: [
      visit('volcano', '화산지대'),
      win('VOLCANO', 3, '화산지대에서 전투 승리'),
    ],
    outro: [
      N('흘러내리는 용암 줄기 하나가 봉인 문양과 똑같은 모양으로 굽이친다.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 30화 · 3학년 1학기 6주차 ──
  ep(3, 'semester1', 6, {
    status: '임시',
    title: '잿빛 협곡',
    region: 'VOLCANO',
    summary: '',
    brief: [
      KAEL('잿빛 협곡의 화염 파수꾼들이 누군가의 명령을 받는 것처럼 움직인다.'),
    ],
    objectives: [
      visit('volcano-2', '잿빛 협곡'),
      kill('mon-flame-warden', 2, '화염 파수꾼 처치'),
    ],
    outro: [
      N('파수꾼의 핵에 새겨진 명령문 — "문을 지켜라. 먹이를 들이지 마라."'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 31화 · 3학년 1학기 9주차 ──
  ep(3, 'semester1', 9, {
    status: '임시',
    title: '마물 마을의 대장간',
    region: 'VOLCANO',
    summary: '',
    brief: [
      MIREL('마물 마을의 대장장이가 봉인 장치를 고쳐 본 적이 있다고 한다. 정중하게 대해라.'),
    ],
    objectives: [
      visit('demon-village', '마물 마을'),
      talk('npc-demon-smith', '용암대장장이 그롯과 대화'),
    ],
    outro: [
      GROT('그 장치? 우리 할아버지가 인간이랑 같이 만든 거다.'),
      GROT('그런데 지금은 한쪽만 계속 닳고 있지. 누가 뒤에서 빼먹는 거야.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),

  // ════════════════════════════════════════════════════════════════════════
  // 3학년 여름방학
  // ════════════════════════════════════════════════════════════════════════
  // ── 32화 · 3학년 여름방학 3주차 ──
  ep(3, 'summer', 3, {
    status: '임시',
    title: '용암 평원',
    region: 'VOLCANO',
    summary: '',
    brief: [
      EDRIC('그롯이 말한 "빼먹는 자리"는 용암 평원 너머다. 가자.'),
    ],
    objectives: [
      visit('volcano-3', '용암 평원'),
      win('VOLCANO', 4, '용암 평원에서 전투 승리'),
    ],
    outro: [
      N('평원 한가운데, 용암이 모두 한 방향 — 모르스의 성 — 으로 흘러간다.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 33화 · 3학년 여름방학 6주차 ──
  ep(3, 'summer', 6, {
    status: '임시',
    title: '폐광산',
    region: 'VOLCANO',
    summary: '',
    brief: [
      KAEL('폐광산에 봉인석을 캐 가는 무리가 있다. 막아라.'),
    ],
    objectives: [
      visit('mine', '폐광산'),
      kill('family:construct', 3, '구조물형 처치'),
    ],
    outro: [
      N('광산 수레마다 봉인석 조각이 실려 있다. 행선지는 학교 쪽이다.'),
      FIRE('학교로…? 왜 학교로 가져가는 거야?'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 34화 · 3학년 여름방학 9주차 ──
  ep(3, 'summer', 9, {
    status: '임시',
    title: '용암 동굴',
    region: 'VOLCANO',
    summary: '',
    brief: [
      MIREL('용암 동굴이 봉인의 핵이다. 파수꾼들을 넘어 핵을 확인해라.'),
    ],
    objectives: [
      visit('lava-cave', '용암 동굴'),
      kill('mon-flame-warden', 3, '화염 파수꾼 처치'),
    ],
    outro: [
      N('봉인 핵에서 굵은 마력 줄기가 땅속으로 — 울토르 방향으로 — 뻗어 있다.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 35화 · 3학년 여름방학 12주차 ──
  ep(3, 'summer', 12, {
    status: '임시',
    title: '봉인의 매개체',
    region: 'ACADEMY',
    summary: '',
    brief: [
      MIREL('돌아오면 바로 내 연구실로 와라. 다른 교수들에게는 아직 말하지 말고.'),
    ],
    objectives: [
      talk('npc-mirel', '미르엘 교수에게 보고'),
    ],
    outro: [
      MIREL('봉인은 모르스를 가두는 문이 아니라, 모르스의 힘을 끌어다 쓰는 관이었다.'),
      MIREL('그리고 그 관의 끝은… 우리 학교다.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),

  // ════════════════════════════════════════════════════════════════════════
  // 3학년 2학기
  // ════════════════════════════════════════════════════════════════════════
  // ── 36화 · 3학년 2학기 3주차 ──
  ep(3, 'semester2', 3, {
    status: '임시',
    title: '기록 대조',
    region: 'ACADEMY',
    summary: '',
    brief: [
      OWEN('지금까지 모은 기록을 한자리에 놓아 봅시다. 도서관으로 오세요.'),
    ],
    objectives: [
      visit('academy-library', '도서관'),
      talk('npc-librarian', '사서 오웬과 기록 대조'),
    ],
    outro: [
      OWEN('지워진 30년 동안 학교가 세워졌군요. 봉인에서 끌어온 힘으로.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 37화 · 3학년 2학기 6주차 ──
  ep(3, 'semester2', 6, {
    status: '임시',
    title: '흑마법의 흔적',
    region: 'VOLCANO',
    summary: '',
    brief: [
      KAEL('봉인을 "먹이"로 삼는 법을 아는 흑마법사들이 화산에 모였다. 토벌한다.'),
    ],
    objectives: [
      kill('family:darkmage', 4, '흑마법사형 처치'),
    ],
    outro: [
      N('쓰러진 흑마법사의 로브 안쪽에 울토르 교직원의 휘장이 꿰매져 있다.'),
      ICE('…학교 안에 있어.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 38화 · 3학년 2학기 9주차 ──
  ep(3, 'semester2', 9, {
    status: '임시',
    title: '봉인 수호자의 유언',
    region: 'VOLCANO',
    summary: '',
    brief: [
      GROT('화산 성채에 할아버지가 남긴 말이 있다. 인간인 너희가 들어야 할 말이야.'),
    ],
    objectives: [
      visit('demon-temple', '화산 성채'),
      win('VOLCANO', 3, '성채 주변 정리'),
    ],
    outro: [
      N('"봉인은 두 종족이 함께 지킬 때만 닫힌다. 한쪽이 독차지하면 문은 굶주린다."'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),

  // ════════════════════════════════════════════════════════════════════════
  // 3학년 겨울방학
  // ════════════════════════════════════════════════════════════════════════
  // ── 39화 · 3학년 겨울방학 3주차 ──
  ep(3, 'winter', 3, {
    status: '임시',
    title: '동료와의 밤',
    region: 'ACADEMY',
    summary: '',
    brief: [
      N('기숙사 휴게실. 아무도 먼저 말을 꺼내지 않는다.'),
      EARTH('…우리가 알아낸 거, 다른 애들한테도 말해야 할까?'),
    ],
    objectives: [
      talk('any', '학교 사람들과 이야기 나누기', 3),
    ],
    outro: [
      N('누군가는 믿고, 누군가는 고개를 젓는다. 그래도 말하길 잘했다.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 40화 · 3학년 겨울방학 6주차 ──
  ep(3, 'winter', 6, {
    status: '임시',
    title: '교수 회의',
    region: 'ACADEMY',
    summary: '',
    brief: [
      MIREL('교수 회의에 너희를 증인으로 부르겠다. 본 것만 말해라.'),
    ],
    objectives: [
      visit('council-room', '교수 회의실'),
      talk('npc-mirel', '미르엘 교수와 회의 준비'),
    ],
    outro: [
      MIREL('반은 믿고 반은 의심하더군. 하지만 의심하는 쪽에 그 휘장의 주인이 있다.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 41화 · 3학년 겨울방학 9주차 ──
  ep(3, 'winter', 9, {
    status: '임시',
    title: '마지막 해를 앞두고',
    region: 'ACADEMY',
    summary: '',
    brief: [
      EDRIC('내년이 마지막 해다. 실력부터 다져 둬라. 어디든 좋다, 싸워서 이겨 와.'),
    ],
    objectives: [
      win('any', 5, '전투 승리'),
    ],
    outro: [
      N('손에 익은 술식이 예전보다 훨씬 가볍다.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 42화 · 3학년 겨울방학 12주차 ──
  ep(3, 'winter', 12, {
    status: '임시',
    title: '결의',
    region: 'ACADEMY',
    summary: '',
    brief: [
      EDRIC('4년 전에 입학식에서 들은 말, 기억하나? "배운 것을 무엇을 위해 쓸지 결정하게 될 거다."'),
    ],
    objectives: [
      talk('npc-job-trainer', '에드릭 교수와 대화'),
    ],
    outro: [
      FIRE('결정했어. 끝까지 가 보자.'),
      ICE('…응.'),
      EARTH('같이 가자.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),

  // ════════════════════════════════════════════════════════════════════════
  // 4학년 1학기
  // ════════════════════════════════════════════════════════════════════════
  // ── 43화 · 4학년 1학기 3주차 ──
  ep(4, 'semester1', 3, {
    status: '임시',
    title: '에르디아 재방문',
    region: 'ERDIA',
    summary: '',
    brief: [
      MIREL('졸업 프로젝트는 4년간의 기록을 모으는 일이다. 처음 시작한 숲부터 다시 가 봐라.'),
    ],
    objectives: [
      visit('forest-3', '에르디아 고목숲'),
      kill('family:plant', 5, '식물형 처치'),
    ],
    outro: [
      N('1학년 때 쓰러뜨린 가시어미의 자리에서 작은 새싹이 돋아 있다. 봉인 문양은 사라졌다.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 44화 · 4학년 1학기 6주차 ──
  ep(4, 'semester1', 6, {
    status: '임시',
    title: '바다의 기록',
    region: 'COAST',
    summary: '',
    brief: [
      KAEL('심해 봉인 장치의 상태를 다시 기록해 와라. 이번엔 너희가 선배다.'),
    ],
    objectives: [
      visit('deepsea', '심해'),
      kill('family:aquatic', 5, '수생형 처치'),
    ],
    outro: [
      N('심해 장치는 여전히 돌고 있지만, 빨아들이는 속도가 눈에 띄게 빨라졌다.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 45화 · 4학년 1학기 9주차 ──
  ep(4, 'semester1', 9, {
    status: '임시',
    title: '하늘과 폐허',
    region: 'RUINS',
    summary: '',
    brief: [
      OWEN('뇌운 첨탑과 지하 납골당 — 아직 기록이 비어 있는 두 곳입니다.'),
    ],
    objectives: [
      visit('thunder-spire', '뇌운 첨탑'),
      visit('catacomb', '지하 납골당'),
    ],
    outro: [
      OWEN('이제 지도가 완성됐습니다. 모든 봉인의 관이 한 점으로 모입니다.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),

  // ════════════════════════════════════════════════════════════════════════
  // 4학년 여름방학
  // ════════════════════════════════════════════════════════════════════════
  // ── 46화 · 4학년 여름방학 3주차 ──
  ep(4, 'summer', 3, {
    status: '임시',
    title: '봉인 흔적 연결 ① 설원',
    region: 'SNOWFIELD',
    summary: '',
    brief: [
      MIREL('마지막 원정이다. 각 지역 봉인에 학교 쪽으로 가는 관을 끊는 표식을 새긴다. 설원부터.'),
    ],
    objectives: [
      visit('frozen-lake', '얼어붙은 호수'),
      win('SNOWFIELD', 4, '설원에서 전투 승리'),
    ],
    outro: [
      N('얼음 아래 흐르던 마력 줄기 하나가 잠잠해진다.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 47화 · 4학년 여름방학 6주차 ──
  ep(4, 'summer', 6, {
    status: '임시',
    title: '봉인 흔적 연결 ② 화산',
    region: 'VOLCANO',
    summary: '',
    brief: [
      GROT('화산 쪽 관은 내가 같이 끊어 주마. 대신 흑마법사 녀석들은 너희가 맡아.'),
    ],
    objectives: [
      visit('lava-cave', '용암 동굴'),
      kill('family:darkmage', 3, '흑마법사형 처치'),
    ],
    outro: [
      N('두 번째 줄기가 끊긴다. 멀리 학교 쪽 하늘이 붉게 번쩍인다.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 48화 · 4학년 여름방학 9주차 ──
  ep(4, 'summer', 9, {
    status: '임시',
    title: '봉인 흔적 연결 ③ 폐허',
    region: 'RUINS',
    summary: '',
    brief: [
      MIREL('버려진 신전 깊은 곳이 마지막이다. 끊는 순간 학교 쪽에서 반응이 올 거다.'),
    ],
    objectives: [
      visit('ruin-sanctum', '버려진 신전 내부'),
      win('RUINS', 4, '폐허에서 전투 승리'),
    ],
    outro: [
      N('세 번째 줄기가 끊기자 땅 전체가 크게 한 번 흔들린다.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 49화 · 4학년 여름방학 12주차 ──
  ep(4, 'summer', 12, {
    status: '임시',
    title: '최종 준비',
    region: 'ACADEMY',
    summary: '',
    brief: [
      MIREL('학교 지하 봉인이 깨어나고 있다. 마지막 학기가 시작되기 전에 와라.'),
    ],
    objectives: [
      talk('npc-mirel', '미르엘 교수와 대화'),
    ],
    outro: [
      MIREL('이제 남은 건 하나다. 문 너머의 그 녀석과 이야기를 하든, 싸우든.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),

  // ════════════════════════════════════════════════════════════════════════
  // 4학년 2학기
  // ════════════════════════════════════════════════════════════════════════
  // ── 50화 · 4학년 2학기 3주차 ──
  ep(4, 'semester2', 3, {
    status: '임시',
    title: '학교 이상현상',
    region: 'ACADEMY',
    summary: '',
    brief: [
      N('복도 바닥의 마법진이 저절로 빛났다 꺼지기를 반복한다.'),
      KAEL('몬스터가 학교 근처까지 왔다. 학생들을 지킨다.'),
    ],
    objectives: [
      win('any', 5, '전투 승리'),
      talk('npc-mirel', '미르엘 교수에게 보고'),
    ],
    outro: [
      MIREL('봉인이 무너지기 시작했다. 최종 게이트가 열린다.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 51화 · 4학년 2학기 6주차 ──
  ep(4, 'semester2', 6, {
    status: '임시',
    title: '모르스의 성',
    region: 'MORS',
    summary: '',
    brief: [
      MIREL('게이트 너머가 모르스의 성이다. 전령부터 넘어야 한다.'),
    ],
    objectives: [
      visit('demon-castle', '모르스의 성'),
      kill('mon-azka-herald', 1, '모르스의 전령 처치'),
    ],
    outro: [
      N('전령이 쓰러지며 웃는다. "주인님은 너희를 기다리고 계셨다."'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
  // ── 52화 · 4학년 2학기 9주차 ──
  ep(4, 'semester2', 9, {
    status: '임시',
    title: '최후의 선택',
    region: 'MORS',
    summary: '',
    brief: [
      FIRE('여기까지 왔어.'),
      ICE('…끝내자.'),
      EARTH('어떤 끝이든, 우리가 고른 끝으로.'),
    ],
    objectives: [
      visit('demon-castle', '모르스의 성'),
      win('MORS', 3, '성 안에서 전투 승리'),
    ],
    outro: [
      N('성 가장 깊은 곳, 사슬에 감긴 문이 천천히 열린다.'),
    ],
    choices: [],
    setFlags: [],
    rewards: {},
  }),
]

/** 스토리 주간 에피소드 전부 — globalWeek 순, no = 1~52화 */
export const STORY_EPISODES: StoryEpisode[] = EPISODES.slice()
  .sort((a, b) => a.week - b.week)
  .map((e, i) => ({ ...e, no: i + 1 }))

const BY_WEEK = new Map(STORY_EPISODES.map((e) => [e.week, e]))
export const episodeForWeek = (globalWeek: number) => BY_WEEK.get(globalWeek)

/** 이 주가 스토리 주간인가 — 학기 중이면 그 주는 수업이 없다 */
export function isStoryEpisodeWeek(globalWeek: number): boolean {
  return BY_WEEK.has(globalWeek)
}

/** 에피소드 미션의 퀘스트 템플릿 id */
export const episodeQuestId = (week: number) => `STORY_EP_${week}`

/** 학기 중 스토리 주간인 학기 주차(수업 없음) */
export function isSemesterStoryWeek(globalWeek: number): boolean {
  const info = calendarInfo(globalWeek)
  return !info.isVacation && isStoryEpisodeWeek(globalWeek)
}
