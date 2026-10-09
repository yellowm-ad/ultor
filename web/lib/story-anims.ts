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
  'celine-laugh',
  'celine-mix',
  'celine-sad',
  'doran-down',
  'doran-laugh',
  'doran-look',
  'doran-surprise',
  'doran-think',
  'kael-surprise',
  'kael-think',
  'mirel-farewell',
  'mirel-laugh',
  'mirel-protect',
  'mirel-seal',
  'mirel-speech',
  'mirel-think',
  'owen-freeze',
  'owen-laugh',
  'owen-sad',
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
  'ruspell-heat',
  'ruspell-laugh',
  'ruspell-sad',
  'ruspell-smirk',
  'ruspell-think',
  'saint-heal',
  'saint-laugh',
  'saint-surprise',
  'saint-think',
  'sella-laugh',
  'sella-notes',
  'sella-sad',
  'sella-startle',
  'sella-surprise',
  'sella-think',
  'sella-touch',
  'van-give',
  'van-inspect',
  'yuna-laugh',
  'yuna-think',
  'yuna-wave',
] as const

export type StoryAnimId = (typeof STORY_ANIM_IDS)[number]

export const storyAnimSrc = (id: string) => `/images/story-anims/${id}.png`
