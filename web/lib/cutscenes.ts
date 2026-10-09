// ============================================================================
// 스토리 컷신 이미지 목록 — 대본(울토르_메인스토리_대사_컷신_01-05.md v1.1)의 [CUTSCENE]·[INTERLUDE] 장면
//
//   · 이미지: public/images/cutscenes/<id>.png — Gemini 이미지 API(scripts/gemini-image.mjs)로 제작.
//     연출 = 젠레스 존 제로 스토리 컷신처럼 만화 컷(굵은 검은 컷 테두리, 사선 분할, 극적인 구도·조명).
//     작화 = 「패러디 캐릭터 밀포이, 해리포탈 삼면도.png」 느낌(사용자 지정 2026-10-08) — 깔끔한 애니 일러스트,
//       가는 선화, 부드러운 셀 채색, 차분한 따뜻한 톤. 모든 컷에 STYLE_REF 를 첫 참고 이미지로 넣는다.
//     말풍선은 넣지 않는다 — 대사는 게임 대화창이 띄운다.
//   · full  = 화면 전체를 덮는 풀컷신(강조 장면) / 아니면 화면 가운데 만화 컷 패널
//   · refs  = 작화풍·외형을 맞출 참고 이미지(게임 개발 파일 폴더의 삼면도·일러스트)
//   · 대사 줄의 `cut: '<id>'` 로 띄운다(lib/story StoryLine.cut). 파일이 아직 없으면 조용히 건너뛴다.
// ============================================================================

/** 모든 컷신의 작화풍 기준(게임 개발 파일 폴더) — 캐릭터 refs 보다 먼저 넣는다 */
export const STYLE_REF = '패러디 캐릭터 밀포이, 해리포탈 삼면도.png'
export const STYLE_PROMPT =
  'clean anime illustration style matching the reference character sheet: thin clean lineart, soft cel shading, muted warm palette, detailed school uniforms; ' +
  'composed as a dramatic manga-style story cutscene panel (Zenless Zone Zero style framing, thick black panel borders, cinematic lighting), no speech bubbles, no text'

import { CUTSCENES_GEN } from '@/lib/story-script-gen'

export interface CutsceneDef {
  id: string
  /** 어느 막·장면 */
  scene: string
  full?: boolean
  /** 화면에 담을 것(이미지 프롬프트의 바탕) */
  shot: string
  /** 참고 이미지 — 게임 개발 파일 폴더 기준 파일명 */
  refs: string[]
}

const MIREL = '미르엘 삼면도.jpg'
const RIAN = '리안 삼면도.jpg'
const SELLA = '전투 NPC 셀라 삼면도.png'
const DORAN = '도란 삼면도.jpg'
const NPCS = '스토리 NPC 일러스트.png'
const SCHOOL = '중앙 대도서관 에셋 디자인.jpg'
const MORS = '모르스 1페이즈(망토, 면류관), 2페이즈(망토, 면류관 없음) 삼면도.png'

export const CUTSCENES: CutsceneDef[] = [
  // ── EP00 입학식 ──
  { id: 'ep00-a1', scene: 'EP00 [CUTSCENE 00-A] 입학식 시작', full: true, shot: '주인공 뒤에서 천천히 상승하는 카메라 — 광장 중앙 분수, 울토르 문장, 교직원 단상, 계단 위 본관 정문이 한 프레임에. 종이 울리는 입학식 아침, 모여 선 신입생들의 뒷모습', refs: [SCHOOL] },
  { id: 'ep00-a2', scene: 'EP00 [CUTSCENE 00-A] 입학식 시작', shot: '단상 위의 미르엘 — 신입생을 내려다보며 환영 연설, 부드럽지만 위엄 있는 표정, 아래에서 올려다보는 구도', refs: [MIREL] },
  { id: 'ep00-a3', scene: 'EP00 [CUTSCENE 00-A] 입학식 시작', shot: '학생들을 훑는 3분할 만화 컷 — 하품을 참는 리안 / 노트를 꺼내는 셀라 / 주변을 살피는 도란', refs: [RIAN, SELLA, DORAN] },
  { id: 'ep00-a4', scene: 'EP00 [CUTSCENE 00-A] 입학식 시작', shot: '"졸업은 그 선택의 끝이 아니라, 시작에 가깝습니다" — 잠깐 미소 짓는 미르엘의 얼굴 클로즈업', refs: [MIREL] },
  { id: 'ep00-b1', scene: 'EP00 [CUTSCENE 00-B] 금지구역 암시', full: true, shot: '밤, 아무도 없는 본관 지하로 내려가는 카메라 — 돌계단 아래 오래된 철문, 문 중앙의 문양이 아주 미세하게 빛난다. 차가운 푸른 어둠', refs: [] },
  { id: 'ep00-b2', scene: 'EP00 [CUTSCENE 00-B] 금지구역 암시', full: true, shot: '철문 문양 클로즈업 — 빛이 꺼지기 직전, 거의 검은 화면', refs: [] },
  // ── EP01 처음 맞는 학교생활 ──
  { id: 'ep01-a1', scene: 'EP01 [CUTSCENE 01-A] 밤의 학교', full: true, shot: '학생들이 모두 돌아간 밤 — 불 켜진 창문 하나가 있는 울토르 본관 외경', refs: [SCHOOL] },
  { id: 'ep01-a2', scene: 'EP01 [CUTSCENE 01-A] 밤의 학교', shot: '촛불 아래 산더미 같은 신입생 답안지를 채점하는 미르엘 — 한 장을 들고 작게 웃음을 터뜨리는 얼굴 + 빨간 펜으로 여백에 짧게 적는 손 클로즈업(2분할 컷). 다정한 교사의 밤', refs: [MIREL] },
  { id: 'ep01-a3', scene: 'EP01 [CUTSCENE 01-A] 밤의 학교', shot: '숲 관리인의 짧은 보고서를 읽으며 학생 안전을 걱정하는 표정의 미르엘(눈썹 사이가 살짝 좁아짐), 창밖으로 기숙사 창문 불빛들이 하나씩 꺼져 간다', refs: [MIREL] },
  // ── EP02 숲에서 들려온 이상한 울음 ──
  { id: 'ep02-a1', scene: 'EP02 [CUTSCENE 02-A] 미르엘의 첫 은폐', shot: '숲속, 바위 틈의 작은 검은 결정을 신이 나서 가리키는 리안과 학생들 / 다가온 미르엘이 리안의 손목을 가볍게 잡아 결정에서 떼어 내는 컷(2분할) — 걱정하는 보호자의 표정', refs: [RIAN, MIREL] },
  { id: 'ep02-a2', scene: 'EP02 [CUTSCENE 02-A] 미르엘의 첫 은폐', shot: '작은 검은 결정을 손바닥 위에서 봉인하는 미르엘의 손 클로즈업 — 결정의 빛이 꺼진다. 뒤로 아쉬워하는 학생들이 흐릿하게', refs: [MIREL] },
  // ── EP03 중간고사와 사라진 약초 ──
  { id: 'ep03-a1', scene: 'EP03 [CUTSCENE 03-A] 오래된 가시', shot: '숲의 약초 채집 지점 — 땅에서 가시 하나를 집어 든 리안, 가시 끝에 흐르는 검은 마력, 옆에서 들여다보는 셀라와 도란', refs: [RIAN, SELLA, DORAN] },
  { id: 'ep03-a2', scene: 'EP03 [CUTSCENE 03-A] 오래된 가시', shot: '표정 변화 없이 가시를 받아 가는 미르엘의 손을 따라가는 컷', refs: [MIREL] },
  // ── EP04 마지막 수업, 이상한 뿌리 ──
  { id: 'ep04-a1', scene: 'EP04 [CUTSCENE 04-A] 이상한 뿌리', full: true, shot: '교외 숲 경계 — 땅이 흔들리며 거대한 나무뿌리 하나가 바닥을 뚫고 솟아오른다. 놀라 물러서는 주인공 일행과 오웬', refs: [RIAN, SELLA, DORAN, NPCS] },
  { id: 'ep04-a2', scene: 'EP04 [CUTSCENE 04-A] 이상한 뿌리', shot: '뿌리 표면의 오래된 문양 클로즈업 — 기록 문자보다 오래된 고대 문자, 굳은 오웬의 얼굴(2분할)', refs: [NPCS] },
  { id: 'ep04-a3', scene: 'EP04 [CUTSCENE 04-A] 이상한 뿌리', full: true, shot: '나무 사이로 달려 들어온 미르엘이 한 팔을 넓게 펼쳐 학생들 앞을 막아선다 — 망토 자락이 휘날리고, 뒤에는 솟아오른 거대한 뿌리. 믿음직한 어른의 뒷모습과 단호한 옆얼굴', refs: [MIREL, RIAN, SELLA] },
  { id: 'ep04-b1', scene: 'EP04 [CUTSCENE 04-B] 방학 출발', shot: '짐을 챙기는 학생들 — 장비를 점검해 건네는 대장장이 반, 약초 키트를 건네는 약사 셀린, 들뜬 리안', refs: [RIAN, NPCS] },
  { id: 'ep04-b2', scene: 'EP04 [CUTSCENE 04-B] 방학 출발', shot: '교문에서 학생들을 배웅하는 미르엘 — 따뜻한 미소로 손을 들어 인사한다', refs: [MIREL] },
  // ── EP04 막간 — 화산지대(얼굴·이름을 숨긴 모르스) ──
  { id: 'ep04-c1', scene: 'EP04 [INTERLUDE 04-C] 같은 시각, 화산지대', full: true, shot: '검붉은 하늘 아래 용암이 느리게 흐르는 바위 언덕 — 거대한 뿔을 가진 인물이 등을 보인 채 앉아 있고(얼굴은 보이지 않는다), 옆에서 덩치 큰 마족 수하가 용암 웅덩이에 꽂았던 꼬챙이에서 구운 감자를 자랑스럽게 내민다. 발밑 바위 균열들이 은은한 금빛으로 빛난다. 쓸쓸하지만 어딘가 평화롭고 우스운 분위기. 뿔 달린 인물은 참고 시트의 모르스(긴 흑발, 굽은 뿔, 검은 망토) 뒷모습', refs: [MORS] },
]

/** 전체 컷 슬롯 — 위의 EP00~04(손으로 정리) + EP05~ 자동 생성(lib/story-script-gen) */
export const ALL_CUTSCENES: CutsceneDef[] = [...CUTSCENES, ...CUTSCENES_GEN]

const BY_ID = new Map(ALL_CUTSCENES.map((c) => [c.id, c]))
export const cutsceneById = (id: string) => BY_ID.get(id)
export const cutsceneSrc = (id: string) => `/images/cutscenes/${id}.png`
