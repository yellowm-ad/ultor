// ============================================================================
// 메인 스토리 진행 — 레벨 관문(2026-11-05)
//
//   예전: EP01~EP52 가 정해진 globalWeek 에 열렸다(192주 달력에 묶임).
//   지금: 앞 막을 끝냈고 레벨이 EP_MIN_LEVEL 에 닿으면 다음 막을 바로 시작할 수 있다(HUD · 학사 수첩).
//         달력(학기·수업·방학)은 학교생활용으로 그대로 흘러가고, 이야기는 레벨 따라 진행된다.
//   · 막을 시작하면 그 막의 미션이 수첩 MAIN 칸에 들어가 주가 바뀌어도 남는다(lib/quests generateWeeklyQuests).
//   · 결말(EP_<week>_END)·완료 플래그(EP_<week>_DONE)는 예전과 같은 이름 — 옛 세이브와 호환.
//   · requiredFlags 가 안 맞는 막(다른 루트 전용)은 건너뛴다.
// ============================================================================

import type { GameState } from '@/lib/types'
import { STORY_EPISODES, type StoryEpisode } from '@/lib/story-episodes'
import { flagOn, flagsAllOn } from '@/lib/story'

/**
 * 막별 시작 레벨 — 지역 권장 레벨(lib/field-specs recommendedLevel)에 맞춘 곡선.
 * 숲(1~15) → 해안(8~20) → 천공(15~25) → 폐허(21~38) → 설원(31~46) → 화산(41~63)
 */
export const EP_MIN_LEVEL: Record<number, number> = {
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 7, 7: 10,
  8: 12, 9: 13, 10: 14, 11: 15, 12: 16, 13: 17, 14: 18,
  15: 19, 16: 19, 17: 20, 18: 20, 19: 21, 20: 21, 21: 22, 22: 22, 23: 23, 24: 23, 25: 24, 26: 25, 27: 25,
  28: 26, 29: 27, 30: 28, 31: 29, 32: 30, 33: 31, 34: 32, 35: 33, 36: 34, 37: 35, 38: 36, 39: 37,
  40: 38, 41: 39, 42: 40, 43: 42, 44: 43, 45: 45,
  46: 47, 47: 50, 48: 53, 49: 55, 50: 57, 51: 60, 52: 62,
}
export const episodeMinLevel = (ep: StoryEpisode) => EP_MIN_LEVEL[ep.no] ?? 1

export const episodeDoneFlag = (ep: StoryEpisode) => `EP_${ep.week}_DONE`
export const episodeOpenFlag = (ep: StoryEpisode) => `beat:EP_${ep.week}_OPEN`

type S = Pick<GameState, 'storyFlags'>

/** 지금 진행 중인(시작했지만 결말 전) 막 */
export function currentEpisode(state: S): StoryEpisode | null {
  return STORY_EPISODES.find((ep) => flagOn(state, episodeOpenFlag(ep)) && !flagOn(state, episodeDoneFlag(ep))) ?? null
}

/** 다음에 시작할 막 — 진행 중인 막이 있으면 null. 루트가 안 맞는 막은 건너뛴다 */
export function nextEpisode(state: S): StoryEpisode | null {
  if (currentEpisode(state)) return null
  for (const ep of STORY_EPISODES) {
    if (flagOn(state, episodeDoneFlag(ep))) continue
    if (!flagsAllOn(state, ep.requiredFlags)) continue
    return ep
  }
  return null
}

export type EpisodeGate = { ep: StoryEpisode; minLevel: number; ready: boolean; why: string | null }

/** 다음 막을 지금 시작할 수 있나 — 프롤로그(입학식)를 본 뒤, 레벨이 닿으면 */
export function episodeGate(state: Pick<GameState, 'storyFlags' | 'player' | 'storyQueue'>): EpisodeGate | null {
  const ep = nextEpisode(state)
  if (!ep) return null
  const minLevel = episodeMinLevel(ep)
  const why = !flagOn(state, 'CH0_STARTED') && !state.storyFlags.DEBUG_UNLOCK_ALL
    ? '입학식을 먼저 마쳐야 합니다.'
    : state.player.level < minLevel
      ? `Lv.${minLevel} 부터 시작할 수 있습니다. (지금 Lv.${state.player.level})`
      : null
  return { ep, minLevel, ready: !why && state.storyQueue.length === 0, why }
}
