// ============================================================================
// 스토리 연출 동작(PixelLab) — 대사 줄의 anim: '<id>' 로 대화창 위 작은 무대에 재생한다.
//   · 시트: public/images/story-anims/<id>.png  — 96px 셀 · 8프레임 가로 1줄(남쪽 = 정면)
//   · 목록/요청: scripts/_pixellab/story-anims.txt → pl-story-anims.mjs(생성) → build-story-anims.mjs(시트 조립)
//   · 파일이 없으면 조용히 건너뛴다(컷신 이미지와 같은 규칙).
// ============================================================================

export const STORY_ANIM_CELL = 96
export const STORY_ANIM_FRAMES = 8

export const STORY_ANIM_IDS = [
  'celine-give',
  'celine-mix',
  'celine-sad',
  'doran-down',
  'doran-look',
  'doran-surprise',
  'doran-think',
  'kael-think',
  'mirel-farewell',
  'mirel-laugh',
  'mirel-protect',
  'mirel-seal',
  'mirel-speech',
  'owen-freeze',
  'owen-stop',
  'owen-surprise',
  'owen-think',
  'rian-laugh',
  'rian-pickup',
  'rian-reach',
  'rian-sad',
  'rian-sulk',
  'rian-surprise',
  'rian-think',
  'rian-wave',
  'rian-yawn',
  'ruspell-laugh',
  'ruspell-smirk',
  'sella-notes',
  'sella-startle',
  'sella-surprise',
  'sella-think',
  'sella-touch',
  'van-give',
  'van-inspect',
  'yuna-laugh',
  'yuna-wave',
] as const

export type StoryAnimId = (typeof STORY_ANIM_IDS)[number]

export const storyAnimSrc = (id: string) => `/images/story-anims/${id}.png`
