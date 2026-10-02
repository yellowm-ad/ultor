// ============================================================================
// 수업 미니게임 콘텐츠 데이터 — 퀴즈 문제은행 · 영창 · 실습 도구 뽑기표 · 시약 레시피 (통합 PRD §16~20)
// 순수 데이터. 문제/영창은 여기에 한 줄씩 추가하면 바로 출제된다.
// ============================================================================

import type { RhythmStyle } from '@/lib/curriculum'

// ─────────────────────────────────────────────────────────────────────────────
// 1. 지식 퀴즈(§16)
// ─────────────────────────────────────────────────────────────────────────────
export type QuizCategory = 'world' | 'magic' | 'math' | 'nature' | 'time' | 'ethics' | 'manners'
export const QUIZ_CATEGORY_LABEL: Record<QuizCategory, string> = {
  world: '울토르 역사·지리',
  magic: '마법 상식',
  math: '산술',
  nature: '동식물',
  time: '시간·달력',
  ethics: '윤리',
  manners: '예절',
}
export interface QuizQuestion {
  id: string
  cat: QuizCategory
  q: string
  choices: string[]
  answer: number // choices 인덱스
  minYear?: number
}
const Q = (id: string, cat: QuizCategory, q: string, choices: string[], answer: number, minYear?: number): QuizQuestion => ({ id, cat, q, choices, answer, minYear })

export const QUIZ_BANK: QuizQuestion[] = [
  // ── 세계관 ──
  Q('w1', 'world', '울토르 마법학교에서 1학년이 가장 먼저 배우는 "삼원"이 아닌 것은?', ['화염', '빙결', '대지', '바람'], 3),
  Q('w2', 'world', '인마대전이 끝난 것은 지금으로부터 약 몇 년 전인가?', ['200년', '500년', '2,000년', '20,000년'], 2),
  Q('w3', 'world', '인마대전 끝에 봉인되었다고 전해지는 악마왕의 이름은?', ['세르', '모르스', '그롯', '레온'], 1),
  Q('w4', 'world', '하늘 위에 떠 있는 도시이자 천공 신전이 있는 곳은?', ['스톰헤이븐', '아틀란티스', '오로라 마을', '마물 마을'], 0),
  Q('w5', 'world', '바다 깊은 곳에 잠든 수중 도시의 이름은?', ['루미나', '아틀란티스', '에르디아', '울토르'], 1),
  Q('w6', 'world', '학교에서 가장 가까운 첫 야외 실습지는?', ['화산지대', '루미나 설원', '에르디아 숲', '버려진 폐허'], 2),
  Q('w7', 'world', '울토르의 정규 과정은 몇 년제인가?', ['2년', '3년', '4년', '6년'], 2),
  Q('w8', 'world', '오로라 마을이 있는 지역은?', ['루미나 설원', '화산지대', '에르디아 해안', '하늘 유적'], 0),
  Q('w9', 'world', '용암과 마물 마을이 있는 지역은?', ['에르디아 숲', '화산지대', '스톰헤이븐', '해안'], 1),
  Q('w10', 'world', '울토르가 세워진 목적과 가장 가까운 것은?', ['마족을 정복하기 위해', '전쟁 이후 마법을 바르게 가르치기 위해', '왕실의 금고를 지키기 위해', '바다 무역을 독점하기 위해'], 1),
  Q('w11', 'world', '인마대전의 기록에 대해 오웬 사서가 강조한 것은?', ['기록은 쓰는 사람의 편일 수 있다', '모든 기록은 완벽하다', '기록은 읽을 필요가 없다', '전쟁은 없었다'], 0, 2),
  Q('w12', 'world', '온건파 마족과 처음 마주치게 되는 지역은?', ['루미나 설원', '에르디아 숲', '해안', '학교 도서관'], 0, 2),
  // ── 마법 상식 ──
  Q('m1', 'magic', '주인공(학생)이 끝까지 배울 수 없는 속성은?', ['화염', '빛', '어둠', '바람'], 3),
  Q('m2', 'magic', '어둠 계열 즉사 술식이 보스에게 쓰였을 때의 결과는?', ['즉사한다', '피해 0 · 효과 없음', 'HP가 절반이 된다', '보스가 도망간다'], 1),
  Q('m3', 'magic', '전위 포지션의 보너스는?', ['주는 피해 +10%', '회복량 +10%', '최대 HP +10%', '이동 속도 +10%'], 0),
  Q('m4', 'magic', '후위 포지션의 보너스는?', ['주는 피해 +10%', '회복량 +10%', '최대 HP +10%', '방어력 +10%'], 1),
  Q('m5', 'magic', '화상·출혈과 가장 관련 깊은 원소는?', ['화염', '빙결', '대지', '빛'], 0),
  Q('m6', 'magic', '감속·마비 같은 제어와 가장 관련 깊은 원소는?', ['화염', '빙결', '대지', '어둠'], 1),
  Q('m7', 'magic', '치유·부활·정화를 담당하는 속성은?', ['어둠', '빛', '대지', '화염'], 1),
  Q('m8', 'magic', '어둠·빛 수업은 몇 학년부터 들을 수 있나?', ['1학년', '2학년', '3학년', '4학년'], 2),
  Q('m9', 'magic', '마나를 다룰 때 미르엘 교수가 강조한 원칙은?', ['억지로 밀어붙이면 되튄다', '많을수록 무조건 좋다', '숨을 참아야 한다', '눈을 감아야 한다'], 0),
  Q('m10', 'magic', '펫은 진형의 어느 칸에서 함께 싸우나?', ['펫 고정 칸', '후위만', '지원만', '참가하지 않는다'], 0),
  // ── 산술 ──
  Q('a1', 'math', '마력석이 한 상자에 8개 들어 있다. 4상자를 사서 3개를 쓰면 남는 마력석은?', ['26개', '29개', '32개', '35개'], 1),
  Q('a2', 'math', '물약 하나가 25골드일 때 6개의 가격은?', ['125골드', '150골드', '175골드', '200골드'], 1),
  Q('a3', 'math', '약초 36개를 4명이 똑같이 나누면 한 명당?', ['6개', '8개', '9개', '12개'], 2),
  Q('a4', 'math', '파티 4명이 몬스터 경험치 200을 나눈다(보너스 없음). 1인당?', ['40', '50', '60', '80'], 1),
  Q('a5', 'math', '7 × 8 − 6 = ?', ['48', '50', '52', '56'], 1),
  Q('a6', 'math', '골드 500에서 장비 175, 물약 90을 사면 남는 골드는?', ['215', '225', '235', '245'], 2),
  Q('a7', 'math', '한 학기 12주, 1년에 학기 2번과 방학 2번이면 1년은 몇 주?', ['24주', '36주', '48주', '52주'], 2),
  Q('a8', 'math', '마나 120 중 35%를 쓰면 남는 마나는?', ['42', '72', '78', '85'], 2, 2),
  // ── 동식물 ──
  Q('n1', 'nature', '독버섯을 맨손으로 채집하면 생길 수 있는 위험은?', ['손이 빨라진다', '피부 염증·중독', '마력이 늘어난다', '아무 일도 없다'], 1),
  Q('n2', 'nature', '약초를 채집할 때 다음 해를 위해 지켜야 할 것은?', ['뿌리째 모두 뽑는다', '뿌리는 남기고 일부만 딴다', '불로 태운 뒤 딴다', '밤에만 딴다'], 1),
  Q('n3', 'nature', '바닷속 생물이 아닌 것은?', ['해파리', '산호', '두더지', '해마'], 2),
  Q('n4', 'nature', '나방이 밤에 불빛 근처로 모여드는 이유와 가장 가까운 것은?', ['빛을 길잡이로 삼는 습성', '불을 먹기 위해', '추워서 얼어 죽지 않으려고', '사냥하려고'], 0),
  Q('n5', 'nature', '식물이 햇빛으로 양분을 만드는 과정은?', ['광합성', '증산', '발효', '부식'], 0),
  Q('n6', 'nature', '숲에서 낯선 야생동물 새끼를 발견했을 때 적절한 행동은?', ['바로 안아 든다', '먹이를 억지로 준다', '거리를 두고 어미가 있는지 살핀다', '소리를 질러 쫓는다'], 2),
  Q('n7', 'nature', '추운 설원에서 사는 동물에게 흔한 특징은?', ['두꺼운 털이나 지방층', '얇은 피부', '아가미', '날개만 있음'], 0),
  // ── 시간·달력 ──
  Q('t1', 'time', '수업 50분 + 쉬는 시간 10분. 9시에 1교시를 시작하면 3교시가 끝나는 시각은?', ['11시 30분', '11시 50분', '12시', '12시 10분'], 1),
  Q('t2', 'time', '울토르 달력에서 1학기 다음에 오는 것은?', ['2학기', '여름방학', '겨울방학', '졸업식'], 1),
  Q('t3', 'time', '하루는 몇 시간인가?', ['12시간', '20시간', '24시간', '30시간'], 2),
  Q('t4', 'time', '오후 3시를 24시간제로 쓰면?', ['13시', '15시', '18시', '03시'], 1),
  Q('t5', 'time', '중간고사는 학기의 몇 주차에 치르나?', ['3주차', '7주차', '10주차', '12주차'], 1),
  Q('t6', 'time', '1시간 45분 뒤가 6시 10분이라면 지금은?', ['4시 15분', '4시 25분', '4시 35분', '4시 45분'], 1),
  // ── 윤리 ──
  Q('e1', 'ethics', '위험한 마도구를 발견했을 때 가장 적절한 행동은?', ['몰래 가져간다', '직접 시험해 본다', '건드리지 않고 교수에게 알린다', '친구에게 던진다'], 2),
  Q('e2', 'ethics', '시험 중 친구의 답안이 보였다. 올바른 행동은?', ['베낀다', '내 답안에 집중한다', '친구에게 신호를 보낸다', '시험지를 찢는다'], 1),
  Q('e3', 'ethics', '전투에서 이미 항복한 적에게 해야 할 것은?', ['끝까지 공격한다', '공격을 멈추고 상황을 판단한다', '물건을 빼앗는다', '놀린다'], 1),
  Q('e4', 'ethics', '동료의 실수로 실습이 실패했다. 바람직한 반응은?', ['모두 앞에서 탓한다', '함께 원인을 찾고 다시 한다', '혼자 빠진다', '교수에게 몰래 이른다'], 1),
  Q('e5', 'ethics', '마족이라는 이유만으로 도움을 거절하는 것은?', ['편견일 수 있어 사정을 먼저 들어본다', '당연하다', '무조건 공격한다', '도망친다'], 0, 2),
  // ── 예절 ──
  Q('p1', 'manners', '교수 연구실에 들어갈 때 먼저 해야 할 행동은?', ['문을 두드리고 허락을 구한다', '바로 문을 연다', '창문으로 들어간다', '소리 지른다'], 0),
  Q('p2', 'manners', '도서관에서 지켜야 할 예절은?', ['큰 소리로 영창 연습', '조용히 하고 책을 제자리에', '책장에 낙서', '음식을 먹으며 책 읽기'], 1),
  Q('p3', 'manners', '수업에 늦었을 때 적절한 행동은?', ['조용히 들어가 수업 후 사과한다', '문을 쾅 닫는다', '교수에게 이유를 크게 외친다', '그냥 결석한다'], 0),
  Q('p4', 'manners', '처음 만난 마을 어른에게 인사할 때는?', ['반말로 묻는다', '공손하게 인사하고 이름을 밝힌다', '모른 척 지나간다', '손가락질한다'], 1),
  Q('p5', 'manners', '실습실 공용 도구를 다 쓴 뒤에는?', ['그대로 둔다', '닦아서 제자리에 둔다', '내 방으로 가져간다', '숨겨 둔다'], 1),
]

// ─────────────────────────────────────────────────────────────────────────────
// 2. 마법 리듬 실습(§17) — 4레인 낙하 노트. 원소별 박자 패턴
// ─────────────────────────────────────────────────────────────────────────────
export interface RhythmNote {
  t: number // ms (판정선 도달 시각)
  lane: number // 0~3
  fake?: boolean // 어둠: 누르면 감점되는 환영 노트
}
export const RHYTHM_STYLE_META: Record<RhythmStyle, { bpm: number; label: string; color: string }> = {
  fire: { bpm: 150, label: '빠르고 강한 박자', color: '#ff7a3a' },
  ice: { bpm: 96, label: '느리고 규칙적인 박자', color: '#7fd4ff' },
  earth: { bpm: 84, label: '무겁고 긴 박자', color: '#b4c05a' },
  light: { bpm: 112, label: '후반 동시 타이밍', color: '#ffe27a' },
  dark: { bpm: 108, label: '환영 노트 주의', color: '#b07aff' },
  neutral: { bpm: 104, label: '기본 박자', color: '#d8c49a' },
}
/** 시드 고정 난수로 패턴 생성 — 라운드당 ≈ 12초 */
export function buildRhythmChart(style: RhythmStyle, year: number, rand: () => number, round = 0): RhythmNote[] {
  const { bpm } = RHYTHM_STYLE_META[style]
  const beat = 60000 / (bpm * (1 + round * 0.08)) // 라운드마다 템포 +8%
  const total = 12000 // 라운드당 약 12초(3라운드)
  const notes: RhythmNote[] = []
  const lead = 1800 // 첫 노트까지
  let lastLane = -1
  const lane = () => {
    let l = Math.floor(rand() * 4)
    if (l === lastLane) l = (l + 1 + Math.floor(rand() * 3)) % 4
    lastLane = l
    return l
  }
  for (let t = lead, i = 0; t < total; i++) {
    const late = t > total * 0.55
    if (style === 'fire') {
      notes.push({ t, lane: lane() })
      t += rand() < 0.35 + year * 0.05 ? beat / 2 : beat
    } else if (style === 'ice') {
      notes.push({ t, lane: [0, 1, 2, 3, 2, 1][i % 6] })
      t += beat
    } else if (style === 'earth') {
      notes.push({ t, lane: lane() })
      t += beat * (i % 3 === 2 ? 2 : 1)
    } else if (style === 'light') {
      notes.push({ t, lane: lane() })
      if (late && i % 2 === 0) notes.push({ t, lane: (lastLane + 2) % 4 })
      t += beat
    } else if (style === 'dark') {
      notes.push({ t, lane: lane() })
      if (rand() < 0.22) notes.push({ t: t + beat / 2, lane: lane(), fake: true })
      t += beat
    } else {
      notes.push({ t, lane: lane() })
      t += rand() < 0.2 ? beat / 2 : beat
    }
  }
  return notes
}
export const RHYTHM_WINDOWS = { perfect: 60, great: 110, good: 170 } // ms
export const RHYTHM_KEYS = ['d', 'f', 'j', 'k']

// ─────────────────────────────────────────────────────────────────────────────
// 3. 영창 암기(§18)
// ─────────────────────────────────────────────────────────────────────────────
export const CHANT_SETS: Record<string, string[]> = {
  base: ['마나 집중', '촉매 개방', '원소 결집', '술식 고정', '발동'],
  fire: ['숨 고르기', '불씨 점화', '열기 압축', '화염 각인', '방향 지정', '연소 가속', '폭염 해방', '잔화 정리'],
  ice: ['마나 냉각', '수분 응결', '결정 성장', '서리 각인', '형태 고정', '냉기 확산', '빙결 해방', '여운 봉합'],
  earth: ['발 디딤', '지맥 감지', '흙 결속', '암석 각인', '중량 고정', '진동 전달', '대지 해방', '지반 안정'],
  light: ['마음 정화', '광원 인식', '빛 모으기', '축복 각인', '대상 지정', '광휘 확산', '치유 해방', '잔광 회수'],
  dark: ['그림자 응시', '시야 차단', '환영 직조', '낙인 새기기', '대상 고립', '침묵 확산', '어둠 해방', '흔적 지우기'],
  seal: ['봉인진 확인', '열쇠 문양', '마력 역류 차단', '사슬 각인', '중심 고정', '소모 경로 연결', '봉인 갱신', '균열 점검'],
}
/** 학년별 조각 수(§18) — 1학년 3~4 · 2학년 5 · 3학년 6~7 · 4학년 8 */
export const chantLength = (year: number, rand: () => number) => (year <= 1 ? 3 + Math.floor(rand() * 2) : year === 2 ? 5 : year === 3 ? 6 + Math.floor(rand() * 2) : 8)
export function chantSetFor(style: RhythmStyle, courseId: string): string[] {
  if (courseId.startsWith('SEAL') || courseId.startsWith('LOSTWIND')) return CHANT_SETS.seal
  if (style === 'neutral') return [...CHANT_SETS.base, '여운 정리', '마나 회수', '술식 해제']
  return CHANT_SETS[style] ?? CHANT_SETS.base
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. 실습 도구 뽑기(§19) — 현금형 가챠가 아니라 수업용 랜덤 실습물
// ─────────────────────────────────────────────────────────────────────────────
export type DrawRarity = 'common' | 'uncommon' | 'rare' | 'odd'
export const DRAW_RARITY_META: Record<DrawRarity, { label: string; color: string; score: number }> = {
  common: { label: '일반', color: '#c8c0b0', score: 55 },
  uncommon: { label: '고급', color: '#6fd08a', score: 72 },
  rare: { label: '희귀', color: '#6fb4ff', score: 90 },
  odd: { label: '수상한 물건', color: '#d08aff', score: 100 },
}
export interface DrawEntry {
  itemId: string
  rarity: DrawRarity
  weight: number
  qty: number
  note: string
}
export const DRAW_TABLE: DrawEntry[] = [
  { itemId: 'herb-mint', rarity: 'common', weight: 14, qty: 3, note: '실험용 허브' },
  { itemId: 'mush-button', rarity: 'common', weight: 12, qty: 3, note: '평범한 단추버섯' },
  { itemId: 'flower-dew', rarity: 'common', weight: 12, qty: 2, note: '이슬꽃' },
  { itemId: 'ore-iron', rarity: 'common', weight: 10, qty: 2, note: '깨진 완드 부품용 철' },
  { itemId: 'wood-oak', rarity: 'common', weight: 10, qty: 2, note: '실습용 목재' },
  { itemId: 'potion-hp-s', rarity: 'uncommon', weight: 8, qty: 2, note: '예비 회복약' },
  { itemId: 'crystal-mana', rarity: 'uncommon', weight: 8, qty: 1, note: '일반 마력석' },
  { itemId: 'candy-mana-s', rarity: 'uncommon', weight: 7, qty: 1, note: '조교가 흘린 마력캔디' },
  { itemId: 'mush-glow', rarity: 'uncommon', weight: 6, qty: 1, note: '빛버섯' },
  { itemId: 'alch-catalyst', rarity: 'rare', weight: 3, qty: 1, note: '희귀 촉매' },
  { itemId: 'sea-pearl', rarity: 'rare', weight: 3, qty: 1, note: '작은 진주' },
  { itemId: 'candy-mana', rarity: 'rare', weight: 2, qty: 1, note: '마력캔디' },
  { itemId: 'mat-fairy-dust', rarity: 'odd', weight: 1.5, qty: 1, note: '교수의 실수로 섞여 들어간 수상한 가루' },
]

// ─────────────────────────────────────────────────────────────────────────────
// 5. 시약 합성(§20)
// ─────────────────────────────────────────────────────────────────────────────
export interface Reagent {
  id: string
  name: string
  itemIcon: string // 아이콘을 빌려 올 아이템 id
}
export const REAGENTS: Reagent[] = [
  { id: 'herb', name: '회복초', itemIcon: 'herb-mint' },
  { id: 'water', name: '마력수', itemIcon: 'flower-dew' },
  { id: 'stone', name: '정제석', itemIcon: 'crystal-mana' },
  { id: 'glow', name: '빛버섯', itemIcon: 'mush-glow' },
  { id: 'ember', name: '불씨석', itemIcon: 'ore-firestone' },
  { id: 'frost', name: '서리결정', itemIcon: 'crystal-wind' },
]
export interface AlchemyRecipe {
  id: string
  name: string
  /** 정답 재료 순서 */
  order: string[]
  temp: number // 0~100 목표 온도
  mana: number // 0~100 목표 마나량
  rewardItemId: string
  hint: string
}
export const ALCHEMY_RECIPES: AlchemyRecipe[] = [
  { id: 'r-heal', name: '회복약', order: ['herb', 'water', 'stone'], temp: 55, mana: 30, rewardItemId: 'potion-hp-s', hint: '회복초를 먼저 우리고, 마력수로 풀어 정제석으로 굳힌다. 중불, 마나는 적게.' },
  { id: 'r-mana', name: '마력약', order: ['water', 'glow', 'stone'], temp: 30, mana: 75, rewardItemId: 'potion-mp-s', hint: '차가운 마력수에 빛버섯을 녹이고 정제석으로 마무리. 약불, 마나는 넉넉히.' },
  { id: 'r-tonic', name: '전투 강장제', order: ['herb', 'ember'], temp: 80, mana: 50, rewardItemId: 'alch-tonic', hint: '회복초 위에 불씨석. 강불로 빠르게, 마나는 보통.' },
  { id: 'r-antidote', name: '해독제', order: ['glow', 'herb', 'water'], temp: 45, mana: 40, rewardItemId: 'tool-antidote', hint: '빛버섯으로 독을 잡고 회복초 · 마력수 순. 중약불.' },
  { id: 'r-frost', name: '냉각 촉매', order: ['frost', 'water', 'stone', 'glow'], temp: 15, mana: 65, rewardItemId: 'alch-catalyst', hint: '서리결정 → 마력수 → 정제석 → 빛버섯. 거의 끈 불, 마나 많이.' },
]
