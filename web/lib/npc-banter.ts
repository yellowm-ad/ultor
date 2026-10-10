// ============================================================================
// NPC 둘이 나누는 대화(2026-10-10) — 나란히 서 있는 두 사람 중 누구에게 말을 걸어도, 평소 인사 대신
// 둘이 티격태격하는 짧은 장면이 나온다. 장면은 순서대로 하나씩 진행되고(작은 이야기), 끝까지 보면 뒤쪽 몇 장면이 돈다.
//
//   · 학교 동료 짝(밀포이 × 해리포탈)은 lib/school-roster 가 매주 같은 자리에 붙여 세울 때만 장면이 나온다.
//   · 마을 짝은 lib/mock-data 의 주민 NPC(TOWN_DUO_NPCS) — 늘 붙어 서 있다.
//   · 메인 스토리와는 무관한 곁가지(플래그·보상 없음). 진행도는 브라우저에만 기억한다.
// ============================================================================

export interface BanterLine {
  /** 말하는 NPC id */
  who: string
  text: string
}

export interface BanterDuo {
  id: string
  a: string
  b: string
  /** 순서대로 진행되는 장면들 */
  scenes: BanterLine[][]
  /** 끝까지 본 뒤 되풀이할 장면 수(뒤에서부터) */
  loop: number
}

const M = 'comp-milfoy'
const H = 'comp-harry'
const L = (who: string, text: string): BanterLine => ({ who, text })

export const BANTER_DUOS: BanterDuo[] = [
  // ── 뱀 문장 기숙사의 밀포이 × 번개 흉터 해리포탈 — 앙숙에서 시작하는 여섯 장면 ──
  {
    id: 'milfoy-harry',
    a: M,
    b: H,
    loop: 2,
    scenes: [
      [
        L(M, '포탈. 너 또 내 자리에 서 있어.'),
        L(H, '여긴 복도야, 밀포이. 자리가 어디 있어.'),
        L(M, '내가 서면 내 자리야. 품위 있는 사람은 설 곳을 가려 서거든.'),
        L(H, '그럼 품위 있게 한 칸만 옆으로 가 줄래?'),
        L(M, '…흥. 네가 먼저 왔으니 이번만 봐주는 거야.'),
        L(H, '(작게) 한 칸도 안 움직였잖아.'),
      ],
      [
        L(M, '저주학 과제, 몇 점 받았어?'),
        L(H, '92점. 운이 좋았어.'),
        L(M, '운? 나는 사흘 밤을 새워서 94점인데 너는 운으로 92점이라고?'),
        L(H, '사흘이나 새웠어? 눈 밑이 좀… 괜찮아?'),
        L(M, '누, 누가 걱정해 달래! 이건 화장이야. 유행하는 그늘 화장!'),
        L(H, '아, 그렇구나. 잘 어울려.'),
        L(M, '…………칭찬하지 마. 기분 나쁘게.'),
      ],
      [
        L(H, '밀포이, 이거 네 깃펜이지? 실습실에 떨어져 있었어.'),
        L(M, '그걸 왜 네가 들고 있어. 훔쳤지?'),
        L(H, '주워서 돌려주는 중인데.'),
        L(M, '…은으로 된 깃촉이야. 우리 집안 대대로 내려온 거고. 흠집이라도 났으면—'),
        L(H, '그래서 손수건에 싸 왔어. 소중해 보이길래.'),
        L(M, '……'),
        L(M, '고, 고맙다는 말은 안 해. 손수건은 빨아서 돌려줄게. 그뿐이야.'),
      ],
      [
        L(M, '너, 어제 숲 실습에서 왜 내 앞을 막아섰어.'),
        L(H, '가시덩굴이 네 쪽으로 튀었잖아.'),
        L(M, '내 방어 주문이 0.5초면 완성됐어. 네가 끼어들 필요 없었다고.'),
        L(H, '0.5초면 긁혔을 거야. 망토가 찢어지면 싫어하잖아.'),
        L(M, '…망토 걱정을 한 거야? 나 말고?'),
        L(H, '어… 둘 다?'),
        L(M, '대답이 늦어, 포탈! 그런 건 바로 대답하는 거야!'),
      ],
      [
        L(H, '손수건 고마워. 근데 이 자수는 뭐야? 번개 모양 같은데.'),
        L(M, '뱀이야.'),
        L(H, '지그재그로 꺾여 있는데.'),
        L(M, '화난 뱀이야! 수놓다가 손이 미끄러진 것뿐이고, 네 흉터를 보고 놓은 게 절대 아니야.'),
        L(H, '아무 말도 안 했는데…'),
        L(M, '표정이 말했어. 그 얼빠진 표정이.'),
        L(H, '마음에 들어. 잘 쓸게.'),
        L(M, '……쓰지 말고 넣어 둬. 닳으니까.'),
      ],
      [
        L(M, '포탈. 주말에 꽃길 장터에 새 빵집이 열었다던데.'),
        L(H, '응, 들었어. 가 보려고?'),
        L(M, '나 혼자 가면 뱀 문장 기숙사의 위신이 떨어져. 짐 들어 줄 사람이 필요해.'),
        L(H, '빵 한 봉지가 그렇게 무거워?'),
        L(M, '무거워. 아주. 그러니까 정오에 분수대 앞이야. 늦으면 저주할 거야.'),
        L(H, '알았어. 그럼 그건… 같이 가자는 거지?'),
        L(M, '짐꾼이라고 했잖아! …정오야. 일 분도 늦지 마.'),
      ],
      [
        L(H, '어제 빵 맛있었지. 다음엔 꽃집도 가 볼래?'),
        L(M, '누가 다음이 있대?'),
        L(H, '그럼 안 가?'),
        L(M, '…안 간다고는 안 했어. 사람 말을 끝까지 들어, 포탈.'),
      ],
      [
        L(M, '너 넥타이 또 비뚤어졌어. 이리 와 봐.'),
        L(H, '혼자 할 수 있는데.'),
        L(M, '못 하니까 매일 비뚤지. 가만히 있어. …됐어.'),
        L(H, '고마워. 넌 참 잘 챙겨 준다.'),
        L(M, '챙긴 게 아니라 눈에 거슬린 거야. 착각하지 마.'),
        L(H, '응. (웃음)'),
        L(M, '웃지 마!'),
      ],
    ],
  },
  // ── 1학년 동기 리안 × 셀라 — 일단 저지르는 쪽과 계획표를 쓰는 쪽 ──
  {
    id: 'rian-sella',
    a: 'comp-rian',
    b: 'comp-sella',
    loop: 2,
    scenes: [
      [
        L('comp-sella', '리안. 과제 제출이 내일인데 아직 제목도 안 썼다고 들었어.'),
        L('comp-rian', '제목은 다 쓰고 나서 붙이는 거야. 그래야 내용이랑 맞지.'),
        L('comp-sella', '내용은 썼어?'),
        L('comp-rian', '…제목 다음에 쓰려고.'),
        L('comp-sella', '순서가 방금이랑 반대잖아.'),
        L('comp-rian', '그래서 지금 둘 다 못 쓰고 있는 거야. 논리적이지?'),
      ],
      [
        L('comp-rian', '셀라, 너 어제 실습에서 얼음창 열두 발 다 명중했다며. 대단하다!'),
        L('comp-sella', '열한 발이야. 한 발은 과녁 가장자리였어.'),
        L('comp-rian', '그게 명중이지!'),
        L('comp-sella', '가장자리는 명중이 아니라 "아슬아슬하게 안 빗나감"이야. 오늘 밤에 백 발 더 쏠 거야.'),
        L('comp-rian', '…나는 열두 발 중에 과녁을 맞힌 게 세 발인데.'),
        L('comp-sella', '그럼 넌 삼백 발.'),
        L('comp-rian', '칭찬하러 왔다가 숙제를 받았네.'),
      ],
      [
        L('comp-sella', '이번 원정 준비물 목록이야. 물약 여섯, 해독제 둘, 예비 지팡이 하나, 붕대, 지도 두 장.'),
        L('comp-rian', '지도가 왜 두 장이야?'),
        L('comp-sella', '한 장은 네가 잃어버릴 몫.'),
        L('comp-rian', '너무하네. 내가 언제—'),
        L('comp-sella', '지난달 숲, 그 전달 해안, 입학식 날 학교 안내도.'),
        L('comp-rian', '…세 장으로 하자.'),
      ],
      [
        L('comp-rian', '너는 왜 그렇게까지 완벽하게 하려고 해? 조금 틀려도 되잖아.'),
        L('comp-sella', '틀리면 누가 다쳐. 내 계산이 틀리면 앞에 선 사람이 맞아.'),
        L('comp-rian', '앞에 서는 게 나잖아. 난 맞아도 괜찮아.'),
        L('comp-sella', '괜찮지 않아. 그러니까 내가 안 틀리는 거야.'),
        L('comp-rian', '…그럼 나는 네가 계산할 시간을 벌게. 그게 내 일이네.'),
        L('comp-sella', '처음으로 맞는 말을 했어. 기록해 둘게.'),
      ],
    ],
  },
  // ── 카일 × 제이드 — 불과 얼음의 맞수 ──
  {
    id: 'kyle-jade',
    a: 'comp-kyle',
    b: 'comp-jade',
    loop: 2,
    scenes: [
      [
        L('comp-kyle', '제이드! 오늘이야말로 결판을 내자. 대련장으로 와!'),
        L('comp-jade', '어제도 그 말 했어.'),
        L('comp-kyle', '어제는 비겼잖아!'),
        L('comp-jade', '네가 졌어. 넘어져 있었으니까.'),
        L('comp-kyle', '넘어진 채로 "아직 안 끝났다"고 했으면 안 끝난 거야!'),
        L('comp-jade', '…그 규칙은 누가 정했는데.'),
        L('comp-kyle', '내가!'),
      ],
      [
        L('comp-jade', '카일. 네 화염구, 던지기 전에 반 박자 숨을 들이쉬는 버릇이 있어.'),
        L('comp-kyle', '뭐? 그래서 네가 매번 먼저 얼렸구나!'),
        L('comp-jade', '고쳐.'),
        L('comp-kyle', '…왜 알려 주는 거야? 숨기면 계속 이길 텐데.'),
        L('comp-jade', '약점 있는 상대를 이겨 봤자 재미없어.'),
        L('comp-kyle', '크으, 멋있는 말을 무표정으로 하지 마!'),
      ],
      [
        L('comp-kyle', '숨 들이쉬는 버릇 고쳤다! 봤지? 방금 건 네가 못 얼렸어!'),
        L('comp-jade', '봤어. 대신 던질 때 왼발이 먼저 나가.'),
        L('comp-kyle', '또 있어?!'),
        L('comp-jade', '일곱 개 더 있어. 하나씩 알려 줄게.'),
        L('comp-kyle', '한 번에 다 말해!'),
        L('comp-jade', '그러면 넌 내일부터 안 찾아오잖아.'),
        L('comp-kyle', '……어?'),
        L('comp-jade', '대련 상대가 줄어든다는 뜻이야. 다른 뜻은 없어.'),
      ],
    ],
  },
  // ── 울토르 꽃길 장터 — 제빵사 폴코 × 꽃집 로잔 ──
  {
    id: 'village-market',
    a: 'npc-duo-baker',
    b: 'npc-duo-florist',
    loop: 2,
    scenes: [
      [
        L('npc-duo-florist', '폴코 씨, 빵 굽는 연기가 또 우리 장미 쪽으로 넘어와요.'),
        L('npc-duo-baker', '그게 연기냐, 향기지! 버터 향 맡고 자란 장미가 더 통통하다고.'),
        L('npc-duo-florist', '장미는 통통해지면 안 되거든요?'),
        L('npc-duo-baker', '그럼 로잔 씨 꽃가루가 내 반죽에 앉는 건 어쩌고. 어제 식빵에서 프리지아 맛이 났어.'),
        L('npc-duo-florist', '…그건 좀 팔릴 것 같은데요.'),
        L('npc-duo-baker', '…나도 그 생각 했어.'),
      ],
      [
        L('npc-duo-baker', '자, 신제품. 프리지아 식빵이야. 첫 손님은 로잔 씨로 정했지.'),
        L('npc-duo-florist', '왜 저예요? 독이라도 탔어요?'),
        L('npc-duo-baker', '꽃값을 안 냈으니 시식으로 갚는 거지.'),
        L('npc-duo-florist', '(한 입) …어머.'),
        L('npc-duo-baker', '어때!'),
        L('npc-duo-florist', '분해요. 맛있어서.'),
      ],
      [
        L('npc-duo-florist', '학생, 빵 사러 왔으면 꽃도 한 송이 가져가요. 오늘은 같이 사면 깎아 줘요.'),
        L('npc-duo-baker', '언제부터 우리가 같이 팔았지?'),
        L('npc-duo-florist', '폴코 씨 간판 옆에 제 화분 놓은 날부터요.'),
        L('npc-duo-baker', '그거 허락한 적 없는데.'),
        L('npc-duo-florist', '치우지도 않았잖아요.'),
        L('npc-duo-baker', '…물은 내가 주고 있어. 아침마다.'),
      ],
    ],
  },
  // ── 오로라 마을 — 사우나 지기 올가 × 얼음 조각가 니플 ──
  {
    id: 'aurora-sauna',
    a: 'npc-duo-sauna',
    b: 'npc-duo-carver',
    loop: 2,
    scenes: [
      [
        L('npc-duo-carver', '올가 할멈! 사우나 문 좀 닫고 다녀요. 김이 새서 내 순록 뿔이 녹았잖아요.'),
        L('npc-duo-sauna', '뿔이 녹은 게 아니라 네 솜씨가 무른 게지.'),
        L('npc-duo-carver', '사흘 걸려 깎은 거라고요!'),
        L('npc-duo-sauna', '나는 사십 년째 불을 때고 있다. 사흘이 뭐 대수냐.'),
        L('npc-duo-carver', '…그럼 뿔 없는 순록은 뭐라고 팔아요.'),
        L('npc-duo-sauna', '말이라고 팔아.'),
      ],
      [
        L('npc-duo-sauna', '니플, 손이 그게 뭐냐. 동상 걸리겠다. 들어와서 몸 좀 녹여.'),
        L('npc-duo-carver', '싫어요. 따뜻한 데 들어가면 손끝 감각이 풀려서 칼이 밀려요.'),
        L('npc-duo-sauna', '감각 없는 손으로 깎는 게 더 밀리지.'),
        L('npc-duo-carver', '…십 분만이에요.'),
        L('npc-duo-sauna', '수건은 선반 위에 있다. 네 이름 수놓은 걸로.'),
        L('npc-duo-carver', '언제 그런 걸 만들었어요?!'),
      ],
      [
        L('npc-duo-carver', '요즘 눈이 이상하게 빨리 녹아요. 조각이 하루를 못 버텨.'),
        L('npc-duo-sauna', '내 사우나 탓이라고 할 참이냐.'),
        L('npc-duo-carver', '아니요. 이번엔 진짜 할멈 탓이 아닌 것 같아서 더 걱정이에요.'),
        L('npc-duo-sauna', '…족장도 같은 소릴 하더구나. 설원 저쪽이 더워지고 있다고.'),
        L('npc-duo-carver', '녹기 전에 하나 더 깎을게요. 이번엔 할멈 얼굴로.'),
        L('npc-duo-sauna', '주름은 빼라.'),
      ],
    ],
  },
  // ── 마물 마을 — 인간 행상 로비 × 수습 점원 뿔리 ──
  {
    id: 'demon-stall',
    a: 'npc-duo-peddler',
    b: 'npc-duo-imp',
    loop: 2,
    scenes: [
      [
        L('npc-duo-peddler', '자, 뿔리. 손님이 오면 뭐라고 한다고 했지?'),
        L('npc-duo-imp', '“도망치지 마라, 인간!”'),
        L('npc-duo-peddler', '아니, “어서 오세요”.'),
        L('npc-duo-imp', '그건 약해 보여. 우리 마을에선 약해 보이면 값을 깎여.'),
        L('npc-duo-peddler', '도망치는 손님한테는 아예 못 팔아.'),
        L('npc-duo-imp', '…“어서 와라, 인간. 도망치지 않아도 된다.”'),
        L('npc-duo-peddler', '절반은 왔네.'),
      ],
      [
        L('npc-duo-imp', '로비, 이 해골 장식은 왜 안 팔려? 제일 잘생긴 걸로 골랐는데.'),
        L('npc-duo-peddler', '인간 손님은 해골이 잘생겼는지 못 알아봐.'),
        L('npc-duo-imp', '눈이 나쁘구나. 불쌍해.'),
        L('npc-duo-peddler', '대신 네가 구운 용암 과자는 다 팔렸어.'),
        L('npc-duo-imp', '진짜?! …근데 그거 돌인데.'),
        L('npc-duo-peddler', '기념품이라고 써 붙였어.'),
      ],
      [
        L('npc-duo-peddler', '인간 마을에선 내가 마물이랑 장사한다고 손가락질해.'),
        L('npc-duo-imp', '우리 마을에선 내가 인간 밑에서 일한다고 놀려.'),
        L('npc-duo-peddler', '그만둘래?'),
        L('npc-duo-imp', '싫어. 로비는 거스름돈을 안 속여.'),
        L('npc-duo-peddler', '너도 저울을 안 속이지.'),
        L('npc-duo-imp', '…그럼 계속 같이 놀림받자.'),
      ],
    ],
  },
  // ── 천공 신전 — 풍선 장수 파랑 × 하프 수리공 리라 ──
  {
    id: 'sky-balloon',
    a: 'npc-duo-balloon',
    b: 'npc-duo-harp',
    loop: 2,
    scenes: [
      [
        L('npc-duo-harp', '파랑! 풍선 줄 좀 짧게 잡아. 또 내 하프 줄에 감겼어.'),
        L('npc-duo-balloon', '바람이 그쪽으로 부는 걸 어떡해.'),
        L('npc-duo-harp', '조율하는 데 반나절 걸린다고.'),
        L('npc-duo-balloon', '근데 방금 풍선이 줄을 튕겼을 때 소리 예뻤는데.'),
        L('npc-duo-harp', '……그건 인정.'),
      ],
      [
        L('npc-duo-balloon', '리라, 너는 왜 맨날 고치기만 하고 연주는 안 해?'),
        L('npc-duo-harp', '사람들 앞에선 손이 굳어.'),
        L('npc-duo-balloon', '그럼 풍선 뒤에 숨어서 해. 내가 가려 줄게.'),
        L('npc-duo-harp', '풍선은 속이 비쳐 보이잖아.'),
        L('npc-duo-balloon', '많이 불면 안 보여. 오늘 백 개 불게.'),
        L('npc-duo-harp', '…숨 차서 쓰러지지나 마.'),
      ],
      [
        L('npc-duo-harp', '어제 종탑 밑에서 한 곡 쳤어. 아무도 없는 줄 알고.'),
        L('npc-duo-balloon', '알아. 풍선 백 개 뒤에서 들었어.'),
        L('npc-duo-harp', '뭐?!'),
        L('npc-duo-balloon', '숨이 차서 박수는 못 쳤어. 지금 칠게.'),
        L('npc-duo-harp', '…하지 마. 창피해. …한 번만 쳐.'),
      ],
    ],
  },
  // ── 버려진 신전 — 묘지기 돌브 × 양초 장수 미미 ──
  {
    id: 'ruin-candle',
    a: 'npc-duo-sexton',
    b: 'npc-duo-candle',
    loop: 2,
    scenes: [
      [
        L('npc-duo-candle', '돌브 아저씨, 무덤가에 초 좀 켜게 해 줘요. 한 자루에 동전 두 닢!'),
        L('npc-duo-sexton', '죽은 자는 동전을 안 낸다.'),
        L('npc-duo-candle', '그러니까 산 사람한테 받죠. 성묘 오는 사람한테.'),
        L('npc-duo-sexton', '여긴 이백 년째 아무도 안 온다.'),
        L('npc-duo-candle', '…장사 자리를 잘못 잡았네.'),
        L('npc-duo-sexton', '나도 이백 년째 그 생각 중이다.'),
      ],
      [
        L('npc-duo-sexton', '어젯밤 묘비마다 초가 켜져 있더군. 네 짓이냐.'),
        L('npc-duo-candle', '팔다 남은 거예요. 버리긴 아까워서.'),
        L('npc-duo-sexton', '마흔두 자루가 남았다고?'),
        L('npc-duo-candle', '…장사가 좀 안 됐어요.'),
        L('npc-duo-sexton', '이름 지워진 묘비에도 하나씩 놓았더군.'),
        L('npc-duo-candle', '이름이 없으면 더 어둡잖아요.'),
        L('npc-duo-sexton', '……내일부턴 내가 심지를 잘라 주마. 그을음이 덜 난다.'),
      ],
      [
        L('npc-duo-candle', '아저씨, 신전 안쪽에서 요즘 이상한 소리 나는 거 알아요?'),
        L('npc-duo-sexton', '안다. 그러니 초 들고 안쪽까지 가지 마라.'),
        L('npc-duo-candle', '학자 언니는 들어가던데요.'),
        L('npc-duo-sexton', '그 사람은 읽을 줄 아는 게 있고, 너는 팔 줄 아는 것뿐이다.'),
        L('npc-duo-candle', '너무해요!'),
        L('npc-duo-sexton', '그러니 살아서 계속 팔라는 말이다.'),
      ],
    ],
  },
  // ── 아틀란티스 — 잠수부 보글 × 얼음과자 장수 소르 ──
  {
    id: 'atlantis-ice',
    a: 'npc-duo-diver',
    b: 'npc-duo-ice',
    loop: 2,
    scenes: [
      [
        L('npc-duo-ice', '보글 아저씨, 오늘은 뭐 건졌어?'),
        L('npc-duo-diver', '고대 왕국의 술잔이다. 삼천 년은 됐지.'),
        L('npc-duo-ice', '그거 지난주에 내가 떨어뜨린 얼음과자 컵인데.'),
        L('npc-duo-diver', '…바닥에 글자가 있던데.'),
        L('npc-duo-ice', '“소르네 가게”라고 써 있지?'),
        L('npc-duo-diver', '고대어인 줄 알았다.'),
      ],
      [
        L('npc-duo-diver', '소르, 얼음과자 하나. 제일 큰 걸로.'),
        L('npc-duo-ice', '또 외상이야?'),
        L('npc-duo-diver', '오늘은 진주로 낸다. 방금 건진 거야.'),
        L('npc-duo-ice', '이건 진주가 아니라 물고기 눈알인데.'),
        L('npc-duo-diver', '…그럼 외상.'),
        L('npc-duo-ice', '장부가 벌써 세 권째야, 아저씨.'),
      ],
      [
        L('npc-duo-ice', '아저씨는 왜 맨날 그 깊은 데까지 내려가?'),
        L('npc-duo-diver', '어릴 때 저 밑에서 빛을 봤다. 꺼지지 않는 불빛.'),
        L('npc-duo-ice', '사제님이 말하는 그 광원?'),
        L('npc-duo-diver', '그래. 다시 한 번 보고 싶어서.'),
        L('npc-duo-ice', '…찾으면 나도 데려가. 외상은 그걸로 퉁쳐 줄게.'),
        L('npc-duo-diver', '세 권 전부?'),
        L('npc-duo-ice', '한 권만.'),
      ],
    ],
  },
]

const DUO_BY_NPC = new Map<string, BanterDuo>()
for (const d of BANTER_DUOS) {
  DUO_BY_NPC.set(d.a, d)
  DUO_BY_NPC.set(d.b, d)
}

export function duoOf(npcId: string): BanterDuo | undefined {
  return DUO_BY_NPC.get(npcId)
}
/** 짝의 상대 */
export function duoPartner(npcId: string): string | undefined {
  const d = DUO_BY_NPC.get(npcId)
  return d ? (d.a === npcId ? d.b : d.a) : undefined
}

// ── 진행도(브라우저에만) ────────────────────────────────────────────────────────
const KEY = 'ultor-banter'
function readSeen(): Record<string, number> {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

/** 이번에 보여 줄 장면 — 아직 안 본 장면이 있으면 그다음 것, 다 봤으면 뒤쪽 loop 개를 돌아가며 */
export function banterScene(duo: BanterDuo): BanterLine[] {
  const seen = readSeen()[duo.id] ?? 0
  const n = duo.scenes.length
  if (seen < n) return duo.scenes[seen]
  const loop = Math.max(1, Math.min(duo.loop, n))
  return duo.scenes[n - loop + ((seen - n) % loop)]
}

/** 장면을 끝까지 봤다 — 다음엔 다음 장면 */
export function banterAdvance(duo: BanterDuo) {
  try {
    const seen = readSeen()
    seen[duo.id] = (seen[duo.id] ?? 0) + 1
    window.localStorage.setItem(KEY, JSON.stringify(seen))
  } catch {
    // 저장소 접근 불가 — 같은 장면이 다시 나온다
  }
}
