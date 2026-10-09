'use client'

// 스토리 비트 재생 — GameState.storyQueue 앞에서부터 한 개씩 대사를 넘기며 보여준다.
// 비트 데이터는 lib/story.ts STORY_BEATS. (재생 여부 플래그는 큐에 넣을 때 이미 켜짐)

import { useEffect, useState } from 'react'
import { useGame } from '@/lib/game-state'
import { beatById, lineOnRoute, storyLineRoute, type HeroRole } from '@/lib/story'
import { SCHOOL_NPCS } from '@/lib/companions'
import type { Gender } from '@/lib/types'
import { HeroPortrait, Portrait } from '@/components/game/portrait'
import { DialogueBox } from '@/components/game/dialogue-box'
import { HeroSprite, playerSheet } from '@/components/game/pixel-hero'
import { cutsceneById, cutsceneSrc } from '@/lib/cutscenes'
import { STORY_ANIM_CELL, STORY_ANIM_FRAMES, storyAnimSrc } from '@/lib/story-anims'
import { cutsceneOverrideUrl, isAdminPage, onCutsceneStoreChange } from '@/lib/cutscene-store'

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
  // 루트 전용 줄은 지금 루트(루스벨 발견·상징)에 맞는 것만
  const route = storyLineRoute(state)
  const lines = beat.lines.filter((l) => lineOnRoute(l, route))
  const cur = lines[line]
  const last = line >= lines.length - 1
  const choosing = last && !!beat.choices?.length
  const next = () => (choosing ? undefined : last ? dispatch({ type: 'DISMISS_STORY' }) : setLine((l) => l + 1))
  const hero = cur?.hero ? resolveHero(cur.hero) : null
  const isPlayer = !!cur?.player
  const speaker = isPlayer ? state.player.name : hero ? hero.name : cur?.speaker
  const hasPortrait = !!(isPlayer || hero || cur?.portraitId)
  // 컷신 — 이 줄까지 가장 마지막으로 지정된 컷(null 이면 내림)
  let cutId: string | null = null
  for (let i = 0; i <= line && i < lines.length; i++) if (lines[i].cut !== undefined) cutId = lines[i].cut ?? null

  // ▶▶ — 선택지가 있으면 선택지 줄로, 없으면 비트를 끝낸다
  const skip = () => (beat.choices?.length ? setLine(lines.length - 1) : dispatch({ type: 'DISMISS_STORY' }))

  return (
    <>
    {cutId && <CutsceneLayer key={cutId} id={cutId} />}
    {cur?.anim && !(cutId && cutsceneById(cutId)?.full) && <StoryAnimStage key={line} ids={([] as string[]).concat(cur.anim)} side={!!cutId} />}
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
 * 순서: 관리자 창에서 직접 넣은 이미지(lib/cutscene-store) → 정적 파일(public/images/cutscenes/<id>.png).
 * 둘 다 없으면 일반 게임에서는 아무것도 띄우지 않고, 관리자 페이지에서는 자리 표시(슬롯 id·연출 설명)를 보여 준다.
 */
function CutsceneLayer({ id }: { id: string }) {
  const def = cutsceneById(id)
  const [override, setOverride] = useState<string | null | undefined>(undefined)
  const [ok, setOk] = useState(true)
  useEffect(() => {
    let alive = true
    const load = () => cutsceneOverrideUrl(id).then((u) => alive && setOverride(u))
    load()
    const off = onCutsceneStoreChange((changed) => changed === id && load())
    return () => {
      alive = false
      off()
    }
  }, [id])
  if (override === undefined) return null
  const full = !!def?.full
  const src = override ?? (ok ? cutsceneSrc(id) : null)
  if (!src) {
    if (!isAdminPage()) return null
    return (
      <div className={`cutscene-layer ${full ? 'is-full' : 'is-panel'}`} aria-hidden>
        <div className="cutscene-placeholder">
          <b>{id} · {full ? "풀컷신" : "만화 컷"} — 이미지 없음</b>
          <span>{def?.shot}</span>
          <small>관리자 패널 › 컷신 › 「컷신 이미지 관리」에서 넣을 수 있다</small>
        </div>
      </div>
    )
  }
  return (
    <div className={`cutscene-layer ${full ? 'is-full' : 'is-panel'}`} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="cutscene-img" onError={() => (override ? setOverride(null) : setOk(false))} />
    </div>
  )
}

/**
 * 연출 동작 무대 — 풀컷신 중엔 숨김, 만화 컷 패널 중엔 왼쪽 앞(is-side), 컷이 없으면 가운데. 대화창 바로 위.
 * 동작은 한 번만 재생하고 마지막 프레임에서 멈춘다 — 캐릭터를 누르면 다시 재생(대사는 넘어가지 않는다).
 * 시트가 없으면 그 동작만 빠진다.
 */
function StoryAnimStage({ ids, side }: { ids: string[]; side?: boolean }) {
  const [missing, setMissing] = useState<string[]>([])
  const [plays, setPlays] = useState<Record<string, number>>({})
  const shown = ids.filter((id) => !missing.includes(id))
  if (!shown.length) return null
  const scale = 2
  const px = STORY_ANIM_CELL * scale
  return (
    <div className={`story-anim-stage ${side ? 'is-side' : ''}`}>
      {shown.map((id) => (
        <button
          type="button"
          key={`${id}-${plays[id] ?? 0}`}
          className="story-anim-sprite"
          title="눌러서 다시 보기"
          aria-label="동작 다시 보기"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault() /* 포커스를 가져가지 않아야 스페이스가 대사 넘기기로 남는다 */}
          onClick={(e) => {
            e.stopPropagation()
            setPlays((p) => ({ ...p, [id]: (p[id] ?? 0) + 1 }))
          }}
          style={{
            width: px,
            height: px,
            backgroundImage: `url(${storyAnimSrc(id)})`,
            backgroundSize: `${px * STORY_ANIM_FRAMES}px ${px}px`,
            ['--story-anim-end' as string]: `-${px * (STORY_ANIM_FRAMES - 1)}px`,
          }}
        >
          {/* 시트 존재 확인용 — 로드 실패하면 이 동작을 뺀다 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={storyAnimSrc(id)} alt="" hidden onError={() => setMissing((m) => [...m, id])} />
        </button>
      ))}
    </div>
  )
}
