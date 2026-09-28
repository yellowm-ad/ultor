'use client'

// 스토리 비트 재생 — GameState.storyQueue 앞에서부터 한 개씩 대사를 넘기며 보여준다.
// 비트 데이터는 lib/story.ts STORY_BEATS. (재생 여부 플래그는 큐에 넣을 때 이미 켜짐)

import { useEffect, useState } from 'react'
import { useGame } from '@/lib/game-state'
import { beatById } from '@/lib/story'
import { Button } from '@/components/ui/button'
import { Portrait } from '@/components/game/portrait'
import { DiamondMark } from '@/components/game/ui-motifs'

export function StoryOverlay() {
  const { state, dispatch } = useGame()
  const beatId = state.storyQueue[0]
  const beat = beatId ? beatById(beatId) : undefined
  const [line, setLine] = useState(0)
  useEffect(() => setLine(0), [beatId])

  if (!beat || state.screen !== 'world') return null
  const cur = beat.lines[line]
  const last = line >= beat.lines.length - 1
  const next = () => (last ? dispatch({ type: 'DISMISS_STORY' }) : setLine((l) => l + 1))

  return (
    <div className="pointer-events-auto absolute inset-0 z-[45] flex items-end justify-center bg-black/55 p-3 sm:p-6" onClick={next}>
      <div className="relative w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 text-center font-display text-sm text-gold-soft text-shadow-ink">— {beat.title} —</div>
        <div className="flex items-stretch">
          {cur?.portraitId && (
            <div className="relative w-28 shrink-0 overflow-hidden rounded-l-xl border-y-[3px] border-l-[3px] border-gold sm:w-36">
              <Portrait id={cur.portraitId} className="h-full w-full" />
            </div>
          )}
          <div className={`panel-parchment relative flex-1 p-4 pt-5 ${cur?.portraitId ? '' : 'rounded-xl'}`} style={cur?.portraitId ? { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 } : undefined}>
            {cur?.speaker && (
              <div className="absolute -top-3 left-4 flex items-center gap-1.5 rounded-full border-2 border-gold bg-gradient-to-b from-[#241f17] to-[#100d09] px-3 py-1 font-display text-sm text-gold-soft text-shadow-ink shadow-md">
                <DiamondMark size={10} />
                {cur.speaker}
              </div>
            )}
            <p className={`min-h-16 pt-1 text-sm leading-relaxed text-[var(--parchment-foreground)] ${cur?.speaker ? '' : 'italic'}`}>{cur?.text}</p>
            <div className="mt-3 flex justify-end">
              <Button variant="parchment" size="sm" onClick={next}>
                {last ? '닫기' : '▼ 다음'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
