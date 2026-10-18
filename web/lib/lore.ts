// ============================================================================
// 세계관 데이터베이스(2026-10-14) — 수첩 「도감 › 세계관」에 실리는 항목.
//   기준: 울토르_메인스토리_53막_최종개편안_v3.2.md(충돌하면 그 문서가 우선) · lib/regions · lib/story.
//   NPC·아이템·펫의 세부 수치는 각 데이터 파일이 맡고, 여기는 "세계가 어떻게 돌아가는가"를 묶는다.
//
//   ■ 구조 — 게임 시스템과 이어지게(참고: 게임용 세계관 체크리스트 — 핵심 자원 순환·세력 역학·마법의 규칙화·환경 단서)
//     · 자원 순환: 마력(마나) → 마정석 → 학교 실습·제작·연금 → 원정 보급
//     · 세력: 왕국·대성당·울토르·6개 거점(평판 시스템 REPUTATION_HUBS) — 플레이어 선택이 엔딩을 바꾼다
//     · 마법의 규칙: 5속성 상성(lib/constants ELEMENT_META)·전위/후위/보조·감정과 공명
//   ■ 반전 보호(v3.2 §2.4) — 미르엘의 정체·역사 개변·모르스의 진실은 해당 플래그 전에는 절대 드러나지 않는다.
//     · unlock: 항목이 수첩에 나타나는 조건 · revised: 진실이 밝혀지면 본문이 "고쳐 쓰인 기록"으로 바뀐다
//       (도감 자체가 역사 개변의 증거가 되는 연출 — 처음엔 공식 역사, 나중엔 진짜 기록)
//   ■ 확장 규칙 — 새 항목은 id 를 'lore-<분류>-<이름>' 으로, links 에는 게임 데이터의 실제 id 만 쓴다
//     (scripts/audit-data.mjs 가 끊긴 연결을 잡는다).
// ============================================================================

import type { RegionId } from '@/lib/regions'
import type { GameState, MapId } from '@/lib/types'

export type LoreCategory =
  | 'world' // 세계·지리
  | 'polity' // 나라·도시
  | 'faction' // 세력·단체
  | 'race' // 종족
  | 'faith' // 신앙
  | 'magic' // 마법 체계
  | 'history' // 역사·연표
  | 'academy' // 울토르 학교 생활
  | 'ecology' // 생물·생태
  | 'resource' // 자원·재료
  | 'economy' // 경제·생활
  | 'calendar' // 달력·축제
  | 'language' // 언어·문자
  | 'book' // 전승·서적

export const LORE_CATEGORY_LABEL: Record<LoreCategory, string> = {
  world: '세계 · 지리',
  polity: '나라 · 도시',
  faction: '세력 · 단체',
  race: '종족',
  faith: '신앙',
  magic: '마법 체계',
  history: '역사 · 연표',
  academy: '학교 생활',
  ecology: '생물 · 생태',
  resource: '자원 · 재료',
  economy: '경제 · 생활',
  calendar: '달력 · 축제',
  language: '언어 · 문자',
  book: '전승 · 서적',
}

/** 수첩에 나타나는 조건 — 여러 개면 모두 만족해야 한다 */
export interface LoreUnlock {
  /** 켜져 있어야 할 스토리 플래그(예: 'beat:EP_75_OPEN', 'SAINT_MET') */
  flag?: string
  /** 한 번이라도 들어가 본 맵 */
  visit?: MapId
  /** 이 주차 이후 */
  week?: number
}

export interface LoreEntry {
  id: string
  category: LoreCategory
  name: string
  /** 한 줄 요약(목록에 보이는 글) */
  summary: string
  /** 본문 문단 */
  body: string[]
  /** 없으면 처음부터 보인다 */
  unlock?: LoreUnlock
  /** 진실이 밝혀진 뒤 바뀌는 본문 — flag 가 켜지면 body 대신(또는 뒤에 이어) 보인다 */
  revised?: { flag: string; title: string; body: string[]; mode?: 'replace' | 'append' }
  /** 게임 데이터와의 연결 — 실제 id 만 */
  links?: { regions?: RegionId[]; maps?: MapId[]; npcs?: string[]; monsters?: string[]; items?: string[]; companions?: string[] }
  tags?: string[]
}

const E = (e: LoreEntry) => e

export const LORE: LoreEntry[] = [
  // ── 세계 · 지리 ────────────────────────────────────────────────────────────
  E({
    id: 'lore-world-continent',
    category: 'world',
    name: '대륙과 일곱 땅',
    summary: '울토르를 중심으로 숲·바다·하늘·폐허·설원·화산이 둘러싼 대륙.',
    body: [
      '울토르 마법학교가 선 분지를 중심으로, 서쪽의 에르디아 숲, 남쪽의 해안과 바다 밑 아틀란티스, 폭풍 위에 뜬 스톰헤이븐, 북서의 버려진 폐허, 북쪽의 루미나 설원, 그리고 동쪽 끝의 화산지대가 둘러싸고 있다.',
      '사람들은 이 일곱 땅을 "울토르에서 걸어서 닿는 세계"라고 부른다. 화산지대 너머는 지도에 그려지지 않는다.',
      '학생들은 학년이 오를수록 더 먼 땅으로 원정을 떠난다 — 숲은 1학년, 화산은 4학년의 땅이다.',
    ],
    links: { regions: ['ACADEMY', 'ERDIA', 'COAST', 'STORMHAVEN', 'RUINS', 'SNOWFIELD', 'VOLCANO'] },
    tags: ['지도'],
  }),
  E({
    id: 'lore-world-erdia',
    category: 'world',
    name: '에르디아 숲',
    summary: '학교 서쪽의 오래된 숲. 깊어질수록 나무가 기억을 품는다고 한다.',
    body: [
      '바깥 숲은 약초꾼과 1학년 실습생의 땅이다. 깊은 숲을 지나 고목숲에 이르면 나무 껍질에 오래된 문장이 새겨져 있다.',
      '숲의 마력은 뿌리를 따라 흐른다. 그래서 숲이 앓으면 뿌리부터 검게 변한다 — 가시어미 변이체 사건이 그랬다.',
    ],
    unlock: { visit: 'forest' },
    links: { regions: ['ERDIA'], maps: ['forest', 'forest-2', 'forest-3', 'cave', 'swamp'], monsters: ['mon-thorn-matriarch', 'mon-ancient-bark-golem'] },
  }),
  E({
    id: 'lore-world-coast',
    category: 'world',
    name: '에르디아 해안과 아틀란티스',
    summary: '폐등대가 선 해안, 그리고 바다 밑에 가라앉은 옛 도시.',
    body: [
      '해안 마을 사람들은 등대가 꺼진 뒤로 밤바다에 나가지 않는다. 대신 썰물 때 드러나는 길을 따라 바다 밑 도시 아틀란티스로 내려간다.',
      '아틀란티스는 가라앉은 것이 아니라 "스스로 내려간" 도시라는 말이 있다. 대성당 지하의 기록실에는 지상의 어떤 책에도 없는 이름들이 남아 있다.',
    ],
    unlock: { visit: 'sea' },
    links: { regions: ['COAST'], maps: ['sea', 'atlantis', 'atlantis-temple', 'atlantis-crypt'], monsters: ['mon-jelly-queen', 'mon-reef-king'] },
  }),
  E({
    id: 'lore-world-stormhaven',
    category: 'world',
    name: '스톰헤이븐과 천공 신전',
    summary: '번개 구름 위에 떠 있는 하늘 도시. 왕국의 성역.',
    body: [
      '구름다리로만 닿는 하늘 도시. 폭풍은 도시를 지키는 벽이기도 하다.',
      '도시 가장 높은 곳의 천공 신전은 왕국의 성역으로, 국왕이 맹세를 하고 성녀가 기도를 올리는 곳이다.',
    ],
    unlock: { visit: 'stormhaven' },
    links: { regions: ['STORMHAVEN'], maps: ['stormhaven', 'sky-temple', 'sky-sanctum'], npcs: ['npc-king'] },
  }),
  E({
    id: 'lore-world-ruins',
    category: 'world',
    name: '버려진 폐허',
    summary: '인마대전의 격전지였다는 무너진 성곽과 신전.',
    body: ['성곽은 무너졌지만 언데드들은 아직 그날의 순찰을 돈다. 그들이 무엇을 지키는지는 아무도 묻지 않았다.', '폐허 깊은 곳의 버려진 신전은 출입이 금지되어 있다.'],
    unlock: { visit: 'ruins' },
    links: { regions: ['RUINS'], maps: ['ruins', 'graveyard', 'catacomb', 'temple-ruin'] },
  }),
  E({
    id: 'lore-world-snowfield',
    category: 'world',
    name: '루미나 설원',
    summary: '오로라가 내려앉는 북쪽 설원. 읽을 수 없는 석비가 서 있다.',
    body: ['오로라 마을 사람들은 석비의 문장을 읽지 못하지만, 그 앞을 지날 때는 모자를 벗는다.', '이상고온으로 눈이 녹은 해, 석비 아래에서 더 오래된 글자가 드러났다.'],
    unlock: { visit: 'snowfield' },
    links: { regions: ['SNOWFIELD'], maps: ['snowfield', 'aurora-village', 'frozen-lake'] },
  }),
  E({
    id: 'lore-world-volcano',
    category: 'world',
    name: '화산지대',
    summary: '인간 사회에서 밀려난 마물과 인외종이 모여 사는 땅.',
    body: ['용암과 재의 땅. 지도에는 "위험 지역"이라고만 적혀 있다.', '그러나 화산 기슭에는 마물들이 일군 마을이 있고, 그곳 사람들은 손님에게 먼저 차를 내온다.'],
    unlock: { visit: 'volcano' },
    links: { regions: ['VOLCANO'], maps: ['volcano', 'demon-village', 'demon-temple', 'mine'] },
  }),

  // ── 나라 · 도시 ────────────────────────────────────────────────────────────
  E({
    id: 'lore-polity-kingdom',
    category: 'polity',
    name: '왕국',
    summary: '일곱 땅을 다스리는 인간의 왕국. 지금의 국왕은 레오니스.',
    body: [
      '왕국은 인마대전의 승리로 세워졌다고 가르친다. 왕은 천공 신전에서 즉위의 맹세를 하고, 대성당은 그 맹세를 기록한다.',
      '울토르 마법학교는 왕국의 허가를 받아 운영되며, 졸업생 다수가 왕립 기록원·마도기사단·각 지방의 마법사로 나간다.',
    ],
    links: { npcs: ['npc-king'], maps: ['sky-temple'] },
  }),
  E({
    id: 'lore-polity-hubs',
    category: 'polity',
    name: '여섯 거점',
    summary: '안전지대 마을·아틀란티스·천공 성역·폐허 마을·오로라 마을·마물 마을.',
    body: [
      '원정길마다 학생들이 머무는 거점 마을이 있다. 거점 사람들의 믿음(평판)을 얻으면 마을의 상징을 맡겨 준다.',
      '여섯 상징은 각 마을이 "우리는 이 학생을 믿는다"고 말하는 증표다. 증언이 필요한 날, 이 증표는 어떤 기록보다 무겁다.',
    ],
    links: { maps: ['village', 'atlantis', 'sky-temple', 'temple-ruin', 'aurora-village', 'demon-village'] },
    tags: ['평판'],
  }),
  E({
    id: 'lore-polity-monster-village',
    category: 'polity',
    name: '마물 마을',
    summary: '화산 기슭, 밀려난 이들이 세운 마을.',
    body: ['간판은 고대어와 공용어가 나란히 적혀 있다. 아이들은 둘 다 읽는다.', '마을 사람들은 화산 깊은 곳의 "그분"을 마왕이라 부르지 않는다.'],
    unlock: { visit: 'demon-village' },
    revised: {
      flag: 'MORS_TRUTH_CONFIRMED',
      title: '마을이 지켜 온 이름',
      body: ['마을 사람들이 부르던 "그분"은 모르스였다. 그들은 모르스가 인간과 마족 모두의 왕이 되려 했던 시절을 노래로 기억해 왔다.'],
      mode: 'append',
    },
    links: { maps: ['demon-village'] },
  }),

  // ── 세력 · 단체 ────────────────────────────────────────────────────────────
  E({
    id: 'lore-faction-ultor',
    category: 'faction',
    name: '울토르 마법학교',
    summary: '4년제 마법학교. 왕국 마법사의 대부분이 이곳을 거친다.',
    body: [
      '화염·빙결·대지의 기초 3속성과 어둠·빛 심화 과정을 가르친다. 수업 외에도 채집·낚시·연금·요리·제작 같은 생활 과목이 있다.',
      '학교에는 오래된 금기가 하나 있다 — "마왕은 학교에 잠들어 있다." 지하 금지구역은 그래서 열리지 않는다.',
    ],
    links: { regions: ['ACADEMY'], maps: ['village', 'school-hall', 'academy-secret'] },
  }),
  E({
    id: 'lore-faction-cathedral',
    category: 'faction',
    name: '대성당',
    summary: '왕국의 기록과 신앙을 맡은 곳. 성녀가 속해 있다.',
    body: ['대성당은 즉위·조약·전쟁의 기록을 보관한다. "기록된 것이 곧 역사"라는 말이 이곳에서 나왔다.', '성녀는 대성당의 얼굴이지만, 기록실 열쇠는 성녀에게도 없다.'],
    unlock: { flag: 'beat:EP_71_OPEN' },
    links: { npcs: ['npc-saint', 'npc-envoy'] },
  }),
  E({
    id: 'lore-faction-archive',
    category: 'faction',
    name: '왕립 기록원',
    summary: '왕국 공식 역사서를 쓰고 고치는 기관.',
    body: ['기록원 서기는 각 지방을 돌며 기록을 "정리"한다. 정리된 기록은 대성당과 울토르 도서관에 사본으로 보내진다.'],
    unlock: { flag: 'beat:EP_54_OPEN' },
    revised: {
      flag: 'MIREL_HISTORY_SUSPICION',
      title: '정리라는 이름의 수정',
      body: ['울토르 도서관의 사본과 마을 증언을 맞대 보면, "정리"된 자리마다 같은 방향으로 문장이 바뀌어 있다. 누가 그 방향을 정했는가?'],
      mode: 'append',
    },
    links: { maps: ['village-archive'] },
  }),
  E({
    id: 'lore-faction-knights',
    category: 'faction',
    name: '마도기사단',
    summary: '왕국을 순찰하는 마법 기사들. 울토르 졸업생이 많다.',
    body: ['검과 마법을 함께 쓰는 기사단. 학교 주변과 거점 사이 길을 순찰한다.', '기사단의 명령은 왕명과 대성당의 공표에 따른다 — 공표가 틀렸다면, 기사단도 틀린 쪽에 선다.'],
    links: { companions: ['guest-patrol-knight'] },
  }),

  // ── 종족 ───────────────────────────────────────────────────────────────────
  E({
    id: 'lore-race-human',
    category: 'race',
    name: '인간',
    summary: '왕국의 다수 종족. 마력은 배워서 다룬다.',
    body: ['인간은 타고난 마력이 약한 대신, 배우고 기록하는 힘이 강하다. 울토르는 그 힘으로 세워진 학교다.'],
  }),
  E({
    id: 'lore-race-demonkin',
    category: 'race',
    name: '마족',
    summary: '마력을 타고나는 종족. 뿔이나 꼬리를 가진 이가 많다.',
    body: ['마족은 감정이 마력으로 곧장 이어진다. 화가 나면 불꽃이 일고, 슬프면 주위가 식는다.', '공식 역사는 마족을 인마대전의 침략자로 기록한다.'],
    revised: {
      flag: 'MORS_TRUTH_CONFIRMED',
      title: '침략자라는 기록',
      body: ['인마대전 이전의 기록에는 마족과 인간이 한 왕 아래 살던 시절이 있다. "침략자"라는 말은 전쟁이 끝난 뒤에 덧붙여졌다.'],
      mode: 'append',
    },
    links: { companions: ['comp-rusbel'] },
  }),
  E({
    id: 'lore-race-monsterfolk',
    category: 'race',
    name: '마물 · 인외종',
    summary: '말을 하는 마물과 반인반수. 대부분 화산지대에 산다.',
    body: ['야생 마물과 말을 하는 인외종은 다르다. 그러나 왕국의 법은 둘을 같은 이름으로 부른다.', '인외종이 화산지대로 밀려난 것은 법이 그렇게 정한 뒤부터다.'],
    unlock: { visit: 'demon-village' },
  }),
  E({
    id: 'lore-race-merfolk',
    category: 'race',
    name: '아틀란티스 사람들',
    summary: '바다 밑 도시에서 대를 이어 사는 사람들.',
    body: ['아틀란티스 사람들은 숨을 오래 참는 것이 아니라, 물속의 마력으로 숨을 쉰다. 지상에 오래 있으면 목이 마르다고 한다.'],
    unlock: { visit: 'atlantis' },
    links: { maps: ['atlantis'] },
  }),

  // ── 신앙 ───────────────────────────────────────────────────────────────────
  E({
    id: 'lore-faith-light',
    category: 'faith',
    name: '빛의 신앙',
    summary: '대성당이 섬기는 빛. 성녀는 빛의 목소리라 불린다.',
    body: ['빛은 "기억을 비추는 것"으로 여겨진다. 그래서 대성당은 기도와 기록을 같은 일로 본다.', '빛 속성 마법의 기도문 대부분이 대성당 전례에서 나왔다.'],
    links: { npcs: ['npc-saint'] },
  }),
  E({
    id: 'lore-faith-sky',
    category: 'faith',
    name: '천공 신전의 맹세',
    summary: '왕이 하늘 앞에서 백성 모두를 다스리겠다고 맹세하는 의식.',
    body: ['맹세문 첫 줄은 "모든 이를 위하여"이다. 언제부터 "모든 이"가 "모든 사람"으로 바뀌었는지는 기록에 없다.'],
    unlock: { visit: 'sky-temple' },
  }),
  E({
    id: 'lore-faith-folk',
    category: 'faith',
    name: '거점 마을의 민간 신앙',
    summary: '숲의 고목, 바다의 등대, 설원의 석비 — 마을마다 지키는 것.',
    body: ['에르디아 사람들은 고목에, 해안 사람들은 꺼진 등대에, 오로라 사람들은 석비에 인사한다. 대성당은 이를 미신이라 부르지만 막지는 않는다.'],
  }),

  // ── 마법 체계 ──────────────────────────────────────────────────────────────
  E({
    id: 'lore-magic-elements',
    category: 'magic',
    name: '다섯 속성',
    summary: '화염(속도)·빙결(제어)·대지(안정), 그리고 어둠과 빛.',
    body: [
      '"화염은 속도, 빙결은 제어, 대지는 안정." — 울토르 1학년 첫 수업의 문장.',
      '기초 3속성은 서로 물고 물린다. 어둠과 빛은 서로를 비추는 심화 속성으로, 2학년 이후에 배운다.',
      '무엇을 고르든, 왜 골랐는지 말할 수 있으면 된다 — 울토르는 정답보다 이유를 가르친다.',
    ],
    tags: ['전투', '상성'],
  }),
  E({
    id: 'lore-magic-mana',
    category: 'magic',
    name: '마력(마나)',
    summary: '모든 마법의 연료. 땅·물·감정에서 흘러나온다.',
    body: ['마력은 흐르는 것이다. 숲에서는 뿌리를 따라, 바다에서는 해류를 따라, 사람에게서는 감정을 따라 흐른다.', '마력이 한곳에 오래 고이면 굳어서 마정석이 된다.'],
    tags: ['자원 순환'],
  }),
  E({
    id: 'lore-magic-formation',
    category: 'magic',
    name: '전위 · 후위 · 보조',
    summary: '울토르 전투학의 기본 진형.',
    body: ['전위는 버티고, 후위는 쏘고, 보조는 잇는다. 넷이 한 몸처럼 움직일 때 마법은 혼자일 때의 두 배가 된다.', '펫은 주인의 진형을 따라 움직인다.'],
    tags: ['전투'],
  }),
  E({
    id: 'lore-magic-emotion',
    category: 'magic',
    name: '감정과 마력',
    summary: '강한 감정은 마력을 키우지만, 다루지 못하면 폭주한다.',
    body: ['울토르는 감정을 억누르라고 가르치지 않는다. 이름을 붙이라고 가르친다 — 이름 붙인 감정은 다룰 수 있다.'],
  }),
  E({
    id: 'lore-magic-four-hearts',
    category: 'magic',
    name: '네 개로 나뉜 마음',
    summary: '희(喜, 기쁨)·로(怒, 분노)·애(哀, 슬픔)·락(樂, 즐거움) — 한 존재에게서 갈라진 네 감정.',
    body: ['대성당 기록의 구석에 남은 문장. "왕의 마음은 넷으로 나뉘어, 기쁨은 배움의 집 아래에, 분노는 버려진 신전에, 슬픔은 불의 땅에 남았다. 즐거움은……" 마지막 줄은 지워져 있다.'],
    unlock: { flag: 'FOUR_EMOTIONS_DISCOVERED' },
    revised: {
      flag: 'MIREL_TRUE_IDENTITY_FOUND',
      title: '지워진 마지막 줄',
      body: ['즐거움은 빼앗겼다. 빼앗은 자는 그 힘으로 역사를 고쳐 써 왔다.'],
      mode: 'append',
    },
    tags: ['스토리'],
  }),
  E({
    id: 'lore-magic-resonance',
    category: 'magic',
    name: '공명',
    summary: '갈라진 감정 조각이 서로를 끌어당기는 현상.',
    body: ['조각 하나가 깨어나면, 다른 조각이 있는 쪽의 마력이 떨린다. 설원의 이상고온도, 학교 지하의 미세한 진동도 같은 때에 시작됐다.'],
    unlock: { flag: 'MORS_MEMORY_ACQUIRED' },
  }),
  E({
    id: 'lore-magic-seal',
    category: 'magic',
    name: '봉인술',
    summary: '마력을 마법진 안에 가두는 고대 마법.',
    body: ['봉인은 가두는 마법이 아니라 "잊게 하는" 마법이라는 학설이 있다. 봉인된 것은 힘을 잃는 대신, 봉인한 이를 기억하지 못하게 된다.'],
    unlock: { flag: 'beat:EP_99_OPEN' },
  }),

  // ── 역사 · 연표 ────────────────────────────────────────────────────────────
  E({
    id: 'lore-history-war',
    category: 'history',
    name: '인마대전',
    summary: '마왕 모르스가 이끈 마족과 인간의 전쟁. 인간의 승리로 끝났다.',
    body: ['공식 역사: 마왕 모르스가 마족을 이끌고 인간의 땅을 침략했다. 용사와 마법사들이 모르스를 봉인했고, 그 승리 위에 왕국이 세워졌다.', '울토르 역사 교과서 1장의 내용이다.'],
    revised: {
      flag: 'MORS_TRUTH_CONFIRMED',
      title: '고쳐 쓰이기 전의 인마대전',
      body: [
        '모르스는 마족과 인간 모두를 다스리려 했던 왕이었다. 전쟁은 종족의 차별과 인간의 이기심 속에서 시작됐고, 모르스는 패배한 것이 아니라 봉인됐다.',
        '"침략", "마왕", "승리" — 공식 역사의 핵심 단어들은 모두 전쟁 뒤에 덧씌워졌다.',
      ],
      mode: 'replace',
    },
    tags: ['스토리', '연표'],
  }),
  E({
    id: 'lore-history-founding',
    category: 'history',
    name: '울토르 창립',
    summary: '인마대전 직후, 마법을 기록하고 가르치기 위해 세워진 학교.',
    body: ['창립 기록에는 "다시는 그 힘을 잃지 않기 위하여"라고 적혀 있다. 무엇을 잃지 않겠다는 것인지는 적혀 있지 않다.', '학교는 봉인진 위에 세워졌다 — 이것은 금기와 같이 전해지는 이야기다.'],
  }),
  E({
    id: 'lore-history-lighthouse',
    category: 'history',
    name: '등대가 꺼진 해',
    summary: '해안의 등대가 꺼지고 해파리 여왕이 깨어난 해.',
    body: ['등대지기는 "바다 밑에서 누군가 불렀다"는 말을 남기고 사라졌다. 그 뒤로 등대는 다시 켜지지 않았다.'],
    unlock: { visit: 'sea' },
  }),
  E({
    id: 'lore-history-timeline',
    category: 'history',
    name: '연표(공식)',
    summary: '왕국력으로 정리한 공식 연표.',
    body: ['· 인마대전 — 마왕 봉인, 왕국 건국', '· 왕국 원년 — 천공 신전 즉위 맹세 시작', '· 울토르 창립 — 왕국 허가 마법학교', '· 마족 거주 제한법 — 인외종 화산지대 이주', '· 현재 — 국왕 레오니스 재위'],
    revised: {
      flag: 'MIREL_TRUE_IDENTITY_FOUND',
      title: '연표 뒤에 있던 한 사람',
      body: ['연표의 모든 줄에 같은 서명이 숨어 있다. 인마대전 때부터 지금까지 늙지 않고 기록 곁에 있었던 한 사람 — 미르엘.'],
      mode: 'append',
    },
    tags: ['연표'],
  }),

  // ── 학교 생활 ──────────────────────────────────────────────────────────────
  E({
    id: 'lore-academy-years',
    category: 'academy',
    name: '4년 192주',
    summary: '한 해 48주, 학기와 방학이 번갈아 온다.',
    body: ['학기 중에는 수업·시험·학교생활이, 방학에는 지역 원정과 월드 퀘스트가 중심이다.', '한 주는 필수 수업과 외부 활동 두 가지로 끝난다. 약 3주마다 큰 사건이 찾아온다.'],
    tags: ['시스템'],
  }),
  E({
    id: 'lore-academy-houses',
    category: 'academy',
    name: '세 기숙사',
    summary: '요르문간드(얼음) · 펜리르(대지) · 헬라(불).',
    body: [
      '울토르의 기숙사는 세 마리 전설의 짐승 이름을 딴다. 요르문간드는 얼음의 정밀함을, 펜리르는 대지의 굳건함을, 헬라는 불꽃의 결단을 "추구미"로 삼는다.',
      '기숙사의 속성은 규칙이 아니라 지향이다. 어둠을 쓰는 학생이 요르문간드에 있어도, 불을 쓰는 학생이 펜리르에 있어도 이상하지 않다.',
    ],
    tags: ['기숙사'],
  }),
  E({
    id: 'lore-academy-taboo',
    category: 'academy',
    name: '지하 금지구역',
    summary: '"마왕은 학교에 잠들어 있다" — 울토르의 오래된 금기.',
    body: ['본관 지하로 내려가는 계단은 봉인된 문에서 끝난다. 신입생 환영회 날 밤마다 누군가 그 문 앞까지 가 보았다는 이야기가 돈다.'],
    revised: {
      flag: 'JOY_FRAGMENT_FOUND',
      title: '잠들어 있던 것',
      body: ['문 너머의 마법진에는 마왕이 아니라 "기쁨" 하나가 봉인되어 있었다.'],
      mode: 'append',
    },
    links: { maps: ['academy-secret'] },
  }),
  E({
    id: 'lore-academy-library',
    category: 'academy',
    name: '울토르 도서관',
    summary: '왕국 기록의 사본이 모이는 곳. 사서 오웬이 지킨다.',
    body: ['도서관의 사본은 왕립 기록원에서 보내온 것이다. 오웬은 사본이 도착할 때마다 예전 판과 나란히 꽂아 둔다 — "책은 버리는 게 아니라서요."'],
    links: { maps: ['academy-library'], npcs: ['npc-librarian'] },
  }),
  E({
    id: 'lore-academy-life',
    category: 'academy',
    name: '생활 과목',
    summary: '채집·낚시·사냥·연금·요리·제작·하우징.',
    body: ['울토르는 마법만으로는 원정에서 살아남을 수 없다고 가르친다. 생활 과목은 학년과 학기에 따라 하나씩 열린다.'],
    tags: ['시스템'],
  }),

  // ── 생물 · 생태 ────────────────────────────────────────────────────────────
  E({
    id: 'lore-ecology-familiars',
    category: 'ecology',
    name: '펫(마법 동반수)',
    summary: '주인과 마력을 나누는 작은 마법 생물.',
    body: ['펫은 길들이는 것이 아니라 "마음이 맞는" 것이다. 애정이 쌓이면 주인의 진형과 속성에 맞춰 함께 성장한다.', '신입생은 불꽃·서리·대지 동반수 중 하나와 첫 계약을 맺는다.'],
    tags: ['펫'],
  }),
  E({
    id: 'lore-ecology-monster-families',
    category: 'ecology',
    name: '마물의 계통',
    summary: '야생 마물은 사는 땅의 마력을 닮는다.',
    body: ['숲의 마물은 뿌리와 가시를, 바다의 마물은 껍질과 촉수를, 화산의 마물은 불씨를 닮는다. 같은 계통의 마물에서는 비슷한 재료가 나온다.', '변이체는 땅의 마력이 병들었을 때 나타난다.'],
    tags: ['사냥'],
  }),
  E({
    id: 'lore-ecology-undead',
    category: 'ecology',
    name: '기억하는 언데드',
    summary: '폐허의 언데드는 살아 있을 때의 마지막 명령을 되풀이한다.',
    body: ['그들은 적의가 아니라 기억으로 움직인다. 귀를 기울이면 인마대전의 마지막 날 들은 말을 중얼거린다.'],
    unlock: { visit: 'ruins' },
  }),

  // ── 자원 · 재료 ────────────────────────────────────────────────────────────
  E({
    id: 'lore-resource-manastone',
    category: 'resource',
    name: '마정석(마력 결정)',
    summary: '고인 마력이 굳은 돌. 학교 실습과 제작의 연료.',
    body: ['광산과 동굴, 오래된 봉인 근처에서 많이 난다. 울토르 실습실의 등불과 제작대는 모두 마정석으로 돌아간다.', '마정석이 많이 나는 곳일수록 오래전 큰 마법이 있었던 곳이다.'],
    tags: ['자원 순환'],
    links: { maps: ['mine', 'cave'], items: ['crystal-mana', 'crystal-wind'] },
  }),
  E({
    id: 'lore-resource-herbs',
    category: 'resource',
    name: '약초와 연금',
    summary: '숲의 약초가 물약이 되기까지.',
    body: ['약초는 캔 지 하루 안에 다듬어야 약효가 남는다. 연금은 재료의 마력을 섞는 일이고, 요리는 재료의 마력을 데우는 일이다.'],
    tags: ['자원 순환', '채집'],
  }),
  E({
    id: 'lore-resource-cycle',
    category: 'resource',
    name: '원정 보급의 순환',
    summary: '채집·사냥·낚시 → 연금·요리·제작 → 원정.',
    body: ['원정에서 얻은 재료가 학교에서 물약과 장비가 되고, 그것이 다음 원정을 가능하게 한다. 울토르 학생의 한 주는 이 순환으로 돌아간다.'],
    tags: ['시스템', '자원 순환'],
  }),

  // ── 경제 · 생활 ────────────────────────────────────────────────────────────
  E({
    id: 'lore-economy-gold',
    category: 'economy',
    name: '골드',
    summary: '왕국 공용 화폐.',
    body: ['상점·제작·여관 어디서나 쓰는 금화. 거점 마을에서는 평판이 높을수록 덤을 얹어 주는 상인이 많다.'],
    tags: ['시스템'],
  }),
  E({
    id: 'lore-economy-merchants',
    category: 'economy',
    name: '상인과 장인',
    summary: '무기상·물약상·도구상, 그리고 학교 제작대.',
    body: ['학교 앞 상점가는 학생 손님으로 먹고산다. 원정 철이 되면 물약 값이 오른다는 소문이 있지만, 상인들은 부인한다.'],
  }),

  // ── 달력 · 축제 ────────────────────────────────────────────────────────────
  E({
    id: 'lore-calendar-year',
    category: 'calendar',
    name: '울토르의 한 해',
    summary: '1학기 → 여름방학 → 2학기 → 겨울방학.',
    body: ['학기 중간과 끝에는 시험이 있다. 방학은 원정의 계절이다.', '입학식은 봄, 졸업식은 4학년 마지막 주에 열린다.'],
    tags: ['시스템'],
  }),
  E({
    id: 'lore-calendar-festivals',
    category: 'calendar',
    name: '축제',
    summary: '입학 환영제 · 여름밤 별 축제 · 학기 말 마법 경연 · 졸업식.',
    body: ['입학 환영제 — 신입생이 처음 기숙사 문장을 받는 밤.', '여름밤 별 축제 — 학교 광장에 등불을 띄운다. 성녀가 울토르를 처음 찾은 것도 이 무렵이었다.', '학기 말 마법 경연 — 동아리와 기숙사가 실력을 겨룬다.', '졸업식 — 4년의 마지막 주. 졸업생은 자신이 쓴 첫 실습 소감문을 돌려받는다.'],
  }),

  // ── 언어 · 문자 ────────────────────────────────────────────────────────────
  E({
    id: 'lore-language-common',
    category: 'language',
    name: '공용어',
    summary: '왕국의 말과 글.',
    body: ['교과서와 공식 기록은 모두 공용어로 쓰인다. 공용어에는 "인외종"이라는 낱말이 있지만, 고대어에는 그 낱말이 없다.'],
  }),
  E({
    id: 'lore-language-ancient',
    category: 'language',
    name: '고대어',
    summary: '인마대전 이전의 말. 지금은 아무도 읽지 못한다고 알려져 있다.',
    body: ['설원의 석비, 고목의 문장, 아틀란티스 기록실의 이름들이 모두 같은 글자로 쓰여 있다.', '마물 마을의 노인들은 아이들에게 고대어 노래를 가르친다.'],
    unlock: { flag: 'SNOW_STELE_FOUND' },
    revised: {
      flag: 'ANCIENT_SCRIPT_CONFIRMED',
      title: '읽을 수 있는 사람들',
      body: ['고대어는 잊힌 말이 아니라 밀려난 말이었다. 화산지대에서는 여전히 그 말로 인사하고, 그 말로 왕을 부른다.'],
      mode: 'append',
    },
  }),

  // ── 전승 · 서적 ────────────────────────────────────────────────────────────
  E({
    id: 'lore-book-textbook',
    category: 'book',
    name: '『울토르 역사 교과서』',
    summary: '1학년 필수 교재. 인마대전부터 왕국 건국까지.',
    body: ['감수자 서명란에는 대대로 같은 이름의 머리글자가 찍혀 있다. 학생들은 아무도 그것을 이상하게 여기지 않는다.'],
  }),
  E({
    id: 'lore-book-lighthouse-log',
    category: 'book',
    name: '『등대지기 일지』',
    summary: '해안 폐등대에서 발견된 낡은 일지.',
    body: ['"오늘도 바다 밑에서 노래가 들렸다. 슬픈 노래인데, 듣고 있으면 이상하게 마음이 놓인다."'],
    unlock: { visit: 'sea-2' },
  }),
  E({
    id: 'lore-book-oath',
    category: 'book',
    name: '『즉위 맹세문』 사본',
    summary: '천공 신전에 보관된 맹세문의 오래된 사본.',
    body: ['가장 오래된 사본의 첫 줄 — "인간과 마족, 모든 이를 위하여." 지금의 맹세문에는 가운데 낱말들이 없다.'],
    unlock: { flag: 'CATHEDRAL_RECORD_FOUND' },
  }),
  E({
    id: 'lore-book-children',
    category: 'book',
    name: '동요 「네 개의 별」',
    summary: '왕국 아이들이 부르는 숫자 노래.',
    body: ['"하나는 웃고, 둘은 화내고, 셋은 울고, 넷은 춤추네. 넷이 모이면 왕이 오시네." 대성당은 이 노래를 금하지 않았다. 아무도 뜻을 몰랐으니까.'],
    unlock: { week: 40 },
  }),

  // ── 2차 확장(2026-10-14): 거점 문화 · 마물 생태 · 지역 요리 · 특산 재료 · 인물 전승 ──────────────
  // 거점 6곳 — 평판(lib/story REPUTATION_HUBS)과 짝. 상징을 받는 이유가 마을의 가치관과 이어지게
  E({
    id: 'lore-polity-safe-village',
    category: 'polity',
    name: '안전지대 마을(울토르 마을)',
    summary: '학교를 품은 분지 마을. 상징은 「열린 대문」.',
    body: ['학생과 상인, 농부가 한데 사는 마을. 마을 회관의 대문은 밤에도 잠그지 않는다 — "울토르의 학생이라면 누구든"이 마을의 오래된 약속이다.', '상징 「열린 대문」은 그 약속을 지킨 학생에게 맡겨진다.'],
    links: { maps: ['village'] },
    tags: ['평판', '상징'],
  }),
  E({
    id: 'lore-polity-atlantis-town',
    category: 'polity',
    name: '아틀란티스 마을',
    summary: '바다 밑 도시의 사람들. 상징은 「진주 등불」.',
    body: ['아틀란티스 사람들은 손님에게 진주 등불을 건네 길을 밝혀 준다. 등불은 돌려받지 않는다 — 다음 손님에게 건네라는 뜻이다.', '마을의 대성당 지하 기록실은 지상의 기록과 다른 이름들을 품고 있다.'],
    unlock: { visit: 'atlantis' },
    links: { maps: ['atlantis', 'atlantis-temple'], items: ['sea-pearl'] },
    tags: ['평판', '상징'],
  }),
  E({
    id: 'lore-polity-sky-sanctuary',
    category: 'polity',
    name: '천공 신전 성역',
    summary: '스톰헤이븐 꼭대기의 성역. 상징은 「깃털 인장」.',
    body: ['성역의 사제들은 기도문을 깃털 펜으로 옮겨 적는다. 깃털 인장은 "이 사람의 말은 기록할 가치가 있다"는 증표다.'],
    unlock: { visit: 'sky-temple' },
    links: { maps: ['sky-temple', 'sky-sanctum'] },
    tags: ['평판', '상징'],
  }),
  E({
    id: 'lore-polity-ruin-village',
    category: 'polity',
    name: '폐허 신전 쪽 마을',
    summary: '무너진 성곽 그늘에 남은 사람들. 상징은 「꺼지지 않는 초」.',
    body: ['떠나지 않은 사람들의 마을. 그들은 언데드를 쫓지 않고, 해 질 녘마다 성곽에 초를 켜 둔다 — "길을 잃지 마시라고."'],
    unlock: { visit: 'temple-ruin' },
    links: { maps: ['temple-ruin'] },
    tags: ['평판', '상징'],
  }),
  E({
    id: 'lore-polity-aurora',
    category: 'polity',
    name: '오로라 마을',
    summary: '석비를 지키는 설원 마을. 상징은 「서리 매듭」.',
    body: ['설원 사람들은 약속을 할 때 털실로 매듭을 지어 서로의 손목에 묶는다. 매듭은 녹지 않는 서리처럼 오래간다고 믿는다.'],
    unlock: { visit: 'aurora-village' },
    links: { maps: ['aurora-village', 'aurora-sanctum'] },
    tags: ['평판', '상징'],
  }),
  E({
    id: 'lore-polity-monster-emblem',
    category: 'polity',
    name: '마물 마을의 상징',
    summary: '상징은 「두 글자 문패」 — 고대어와 공용어가 나란히 새겨진 문패.',
    body: ['마물 마을에서 믿음을 얻은 손님에게는 작은 문패를 건넨다. 한쪽엔 공용어로, 다른 쪽엔 고대어로 손님의 이름이 새겨져 있다.', '"두 말로 불리는 사람은 두 세계의 손님이다."'],
    unlock: { visit: 'demon-village' },
    links: { maps: ['demon-village'] },
    tags: ['평판', '상징'],
  }),

  // 마물 계통(MonsterFamily) — 도감의 몬스터와 이어진다
  E({
    id: 'lore-ecology-beast',
    category: 'ecology',
    name: '짐승 계통',
    summary: '들쥐부터 잿빛 사냥개까지 — 땅의 마력을 먹고 자란 짐승들.',
    body: ['숲의 짐승은 겁이 많고, 화산의 짐승은 성질이 급하다. 사는 땅의 마력이 성격을 만든다.', '고기·가죽·뼈·발톱은 원정 보급의 기본 재료다.'],
    links: { monsters: ['mon-field-mouse', 'mon-forest-raccoon', 'mon-grey-wolf', 'mon-ember-imp', 'mon-ash-hound'] },
    tags: ['사냥'],
  }),
  E({
    id: 'lore-ecology-plant',
    category: 'ecology',
    name: '식물 계통',
    summary: '움직이는 덩굴과 독버섯 — 숲의 병이 깊어지면 나타난다.',
    body: ['가시덩굴과 독버섯 갓은 본래 숲의 청소부다. 땅의 마력이 병들면 덩치가 커지고 사나워진다 — 가시어미는 그 끝에 선 존재다.'],
    unlock: { visit: 'forest' },
    links: { monsters: ['mon-thorn-vine', 'mon-mush-cap', 'mon-thorn-matriarch'] },
    tags: ['사냥'],
  }),
  E({
    id: 'lore-ecology-construct',
    category: 'ecology',
    name: '구조체 계통',
    summary: '마력이 깃든 나무·돌·갑주. 누군가 내린 명령으로 움직인다.',
    body: ['골렘과 파수꾼은 만든 이의 명령을 끝까지 지킨다. 명령을 내린 사람이 사라진 뒤에도.', '석상 거인의 가슴에는 대개 지워진 문장이 하나 새겨져 있다.'],
    links: { monsters: ['mon-bark-golem', 'mon-ancient-bark-golem', 'mon-cursed-armor', 'mon-flame-warden', 'mon-stone-titan', 'mon-stone-titan-king'] },
    tags: ['사냥'],
  }),
  E({
    id: 'lore-ecology-aquatic',
    category: 'ecology',
    name: '바다 계통',
    summary: '물거품 정령부터 심해 암초왕까지.',
    body: ['바다의 마물은 해류를 따라 마력이 모이는 곳에 산다. 썰물 때 드러나는 길이 위험한 이유다.', '해파리 여왕과 암초왕은 오래전부터 "무언가를 지키듯" 같은 자리를 떠나지 않았다.'],
    unlock: { visit: 'sea' },
    links: { monsters: ['mon-bubble-spirit', 'mon-crab-soldier', 'mon-shallows-eel', 'mon-siren-larva', 'mon-reef-turtle', 'mon-tide-elemental', 'mon-jelly-queen', 'mon-reef-king'] },
    tags: ['사냥'],
  }),
  E({
    id: 'lore-ecology-darkmage',
    category: 'ecology',
    name: '어둠의 마법사들',
    summary: '금지된 마법을 좇는 수련생과 흑마법사. 누군가에게 배웠다.',
    body: ['어둠의 수련생들은 같은 교본을 들고 다닌다. 교본의 필체는 모두 같다.'],
    unlock: { visit: 'ruins' },
    links: { monsters: ['mon-dark-acolyte', 'mon-dark-mage'] },
    tags: ['사냥'],
  }),

  // 지역 요리·재료·물고기 — 생활 아이템과 이어진다
  E({
    id: 'lore-economy-cuisine',
    category: 'economy',
    name: '원정 요리',
    summary: '원정길의 식사가 곧 버프다 — 화염 생선구이, 빙결 버섯 스튜, 야영 도시락.',
    body: ['울토르 요리 수업의 첫 문장은 "요리는 재료의 마력을 데우는 일"이다. 잘 데운 요리는 한동안 몸의 마력을 북돋운다(식사 버프).', '해안 사람은 해산물 수프를, 숲 사람은 버섯 스튜를, 원정 떠나는 학생은 야영 도시락을 싼다.'],
    links: { items: ['food-fire-fish', 'food-mushroom-stew', 'food-berry-tart', 'food-meat-skewer', 'food-seafood-soup', 'food-trail-lunch'] },
    tags: ['요리', '자원 순환'],
  }),
  E({
    id: 'lore-resource-regional',
    category: 'resource',
    name: '지역 특산 재료',
    summary: '숲의 박하·달잎풀, 바다의 진주, 하늘의 구름꽃, 설원의 서리박하, 화산의 화염석.',
    body: [
      '에르디아 — 숲박하·달잎풀·빛버섯. 약초 연금의 기본.',
      '해안 — 다시마·조개껍데기·작은 진주. 진주는 아틀란티스 등불의 재료.',
      '스톰헤이븐 — 바람 결정·구름꽃·하늘뿌리. 가볍고 마력이 잘 흐른다.',
      '폐허 — 묘지버섯·철광석. 오래된 마력이 스며 있다.',
      '설원 — 서리박하·은광석·설원 소나무.',
      '화산 — 흑요석·화염석·불씨풀. 가장 뜨거운 재료.',
    ],
    links: { items: ['herb-mint', 'herb-moonleaf', 'mush-glow', 'sea-kelp', 'sea-pearl', 'crystal-wind', 'flower-cloud', 'herb-skyroot', 'mush-grave', 'ore-iron', 'herb-frostmint', 'ore-silver', 'wood-pine', 'ore-obsidian', 'ore-firestone', 'herb-ember'] },
    tags: ['채집', '자원 순환'],
  }),
  E({
    id: 'lore-ecology-fish',
    category: 'ecology',
    name: '물고기 지도',
    summary: '피라미에서 용암장어까지 — 물의 온도가 물고기를 정한다.',
    body: ['학교 연못엔 피라미와 붕어, 숲 개울엔 숲송어와 달빛 잉어, 바다엔 고등어·도미·진주가오리, 설원의 얼음 밑엔 얼음대구와 서리연어가 산다.', '화산의 용암장어가 "물고기"인지는 아직도 학계에서 다툰다.'],
    links: { items: ['fish-minnow', 'fish-carp', 'fish-trout', 'fish-moonkoi', 'fish-mackerel', 'fish-snapper', 'fish-pearlray', 'fish-icecod', 'fish-frostsalmon', 'fish-lavaeel'] },
    tags: ['낚시'],
  }),

  // 인물 전승 — 세부 설정은 나중에(NPC 데이터). 여기는 세상에 알려진 "소문"만
  E({
    id: 'lore-history-saint',
    category: 'history',
    name: '성녀 리아나',
    summary: '대성당이 세운 지금 시대의 성녀.',
    body: ['빛의 목소리라 불리는 성녀. 여름밤 별 축제 무렵 처음 울토르를 찾았다.', '성녀는 기록을 읽을 수는 있지만, 고칠 수는 없다.'],
    unlock: { flag: 'beat:EP_75_OPEN' },
    links: { npcs: ['npc-saint'] },
  }),
  E({
    id: 'lore-history-king',
    category: 'history',
    name: '국왕 레오니스',
    summary: '지금의 왕. 천공 신전에서 즉위의 맹세를 했다.',
    body: ['백성들은 레오니스를 "듣는 왕"이라 부른다. 증언이 충분하다면, 왕은 기록보다 사람의 말을 먼저 듣는다.'],
    unlock: { visit: 'sky-temple' },
    links: { npcs: ['npc-king'] },
  }),
  E({
    id: 'lore-history-herald',
    category: 'history',
    name: '모르스의 전령',
    summary: '마왕의 이름을 내걸고 나타나는 검은 사자.',
    body: ['"모르스의 이름으로" — 전령은 늘 그렇게 말을 시작한다. 그러나 화산지대 사람들은 그런 전령을 보낸 적이 없다고 한다.'],
    unlock: { flag: 'MORS_MEMORY_ACQUIRED' },
    links: { monsters: ['mon-azka-herald'] },
  }),
  // ── 2026-10-18 레퍼런스 보강(울토르_메인스토리_v3.3_보강안.md) — 실제 신화·역사·철학을 이 세계의 전승으로 옮겨 심었다.
  //    처음 읽을 땐 평범한 옛이야기, 진실 플래그가 켜지면 다른 뜻으로 읽힌다(반전 보호 §2.4: 미르엘을 가리키는 문장은 MIREL_TRUE_IDENTITY_FOUND 뒤에만).
  E({
    id: 'lore-book-scattered-king',
    category: 'book',
    name: '흩어진 왕 — 아이들의 돌림노래',
    summary: '울토르 마을 아이들이 줄넘기하며 부르는 네 마디짜리 노래.',
    body: [
      '"왕의 웃음은 배움의 집 밑에, 왕의 화는 무너진 신전에, 왕의 눈물은 불의 땅에, 왕의 노래는…… 어디 갔지?" — 마지막 마디에서 아이들은 늘 웃으며 줄을 놓친다.',
      '노래 속에는 강가를 따라 왕의 조각을 하나씩 주워 모으는 "줍는 이"가 나온다. 줍는 이가 네 조각을 다 모으면 왕이 다시 일어나 "고맙다"고 말한다는데, 어른들은 그 부분을 부르지 말라고 한다.',
      '마을 노인들의 말로는 아주 오래된 노래라, 처음 누가 지었는지 아무도 모른다.',
    ],
    unlock: { week: 3 },
    revised: {
      flag: 'MORS_TRUTH_CONFIRMED',
      title: '흩어진 왕 — 노래는 기록보다 오래 기억한다',
      mode: 'append',
      body: [
        '기록은 고쳐 쓸 수 있어도, 아이들이 입으로 부르는 노래까지 고치지는 못했다. 마지막 마디가 비어 있는 건 아무도 그 조각이 어디 있는지 몰랐기 때문이다 — 지금은 안다.',
      ],
    },
    links: { maps: ['village'] },
    tags: ['신화', '돌림노래'],
  }),
  E({
    id: 'lore-history-erased-faces',
    category: 'history',
    name: '깎여 나간 얼굴',
    summary: '천공 신전 부조에서 한 사람의 얼굴과 이름만 정으로 쪼아 낸 흔적.',
    body: [
      '천공 대신전 벽의 행렬 부조에는 왕관을 쓴 인물이 하나 있는데, 얼굴과 이름 칸만 정으로 깨끗이 쪼아 냈다. 다른 인물은 이끼 하나 손대지 않았다.',
      '공식 안내문은 "인마대전 때 마족이 훼손"이라 적는다. 그런데 정 자국은 가지런하고, 이름 칸 둘레엔 왕립 기록원이 쓰는 측량 표시가 남아 있다.',
      '지우는 쪽은 언제나 서두르지 않는다. 사람을 지우면, 그 사람이 한 일도 함께 지워지기 때문이다.',
    ],
    unlock: { visit: 'sky-sanctum' },
    revised: {
      flag: 'MORS_TRUTH_CONFIRMED',
      title: '깎여 나간 얼굴 — 지워진 왕',
      body: [
        '쪼아 낸 얼굴은 모르스의 것이었다. 마족과 인간을 함께 다스렸던 왕을 행렬에서 지우자, 행렬은 "인간 왕들의 역사"가 되었다.',
        '얼굴은 지울 수 있어도 행렬의 빈자리는 지울 수 없었다. 부조의 다른 인물들은 지금도 아무도 없는 자리를 향해 고개를 숙이고 있다.',
      ],
    },
    links: { maps: ['sky-sanctum', 'sky-temple'] },
    tags: ['단서', '역사 개변'],
  }),
  E({
    id: 'lore-book-noble-lie',
    category: 'book',
    name: '고귀한 거짓말 — 낡은 「나라에 대하여」 필사본',
    summary: '도서관 철학 서가의 필사본. 여백에 누군가 단정한 글씨로 메모를 남겼다.',
    body: [
      '옛 철학자는 이렇게 썼다. "나라를 지키려면 다스리는 이가 시민에게 아름다운 이야기 하나를 들려주어야 한다 — 사람마다 금·은·쇠가 섞여 태어났으니 제 자리를 지키라는."',
      '책은 울토르 기록관이 기증한 장서다. 여백에는 오래된 잉크로 단정한 메모가 하나 있다. "아름다운 거짓은 무지한 진실보다 사람을 덜 다치게 한다."',
      '사서 오웬은 그 메모를 지우지 않았다. "누가 썼든, 생각해 볼 만한 문장이잖니."',
    ],
    unlock: { visit: 'academy-library' },
    revised: {
      flag: 'MIREL_TRUE_IDENTITY_FOUND',
      title: '고귀한 거짓말 — 여백의 필체',
      mode: 'append',
      body: [
        '여백의 글씨는 관리 일지의 글씨와 같았다. 미르엘은 자신이 고친 역사를 "모두를 덜 다치게 하는 이야기"라고 불렀다.',
        '하지만 그 이야기 때문에 다친 사람들 — 화산으로 밀려난 이들, 낙인찍힌 루스벨 — 은 이야기 밖에 서 있었다. 거짓이 아름다웠던 건, 그것을 듣는 쪽에서만이었다.',
      ],
    },
    links: { maps: ['academy-library'], npcs: ['npc-librarian'] },
    tags: ['철학', '단서'],
  }),
  E({
    id: 'lore-academy-theseus',
    category: 'academy',
    name: '교양 강좌 — 고쳐 지은 배',
    summary: '사서 오웬의 저녁 교양 강좌에서 나온 오래된 질문.',
    body: [
      '"항구에 오래된 배가 하나 있다. 썩은 널빤지를 하나씩 갈아 끼우다 보니, 백 년 뒤엔 처음 널빤지가 하나도 남지 않았지. 그건 아직 같은 배일까?"',
      '"그리고 누가 버려진 널빤지를 모아 다시 배를 지었다면 — 어느 쪽이 진짜 그 배일까?"',
      '그날 강좌는 답이 나오지 않은 채로 끝났다. 오웬은 "답은 시험에 안 나온다. 대신 언젠가 너희 앞에 나올 거다"라며 웃었다.',
    ],
    unlock: { week: 8 },
    revised: {
      flag: 'MORS_TRUTH_CONFIRMED',
      title: '고쳐 지은 배 — 다시 모이는 마음',
      mode: 'append',
      body: ['오백 년 동안 흩어져 있던 네 마음이 다시 모이면, 그는 예전의 왕일까 새로운 누군가일까. 강좌의 질문이 이제 시험이 아니라 선택으로 돌아왔다.'],
    },
    links: { npcs: ['npc-librarian'] },
    tags: ['철학'],
  }),
  E({
    id: 'lore-book-ash-garden',
    category: 'book',
    name: '재의 밭 일지',
    summary: '마물 마을 농부가 적어 둔 화산재 감자밭 일지.',
    body: [
      '"화산재는 처음엔 독이지만 삼 년을 묵히면 무엇이든 자라게 한다. 오늘 그분이 직접 재 감자를 캐셨다. 주먹 둘만 하다."',
      '"사람이 와서 다시 높은 자리로 오시라 청했다. 그분은 갓 구운 감자를 하나 건네며 웃으셨다 — \'이걸 직접 길러 봤다면 그런 말은 안 했을 텐데.\' 손님은 감자만 들고 돌아갔다."',
      '"내기 장기는 오늘도 그분이 졌다. 일부러 지시는 것 같다."',
    ],
    unlock: { visit: 'demon-village' },
    links: { maps: ['demon-village'] },
    tags: ['유배', '일상'],
  }),
  E({
    id: 'lore-book-frozen-penitent',
    category: 'book',
    name: '얼음 속의 참회자',
    summary: '오로라 마을에 전해 오는 겨울 옛이야기.',
    body: [
      '남쪽 사람들의 옛 노래는 가장 깊은 지옥이 불이 아니라 얼음이라고 한다. 거기엔 믿음을 저버린 자들이 갇힌다고.',
      '오로라 마을의 이야기는 조금 다르다. "가장 깊은 겨울에 스스로 걸어 들어가는 이는 죄인이 아니다. 제 안의 불이 남을 태울까 봐, 불을 식히러 오는 사람이다."',
      '그래서 이 마을 사람들은 눈보라 속에서 혼자 걷는 사람을 보면 쫓지 않고, 동굴 어귀에 따뜻한 수프를 두고 온다.',
    ],
    unlock: { visit: 'aurora-village' },
    links: { maps: ['aurora-village', 'ice-cave'], companions: ['comp-rusbel'] },
    tags: ['설원', '옛이야기'],
  }),
  E({
    id: 'lore-faith-blessed-fault',
    category: 'faith',
    name: '복된 탓 — 대성당 저녁 성가의 한 구절',
    summary: '"그 잘못이 없었다면, 이 구원도 없었으리."',
    body: [
      '대성당 저녁 기도에서 한 해에 한 번만 부르는 구절이다. 무너진 일이 있었기에 다시 세우는 일도 있었다는 뜻이라고 성녀는 설명한다.',
      '"잘못을 기뻐하라는 말이 아니에요. 잘못 뒤에도 끝이 아니라는 말이죠."',
    ],
    unlock: { flag: 'beat:EP_75_OPEN' },
    links: { npcs: ['npc-saint'] },
    tags: ['신학', '엔딩 주제'],
  }),

]

// ── 조회 ─────────────────────────────────────────────────────────────────────

type LoreState = Pick<GameState, 'storyFlags' | 'calendar'> & { visitedMaps?: MapId[] }

const on = (s: LoreState, flag: string) => !!s.storyFlags[flag] || !!s.storyFlags.DEBUG_UNLOCK_ALL

export function loreUnlocked(e: LoreEntry, s: LoreState): boolean {
  const u = e.unlock
  if (!u || s.storyFlags.DEBUG_UNLOCK_ALL) return true
  if (u.flag && !on(s, u.flag)) return false
  if (u.visit && !(s.visitedMaps ?? []).includes(u.visit)) return false
  if (u.week && s.calendar.globalWeek < u.week) return false
  return true
}

/** 지금 보여 줄 본문 — 진실이 밝혀졌으면 고쳐 쓰인 기록으로 */
export function loreView(e: LoreEntry, s: LoreState): { title: string; body: string[]; revised: boolean } {
  if (e.revised && on(s, e.revised.flag)) {
    const r = e.revised
    return { title: r.title, body: r.mode === 'append' ? [...e.body, ...r.body] : r.body, revised: true }
  }
  return { title: e.name, body: e.body, revised: false }
}

export const LORE_BY_ID = new Map(LORE.map((e) => [e.id, e]))
