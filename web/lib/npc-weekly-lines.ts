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
}

const POOLS: Record<string, LinePool> = {
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
  if (pool.after && flagOn(state, pool.after.flag)) lines = pool.after.lines
  else {
    const mood = moodOf(state)
    lines = pool[mood] ?? pool.calm
  }
  return lines[gw % lines.length]
}
