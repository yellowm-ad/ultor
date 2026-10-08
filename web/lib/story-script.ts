// ============================================================================
// 《울토르 마법학교》 메인 스토리 대사 — 통합안 v3.0 (2026-10-08, Documents/메인 스토리 53막 v3.0.md)
//
// v3.0 확정으로 옛 대화집 v1.0(봉인 파편 수집 · 석상 거인왕 · 처음부터 악역인 모르스 등)은 전부 폐기했다.
// 지금 남은 건 EP00 프롤로그(입학식)와 1학년 1학기 2주차 역사 수업뿐이다.
// EP01~EP52 의 대사집·컷신은 다음 작업에서 이 파일(또는 별도 데이터셋)에 추가한다. 형식은 lib/story.ts 의 StoryBeat.
//
//   · hero: 'fire' | 'ice' | 'earth' — 삼원 주인공. 플레이어와 같은 속성이면 플레이어 이름/초상으로,
//     아니면 같은 속성 동기(리안 · 셀라 · 도란)가 말한다.
//   · 세계관 체크리스트(v3.0 §16): 미르엘은 이 시점에 '믿을 만한 교수'로만 보여야 한다.
// ============================================================================

import type { StoryBeat, StoryLine } from '@/lib/story'
import { globalWeekOf as W } from '@/lib/calendar'

// ── 화자 헬퍼 ──────────────────────────────────────────────────────────────────
const N = (text: string): StoryLine => ({ speaker: '', text })
const npc = (speaker: string, portraitId?: string) => (text: string): StoryLine => ({ speaker, portraitId, text })
const MIREL = npc('미르엘 교수', 'npc-mirel')
const OWEN = npc('사서 오웬', 'npc-librarian')
// v3.0 인물 — 루스벨 = 화염 동료(comp-rusbel), 국왕 일행 = 스톰헤이븐 천공 신전(npc-king · npc-royal-guard)
const RUSPELL = npc('루스벨', 'comp-rusbel')
const KING = npc('국왕 레오니스', 'npc-king')
const GUARD = npc('왕실 근위병', 'npc-royal-guard')
/* eslint-disable @typescript-eslint/no-unused-vars */
const SAINT = npc('성녀 리아나', 'npc-saint')
const MORS = npc('모르스', 'story-mors')
/* eslint-enable @typescript-eslint/no-unused-vars */
const FIRE = (text: string): StoryLine => ({ speaker: '화염 주인공', hero: 'fire', text })
const ICE = (text: string): StoryLine => ({ speaker: '빙결 주인공', hero: 'ice', text })
const EARTH = (text: string): StoryLine => ({ speaker: '대지 주인공', hero: 'earth', text })

export const SCRIPT_BEATS: StoryBeat[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // CH0 · EP00 — 입학식 「울토르에 오신 것을 환영합니다」 (1학년 1학기 1주차 시작)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'EP00_ENTRANCE',
    arcId: 'CH0',
    title: 'EP00 — 입학식',
    trigger: { type: 'WEEK_START', week: W(1, 'semester1', 1) },
    setFlags: ['CH0_STARTED'],
    lines: [
      N('울토르 마법학교 중앙 광장.'),
      MIREL('울토르에 온 것을 환영한다. 이 학교의 교장이자, 너희에게 삼원을 가르칠 미르엘이다.'),
      MIREL('여기서는 마법을 배우고, 전투를 배우고, 세상을 배운다.'),
      MIREL('그리고 언젠가는… 자신이 배운 것을 무엇을 위해 사용할 것인지 결정하게 될 거다.'),
      FIRE('진짜 여기서 4년이나 다니는 거야?'),
      EARTH('입학하자마자 졸업부터 걱정해?'),
      ICE('조용히 해. 수업 시작한다.'),
      MIREL('울토르에서 처음 배우게 될 것은 삼원이다.'),
      N('미르엘이 세 개의 마력 구체를 띄운다.'),
      MIREL('화염. 빙결. 대지. 모든 마법사는 여기서 시작한다.'),
      MIREL('학사 규칙은 수첩에 다 적혀 있다. 하나만 직접 일러 두지.'),
      MIREL('본관 지하의 금지구역에는 들어가지 마라. 학교가 세워지기 전부터 내려온 규칙이다.'),
      EARTH('…왜요?'),
      MIREL('오래된 이야기다. 마왕이 이 학교 아래에 잠들어 있다는.'),
      N('미르엘이 부드럽게 웃는다. 학생들 사이로 웃음과 수군거림이 번진다.'),
      N('그 순간, 교정 바닥 어딘가에 새겨진 오래된 문양이 아주 잠깐 미세하게 흔들렸다.'),
    ],
  },
  {
    id: 'EP00_HISTORY',
    arcId: 'CH0',
    title: '역사 수업',
    trigger: { type: 'WEEK_START', week: W(1, 'semester1', 2) },
    lines: [
      OWEN('인마대전이 끝난 것은 약 500년 전입니다.'),
      N('벽에 걸린 오래된 벽화.'),
      OWEN('기록에 따르면 마왕 모르스가 먼저 인간을 공격했고, 인간은 마족을 화산 너머로 몰아냈습니다.'),
      FIRE('그래서 마족은 지금도 화산지대에만 사는 거야?'),
      OWEN('공식 기록상으로는 그렇습니다.'),
      ICE("'공식 기록상'이라니?"),
      N('오웬이 잠시 멈춘다.'),
      OWEN('…기록은 쓰는 사람의 편일 수도 있다는 것. 그것만 기억해 두세요.'),
      N('수업이 끝나고, 오웬이 덧붙인다. 전쟁을 끝낸 왕가는 지금도 스톰헤이븐의 하늘 신전을 가장 아낀다고.'),
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CH3 — 스톰헤이븐에서 우연히 마주친 국왕 (천공 신전 첫 방문, 2학년 1학기 이후)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'CH3_KING_ENCOUNTER',
    arcId: 'CH3',
    title: '천공 신전의 손님',
    trigger: { type: 'VISIT', mapId: 'sky-temple' },
    requiredFlags: ['CH3_STORMHAVEN_STARTED'],
    setFlags: ['KING_MET'],
    lines: [
      N('천공 신전 앞뜰. 은빛 갑주의 근위병들이 길을 막아선다.'),
      GUARD('멈춰라. 지금은 폐하께서 기도를 올리시는 중이다.'),
      EARTH('…폐하? 설마 국왕이요?'),
      KING('괜찮다. 학생들이로구나. 울토르의 교복이군.'),
      KING('바람이 거센 날엔 여기 와서 옛 기록을 떠올리곤 하지. 이 나라가 무엇 위에 세워졌는지.'),
      FIRE('무엇 위에… 세워졌는데요?'),
      KING('전쟁과 승리 위에, 라고 다들 말한다. …나는 가끔 그 말이 너무 깨끗하게 들려서 걱정이다.'),
      N('국왕은 짧게 웃고, 근위병들과 함께 신전 안으로 걸어 들어간다.'),
      ICE('…방금 그거, 국왕이 할 말 맞아?'),
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CH4 · EP37 — 폭주하는 루스벨 (3학년 2학기 8주차, 버려진 신전 내부)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'EP37_RAGE',
    arcId: 'CH4',
    title: 'EP37 — 폭주하는 루스벨',
    trigger: { type: 'VISIT', mapId: 'ruin-sanctum' },
    requiredFlags: ['NO_RELEASED'],
    minWeek: W(3, 'semester2', 8),
    setFlags: ['RUSPELL_ENRAGED'],
    battle: { monsterIds: ['mon-ruspell-rage'] },
    lines: [
      N('버려진 신전 최심부. 깨진 봉인진 위로 붉은 기운이 소용돌이친다.'),
      RUSPELL('…다들 왜 그렇게 봐? 나 괜찮아. 조금 덥기만 해.'),
      N('어디선가 낮은 웃음소리가 울린다. 봉인진에서 풀려난 붉은 그림자가 루스벨에게 쏟아져 들어간다.'),
      FIRE('루스벨!'),
      N('루스벨의 불꽃이 보랏빛으로 물든다. 신전 전체가 땅울림과 함께 흔들린다.'),
      RUSPELL('시끄러워… 시끄러워, 시끄러워! 전부, 전부 태워 버릴 거야!'),
      N('— 마왕 루스벨이 앞을 가로막는다.'),
    ],
  },
  {
    id: 'EP37_FLED',
    arcId: 'CH4',
    title: '노는 사라지지 않았다',
    trigger: { type: 'DEFEAT', monsterId: 'mon-ruspell-rage' },
    setFlags: ['RUSPELL_FLED'],
    lines: [
      N('루스벨이 무릎을 꿇는다. 하지만 쓰러지지는 않는다.'),
      RUSPELL('…아니야. 이건 내가 아니야. 이건…'),
      N('보랏빛 불길이 폭발하듯 치솟는다. 연기가 걷혔을 때, 루스벨은 사라지고 없었다.'),
      ICE('…불탄 자국이 북쪽으로 이어져. 설원 쪽이야.'),
      EARTH('루스벨은 살아 있어. 그러니까 아직 끝난 게 아니야.'),
    ],
  },
]
