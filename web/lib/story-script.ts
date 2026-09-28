// ============================================================================
// 《울토르 마법학교》 장기 스토리 대화집 v1.0 — 초안 배치 (2026-09-28)
//
// 대사 분량·세부 연출은 이후 수정 예정. 여기 있는 건 "어느 주에/어디서/무엇을 이기면" 어떤 장면이
// 나오는지의 배치와 초안 대사다. 형식은 lib/story.ts 의 StoryBeat 참고.
//
//   · hero: 'fire' | 'ice' | 'earth' — 삼원 주인공. 플레이어와 같은 속성이면 플레이어 이름/초상으로,
//     아니면 같은 속성 동기(리안 · 셀라 · 도란)가 말한다.
//   · 트리거 페이싱: 방문(VISIT)/전투(DEFEAT) 트리거는 minWeek 이전엔 발생하지 않는다.
//     조건 전에 그 맵을 가도 비트는 소모되지 않고, 조건이 된 뒤 다시 가면 나온다.
//   · 몬스터가 아직 없는 장면은 대체 연결: 해안 수호수 → 산호 여울 전투 승리,
//     홍련의 봉인수 → 용암 동굴의 화염 파수꾼.
//   · 지역 대응: 대화집의 "에르디아 해안" = 바다 해안·산호 여울, "스톰헤이븐(항구)" = 암초 해안·심해,
//     "하늘 유적" = 게임의 스톰헤이븐(하늘 도시) + 버려진 폐허.
// ============================================================================

import type { StoryBeat, StoryLine } from '@/lib/story'
import { globalWeekOf as W } from '@/lib/calendar'

// ── 화자 헬퍼 ──────────────────────────────────────────────────────────────────
const N = (text: string): StoryLine => ({ speaker: '', text })
const npc = (speaker: string, portraitId?: string) => (text: string): StoryLine => ({ speaker, portraitId, text })
const MIREL = npc('미르엘 교수', 'npc-job-trainer')
const OWEN = npc('사서 오웬', 'npc-librarian')
const VAN = npc('대장장이 반', 'npc-weapon')
const CELINE = npc('약사 셀린', 'npc-potion')
const MARENA = npc('어부 마레나', 'story-marena')
const LEON = npc('항만 길드장 레온', 'story-leon')
const NEREA = npc('연구자 네레아', 'story-nerea')
const HART = npc('설원 수렵가 하르트', 'story-hart')
const SER = npc('마족 세르', 'story-ser')
const GROT = npc('용암대장장이 그롯', 'npc-demon-smith')
const MORS = npc('모르스', 'story-mors')
const FIRE = (text: string): StoryLine => ({ speaker: '화염 주인공', hero: 'fire', text })
const ICE = (text: string): StoryLine => ({ speaker: '빙결 주인공', hero: 'ice', text })
const EARTH = (text: string): StoryLine => ({ speaker: '대지 주인공', hero: 'earth', text })

const beat = (id: string) => `beat:${id}`

export const SCRIPT_BEATS: StoryBeat[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // 프롤로그 — 입학 (1학년 1학기)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'P01_ENTRANCE',
    arcId: 'CH1_ERDIA',
    title: '입학식',
    trigger: { type: 'WEEK_START', week: W(1, 'semester1', 1) },
    setFlags: ['CH1_STARTED'],
    lines: [
      N('울토르 마법학교 중앙 광장.'),
      MIREL('울토르에 온 것을 환영한다.'),
      MIREL('여기서는 마법을 배우고, 전투를 배우고, 세상을 배운다.'),
      MIREL('그리고 언젠가는… 자신이 배운 것을 무엇을 위해 사용할 것인지 결정하게 될 거다.'),
      FIRE('진짜 여기서 4년이나 다니는 거야?'),
      EARTH('입학하자마자 졸업부터 걱정해?'),
      ICE('조용히 해. 수업 시작한다.'),
      MIREL('울토르에서 처음 배우게 될 것은 삼원이다.'),
      N('미르엘이 세 개의 마력 구체를 띄운다.'),
      MIREL('화염. 빙결. 대지.'),
      MIREL('모든 마법사는 여기서 시작한다.'),
    ],
  },
  {
    id: 'P02_HISTORY',
    arcId: 'CH1_ERDIA',
    title: '역사 수업',
    trigger: { type: 'WEEK_START', week: W(1, 'semester1', 2) },
    lines: [
      OWEN('인마대전이 끝난 것은 약 500년 전입니다.'),
      N('벽에 걸린 오래된 벽화.'),
      OWEN('인간은 마족을 쓰러뜨렸고, 마족에게서 얻은 힘으로 마법의 시대를 열었습니다.'),
      FIRE('마족에게서 힘을 얻었다는 거야?'),
      OWEN('공식 기록상으로는 그렇습니다.'),
      ICE('‘공식 기록상’이라니?'),
      N('오웬이 잠시 멈춘다.'),
      OWEN('…나중에 이야기하도록 하지요.'),
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CHAPTER 1 — 에르디아 숲 (1학년 1학기 ~ 여름방학)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'C1_01_FIRST_PRACTICE',
    arcId: 'CH1_ERDIA',
    title: '첫 실습',
    trigger: { type: 'VISIT', mapId: 'forest' },
    requiredFlags: ['CH1_STARTED'],
    lines: [
      MIREL('숲에서는 눈앞의 적보다, 적이 왜 그곳에 있는지를 먼저 봐라.'),
      FIRE('교수님, 저거 우리를 보고 있어요.'),
      EARTH('그리고 우리 쪽으로 오고 있고.'),
      ICE('말이 필요하나?'),
    ],
  },
  {
    id: 'C1_02_STRANGE_MONSTER',
    arcId: 'CH1_ERDIA',
    title: '이상한 몬스터',
    trigger: { type: 'DEFEAT', mapId: 'forest-2' },
    minWeek: W(1, 'semester1', 3),
    requiredFlags: [beat('C1_01_FIRST_PRACTICE')],
    lines: [
      CELINE('잠깐. 상처가 이상해.'),
      FIRE('독인가?'),
      CELINE('아니.'),
      ICE('마력이 비정상적으로 뒤틀렸군.'),
      MIREL('이 숲에서 최근 비슷한 사례를 본 적 있느냐?'),
      N('셀린이 고개를 젓는다.'),
      CELINE('없어요.'),
      N('미르엘의 표정이 굳는다.'),
      MIREL('그렇다면 조사할 가치가 있겠구나.'),
    ],
  },
  {
    id: 'C1_03_THORN_MATRIARCH',
    arcId: 'CH1_ERDIA',
    title: '가시어미 변이체',
    trigger: { type: 'VISIT', mapId: 'forest-3' },
    minWeek: W(1, 'semester1', 6),
    requiredFlags: [beat('C1_02_STRANGE_MONSTER')],
    lines: [
      EARTH('저거… 원래 저렇게 큰 몬스터였어?'),
      ICE('아니.'),
      FIRE('그럼 뭐야?'),
      MIREL('뒤로 물러나라.'),
      N('멀리서 거대한 가시어미가 모습을 드러낸다.'),
      MIREL('저건 자연적으로 발생한 변이가 아니다.'),
      npc('가시어미')('──────!'),
      FIRE('온다!'),
      ICE('집중해.'),
      EARTH('이번엔 도망 못 가게 하자.'),
    ],
  },
  {
    id: 'C1_05_SEAL_RESIDUE',
    arcId: 'CH1_ERDIA',
    title: '봉인 마력의 잔재',
    trigger: { type: 'DEFEAT', monsterId: 'mon-thorn-matriarch' },
    requiredFlags: [beat('C1_03_THORN_MATRIARCH')],
    setFlags: ['SEAL_RESIDUE_FOUND'],
    lines: [
      CELINE('안쪽에서 뭔가 나왔어.'),
      N('작은 검붉은 결정.'),
      ICE('마력핵?'),
      MIREL('아니다.'),
      N('잠시 침묵.'),
      MIREL('이건… 봉인 마력의 잔재다.'),
    ],
  },
  {
    id: 'C1_06_ANCIENT_GOLEM',
    arcId: 'CH1_ERDIA',
    title: '고대목 골렘',
    trigger: { type: 'VISIT', mapId: 'swamp' },
    minWeek: W(1, 'summer', 1),
    requiredFlags: ['SEAL_RESIDUE_FOUND'],
    lines: [
      N('숲 깊은 곳.'),
      OWEN('여기 기록과 같은 장소입니다.'),
      FIRE('기록?'),
      OWEN('500년 전, 인마대전 당시 봉인 의식이 이루어졌다는 기록입니다.'),
      N('땅이 흔들린다.'),
      ICE('설명은 나중에.'),
      npc('고대목 골렘')('……돌려……보내라……'),
      EARTH('방금 말했어?'),
      FIRE('저것도 말할 줄 아는 거야?'),
    ],
  },
  {
    id: 'C1_07_DOOR',
    arcId: 'CH1_ERDIA',
    title: '다시 열리는 문',
    trigger: { type: 'DEFEAT', monsterId: 'mon-ancient-bark-golem' },
    requiredFlags: [beat('C1_06_ANCIENT_GOLEM')],
    setFlags: ['ERDIA_CLEARED'],
    lines: [
      N('골렘이 무너진다.'),
      npc('고대목 골렘')('…문이… 다시… 열린다…'),
      FIRE('문?'),
      ICE('무슨 문이지?'),
      N('골렘이 흩어져 사라진다.'),
      MIREL('지금은 돌아간다.'),
      FIRE('교수님, 답을 안 해주시는데요.'),
      MIREL('나도 아직 모른다.'),
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CHAPTER 2 — 에르디아 해안 (1학년 2학기 ~ 겨울방학) — 일부러 템포를 낮춘다
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'C2_01_SHORE_PRACTICE',
    arcId: 'CH2_SHORE',
    title: '해안 실습',
    trigger: { type: 'WEEK_START', week: W(1, 'semester2', 1) },
    setFlags: ['CH2_STARTED'],
    lines: [
      MIREL('오늘은 전투 수업이 아니다.'),
      FIRE('정말요?'),
      MIREL('해안 생태 조사다.'),
      EARTH('와. 살았다.'),
      ICE('네가 왜 안도하는데.'),
    ],
  },
  {
    id: 'C2_02_MARENA',
    arcId: 'CH2_SHORE',
    title: '어부 마레나',
    trigger: { type: 'VISIT', mapId: 'sea' },
    requiredFlags: ['CH2_STARTED'],
    lines: [
      MARENA('학생들이 여기까지 무슨 일이래?'),
      EARTH('학교 실습이에요.'),
      MARENA('그럼 물고기보다 돌멩이부터 조심해.'),
      FIRE('돌멩이요?'),
      MARENA('요즘 해안에서 이상한 돌이 자꾸 올라오거든.'),
      N('마레나가 낚싯대를 건넨다.'),
      MARENA('바다는 기다리는 사람이 얻는 게 많아.'),
      FIRE('전 기다리는 거 잘 못하는데.'),
      ICE('그건 알아.'),
      EARTH('둘이 싸우지 말고 물고기나 잡아.'),
    ],
  },
  {
    id: 'C2_04_STRANGE_WAVES',
    arcId: 'CH2_SHORE',
    title: '해안의 밤',
    trigger: { type: 'VISIT', mapId: 'sea-2' },
    minWeek: W(1, 'semester2', 3),
    requiredFlags: [beat('C2_02_MARENA')],
    lines: [
      N('저녁.'),
      EARTH('저 바다… 이상하지 않아?'),
      ICE('파도가 일정하다.'),
      FIRE('누가 일부러 맞춘 것처럼?'),
      N('미르엘이 멀리 바다를 본다.'),
      MIREL('……그래.'),
      MIREL('바다는 저렇게 움직이지 않는다.'),
    ],
  },
  {
    id: 'C2_05_LIGHTHOUSE',
    arcId: 'CH2_SHORE',
    title: '오래된 등대',
    trigger: { type: 'WEEK_START', week: W(1, 'semester2', 8) },
    requiredFlags: ['CH2_STARTED'],
    lines: [
      N('오웬과 함께 폐등대를 조사한다.'),
      OWEN('이 등대는 최소 300년 이상 되었습니다.'),
      FIRE('그런데 왜 아직 불빛이 보여?'),
      N('침묵.'),
      ICE('누가 관리하고 있다는 뜻인가?'),
      N('오웬이 등대 안쪽의 문양을 본다.'),
      OWEN('아니.'),
      OWEN('이 불은 등대용 불이 아닙니다.'),
    ],
  },
  {
    id: 'C2_06_SHORE_RUIN',
    arcId: 'CH2_SHORE',
    title: '고대 해안 유적',
    trigger: { type: 'WEEK_START', week: W(1, 'semester2', 10) },
    requiredFlags: ['CH2_STARTED'],
    lines: [
      N('벽에 낡은 문장이 새겨져 있다.'),
      OWEN('……‘문을 잠그려면 바다를 잠재워라.’'),
      EARTH('무슨 뜻이지?'),
      OWEN('나도 모르겠습니다.'),
      ICE('교수님께 보여줘야겠군.'),
      OWEN('이번에는 보여드리기 전에… 내가 먼저 확인해야 할 것이 있습니다.'),
      N('오웬이 혼자 남는다.'),
    ],
  },
  {
    id: 'C2_07_GUARDIAN',
    arcId: 'CH2_SHORE',
    title: '해안 수호수',
    // TODO 해안 수호수 몬스터 미구현 — 지금은 겨울방학 중 산호 여울 전투 승리로 대체
    trigger: { type: 'DEFEAT', mapId: 'sea-2' },
    minWeek: W(1, 'winter', 1),
    requiredFlags: [beat('C2_06_SHORE_RUIN')],
    setFlags: ['SHORE_SHARD_FOUND'],
    lines: [
      N('여울 깊은 곳에서 해안 수호수가 몸을 일으킨다.'),
      MIREL('쓰러뜨려도 된다.'),
      MIREL('하지만 죽이지는 마라.'),
      FIRE('왜요?'),
      MIREL('이 녀석은 적이 아니라, 무언가를 지키고 있는 것 같구나.'),
      N('수호수가 물러난 자리에서 봉인의 파편이 발견되었다.'),
    ],
  },
  {
    id: 'C2_08_TO_STORMHAVEN',
    arcId: 'CH2_SHORE',
    title: '숲과 바다',
    trigger: { type: 'WEEK_END', week: W(1, 'winter', 12) },
    requiredFlags: ['SHORE_SHARD_FOUND'],
    setFlags: ['SHORE_CLEARED'],
    lines: [
      N('해안에서 찾은 파편과 숲에서 얻은 결정이 미세하게 반응한다.'),
      ICE('같은 마력이다.'),
      EARTH('숲과 바다가 연결돼 있었다는 거네.'),
      FIRE('그럼 다음은?'),
      N('미르엘이 바다 너머를 본다.'),
      MIREL('스톰헤이븐.'),
      MIREL('이제부터는 학생 실습이 아니다.'),
      MIREL('정식 조사가 필요하다.'),
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CHAPTER 3 — 스톰헤이븐 (2학년 1학기 ~ 여름방학) — 첫 대형 방학 원정
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'C3_01_ARRIVAL',
    arcId: 'CH3_STORMHAVEN',
    title: '스톰헤이븐 입항',
    trigger: { type: 'WEEK_START', week: W(2, 'summer', 1) },
    setFlags: ['CH3_STARTED'],
    lines: [
      LEON('울토르 학생들인가?'),
      FIRE('네.'),
      LEON('그럼 바다에서 사고 치지 마.'),
      EARTH('보통 그런 말을 먼저 하는 사람이 사고 치게 만들던데.'),
      N('레온이 웃는다.'),
      LEON('그 말은 기억해두지.'),
      LEON('스톰헤이븐은 바다로 사는 도시다.'),
      LEON('낚시꾼도, 상인도, 탐험가도 결국 바다에 빚지고 있지.'),
      ICE('최근 문제가 생겼다고 들었다.'),
      N('레온의 표정이 어두워진다.'),
      LEON('물고기가 사라졌다.'),
      LEON('그리고 밤마다 바다 밑에서 빛이 올라온다.'),
    ],
  },
  {
    id: 'C3_03_JELLY_QUEEN',
    arcId: 'CH3_STORMHAVEN',
    title: '바다 밑의 빛',
    trigger: { type: 'VISIT', mapId: 'sea-3' },
    requiredFlags: ['CH3_STARTED'],
    lines: [
      MARENA('저 빛을 따라가면 안 돼.'),
      FIRE('왜요?'),
      MARENA('사람을 부르는 빛도 있거든.'),
      npc('해파리 여왕')('……돌려보내라……'),
      FIRE('저거 또 말해!'),
      ICE('숲의 골렘과 같은 반응이다.'),
      EARTH('그럼 이것도 봉인하고 관련 있다는 거네.'),
    ],
  },
  {
    id: 'C3_05_MORS_SEAL',
    arcId: 'CH3_STORMHAVEN',
    title: '모르스의 인장',
    trigger: { type: 'DEFEAT', monsterId: 'mon-jelly-queen' },
    requiredFlags: [beat('C3_03_JELLY_QUEEN')],
    setFlags: ['MORS_SEAL_NAMED'],
    lines: [
      N('해파리 여왕의 핵에서 기억 같은 영상이 떠오른다.'),
      N('오래전 누군가가 바닷속에 거대한 문을 봉인하고 있다.'),
      MIREL('……모르스의 인장.'),
      FIRE('이제 이름까지 나왔네요.'),
      MIREL('그래.'),
      MIREL('그리고 여기서 끝나야 한다.'),
    ],
  },
  {
    id: 'C3_06_DEEP_RUIN',
    arcId: 'CH3_STORMHAVEN',
    title: '심해 유적',
    trigger: { type: 'VISIT', mapId: 'deepsea' },
    requiredFlags: ['MORS_SEAL_NAMED'],
    lines: [
      NEREA('당신들은 이걸 찾으러 온 건가요?'),
      ICE('알고 있었나?'),
      NEREA('스톰헤이븐의 연구자들은 오래전부터 알고 있었어요.'),
      NEREA('문제는 누구도 안쪽까지 들어갈 수 없었다는 거죠.'),
      npc('심해 암초왕')('인간이여.'),
      npc('심해 암초왕')('너희는 또 문을 열러 왔느냐.'),
      FIRE('우린 닫으러 왔는데.'),
      N('암초왕이 잠시 침묵한다.'),
      npc('심해 암초왕')('……그 말을 한 인간은 처음이다.'),
    ],
  },
  {
    id: 'C3_08_SEAL_PART',
    arcId: 'CH3_STORMHAVEN',
    title: '인장의 일부',
    trigger: { type: 'DEFEAT', monsterId: 'mon-reef-king' },
    requiredFlags: [beat('C3_06_DEEP_RUIN')],
    setFlags: ['REEF_KING_DOWN'],
    lines: [
      N('수중 유적 중앙에 인장이 떠오른다.'),
      NEREA('이게… 진짜 인장이라면…'),
      OWEN('아니.'),
      OWEN('이건 인장의 일부입니다.'),
      ICE('일부?'),
      OWEN('그렇다면 다른 곳에도 있습니다.'),
    ],
  },
  {
    id: 'C3_09_FAREWELL',
    arcId: 'CH3_STORMHAVEN',
    title: '돌아가기 전',
    trigger: { type: 'FLAG', flag: 'REEF_KING_DOWN' },
    setFlags: ['STORMHAVEN_CLEARED'],
    lines: [
      LEON('너희가 뭘 찾았는지는 모르겠지만…'),
      LEON('스톰헤이븐 사람들은 너희가 와준 걸 기억할 거다.'),
      EARTH('또 올 수 있을까요?'),
      LEON('바다는 늘 같은 곳에 있지.'),
      LEON('다만 사람이 달라지지.'),
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CHAPTER 4 — 하늘 유적 (2학년 2학기 ~ 겨울방학)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'C4_01_RETURN',
    arcId: 'CH4_SKY',
    title: '학교 복귀',
    trigger: { type: 'WEEK_START', week: W(2, 'semester2', 1) },
    setFlags: ['CH4_STARTED'],
    lines: [
      CELINE('살아 돌아왔네.'),
      FIRE('왜 다들 저희 볼 때마다 살아 돌아왔냐고 해요?'),
      CELINE('그게 중요한 거니까.'),
    ],
  },
  {
    id: 'C4_02_SKY_ANOMALY',
    arcId: 'CH4_SKY',
    title: '하늘 이상 현상',
    trigger: { type: 'WEEK_START', week: W(2, 'semester2', 3) },
    requiredFlags: ['CH4_STARTED'],
    lines: [
      N('학교 창밖. 하늘이 갈라지듯 빛난다.'),
      EARTH('저거 구름 아니야.'),
      ICE('마력 폭주다.'),
      MIREL('모두 움직이지 마라.'),
      N('잠시 후, 하늘에 오래된 구조물이 모습을 드러낸다.'),
    ],
  },
  {
    id: 'C4_03_SKY_RUIN',
    arcId: 'CH4_SKY',
    title: '하늘 유적',
    trigger: { type: 'VISIT', mapId: 'stormhaven' },
    requiredFlags: [beat('C4_02_SKY_ANOMALY')],
    lines: [
      OWEN('하늘 유적.'),
      OWEN('인마대전 이전부터 존재했다는 기록이 있습니다.'),
      FIRE('그럼 인간이 만든 게 아니란 거야?'),
      OWEN('그 점이 문제입니다.'),
    ],
  },
  {
    id: 'C4_04_UNDEAD_MAGE',
    arcId: 'CH4_SKY',
    title: '죽은 자의 기록자',
    trigger: { type: 'VISIT', mapId: 'ruins-2' },
    requiredFlags: [beat('C4_03_SKY_RUIN')],
    lines: [
      npc('언데드 마법사')('기록은 남아 있다.'),
      npc('언데드 마법사')('승자는 언제나 자기들이 옳았다고 적지.'),
      FIRE('당신은 누군데?'),
      npc('언데드 마법사')('죽은 자의 기록자.'),
      ICE('무슨 뜻이지?'),
      npc('언데드 마법사')('너희는 아직 진짜 역사를 본 적이 없다.'),
    ],
  },
  {
    id: 'C4_05_TITAN_KING',
    arcId: 'CH4_SKY',
    title: '석상 거인왕',
    trigger: { type: 'VISIT', mapId: 'graveyard' },
    requiredFlags: [beat('C4_04_UNDEAD_MAGE')],
    lines: [
      N('거대한 문이 열린다.'),
      npc('석상 거인왕')('침입자를… 처분한다.'),
    ],
  },
  {
    id: 'C4_06_SEAL_CRACK',
    arcId: 'CH4_SKY',
    title: '봉인 균열',
    trigger: { type: 'DEFEAT', monsterId: 'mon-stone-titan-king' },
    requiredFlags: [beat('C4_05_TITAN_KING')],
    setFlags: ['SKY_CLEARED'],
    lines: [
      N('전투가 끝나자 바닥에 균열이 번진다.'),
      MIREL('전원 뒤로!'),
      N('균열에서 마력이 폭발한다.'),
      OWEN('인장이 깨지는 게 아니야.'),
      OWEN('안에서 밀어내고 있습니다.'),
      ICE('누가?'),
      N('오웬은 대답하지 않는다.'),
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CHAPTER 5 — 설원 (3학년 1학기 ~ 여름방학) — 사건보다 사람과 진실
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'C5_01_SNOW_GATE',
    arcId: 'CH5_SNOWFIELD',
    title: '설원 입구',
    trigger: { type: 'VISIT', mapId: 'snowfield' },
    minWeek: W(3, 'semester1', 1),
    lines: [
      HART('불 마법사는 앞에.'),
      HART('얼음 마법사는 뒤에.'),
      FIRE('왜 나는 앞인데?'),
      HART('불을 가진 사람은 길을 밝혀야 하니까.'),
    ],
  },
  {
    id: 'C5_02_VILLAGE',
    arcId: 'CH5_SNOWFIELD',
    title: '작은 마을',
    trigger: { type: 'VISIT', mapId: 'aurora-village' },
    requiredFlags: [beat('C5_01_SNOW_GATE')],
    lines: [
      N('마을 주민들이 마족의 흔적을 무서워한다.'),
      EARTH('여기 사람들은 마족을 정말 싫어하네.'),
      HART('싫어하는 게 아니다.'),
      HART('두려워하는 거지.'),
    ],
  },
  {
    id: 'C5_03_SER',
    arcId: 'CH5_SNOWFIELD',
    title: '첫 마족',
    trigger: { type: 'VISIT', mapId: 'snowfield-3' },
    minWeek: W(3, 'summer', 1),
    requiredFlags: [beat('C5_02_VILLAGE')],
    setFlags: ['MET_SER'],
    lines: [
      N('눈밭에 부상당한 마족이 쓰러져 있다.'),
      N('화염 마법이 손끝에 모인다.'),
      ICE('잠깐.'),
      FIRE('마족이야.'),
      ICE('상처 입었다고.'),
      SER('……죽이지 않을 건가?'),
      EARTH('너도 말을 하네.'),
      SER('나는 싸우러 온 게 아니다.'),
      FIRE('그럼 뭘 하러 왔어?'),
      SER('기록을 찾으러.'),
      OWEN('어떤 기록?'),
      N('세르가 오래된 조각을 꺼낸다.'),
      SER('인마대전 이전의 기록.'),
    ],
  },
  {
    id: 'C5_05_PARTIAL_TRUTH',
    arcId: 'CH5_SNOWFIELD',
    title: '진실의 일부',
    trigger: { type: 'FLAG', flag: 'MET_SER' },
    setFlags: ['SNOWFIELD_CLEARED'],
    lines: [
      SER('모든 마족이 모르스를 따랐던 것은 아니다.'),
      FIRE('그럼 왜 인간이 다 죽였어?'),
      SER('모르지.'),
      SER('인간들이 무엇을 두려워했는지도.'),
      SER('우리도 무엇을 두려워했는지도.'),
      OWEN('……역사에는 이런 기록이 없습니다.'),
      SER('그러니까 사라진 거겠지.'),
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CHAPTER 6 — 화산지대 (3학년 2학기 ~ 겨울방학) — 제작/장비 성장과 연결
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'C6_01_VOLCANO_GATE',
    arcId: 'CH6_VOLCANO',
    title: '화산 입구',
    trigger: { type: 'VISIT', mapId: 'volcano' },
    minWeek: W(3, 'semester2', 1),
    lines: [
      VAN('여기서 살아남으면 장비 하나 정도는 새로 맞춰주지.'),
      FIRE('진짜요?'),
      VAN('먼저 살아남아.'),
    ],
  },
  {
    id: 'C6_02_FORGE',
    arcId: 'CH6_VOLCANO',
    title: '화산의 대장간',
    trigger: { type: 'VISIT', mapId: 'demon-village' },
    requiredFlags: [beat('C6_01_VOLCANO_GATE')],
    lines: [
      GROT('이 광석은 옛 봉인 구조와 같은 성질을 갖고 있어.'),
      VAN('그러면 이게 봉인 장치를 움직이는 핵심 재료였겠군.'),
    ],
  },
  {
    id: 'C6_03_MAP',
    arcId: 'CH6_VOLCANO',
    title: '진실에 가까워지다',
    trigger: { type: 'WEEK_START', week: W(3, 'winter', 1) },
    requiredFlags: [beat('C6_01_VOLCANO_GATE')],
    lines: [
      MIREL('에르디아. 해안. 스톰헤이븐. 하늘. 설원.'),
      MIREL('그리고 이곳.'),
      N('미르엘이 지도를 펼친다.'),
      MIREL('모든 지역에서 동일한 마력 반응이 확인됐다.'),
      EARTH('하나의 봉인을 여러 곳에 나눠놓은 거야?'),
      OWEN('아마도.'),
    ],
  },
  {
    id: 'C6_04_SEAL_BEAST',
    arcId: 'CH6_VOLCANO',
    title: '홍련의 봉인수',
    // TODO 홍련의 봉인수 몬스터 미구현 — 지금은 용암 동굴 방문 + 화염 파수꾼으로 대체
    trigger: { type: 'VISIT', mapId: 'lava-cave' },
    requiredFlags: [beat('C6_03_MAP')],
    lines: [
      npc('홍련의 봉인수')('봉인을 유지하라.'),
      npc('홍련의 봉인수')('돌아가라.'),
      ICE('지금까지 만난 것들과 똑같다.'),
    ],
  },
  {
    id: 'C6_05_SEAL_CORE',
    arcId: 'CH6_VOLCANO',
    title: '봉인의 핵심',
    trigger: { type: 'DEFEAT', monsterId: 'mon-flame-warden', mapId: 'lava-cave' },
    requiredFlags: [beat('C6_04_SEAL_BEAST')],
    setFlags: ['VOLCANO_CLEARED', 'SEAL_KNOWLEDGE'],
    lines: [
      N('봉인수가 쓰러지자 중앙에 고대 장치가 모습을 드러낸다.'),
      MIREL('이제 알겠다.'),
      FIRE('뭘요?'),
      MIREL('우리가 찾은 모든 것은 봉인을 강화하기 위한 부품이 아니었다.'),
      N('침묵.'),
      MIREL('봉인을 유지하기 위해 마력을 계속 빼내는 장치였어.'),
      ICE('그렇다면…'),
      OWEN('누군가의 힘을 계속 소모시키고 있다는 뜻입니다.'),
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FINAL — 모르스 (4학년 2학기)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'F01_LAST_TERM',
    arcId: 'FINAL_MORS',
    title: '마지막 학기',
    trigger: { type: 'WEEK_START', week: W(4, 'semester2', 1) },
    lines: [
      CELINE('마지막 학기인데도 얼굴이 다들 너무 굳었네.'),
      EARTH('졸업식보다 세상이 먼저 끝날 것 같아서요.'),
      N('셀린이 웃다가 표정을 바꾼다.'),
      CELINE('……농담이 아니구나.'),
    ],
  },
  {
    id: 'F02_SEAL_COLLAPSE',
    arcId: 'FINAL_MORS',
    title: '학교 봉인 붕괴',
    trigger: { type: 'WEEK_START', week: W(4, 'semester2', 4) },
    setFlags: ['FINAL_GATE_OPEN'],
    lines: [
      N('학교 전체에 경보가 울린다.'),
      MIREL('모두 움직이지 마라!'),
      OWEN('봉인 반응이 동시에 발생했습니다.'),
      ICE('모르스?'),
      OWEN('아직 아닙니다.'),
      OWEN('하지만 이제 가까워지고 있습니다.'),
    ],
  },
  {
    id: 'F03_FINAL_DOOR',
    arcId: 'FINAL_MORS',
    title: '최종문 앞',
    trigger: { type: 'VISIT', mapId: 'demon-castle' },
    requiredFlags: ['FINAL_GATE_OPEN'],
    setFlags: ['MORS_MET'],
    lines: [
      N('고대의 문 앞.'),
      FIRE('여기 뒤에 있는 게…'),
      MIREL('그래.'),
      MIREL('모르스다.'),
      EARTH('그럼 지금까지의 이야기는 전부 이걸 위한 거였어?'),
      MIREL('아니다.'),
      MIREL('너희가 이곳까지 온 이유는 싸우기 위해서가 아니다.'),
      N('문이 열린다.'),
      MORS('……인간이 또 왔군.'),
      FIRE('모르스.'),
      MORS('그래.'),
      MORS('네가 알고 있는 이름 그대로다.'),
    ],
  },
  {
    id: 'F05_TRUTH',
    arcId: 'FINAL_MORS',
    title: '인마대전의 진실',
    trigger: { type: 'FLAG', flag: 'MORS_MET' },
    setFlags: ['MORS_DIALOGUE'],
    lines: [
      ICE('왜 우리에게 공격하지 않지?'),
      MORS('이미 너희가 나를 공격할 이유를 알고 있으니까.'),
      FIRE('마족을 싫어하니까.'),
      MORS('그것도 인간에게 배운 이야기인가?'),
      N('침묵.'),
      MORS('500년 전.'),
      MORS('인간은 마족의 힘을 탐냈다.'),
      MORS('그리고 마족은 인간을 두려워했다.'),
      MORS('전쟁은 시작됐다.'),
      OWEN('공식 역사에서는 마족이 먼저 인간 세계를 공격했다고 기록되어 있습니다.'),
      MORS('기록은 승자의 것이라 하지 않았나?'),
      N('오웬이 대답하지 못한다.'),
      FIRE('그럼 네가 인간 세계를 없애려고 한 건 아니야?'),
      MORS('아니다.'),
      MORS('나는 문을 닫으려 했다.'),
      EARTH('무슨 문?'),
      MORS('인간과 마족의 세계 사이에 처음 열린 문.'),
      MORS('그 문을 연 것은 나도, 인간도 아니다.'),
      MORS('전쟁이 시작된 뒤, 너희들은 그 문을 이용했다.'),
      MORS('그리고 봉인은 완전하지 않았다.'),
      ICE('그래서 500년 동안 계속 힘을 빼앗은 건가.'),
      MORS('……그래.'),
    ],
  },
  {
    id: 'F09_BEFORE_CHOICE',
    arcId: 'FINAL_MORS',
    title: '마지막 선택',
    trigger: { type: 'FLAG', flag: 'MORS_DIALOGUE' },
    lines: [
      MIREL('이제 선택해야 한다.'),
      MIREL('너희가 배운 역사대로 싸울지.'),
      MIREL('아니면 직접 본 것을 믿을지.'),
      OWEN('나는 기록을 지키는 사람입니다.'),
      OWEN('하지만 기록이 사람보다 중요하다고 생각하지는 않습니다.'),
      CELINE('누군가를 살리는 방법이 꼭 누군가를 쓰러뜨리는 방법일 필요는 없어.'),
      VAN('무기 쥐었다고 꼭 휘둘러야 하는 건 아니다.'),
      MORS('학생.'),
      MORS('네가 여기까지 온 4년을 나는 보지 못했다.'),
      MORS('하지만 네가 지금 무엇을 선택하는지는 볼 수 있다.'),
      MORS('그러니 결정해라.'),
      MORS('나를 쓰러뜨릴 것인지.'),
      MORS('아니면… 이 오래된 싸움을 끝낼 것인지.'),
    ],
    choices: [
      { label: '봉인을 지킨다 — 모르스를 쓰러뜨린다', setFlags: ['ENDING_A', 'PRESERVATION_FLAG', 'ACADEMY_TRUST'] },
      { label: '공존을 택한다 — 싸움을 끝낸다', setFlags: ['ENDING_B', 'DEMON_TRUST'] },
    ],
  },
  {
    id: 'F_ENDING_A',
    arcId: 'FINAL_MORS',
    title: '봉인 유지',
    trigger: { type: 'FLAG', flag: 'ENDING_A' },
    lines: [
      MORS('……그렇군.'),
      MORS('인간은 결국 그렇게 선택하는가.'),
      MORS('그렇다면… 이번에는 너희 손으로 끝내라.'),
      N('(최종 전투 — 모르스 보스전 연결 예정)'),
    ],
  },
  {
    id: 'F_ENDING_B',
    arcId: 'FINAL_MORS',
    title: '공존',
    trigger: { type: 'FLAG', flag: 'ENDING_B' },
    lines: [
      FIRE('우리가 믿어온 이야기가 틀렸을 수도 있어.'),
      ICE('그렇다고 네 말을 무조건 믿을 수도 없다.'),
      EARTH('그러니까 직접 확인하자.'),
      MORS('……인간이 그런 말을 하는 날이 올 줄은 몰랐군.'),
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 졸업 (4학년 겨울방학)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: 'EP_GRADUATION',
    arcId: 'EPILOGUE',
    title: '졸업식',
    trigger: { type: 'WEEK_START', week: W(4, 'winter', 1) },
    lines: [
      MIREL('처음 학교에 들어왔을 때가 기억나느냐?'),
      FIRE('네.'),
      MIREL('그때의 너희는 마법을 잘 쓰는 학생이면 충분하다고 생각했겠지.'),
      EARTH('지금은요?'),
      N('미르엘이 미소 짓는다.'),
      MIREL('마법을 무엇에 쓸지 결정할 수 있는 사람이 되었구나.'),
    ],
  },
]
