'use client'

import { useState } from 'react'
import { useGame } from '@/lib/game-state'
import { npcById } from '@/lib/mock-data'
import { npcWeeklyLine } from '@/lib/npc-weekly-lines'
import { Button } from '@/components/ui/button'
import { Portrait } from '@/components/game/portrait'
import { DiamondMark } from '@/components/game/ui-motifs'
import { coursesForWeek, nextCourseSkill } from '@/lib/academics'
import { skillById } from '@/lib/mock-data'

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
  craftStation: '제작대',
}

export function DialogueScreen() {
  const { state, dispatch } = useGame()
  const npc = state.activeNpcId ? npcById(state.activeNpcId) : null
  const [lineIdx, setLineIdx] = useState(0)

  if (!npc || state.screen !== 'dialogue') return null

  const close = () => {
    setLineIdx(0)
    dispatch({ type: 'CLOSE_OVERLAY' })
  }

  const isShopkeeper = ['weaponMerchant', 'potionMerchant', 'toolMerchant'].includes(npc.role)
  const isTamer = npc.role === 'petTamer'
  const isProfessor = npc.role === 'professor'
  const isElder = npc.role === 'housing'
  const isCraftStation = npc.role === 'craftStation'
  // 교수: 이번 학기 수업과 다음에 배울 마법 안내(전직 담당관 폐지 — 마법은 수업으로 배운다)
  const courseNotes = isProfessor
    ? coursesForWeek(state.calendar.globalWeek).flatMap((c) => {
        const nx = nextCourseSkill(c, state.academics.courseScore[c.id] ?? 0)
        return nx ? [`「${c.name}」 점수 ${nx.needScore} → ${skillById(nx.skillId)?.name ?? nx.skillId}`] : []
      })
    : []
  // 이번 주 대사(주간 풀)를 첫 줄로, 이어서 기본 인사
  const weekly = npcWeeklyLine(npc.id, state)
  const lines = weekly ? [weekly, ...npc.greeting] : npc.greeting
  const lastLine = lineIdx >= lines.length - 1

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-end justify-center bg-black/50 p-3 sm:p-6">
      {/* RPG 대화창 — 참고자료처럼 아이보리 양피지 본문 + 남색·금 이름표 */}
      <div className="relative w-full max-w-3xl">
        <div className="flex items-stretch gap-0">
          {/* 초상화 */}
          <div className="relative w-28 shrink-0 overflow-hidden rounded-l-xl border-y-[3px] border-l-[3px] border-gold sm:w-40">
            <Portrait id={npc.id} className="h-full w-full" />
          </div>

          {/* 본문 */}
          <div
            className="panel-parchment relative flex-1 p-4 pt-5"
            style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
          >
            <div className="absolute -top-3 left-4 flex items-center gap-1.5 rounded-full border-2 border-gold bg-gradient-to-b from-[#241f17] to-[#100d09] px-3 py-1 font-display text-sm text-gold-soft text-shadow-ink shadow-md">
              <DiamondMark size={10} />
              {npc.name}
              <span className="text-[10px] font-normal text-white/60">{ROLE_LABEL[npc.role]}</span>
            </div>

            <p className="min-h-16 pt-1 text-sm leading-relaxed text-[var(--parchment-foreground)]">{lines[lineIdx]}</p>

            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              {!lastLine && (
                <Button variant="parchment" size="sm" onClick={() => setLineIdx((i) => Math.min(lines.length - 1, i + 1))}>
                  ▼ 다음
                </Button>
              )}

              {lastLine && (isShopkeeper || isTamer) && (
                <Button variant="default" size="sm" onClick={() => dispatch({ type: 'OPEN_SHOP', npcId: npc.id })}>
                  {isTamer ? '먹이 상점' : '상점 열기'}
                </Button>
              )}

              {lastLine && isTamer && (
                <Button variant="default" size="sm" onClick={() => dispatch({ type: 'OPEN_TAMER', npcId: npc.id })}>
                  펫 훈련
                </Button>
              )}

              {lastLine && isCraftStation && (
                <Button variant="default" size="sm" onClick={() => dispatch({ type: 'OPEN_CRAFT', npcId: npc.id })}>
                  제작하기
                </Button>
              )}

              {lastLine && isElder && (
                <Button variant="default" size="sm" onClick={() => dispatch({ type: 'REST' })}>
                  휴식하기 (파티 전원 회복)
                </Button>
              )}

              {lastLine && isProfessor && (
                <span className="self-center text-[11px] text-[#6b5a38]">
                  {courseNotes.length ? `다음 수업 마법 — ${courseNotes.join(' · ')}` : '이번 학기 수업 마법은 모두 익혔거나 방학입니다.'}
                </span>
              )}

              <Button variant="ghost" size="sm" onClick={close} className="text-[var(--parchment-foreground)] hover:bg-black/10">
                닫기
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
