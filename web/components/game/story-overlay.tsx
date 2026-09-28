'use client'

// 스토리 비트 재생 — GameState.storyQueue 앞에서부터 한 개씩 대사를 넘기며 보여준다.
// 비트 데이터는 lib/story.ts STORY_BEATS. (재생 여부 플래그는 큐에 넣을 때 이미 켜짐)

import { useEffect, useState } from 'react'
import { useGame } from '@/lib/game-state'
import { beatById, type HeroRole } from '@/lib/story'
import { COMPANIONS } from '@/lib/companions'
import type { Gender } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { HeroPortrait, Portrait } from '@/components/game/portrait'
import { DiamondMark } from '@/components/game/ui-motifs'

/** 삼원 주인공 대사의 실제 화자 — 같은 속성이면 플레이어, 아니면 같은 속성 동기(1학년 학생 동료) */
function resolveHero(role: HeroRole, player: { name: string; element: string; gender: Gender }): { name: string; element: HeroRole; gender: Gender } {
  if (player.element === role) return { name: player.name, element: role, gender: player.gender }
  const c = COMPANIONS.find((x) => x.role === 'student' && x.joinYear === 1 && x.element === role)
  return { name: c?.name ?? role, element: role, gender: c?.gender ?? 'male' }
}

export function StoryOverlay() {
  const { state, dispatch } = useGame()
  const beatId = state.storyQueue[0]
  const beat = beatId ? beatById(beatId) : undefined
  const [line, setLine] = useState(0)
  useEffect(() => setLine(0), [beatId])

  if (!beat || state.screen !== 'world') return null
  const cur = beat.lines[line]
  const last = line >= beat.lines.length - 1
  const choosing = last && !!beat.choices?.length
  const next = () => (choosing ? undefined : last ? dispatch({ type: 'DISMISS_STORY' }) : setLine((l) => l + 1))
  const hero = cur?.hero ? resolveHero(cur.hero, state.player) : null
  const speaker = hero ? hero.name : cur?.speaker
  const hasPortrait = !!(hero || cur?.portraitId)

  return (
    <div className="pointer-events-auto absolute inset-0 z-[45] flex items-end justify-center bg-black/55 p-3 sm:p-6" onClick={next}>
      <div className="relative w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 text-center font-display text-sm text-gold-soft text-shadow-ink">— {beat.title} —</div>
        <div className="flex items-stretch">
          {hasPortrait && (
            <div className="relative w-28 shrink-0 overflow-hidden rounded-l-xl border-y-[3px] border-l-[3px] border-gold sm:w-36">
              {hero ? <HeroPortrait element={hero.element} gender={hero.gender} className="h-full w-full" /> : <Portrait id={cur!.portraitId!} className="h-full w-full" />}
            </div>
          )}
          <div className={`panel-parchment relative flex-1 p-4 pt-5 ${hasPortrait ? '' : 'rounded-xl'}`} style={hasPortrait ? { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 } : undefined}>
            {speaker && (
              <div className="absolute -top-3 left-4 flex items-center gap-1.5 rounded-full border-2 border-gold bg-gradient-to-b from-[#241f17] to-[#100d09] px-3 py-1 font-display text-sm text-gold-soft text-shadow-ink shadow-md">
                <DiamondMark size={10} />
                {speaker}
              </div>
            )}
            <p className={`min-h-16 pt-1 text-sm leading-relaxed text-[var(--parchment-foreground)] ${speaker ? '' : 'italic'}`}>{cur?.text}</p>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              {choosing ? (
                beat.choices!.map((c) => (
                  <Button key={c.label} variant="default" size="sm" onClick={() => dispatch({ type: 'STORY_CHOICE', setFlags: c.setFlags })}>
                    {c.label}
                  </Button>
                ))
              ) : (
                <Button variant="parchment" size="sm" onClick={next}>
                  {last ? '닫기' : '▼ 다음'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
