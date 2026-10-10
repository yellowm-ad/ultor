'use client'

import { useState } from 'react'
import { useGame } from '@/lib/game-state'
import { npcById } from '@/lib/mock-data'
import { npcWeeklyLine } from '@/lib/npc-weekly-lines'
import { Portrait } from '@/components/game/portrait'
import { DialogueBox } from '@/components/game/dialogue-box'
import { coursesForWeek, nextCourseSkill } from '@/lib/academics'
import { skillById } from '@/lib/mock-data'
import { canRecruit, schoolNpcById } from '@/lib/companions'
import { banterAdvance, banterScene, duoOf } from '@/lib/npc-banter'
import { rosterDuoTogether } from '@/lib/school-roster'

const ROLE_LABEL: Record<string, string> = {
  professor: '교수',
  weaponMerchant: '무기 상인',
  potionMerchant: '물약 상인',
  toolMerchant: '도구 상인',
  petTamer: '펫 조련사',
  housing: '하우징 촌장',
  arenaMaster: '투기장장',
  guard: '경비대장',
  flavor: '주민',
  templePriest: '신관',
  saint: '성녀',
  farmer: '농부',
  craftStation: '장인',
  companion: '동료',
  royal: '국왕',
  royalGuard: '왕실 근위병',
}

export function DialogueScreen() {
  const { state, dispatch } = useGame()
  const npc = state.activeNpcId ? npcById(state.activeNpcId) : null
  const [lineIdx, setLineIdx] = useState(0)

  if (!npc || state.screen !== 'dialogue') return null

  // 짝이 있는 NPC(lib/npc-banter) — 둘이 붙어 서 있으면 평소 인사 대신 둘의 장면. 학교 동료 짝은 이번 주에 같이 서 있을 때만
  const duo = duoOf(npc.id)
  const banter = duo && (npc.role !== 'companion' || rosterDuoTogether(state, npc.id)) ? banterScene(duo) : null

  const close = () => {
    // 장면을 마지막 줄까지 봤으면 다음엔 다음 장면
    if (duo && banter && lineIdx >= banter.length - 1) banterAdvance(duo)
    setLineIdx(0)
    dispatch({ type: 'CLOSE_OVERLAY' })
  }

  const isShopkeeper = ['weaponMerchant', 'potionMerchant', 'toolMerchant'].includes(npc.role)
  const isTamer = npc.role === 'petTamer'
  const isProfessor = npc.role === 'professor'
  const isElder = npc.role === 'housing'
  const isCraftStation = npc.role === 'craftStation'
  // 학교 동료 — 아직 합류하지 않았고 조건이 되면 대화 끝에 '파티에 합류' 권유
  const mate = npc.role === 'companion' ? schoolNpcById(npc.id) : undefined
  const canJoin = !!mate && !state.companions.recruited[mate.id] && canRecruit(state, mate).ok
  // 교수: 이번 학기 수업과 다음에 배울 마법 안내(전직 담당관 폐지 — 마법은 수업으로 배운다)
  const courseNotes = isProfessor
    ? coursesForWeek(state.calendar.globalWeek).flatMap((c) => {
        const nx = nextCourseSkill(c, state.academics.courseScore[c.id] ?? 0)
        return nx ? [`「${c.name}」 점수 ${nx.needScore} → ${skillById(nx.skillId)?.name ?? nx.skillId}`] : []
      })
    : []
  // 이번 주 대사(주간 풀)를 첫 줄로, 이어서 기본 인사
  const weekly = npcWeeklyLine(npc.id, state)
  const lines = banter ? banter.map((l) => l.text) : weekly ? [weekly, ...npc.greeting] : npc.greeting
  // 지금 줄을 말하는 사람(둘의 장면에서는 줄마다 바뀐다)
  const speaker = (banter && npcById(banter[Math.min(lineIdx, banter.length - 1)].who)) || npc
  const speakerMate = speaker.role === 'companion' ? schoolNpcById(speaker.id) : undefined
  const lastLine = lineIdx >= lines.length - 1

  const hasActions = isShopkeeper || isTamer || isCraftStation || isElder || isProfessor || canJoin
  // 마지막 줄: 할 일이 없는 NPC는 엔터/클릭으로 바로 닫고, 상점·훈련 등은 버튼 선택을 기다린다
  const canAdvance = !lastLine || !hasActions
  const advance = () => (lastLine ? close() : setLineIdx((i) => Math.min(lines.length - 1, i + 1)))

  return (
    <DialogueBox
      speaker={speaker.name}
      role={speakerMate ? speakerMate.title : ROLE_LABEL[speaker.role]}
      portrait={
        <span className="block h-full w-full" style={speaker.hue ? { filter: `hue-rotate(${speaker.hue}deg)` } : undefined}>
          <Portrait id={speaker.spriteId ?? speaker.id} className="h-full w-full" />
        </span>
      }
      text={lines[lineIdx]}
      canAdvance={canAdvance}
      onAdvance={advance}
      onSkip={lastLine ? undefined : () => setLineIdx(lines.length - 1)}
      onClose={close}
      actions={
        lastLine && hasActions ? (
          <>
            {isProfessor && (
              <span className="dlg-note">
                {courseNotes.length ? `다음 수업 마법 — ${courseNotes.join(' · ')}` : '이번 학기 수업 마법은 모두 익혔거나 방학입니다.'}
              </span>
            )}
            {(isShopkeeper || isTamer) && (
              <button type="button" className="dlg-btn" onClick={() => dispatch({ type: 'OPEN_SHOP', npcId: npc.id })}>
                {isTamer ? '먹이 상점' : '상점 열기'}
              </button>
            )}
            {isTamer && (
              <button type="button" className="dlg-btn" onClick={() => dispatch({ type: 'OPEN_TAMER', npcId: npc.id })}>
                펫 훈련
              </button>
            )}
            {isCraftStation && (
              <button type="button" className="dlg-btn" onClick={() => dispatch({ type: 'OPEN_CRAFT', npcId: npc.id })}>
                제작하기
              </button>
            )}
            {canJoin && (
              <button
                type="button"
                className="dlg-btn"
                onClick={() => {
                  dispatch({ type: 'RECRUIT_COMPANION', companionId: mate!.id })
                  close()
                }}
              >
                파티에 합류시키기
              </button>
            )}
            {isElder && (
              <button type="button" className="dlg-btn" onClick={() => dispatch({ type: 'REST' })}>
                휴식하기 (파티 전원 회복)
              </button>
            )}
            <button type="button" className="dlg-btn is-quiet" onClick={close}>
              닫기
            </button>
          </>
        ) : null
      }
    />
  )
}
