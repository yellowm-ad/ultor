// ============================================================================
// NPC 주간 대사 풀 — 대화집 v1.0 「4년간 반복적으로 사용할 수 있는 NPC 주간 대사 풀」.
// NPC 대화창 첫 줄로 이번 주 대사 1개를 끼워 넣는다(주차 기준 결정론 선택, 같은 주엔 같은 대사).
//
//   분위기: 방학 직전(학기 11~12주) > 스토리 임박(2주 안에 주간 스토리 비트) > 평온
// ============================================================================

import type { GameState } from '@/lib/types'
import { calendarInfo } from '@/lib/calendar'
import { flagOn, STORY_BEATS } from '@/lib/story'

type Mood = 'calm' | 'story' | 'vacation'

interface LinePool {
  calm: string[]
  story?: string[]
  vacation?: string[]
  /** 이 플래그가 켜지면 이 대사들로 교체 */
  after?: { flag: string; lines: string[] }
  /** 스토리 단계별 대사 — 앞에서부터 차례로, 켜진 플래그 가운데 가장 뒤의 것을 쓴다(`EP_<주차>_DONE` = 그 막을 마침) */
  stages?: { flag: string; lines: string[] }[]
}

const POOLS: Record<string, LinePool> = {
  // ── 마을 사람들 — 메인 스토리가 지나간 자리마다 말이 달라진다(2026-10-10) ──
  'npc-archivist': {
    calm: ['조용히 보렴. 종이는 소리에도 닳는단다.', '오웬이 어릴 적엔 여기서 살다시피 했지. 그 애가 도서관으로 간 건 책이 더 많아서가 아니라, 빈 책장이 덜 보여서일 게다.'],
    stages: [
      { flag: 'FOUR_EMOTIONS_DISCOVERED', lines: ['네 얼굴의 벽화, 그리고 그 뒤의 우리 기록관 문장이라… 그렇다면 잘려 나간 쪽이 어디 있었는지는 알겠구나. 누가 잘랐는지가 남았지.'] },
      { flag: 'EP_132_DONE', lines: ['공식 발표문이 내려왔단다. 사본을 떠서 꽂아 두긴 하겠다만, 어느 책장에 꽂아야 할지 모르겠구나. 역사 칸인지, 지어낸 이야기 칸인지.'] },
    ],
  },
  'npc-guard': {
    calm: ['통문 밖은 학교 안과 다르다. 나갈 땐 반드시 동료와 함께.', '돌아오는 시간도 보고해라. 안 돌아오면 찾으러 가야 하니까.'],
    stages: [
      { flag: 'EP_23_DONE', lines: ['숲에서 돌아온 조사단 얼굴이 다들 굳어 있더군. 고목숲 안쪽은 당분간 조심해라.'] },
      { flag: 'EP_47_DONE', lines: ['바다 쪽 통문 근무가 늘었다. 심해에서 뭔가 올라왔다는 소문 때문이지.'] },
      { flag: 'EP_132_DONE', lines: ['…루스벨이라는 학생 수배 전단이 내려왔다. 나는 그 애가 통문을 지날 때마다 인사하던 걸 기억하는데.'] },
      { flag: 'EP_167_DONE', lines: ['화산 쪽에서 돌아왔다고? 살아 돌아온 것만으로 보고서 열 장 값은 한다.'] },
    ],
  },
  'npc-priest': {
    calm: ['성역의 종은 하루 세 번 울린단다. 길을 잃으면 종소리를 따라오렴.', '다친 곳은 없니? 기도는 다친 뒤보다 다치기 전에 하는 편이 좋단다.'],
    stages: [
      { flag: 'beat:EP_71_OPEN', lines: ['스톰헤이븐에서 성녀님의 사절이 오신다는구나. 신전이 생긴 뒤로 처음 있는 일이야.'] },
      { flag: 'beat:EP_75_OPEN', lines: ['성녀님께서 연못가에 머물고 계신단다. 궁금한 게 있으면 직접 여쭤 보렴.'] },
      { flag: 'EP_91_DONE', lines: ['왕의 마음이 넷으로 나뉘었다는 벽화 이야기… 신전의 기록에는 없는 내용이구나. 없는 것인지, 지워진 것인지.'] },
    ],
  },
  'npc-saint': {
    calm: ['빛이 그대와 함께하기를.', '기록은 쓰는 사람의 마음을 닮는답니다. 그래서 읽을 때는 누가 썼는지도 함께 읽어야 해요.'],
    stages: [
      { flag: 'EP_81_DONE', lines: ['천공 신전의 문장… "네 개로 나뉜 왕의 마음". 저도 처음 듣는 구절이었어요.'] },
      { flag: 'EP_95_DONE', lines: ['읽지 못한 문장이 자꾸 마음에 걸려요. 글자가 아니라, 누군가 읽지 못하게 만든 것 같아서.'] },
      { flag: 'EP_132_DONE', lines: ['공식 발표는 들었어요. 하지만 저는 그대가 본 것을 믿겠습니다.'] },
    ],
  },
  'npc-farmer': {
    calm: ['올해 순무가 실하게 들었어. 학생들 급식에 들어갈 거니 많이 먹어 둬.', '허수아비가 밤마다 조금씩 돌아서는 것 같은데… 기분 탓이겠지?'],
    stages: [
      { flag: 'EP_23_DONE', lines: ['숲 쪽 밭에 처음 보는 뿌리가 올라왔어. 뽑아도 뽑아도 다시 자라더라고.'] },
      { flag: 'EP_136_DONE', lines: ['겨울인데 밭이 안 얼어. 농사꾼한텐 좋은 일 같지? 아니야, 무서운 일이야.'] },
    ],
  },
  'npc-elder': {
    calm: ['쉬고 싶을 땐 언제든 오렴. 네 방은 늘 비워 둔단다.', '방을 꾸미는 건 마음을 정리하는 일이기도 하지. 가구는 핀 장인에게 부탁해 보렴.'],
    stages: [{ flag: 'EP_132_DONE', lines: ['루스벨 그 아이 방은 그대로 뒀단다. 돌아올 곳은 있어야 하니까.'] }],
  },
  'npc-arena': {
    calm: ['강해지고 싶으면 맞아 봐야 한다. 안전하게 맞는 곳이 투기장이지.', '이긴 날보다 진 날의 기록을 오래 들여다봐라.'],
    stages: [{ flag: 'EP_128_DONE', lines: ['폭주한 동기를 네 손으로 막았다지. 그건 승리가 아니야. 그래도 고개는 들고 다녀라.'] }],
  },
  // ── 아틀란티스 ──
  'npc-atlantis-elder': {
    calm: ['해류는 거짓말을 하지 않습니다. 다만 아주 천천히 말할 뿐이지요.', '대성당의 진주 제단은 보셨습니까? 밤에 보는 편이 더 아름답습니다.'],
    stages: [
      { flag: 'EP_39_DONE', lines: ['겨울 바다 밑의 불빛을 보셨군요. 우리는 그것을 "꺼지지 않는 광원"이라 부릅니다.'] },
      { flag: 'EP_47_DONE', lines: ['암초왕이 잠들자 해류가 바뀌었습니다. 오래 막혀 있던 것이 흐르기 시작한 느낌입니다.'] },
      { flag: 'EP_91_DONE', lines: ['지하 벽화실은 사제들도 잘 내려가지 않는 곳입니다. 네 얼굴이 우리를 내려다보는 것 같아서요.'] },
    ],
  },
  'npc-atlantis-merchant': {
    calm: ['진주는 흠 없는 것보다 사연 있는 것이 비쌉니다.', '뭍에서 온 손님에겐 조개 한 줌 덤입니다. 소문 좀 내 주세요.'],
    stages: [{ flag: 'EP_43_DONE', lines: ['해파리 여왕이 사라지고 나서 잠수부들이 다시 깊은 데까지 내려가요. 덕분에 진주 값이 내렸지 뭡니까.'] }],
  },
  'npc-atlantis-child': {
    calm: ['뭍사람은 정말 아가미가 없어? 그럼 물속에서 하품은 어떻게 해?', '보글 아저씨는 맨날 보물을 건져 와. 대부분 소르 누나 컵이지만.'],
  },
  // ── 천공 신전 ──
  'npc-sky-priest': {
    calm: ['바람은 묻는 자에게만 답합니다. 무엇을 물으러 오셨습니까.', '이 높이에서는 거짓말이 멀리까지 들립니다. 그래서 다들 말을 아끼지요.'],
    stages: [
      { flag: 'EP_81_DONE', lines: ['대신전의 문이 열린 것은 제가 사제가 된 뒤 처음입니다. 문이 사람을 고른 것이겠지요.'] },
      { flag: 'KING_MET', lines: ['폐하께서 이곳에 머무신 뒤로 바람이 잦아들었습니다. 조용한 것이 꼭 좋은 징조는 아닙니다.'] },
    ],
  },
  'npc-sky-keeper': {
    calm: ['종은 제가 치는 게 아니에요. 바람이 치고, 저는 줄을 잡고 있을 뿐이에요.', '풍선 장수 파랑이 또 줄을 종탑에 걸어 놨어요. 못 본 척해 주세요.'],
  },
  // ── 버려진 신전 ──
  'npc-abandoned-monk': {
    calm: ['여기서는 낮게 말하게. 돌들이 듣고 있으니.', '기도란 대답을 듣는 일이 아니라, 묻기를 그치지 않는 일이지.'],
    stages: [
      { flag: 'EP_119_DONE', lines: ['신전 안쪽의 문은 열지 말라고 했건만. …아니, 자네를 탓하는 게 아닐세. 닫아 둔 쪽의 잘못이지.'] },
      { flag: 'EP_130_DONE', lines: ['노(怒)는 죽지 않네. 누군가의 가슴으로 옮겨 갈 뿐이지. 그 아이를 미워하지 말게.'] },
    ],
  },
  'npc-abandoned-scholar': {
    calm: ['이 벽의 글자는 세 번 덧쓰였어요. 맨 아래 글자가 진짜고, 위의 두 겹은 누군가의 변명이죠.', '탁본 뜰 때는 숨도 참아요. 이백 년 묵은 먼지는 생각보다 예민하거든요.'],
    stages: [
      { flag: 'EP_108_DONE', lines: ['봉인 구조를 다시 그려 봤어요. 가두는 모양이 아니라… 나눠 담는 모양이에요.'] },
      { flag: 'EP_130_DONE', lines: ['고대문자 단서, 잘 간직하세요. 읽을 줄 아는 사람이 이 대륙에 한 손으로 꼽힐 테니.'] },
    ],
  },
  // ── 오로라 마을 ──
  'npc-aurora-chief': {
    calm: ['눈은 우리 집이고, 길이고, 달력이다. 눈이 말해 주는 대로 산다.', '사우나는 다녀왔나? 올가의 불은 사십 년 동안 한 번도 꺼진 적이 없다.'],
    stages: [
      { flag: 'EP_136_DONE', lines: ['만년설이 녹고 있다. 할아버지의 할아버지 때도 없던 일이다.'] },
      { flag: 'EP_147_DONE', lines: ['녹은 눈 밑에서 석비가 드러났다. 우리 부족 누구도 그런 것이 있는 줄 몰랐다.'] },
      { flag: 'EP_156_DONE', lines: ['불을 품은 아이가 동굴에 있었다지. …미워하지는 않는다. 그 아이도 춥고 싶었을 것이다.'] },
    ],
  },
  'npc-aurora-trader': {
    calm: ['털옷은 한 치수 크게 사. 안에 한 벌 더 껴입게 될 테니까.', '뭍 동전도 받아. 대신 얼음 동전으로 거슬러 줄 거야. 녹기 전에 써.'],
    stages: [{ flag: 'EP_136_DONE', lines: ['요즘은 털옷보다 부채가 잘 팔려. 설원에서 부채라니, 장사 삼십 년에 처음이야.'] }],
  },
  'npc-aurora-hunter': {
    calm: ['발자국은 짐승의 일기다. 읽을 줄 알면 굶지 않아.', '사냥꾼 캠프에서 생존 훈련을 한다. 죽지 않을 자신이 있으면 와 봐.'],
    stages: [{ flag: 'EP_153_DONE', lines: ['동굴 쪽 눈이 검게 그을려 있었다. 짐승의 짓이 아니야. 사람의 불이다.'] }],
  },
  // ── 마물 마을 ──
  'npc-demon-elder': {
    calm: ['인간의 책에 적힌 마왕과 우리가 아는 그분은 다른 분이오.', '무서워 말고 둘러보시오. 뿔이 있다고 다 들이받는 것은 아니니.'],
    stages: [
      { flag: 'EP_160_DONE', lines: ['용암 강을 건너왔다는 것만으로 젊은 것들이 술렁이오. 인간이 걸어서 온 것은 백 년 만이니.'] },
      { flag: 'EP_167_DONE', lines: ['성으로 가시오. 그분은 기다리는 데 익숙하지만, 기다림이 좋아서 익숙한 것은 아니라오.'] },
    ],
  },
  'npc-demon-smith': {
    calm: ['화산 불로 벼린 물건이다. 뭍 대장간 것과 비교하지 마라.', '인간 손은 작아서 자루를 다시 깎아야 해. 수고비는 받는다.'],
  },
  'npc-demon-child': {
    calm: ['인간이다! 뿔 없는 거 진짜였네…', '뿔리 형은 인간 가게에서 일해. 멋있지? 나도 크면 거스름돈 셀 거야.'],
  },
  'npc-job-trainer': {
    calm: ['이번 주에는 전투보다 복습이 중요하다.', '강해지는 것과 서두르는 것은 같은 말이 아니란다.'],
    story: ['요즘 마력이 이상하게 흔들리고 있구나.', '이번 주는 특히 혼자 움직이지 않도록 하거라.'],
    vacation: ['방학이라고 해서 공부가 끝나는 것은 아니다.', '오히려 학교 밖에서 배울 것이 더 많을 수도 있지.'],
  },
  'npc-librarian': {
    calm: ['오늘은 신간이 들어왔습니다.', '그 책은 아직 네가 읽을 때가 아닙니다.', '이 기록은… 나중에 이야기합시다.'],
    after: { flag: 'FOUR_EMOTIONS_DISCOVERED', lines: ['예전에 했던 질문에 답할 때가 된 것 같군요.'] },
  },
  'npc-weapon': {
    calm: ['장비 점검은 했나?', '새 장비가 필요하면 먼저 지금 장비가 왜 부족한지부터 생각해.', '망가진 장비는 솔직하다. 관리가 부족했다는 뜻이니까.'],
  },
  'npc-potion': {
    calm: ['오늘은 다친 학생이 유난히 많네.', '포션은 많이 들고 다닐수록 좋은 게 아니라, 제대로 쓰는 게 중요해.', '무사히 돌아오는 것도 실력이다.'],
  },
}

function moodOf(state: Pick<GameState, 'calendar' | 'storyFlags'>): Mood {
  const gw = state.calendar.globalWeek
  const info = calendarInfo(gw)
  if (!info.isVacation && info.week >= 11) return 'vacation'
  const soon = STORY_BEATS.some(
    (b) => b.trigger.type === 'WEEK_START' && b.trigger.week > gw && b.trigger.week <= gw + 2 && !flagOn(state, `beat:${b.id}`),
  )
  return soon ? 'story' : 'calm'
}

/** 이번 주 이 NPC 의 주간 대사(없으면 null) */
export function npcWeeklyLine(npcId: string, state: Pick<GameState, 'calendar' | 'storyFlags'>): string | null {
  const pool = POOLS[npcId]
  if (!pool) return null
  const gw = state.calendar.globalWeek
  let lines = pool.calm
  const stage = [...(pool.stages ?? [])].reverse().find((s) => flagOn(state, s.flag))
  if (stage) lines = stage.lines
  else if (pool.after && flagOn(state, pool.after.flag)) lines = pool.after.lines
  else {
    const mood = moodOf(state)
    lines = pool[mood] ?? pool.calm
  }
  return lines[gw % lines.length]
}
