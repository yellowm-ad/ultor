'use client'

// 스토리 비트 재생 — GameState.storyQueue 앞에서부터 한 개씩 대사를 넘기며 보여준다.
// 비트 데이터는 lib/story.ts STORY_BEATS. (재생 여부 플래그는 큐에 넣을 때 이미 켜짐)

import { useEffect, useState } from 'react'
import { useGame } from '@/lib/game-state'
import { beatById, type HeroRole } from '@/lib/story'
import { SCHOOL_NPCS } from '@/lib/companions'
import type { Gender } from '@/lib/types'
import { HeroPortrait, Portrait } from '@/components/game/portrait'
import { DialogueBox } from '@/components/game/dialogue-box'
import { HeroSprite, playerSheet } from '@/components/game/pixel-hero'
import { cutsceneById, cutsceneSrc } from '@/lib/cutscenes'

/**
 * 대화집의 삼원(화염/빙결/대지) 화자 대사 — PRD v2.0 이후 주인공은 고정 속성이 없으므로,
 * 해당 시트를 쓰는 1학년 동기 학교 NPC(리안·셀라·도란)가 말한다.
 */
const ROLE_NPC: Record<HeroRole, string> = { fire: 'comp-rian', ice: 'comp-sella', earth: 'comp-doran' }
function resolveHero(role: HeroRole): { name: string; element: HeroRole; gender: Gender } {
  const c = SCHOOL_NPCS.find((x) => x.id === ROLE_NPC[role])
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
  const hero = cur?.hero ? resolveHero(cur.hero) : null
  const isPlayer = !!cur?.player
  const speaker = isPlayer ? state.player.name : hero ? hero.name : cur?.speaker
  const hasPortrait = !!(isPlayer || hero || cur?.portraitId)
  // 컷신 — 이 줄까지 가장 마지막으로 지정된 컷(null 이면 내림)
  let cutId: string | null = null
  for (let i = 0; i <= line && i < beat.lines.length; i++) if (beat.lines[i].cut !== undefined) cutId = beat.lines[i].cut ?? null

  // ▶▶ — 선택지가 있으면 선택지 줄로, 없으면 비트를 끝낸다
  const skip = () => (beat.choices?.length ? setLine(beat.lines.length - 1) : dispatch({ type: 'DISMISS_STORY' }))

  return (
    <>
    {cutId && <CutsceneLayer key={cutId} id={cutId} />}
    <DialogueBox
      zClass="z-[45]"
      title={beat.title}
      speaker={speaker}
      italic={!speaker}
      portrait={
        hasPortrait ? isPlayer ? (
          <span className="flex h-full w-full items-end justify-center overflow-hidden bg-[#1c1822]">
            <HeroSprite sheet={playerSheet(state.player.appearance.gender)} dir="down" px={150} />
          </span>
        ) : hero ? <HeroPortrait element={hero.element} gender={hero.gender} className="h-full w-full" /> : <Portrait id={cur!.portraitId!} className="h-full w-full" /> : undefined
      }
      text={cur?.text ?? ''}
      canAdvance={!choosing}
      onAdvance={next}
      onSkip={choosing ? undefined : skip}
      actions={
        choosing
          ? beat.choices!.map((c) => (
              <button key={c.label} type="button" className="dlg-btn" onClick={() => dispatch({ type: 'STORY_CHOICE', setFlags: c.setFlags })}>
                {c.label}
              </button>
            ))
          : null
      }
    />
    </>
  )
}

/**
 * 컷신 이미지 — full: 화면 전체(강조 장면) / 기본: 화면 가운데 만화 컷 패널(젠레스 존 제로식 사선 컷).
 * 이미지 파일이 아직 없으면(제작 전) 아무것도 띄우지 않는다.
 */
function CutsceneLayer({ id }: { id: string }) {
  const def = cutsceneById(id)
  const [ok, setOk] = useState(true)
  if (!ok) return null
  const full = !!def?.full
  return (
    <div className={`cutscene-layer ${full ? 'is-full' : 'is-panel'}`} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cutsceneSrc(id)} alt="" className="cutscene-img" onError={() => setOk(false)} />
    </div>
  )
}
