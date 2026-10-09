// ============================================================================
// 메인 스토리 53막 — 통합안 v3.0 (2026-10-08 확정, Documents/메인 스토리 53막 v3.0.md)
//
//   EP00 프롤로그(입학식)는 1학년 1학기 1주차 시작 장면 — lib/story-script.ts.
//   EP01~EP52 는 아래 데이터. 각 막은 정해진 globalWeek 가 시작될 때 오프닝, 그 주의 스토리 미션 보상을
//   받으면 결말이 재생된다(lib/story.ts episodeBeats). 스토리 주간에도 수업은 그대로 있다(v3.0 §10).
//
//   · EP01~EP04 = 사용자 대본(울토르_메인스토리_대사_컷신_01-05.md) — 오프닝/결말은 lib/story-script EP_SCRIPT,
//     막 중간 장면은 story-script SCRIPT_BEATS(NPC 대화·장소 진입), 컷신 이미지는 lib/cutscenes.
//   · EP05~EP19 = 대본 md 자동 변환(lib/story-script-gen). ⚠ EP20~EP52 는 아직 요점(points)을 읽는 임시 나레이션.
//
// ── 작성 형식(한 막 = E(…) 한 줄 묶음) ──────────────────────────────────────────
//   E(번호, globalWeek, 장, 지역, '제목', [요점, …], [미션 목표, …], [켜질 플래그, …], { 선택 옵션 })
//     옵션: route(기본 'ALL') · routes(루트별 요점) · requiredFlags · choices · rewards · status
//   목표:  visit('맵 id', '맵 이름') · kill('몬스터 id' | 'family:계열', 수, '문구')
//          win('지역 id' | 'any', 수, '문구') · talk('NPC id' | 'any', '문구', 수?) · act('PLACE_FURNITURE' 등, 'any', 수, '문구')
// ============================================================================

import type { QuestObjective, QuestObjectiveType } from '@/lib/types'
import type { StoryChoice, StoryLine } from '@/lib/story'
import type { RegionId } from '@/lib/regions'
import { calendarInfo } from '@/lib/calendar'
import { EP_SCRIPT } from '@/lib/story-script'

export interface EpisodeRewards {
  exp?: number
  gold?: number
  /** 이번 학기 과목 점수 — 스토리 주간에도 수업이 있으므로 기본 0 */
  course?: number
  items?: { itemId: string; qty: number }[]
}

/** v3.0 장 구분 */
export type StoryChapter = 'CH0' | 'CH1' | 'CH2' | 'CH3' | 'CH4' | 'CH5' | 'CH6' | 'CH7'
/** 엔딩 루트 — 공통(ALL) 또는 루트 전용. 루트 판정은 Phase 2(평판·상징) 이후 연결 */
export type StoryRoute = 'ALL' | 'A' | 'B' | 'C' | 'B_OR_C'

export interface StoryEpisode {
  /** globalWeek(1~192) */
  week: number
  /** 막 번호(1~52, 프롤로그 EP00 은 story-script) */
  no: number
  /** 'EP01' 형식 */
  id: string
  chapter: StoryChapter
  status: '임시' | '완성'
  title: string
  region: RegionId
  route: StoryRoute
  /** 수첩 미션 설명 */
  summary: string
  /** v3.0 문서의 막 요점 */
  points: string[]
  /** 루트별로 달라지는 요점(EP46~52) */
  routes?: Partial<Record<'A' | 'B' | 'C' | 'B_OR_C', string[]>>
  brief: StoryLine[]
  objectives: QuestObjective[]
  outro: StoryLine[]
  choices: StoryChoice[]
  requiredFlags: string[]
  setFlags: string[]
  rewards: EpisodeRewards
}

const N = (text: string): StoryLine => ({ speaker: '', text })

// ── 목표 ────────────────────────────────────────────────────────────────────
const visit = (mapId: string, name: string): QuestObjective => ({ type: 'VISIT', targetId: mapId, count: 1, label: `${name} 도착` })
const kill = (target: string, count: number, label: string): QuestObjective => ({ type: 'KILL', targetId: target, count, label })
const win = (region: string, count: number, label: string): QuestObjective => ({ type: 'WIN_BATTLE', targetId: region, count, label })
const talk = (npcId: string, label: string, count = 1): QuestObjective => ({ type: 'TALK', targetId: npcId, count, label })
const act = (type: QuestObjectiveType, targetId: string, count: number, label: string): QuestObjective => ({ type, targetId, count, label })

interface EpisodeOpts {
  route?: StoryRoute
  routes?: StoryEpisode['routes']
  requiredFlags?: string[]
  choices?: StoryChoice[]
  rewards?: EpisodeRewards
  status?: StoryEpisode['status']
}

/** 요점 앞쪽 절반 = 오프닝 나레이션, 나머지 = 결말 나레이션(임시) */
function E(
  no: number, week: number, chapter: StoryChapter, region: RegionId, title: string,
  points: string[], objectives: QuestObjective[], setFlags: string[] = [], o: EpisodeOpts = {},
): StoryEpisode {
  const routeLines = Object.entries(o.routes ?? {}).map(([r, ps]) => `[${r === 'B_OR_C' ? 'B/C' : r} 루트] ${ps.join(' · ')}`)
  const all = [...points, ...routeLines]
  const cut = Math.max(1, Math.ceil(all.length / 2))
  // 대본이 있는 막은 대본의 오프닝/결말 대사
  const script = EP_SCRIPT[no]
  return {
    week, no, id: `EP${String(no).padStart(2, '0')}`, chapter, status: o.status ?? (script ? '완성' : '임시'), title, region,
    route: o.route ?? 'ALL',
    summary: points.slice(0, 3).join(' · '),
    points, routes: o.routes,
    brief: script?.brief ?? all.slice(0, cut).map(N),
    objectives,
    outro: script?.outro ?? (all.slice(cut).length ? all.slice(cut) : ['(임시 결말 — 대사집 작업 예정)']).map(N),
    choices: script?.choices ?? o.choices ?? [], requiredFlags: o.requiredFlags ?? [], setFlags, rewards: o.rewards ?? {},
  }
}

/** EP01~EP52 — v3.0 §7·§8 */
const EPISODES: StoryEpisode[] = [
  // ════════ CH1 — 에르디아 숲 ════════
  E(1, 3, 'CH1', 'ACADEMY', '처음 맞는 학교생활',
    ['학생들과 첫 교류', '수업·동아리·기숙사·학사 수첩 사용', '간단한 외부 사이트 퀘스트 경험', '전투와 생활 콘텐츠를 처음 연결', "'4년을 여기서 보낸다'는 현실적인 감각"],
    [talk('npc-potion', '셀린의 생활수업 듣기'), talk('npc-weapon', '반의 제작실 둘러보기')], ['CH1_STARTED']),
  E(2, 6, 'CH1', 'ERDIA', '숲에서 들려온 이상한 울음',
    ['에르디아 숲 현장 수업', '채집과 몬스터 토벌의 교육적 연결', '평소와 다른 몬스터 행동 발견', '교사는 단순한 이상기후·서식 변화로 판단', '주인공 일행은 작은 마력 잔향 발견'],
    [act('GATHER', 'tag:herb', 3, '숲에서 지정 약초 채집'), win('ERDIA', 2, '에르디아에서 전투 승리'), visit('forest-2', '숲 깊은 곳 조사')]),
  E(3, 9, 'CH1', 'ERDIA', '중간고사와 사라진 약초',
    ['원소 기초·산술·동식물·예절 중간평가', '학교생활과 동료 관계 강화', '실습 준비 중 희귀 약초가 사라지는 사건', '숲 몬스터의 행동과 연결됨', '오래된 가시 흔적 발견'],
    [talk('npc-potion', '셀린의 약초실 확인'), talk('npc-librarian', '오웬에게 기록 묻기'), visit('forest', '숲의 약초 채집 지점')]),
  E(4, 12, 'CH1', 'ERDIA', '마지막 수업, 이상한 뿌리',
    ['학기말 평가와 성적·학점 정산', '방학 전 외부활동 안내', '숲 심층부에서 거대한 뿌리 흔적 확인', '학교 측은 단순 생태 이상으로 처리', '주인공 일행은 방학 조사단 참가를 결심'],
    [talk('npc-librarian', '오웬에게 조사단 이야기 듣기'), visit('forest', '교외 숲 경계')], [],
    { rewards: { items: [{ itemId: 'potion-hp-s', qty: 3 }, { itemId: 'potion-mp-s', qty: 2 }] } }),
  E(5, 15, 'CH1', 'ERDIA', '깊은 숲으로',
    ['에르디아 장기 원정 시작', '깊은 숲 → 고목숲 진입', '채집·사냥·생활 퀘스트가 메인 사건 조사와 결합', '몬스터 변이 흔적 다수 발견', '첫 본격적인 사건 지역 확정'],
    [visit('forest-3', '에르디아 고목숲'), win('ERDIA', 4, '고목숲 일대 전투 승리')]),
  E(6, 19, 'CH1', 'ERDIA', '가시어미 변이체',
    ['가시어미 변이체 등장', '일반 생태계에서 설명되지 않는 마력 변화', '지역 보스급 전투', '처치 후 정상 마력과 다른 고대 계열 잔향 발견', '미르엘은 이 결과를 학교로 가져오게 함'],
    [kill('mon-thorn-matriarch', 1, '가시어미 변이체 처치'), talk('npc-mirel', '미르엘 교수에게 잔향 보고')]),
  E(7, 23, 'CH1', 'ERDIA', '고목의 문장',
    ['고대목 골렘과 대치', '골렘이 오래된 문장을 반복', "'문을 닫아야 한다'는 이미지와 기억", '봉인의 흔적이 처음으로 메인 미스터리로 승격', '이 시점에서는 모르스의 이름을 확정하지 않음', '개강 준비와 함께 해안으로'],
    [visit('swamp', '안개 늪지'), kill('mon-ancient-bark-golem', 1, '고대목 골렘 처치')], ['CH1_ERDIA_COMPLETE']),

  // ════════ CH2 — 에르디아 해안 / 아틀란티스 ════════
  E(8, 27, 'CH2', 'COAST', '숲을 떠나 바다로',
    ['개강 후 학교 복귀', '숲 사건 조사 결과 정리', '해안 현장실습 공지', '아틀란티스·바다 해안 지역과의 교류', '바다 생태 수업과 낚시 실습 준비'],
    [visit('sea', '바다 해안'), win('COAST', 2, '해안에서 전투 승리')], ['CH2_COAST_STARTED']),
  E(9, 30, 'CH2', 'COAST', '바다는 기다리는 사람에게',
    ['낚시·채집·해양 생태 조사', '어민 NPC와 교류', '특정 시간대에만 나타나는 바다빛 발견', '폐등대 조사', '등대 안에서 숲의 봉인 흔적과 닮은 문양 발견'],
    [visit('sea-3', '암초 해안'), kill('family:aquatic', 3, '수생형 몬스터 처치')]),
  E(10, 33, 'CH2', 'COAST', '중간고사, 그리고 해저 유적',
    ['해양 생태·원소 응용 중간평가', '학생 간 경쟁과 동료 관계 강화', '해안에서 오래된 유적의 일부 발견', '수중 활동의 스토리 도입', "유적 벽면에 '문'을 암시하는 기호 — 판독 불가"],
    [visit('sea-2', '산호 여울'), visit('sea-cave', '해식 동굴')]),
  E(11, 36, 'CH2', 'COAST', '파도 아래 잠든 것',
    ['학기말 정산', '해안 수호수·유적 수호자와의 전투', '인장 파편 하나 확보', '파편이 숲에서 가져온 잔향과 공명', '바다 밑 더 깊은 곳을 조사하기로 함'],
    [visit('sea-cave', '해식 동굴'), win('COAST', 4, '해안 유적 일대 전투 승리')]),
  E(12, 39, 'CH2', 'COAST', '겨울 바다의 불빛',
    ['아틀란티스에서 겨울 체류', '낚시·채집·생활 퀘스트로 쉬어 가는 구간', '밤바다에 거대한 광원이 나타남', '도시 사람들은 오래된 재앙의 전조로 생각', '심해 탐사 준비'],
    [visit('atlantis', '아틀란티스'), talk('npc-atlantis-elder', '해류사제 넬리아에게 광원 이야기 듣기')]),
  E(13, 43, 'CH2', 'COAST', '해파리 여왕',
    ['심해 진입', '해파리 여왕과 전투', "전투 중 '문 안쪽에서 무언가가 깨어나고 있다'는 반응", '단순 해저 생태 이상이 아니라 봉인 사건임을 확신'],
    [visit('sea-3', '암초 해안'), kill('mon-jelly-queen', 1, '해파리 여왕 처치')]),
  E(14, 47, 'CH2', 'COAST', '암초왕의 기억',
    ['심해 암초왕 토벌', '심해 유적 중심에서 인장의 진짜 명칭 일부 발견', "처음으로 '모르스'라는 이름이 기록에 등장", "기록은 모르스를 '마왕·재앙'으로 기술", '주인공은 의문을 품고 학교로 복귀'],
    [visit('deepsea', '심해'), kill('mon-reef-king', 1, '심해 암초왕 처치')], ['CH2_COAST_COMPLETE']),

  // ════════ CH3 — 스톰헤이븐 / 천공 신전 ════════
  E(15, 51, 'CH3', 'ACADEMY', '돌아온 학생, 남겨진 질문',
    ['해안·심해 조사 결과 학술 보고', '학교생활 비중 증가', '동료 NPC와의 관계 심화', '마족·인마대전 역사 수업에서 불편한 질문 발생'],
    [visit('academy-library', '도서관'), talk('any', '동료들과 이야기 나누기', 2)], ['CH3_STORMHAVEN_STARTED']),
  E(16, 54, 'CH3', 'ACADEMY', '기록이 다르게 쓰여 있다',
    ['오웬의 도서관 자료 조사', '해안에서 발견한 기록과 학교 공식 역사의 불일치', '같은 인장을 두고 설명이 다르게 적혀 있음', "'누군가 기록을 수정했을 가능성'이 처음 제시됨"],
    [visit('academy-library', '도서관'), talk('npc-librarian', '사서 오웬과 기록 대조')]),
  E(17, 60, 'CH3', 'STORMHAVEN', '하늘에서 내려온 초대',
    ['기말평가', '스톰헤이븐 연구기관의 초청', '하늘 지역과 신전 자료를 조사할 여름 연구 계획 수립', '미르엘이 직접 추천서를 써 원정을 승인'],
    [talk('npc-mirel', '미르엘 교수에게 원정 승인 받기'), visit('stormhaven', '스톰헤이븐')]),
  E(18, 63, 'CH3', 'ACADEMY', '방학은 조금 천천히',
    ['전투 비중을 줄이고 휴식', '동료 NPC와 외출', '개인공간·하우징·요리·낚시·제작', '학생 관계도 상승', '생활·타이쿤 요소 강조'],
    [act('PLACE_FURNITURE', 'any', 1, '개인 공간 꾸미기'), act('COOK', 'any', 1, '요리 한 가지 만들기'), talk('any', '동료들과 외출 이야기', 2)]),
  E(19, 67, 'CH3', 'STORMHAVEN', '마법 동아리 합동 실습',
    ['동료들과 마법 실습', '협동 미니게임', '5속성 체계를 공부하는 심화 수업의 전조', '빛·어둠과 관련된 고대 개념이 학술 자료에서 처음 언급됨'],
    [visit('stormhaven-2', '폭풍 구름다리'), win('STORMHAVEN', 3, '스톰헤이븐에서 합동 실습 전투')]),
  E(20, 71, 'CH3', 'ACADEMY', '여름밤의 성녀',
    ['휴식과 축제 중심의 여름 이벤트', '성녀의 사절이 울토르를 방문', '빛 속성·성역에 관한 새로운 지식', '성녀 본인과의 만남이 다음 학기의 주요 사건이 됨'],
    [talk('npc-priest', '신관 세드릭에게 사절 소식 듣기'), talk('any', '축제에서 사람들과 이야기', 2)]),
  E(21, 75, 'CH3', 'ACADEMY', '성녀와 첫 대화',
    ['성녀가 울토르 방문', '빛의 마법·치유·성역 수업 공개', '성녀는 공식 역사와 오래된 기록 사이의 차이를 감지', '주인공에게 과거의 봉인에 관해 신중하게 접근'],
    [talk('npc-saint', '성녀 리아나와 대화')], ['SAINT_MET']),
  E(22, 78, 'CH3', 'ACADEMY', '중간고사: 빛과 기록',
    ['빛 마법 실습', '역사·윤리 시험', '마왕을 악으로만 정의하는 학교 교육에 의문 제기', "성녀가 '기록을 읽는 법'을 알려 줌"],
    [talk('npc-saint', '성녀에게 기록 읽는 법 배우기'), talk('npc-librarian', '사서 오웬과 이야기')]),
  E(23, 81, 'CH3', 'STORMHAVEN', '천공 신전의 문',
    ['성녀와 일행이 천공 신전의 고대 기록을 확인', "'네 개로 나뉜 왕의 마음'이라는 상징 발견", '희노애락이라는 이름까지는 확정하지 않음', '미르엘이 조사 범위를 축소시키려 함'],
    [visit('sky-temple', '천공 신전'), visit('sky-sanctum', '천공 대신전 내부')]),
  E(24, 84, 'CH3', 'ACADEMY', '하늘을 올려다보는 이유',
    ['기말평가', '천공 신전 자료가 오래된 대성당 기록과 연결될 가능성', '겨울방학에 아틀란티스 대성당을 방문하기로 결정', '미르엘은 동행 대신 보고서 제출을 요구'],
    [talk('npc-mirel', '미르엘 교수에게 보고서 제출')]),
  E(25, 87, 'CH3', 'COAST', '대성당으로 가는 겨울길',
    ['아틀란티스 대성당 방문', '종교·성역·역사 관련 생활형 퀘스트', '성녀의 가르침과 지역 주민 교류', '성당에서 오래된 왕의 형상 발견'],
    [visit('atlantis', '아틀란티스'), visit('atlantis-temple', '아틀란티스 대성당')]),
  E(26, 91, 'CH3', 'COAST', '네 개로 나뉜 마음',
    ['성당 지하의 오래된 벽화 조사', '왕의 마음이 희·노·애·락 네 상징으로 분리된 묘사 확인', '오웬은 기록이 의도적으로 잘려 있다고 판단', '미르엘이 이 사실을 알고 있었을 가능성'],
    [visit('atlantis-temple', '아틀란티스 대성당'), talk('npc-librarian', '사서 오웬에게 벽화 기록 전달')], ['CATHEDRAL_RECORD_FOUND', 'FOUR_EMOTIONS_DISCOVERED']),
  E(27, 95, 'CH3', 'ACADEMY', '읽지 못한 문장',
    ['성녀가 일부 문장을 해독하려 하지만 완전하지 않음', '미르엘이 조사 중단을 지시', '학교 공식 역사와 오래된 기록이 충돌한다는 확신', '3학년부터 유적 자체를 직접 조사하기로 결심'],
    [talk('npc-saint', '성녀와 문장 해독 시도'), talk('npc-mirel', '미르엘 교수의 지시 듣기')]),

  // ════════ CH4 — 버려진 폐허 / 버려진 신전 ════════
  E(28, 99, 'CH4', 'RUINS', '천공 아래서 찾은 길',
    ['고급 탐사 수업', '스톰헤이븐 기록을 실제 유적 현장과 대조', "과거 지역 재방문 — '4년의 학교생활이 연결된다'"],
    [visit('stormhaven-3', '뇌운 고원'), visit('ruins', '버려진 폐허')], ['CH4_RUINS_STARTED']),
  E(29, 102, 'CH4', 'RUINS', '중간고사: 고대마법과 역사의 빈칸',
    ['고대마법·봉인학·역사 시험', '시험 문제 속 공식 기록과 실제 유물의 불일치', '직접 조사할 명분 확보'],
    [talk('npc-librarian', '사서 오웬과 시험 문제 검토'), visit('ruins', '버려진 폐허')]),
  E(30, 105, 'CH4', 'RUINS', '버려진 폐허의 기록자',
    ['폐허·묘지·언데드 조사', '언데드 마법사와 접촉', "'승자는 항상 자기 기록을 남긴다'는 메시지", '과거가 조작됐다는 확신 강화'],
    [visit('ruins-2', '무너진 성곽'), kill('family:undead', 3, '언데드 처치')]),
  E(31, 108, 'CH4', 'RUINS', '신전으로 이어지는 균열',
    ['기말평가', '버려진 신전의 봉인 구조 발견', '안쪽에 네 감정 중 하나가 봉인되어 있다는 정황', '미르엘이 조사 결과를 비정상적으로 빨리 알고 있음'],
    [visit('temple-ruin', '버려진 신전'), talk('npc-abandoned-scholar', '유물학자 세라와 봉인 구조 확인')], ['MIREL_HISTORY_SUSPICION']),
  E(32, 111, 'CH4', 'ACADEMY', '방학 원정, 마지막 평온',
    ['유적 탐사 전 짧은 휴식', '동료들과 장비·요리·캠핑·하우징 정비', '4학년을 앞둔 선택과 책임에 관한 개인적 대화'],
    [act('COOK', 'any', 1, '원정 식량 요리'), talk('any', '동료들과 속 깊은 이야기', 3)]),
  E(33, 115, 'CH4', 'RUINS', '죽은 자가 기억하는 전쟁',
    ['폐허 심층부 진입', '언데드·흑마법사', '인마대전 당시의 자료와 현재 공식 역사 비교', "'마왕이 먼저 공격했다'는 기록이 조작됐을 가능성이 매우 높아짐"],
    [visit('catacomb', '지하 납골당'), kill('mon-dark-mage', 2, '흑마법사 처치')]),
  E(34, 119, 'CH4', 'RUINS', '문을 열지 말 것',
    ['버려진 신전 입구 발견', '봉인된 감정 파편의 반응', '미르엘이 직접 조사 허가', '지금까지 찾은 모든 사건의 중심이라고 판단'],
    [visit('temple-ruin', '버려진 신전'), visit('ruin-sanctum', '버려진 신전 내부')]),
  E(35, 123, 'CH4', 'RUINS', '신전 아래의 봉인',
    ['신전 내부 조사', "봉인된 '노'의 인격 발견", '루스벨의 흔적 확인', '미르엘은 내부 상황을 비정상적으로 정확히 알고 있음'],
    [visit('ruin-sanctum', '버려진 신전 내부'), win('RUINS', 3, '신전 내부 전투 승리')], ['NO_SEAL_FOUND']),
  E(36, 126, 'CH4', 'ACADEMY', '미르엘의 손',
    ['역사 개변에 대해 미르엘에게 직접 질문', '미르엘은 모호한 답변으로 넘김', '동시에 몰래 봉인 장치를 조작', "'노'의 인격 봉인이 풀림"],
    [talk('npc-mirel', '미르엘 교수에게 역사 개변을 묻기')], ['NO_RELEASED']),
  E(37, 128, 'CH4', 'RUINS', '폭주하는 루스벨',
    ["미르엘이 '노'의 인격을 루스벨에게 주입", '루스벨 폭주', '화염 마족의 힘 + 분노 인격으로 전투 양상이 완전히 변함', '폐허된 신전 편 최종보스 — 마왕 루스벨'],
    // 신전 내부에 들어가면 폭주 장면(story-script EP37_RAGE) → 보스전. 처치해도 도주(EP37_FLED)
    [visit('ruin-sanctum', '버려진 신전 내부'), kill('mon-ruspell-rage', 1, '폭주한 루스벨 저지')]),
  E(38, 130, 'CH4', 'RUINS', '노는 죽지 않았다',
    ['루스벨은 처치되지 않고 도주', '신전에서 고대문자·인격 조각에 대한 단서 획득', '루스벨이 살아 있는 한 사건이 끝나지 않았음을 깨달음'],
    [visit('ruin-sanctum', '버려진 신전 내부'), talk('npc-abandoned-scholar', '유물학자 세라와 고대문자 단서 확인')]),
  E(39, 132, 'CH4', 'ACADEMY', '기록을 바꾼 사람',
    ['기말평가보다 사건 수습 비중 증가', '학교가 공식 발표로 사건을 축소', '미르엘이 단순 방관자가 아니라고 판단', '루스벨의 행방은 불명'],
    [talk('npc-librarian', '사서 오웬과 공식 발표 비교'), talk('any', '학교 사람들의 반응 듣기', 2)]),
  E(40, 136, 'CH5', 'SNOWFIELD', '뜨거워진 겨울',
    ['설원 지역 기후가 급격히 상승', '만년설이 녹기 시작', '화산이 아니라 루스벨의 폭주가 기후 이상을 일으켰을 가능성', '피해 복구 지원과 고대 석비 조사를 함께 하기로 결정'],
    [visit('snowfield', '루미나 설원'), win('SNOWFIELD', 2, '설원에서 전투 승리')]),
  E(41, 141, 'CH5', 'ACADEMY', '다음은 설원이다',
    ['설원 파견 준비', '장비·코스튬·연금술·사냥 준비', '루스벨을 반드시 찾아야 한다는 목표 설정', "학교는 공식적으로 '마왕 토벌 준비'를 시작"],
    [act('CRAFT', 'any', 1, '원정 장비 제작'), talk('npc-potion', '약사 셀린에게 원정 물약 준비')]),

  // ════════ CH5 — 설원 / 오로라 마을 ════════
  E(42, 147, 'CH5', 'SNOWFIELD', '여름이어야 할 눈',
    ['루미나 설원 도착', '이상 고온으로 눈과 얼음이 녹는 지역 발견', '오로라 마을 피해 복구', '마을 평판 시스템 본격 개방', '주민의 신뢰를 얻는 첫 단계'],
    [visit('aurora-village', '오로라 마을'), talk('npc-aurora-chief', '설인족장 보르에게 피해 상황 듣기')]),
  E(43, 150, 'CH5', 'SNOWFIELD', '만년설 아래의 석비',
    ['고온 때문에 드러난 고대 석비 발견', '유실 문자라 읽을 수 없음', '미르엘은 해독에 도움을 주지 않음', '빈손에 가까운 상황'],
    [visit('frozen-lake', '얼어붙은 호수'), win('SNOWFIELD', 3, '석비 주변 정리')], ['SNOW_STELE_FOUND']),
  E(44, 153, 'CH5', 'SNOWFIELD', '동굴 속의 루스벨',
    ['설원 곳곳에서 루스벨의 화염 흔적 추적', '루스벨 은신 동굴 후보 발견', '설원 평판이 높을수록 추적 단서 증가', '루스벨을 찾을 수 있는 마지막 기회가 준비됨'],
    [visit('ice-cave', '얼음 동굴'), win('SNOWFIELD', 4, '설원에서 전투 승리')]),
  E(45, 156, 'CH5', 'SNOWFIELD', '두 갈래의 진실',
    ['기말평가·졸업 준비가 멈추고 최종 조사로 전환', '루스벨 발견 여부를 확정하는 핵심 분기', '여기서부터 4학년 2학기는 엔딩 특수 루프로 전환'],
    // ⚠ RUSPELL_FOUND 판정(설원 평판·추적 단서)은 Phase 2 — 지금은 자동으로 켜지지 않는다
    [visit('ice-cave', '얼음 동굴')], [],
    { routes: { B_OR_C: ["RUSPELL_FOUND — 루스벨 생존 확인, '노' 인격 상태와 깃든 모르스의 기억 확인"], A: ['루스벨을 찾지 못한 채 학교로 귀환'] } }),

  // ════════ CH6 — 화산지대 / 마물 마을 / 모르스의 성 ════════
  E(46, 160, 'CH6', 'VOLCANO', '화산으로',
    ['화산지대 진입'],
    [visit('volcano', '화산지대'), visit('demon-village', '마물 마을')], [],
    { routes: {
      A: ['루스벨을 찾지 못함', '미르엘과 함께 모르스 토벌 작전으로 이동', '모르스가 악의적인 마왕이라고 믿을 수밖에 없음'],
      B_OR_C: ["루스벨에게 남은 '노' 인격과 모르스의 기억 일부 확인", '학교로 돌아가지 않고 먼저 화산지대로', '마물 마을에서 모르스의 존재 확인'],
    } }),
  E(47, 167, 'CH6', 'VOLCANO', '마왕의 성에 도착하기 전에',
    ['모르스의 성을 앞둔 마물 마을'],
    [visit('demon-village', '마물 마을'), talk('npc-demon-elder', '장로 카즈와 대화')], [],
    { routes: {
      A: ['모르스와 대치', '마을 사람들은 인간에게 적대적', '모르스도 주인공을 인간 세력의 일원으로 판단', '토벌 전투 준비'],
      B_OR_C: ['화산지대 평판작 본격 시작', '분수대를 중심으로 마물 마을의 사정 해결', '루스벨의 말과 마을의 기억을 비교', '모르스와 대화하기 위한 신뢰 조건 준비'],
    } }),

  // ════════ CH7 — 최종장 (4학년 2학기 특수 플롯) ════════
  E(48, 171, 'CH7', 'ACADEMY', '마을의 이름으로',
    ['거점 평판 최종 점검', '각 마을 분수대에서 최종 평판 퀘스트 개방', '지정 에픽 몬스터 사냥·생활 활동·주민 사건 해결', '마을별 Lv.5 상징 아이템 획득', '부족한 상징은 여기서 추가 파밍'],
    // ⚠ 평판·분수대·상징(6거점)은 Phase 2 — 임시 목표
    [win('any', 3, '거점 의뢰 전투 승리'), talk('any', '거점 주민들과 이야기', 3)]),
  E(49, 174, 'CH7', 'ACADEMY', '학교 지하의 기쁨',
    ['울토르 학교 금지구역의 숨겨진 마법진'],
    // 숨겨진 통로(academy-secret, 2층 서쪽 회랑 벽 너머의 오망성 제단실)가 '희'의 봉인 자리 후보
    [visit('academy-secret', '숨겨진 통로')], [],
    { routes: {
      B_OR_C: ['모르스와의 대화에서 확인한 진실을 바탕으로 학교 지하로', "봉인된 '희'의 인격 확인", '미르엘이 오래전부터 학교를 이용해 희를 관리해 온 증거', "'마왕은 학교에 잠들어 있었다'는 말의 진짜 의미"],
      A: ['학교 지하 조사를 할 수 없거나 불완전한 기록만 확보', '미르엘은 과거 이야기를 덮고 최종 토벌을 재촉'],
    } }),
  E(50, 177, 'CH7', 'ACADEMY', '락을 가진 자',
    ['미르엘의 정체가 본격적으로 드러남', '인마대전 당시부터 살아온 존재임이 확인', "모르스에게서 '락'을 빼앗아 자신의 힘으로 써 왔다는 사실", '마족·인외종을 화산지대로 몰아넣은 정책의 설계자가 미르엘', '인마대전 기록이 미르엘에 의해 개변됐다는 사실 확정', '최종 적 = 미르엘'],
    [talk('npc-mirel', '미르엘과 마주하기')], ['MIREL_TRUE_IDENTITY_FOUND', 'FINAL_GATE_OPEN']),
  E(51, 179, 'CH7', 'STORMHAVEN', '왕 앞에 서는 자',
    ['스톰헤이븐 천공 신전에 머무는 국왕 앞의 공식 심문'],
    [visit('sky-temple', '천공 신전'), talk('npc-king', '국왕 알현')], [],
    { routes: {
      C: ['거점 상징을 모두 가진 주인공이 인간 사회 대표로 인정됨', '왕 앞에서 모르스의 입장을 대변', '과거의 차별과 역사 개변 공개', '인간 측·마물 측 증언과 울토르 기록 제시', '미르엘의 거짓말을 공개적으로 뒤집음'],
      B: ['상징이 하나 이상 부족', '사실은 증명했지만 사회적 합의 실패', '주인공과 모르스에게 추적 명령'],
      A: ['이미 모르스 토벌이 끝난 경우', '공식적으로 영웅으로 추앙받지만 주인공만 진실의 흔적을 앎'],
    } }),
  E(52, 180, 'CH7', 'MORS', '네 마음이 다시 하나가 될 때',
    ['본편 결말 — 4학년 2학기 졸업 직전'],
    [visit('demon-castle', '모르스의 성'), win('MORS', 3, '최종전')], [],
    { routes: {
      A: ['모르스 토벌 완료', '미르엘은 영웅으로 남거나 의심받지 않음', '석비의 문장과 학교 기록에 남은 의문을 안고 졸업', '마족이 차별받는 현실을 보여 주는 찝찝한 마무리'],
      B: ['모르스와 주인공이 미르엘의 영향에서 벗어남', '희·노·락·애의 진실', '인간 사회의 신뢰 부족으로 함께 도피', '화산지대 너머 새로운 땅을 바라보며 끝'],
      C: ["루스벨의 '노', 미르엘의 '락', 울토르 지하의 '희'를 회수", "모르스의 '애'와 함께 네 감정을 흡수 — 모르스 완전체", '미르엘 최종 토벌', '마족·인간 교류 재개와 마족 마을 개방', '왕과 새로운 협약, 주인공 영웅 인정', '입학식과 대응되는 졸업식'],
    } }),
]

/** 메인 스토리 EP01~EP52 — globalWeek 순 */
export const STORY_EPISODES: StoryEpisode[] = EPISODES.slice().sort((a, b) => a.week - b.week)

const BY_WEEK = new Map(STORY_EPISODES.map((e) => [e.week, e]))
export const episodeForWeek = (globalWeek: number) => BY_WEEK.get(globalWeek)

/** 이 주가 메인 스토리 주인가 */
export function isStoryEpisodeWeek(globalWeek: number): boolean {
  return BY_WEEK.has(globalWeek)
}

/** 에피소드 미션의 퀘스트 템플릿 id */
export const episodeQuestId = (week: number) => `STORY_EP_${week}`

/**
 * 학기 중 수업이 빠지는 스토리 주인가 — v3.0 §10: 스토리 주에도 필수 수업은 그대로 있다 → 항상 false.
 * (4학년 2학기 특수 루프의 수업 해제는 Phase 3 에서 이 함수로 연결)
 */
export function isSemesterStoryWeek(globalWeek: number): boolean {
  void calendarInfo(globalWeek)
  return false
}
