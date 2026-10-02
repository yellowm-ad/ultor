'use client'

// ============================================================================
// 수업 장면 오버레이 — 교실 착석(월드) 위에 얹힌다.
//   ① 강의 5초(교수 강의 애니 + 학생 경청 애니 + 말풍선, 레터박스·과목 타이틀)
//   ② 교수 머리 위 느낌표 → 화면이 천천히 어두워지며 미니게임 전환
//   ③ 미니게임(시험은 2~3개 연속)
//   ④ 수업 종료 — 4초(BGM 자리) 동안 가운데 '수업 종료' 배너가 쿵 → 평가창 → [다음] → 원래 자리로
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { useGame } from '@/lib/game-state'
import { calendarLabel } from '@/lib/calendar'
import { classMetaFor, MINIGAME_META, professorById, type MiniGameType } from '@/lib/curriculum'
import { MiniGame } from '@/components/game/class-minigames'

const LECTURE_MS = 5000
const ALERT_MS = 1400
const TRANSITION_MS = 1600
const END_HOLD_MS = 4000 // 수업 종료 BGM 자리(BGM 은 아직 없음 — playClassEndJingle 훅)

/** 수업 종료 BGM 훅 — 사운드 시스템이 생기면 여기서 재생 */
function playClassEndJingle() {
  /* BGM 미적용 */
}

export function ClassSceneOverlay() {
  const { state, dispatch } = useGame()
  const sc = state.classScene
  const [stage, setStage] = useState<'lecture' | 'alert' | 'transition' | 'intro' | 'play' | 'stamp' | 'panel'>('lecture')
  const timers = useRef<number[]>([])
  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms))

  // 단계 진행
  useEffect(() => {
    if (!sc) return
    clearTimers()
    if (sc.phase === 'lecture') {
      setStage('lecture')
      later(LECTURE_MS, () => {
        setStage('alert')
        dispatch({ type: 'CLASS_ALERT' })
      })
      later(LECTURE_MS + ALERT_MS, () => setStage('transition'))
      later(LECTURE_MS + ALERT_MS + TRANSITION_MS, () => dispatch({ type: 'CLASS_BEGIN_GAMES' }))
    } else if (sc.phase === 'game') {
      setStage('intro')
      later(1500, () => setStage('play'))
    } else if (sc.phase === 'result') {
      setStage('stamp')
      playClassEndJingle()
      later(END_HOLD_MS, () => setStage('panel'))
    }
    return clearTimers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sc?.phase, sc?.index])

  const onGrant = useCallback((items: { itemId: string; qty: number }[]) => dispatch({ type: 'CLASS_GIVE_ITEMS', items }), [dispatch])

  if (!sc) return null
  const prof = professorById(sc.professorId)
  const meta = classMetaFor(sc.courseId)
  const isExam = sc.kind === 'midterm' || sc.kind === 'final'
  const gameType = sc.games[sc.index] as MiniGameType | undefined
  const dark = stage === 'transition' || stage === 'intro' || stage === 'play' || stage === 'stamp' || stage === 'panel'

  return (
    <div className="class-overlay pointer-events-none fixed inset-0 z-[60]">
      {/* 레터박스 */}
      <div className={`class-letterbox class-letterbox-top ${stage === 'lecture' || stage === 'alert' ? 'on' : ''}`} />
      <div className={`class-letterbox class-letterbox-bottom ${stage === 'lecture' || stage === 'alert' ? 'on' : ''}`} />

      {/* 과목 타이틀 */}
      {(stage === 'lecture' || stage === 'alert') && (
        <div className="class-title-card">
          <div className="class-title-kind">{isExam ? (sc.kind === 'midterm' ? '중간고사' : '기말고사') : sc.kind === 'practice' ? '기말 대비 실습' : '이번 주 수업'}</div>
          <div className="class-title-name">{sc.label}</div>
          <div className="class-title-sub">
            {prof?.name} · {calendarLabel(state.calendar.globalWeek)}
          </div>
        </div>
      )}

      {/* 화면 전환 + 미니게임 */}
      <div className={`class-veil ${dark ? 'on' : ''}`} />
      {stage === 'intro' && gameType && (
        <div className="class-center">
          <div className="class-game-intro">
            {isExam && (
              <div className="class-title-kind">
                {sc.kind === 'midterm' ? '중간고사' : '기말고사'} {sc.index + 1}/{sc.games.length}
              </div>
            )}
            <div className="class-game-intro-name">{MINIGAME_META[gameType].name}</div>
            <div className="class-game-intro-desc">{MINIGAME_META[gameType].desc}</div>
          </div>
        </div>
      )}
      {stage === 'play' && gameType && sc.phase === 'game' && (
        <div className="class-center pointer-events-auto">
          <div className="class-game-frame">
            <div className="class-game-head">
              <span>{MINIGAME_META[gameType].name}</span>
              <span className="opacity-70">{prof?.name}</span>
            </div>
            <MiniGame
              key={`${sc.index}-${gameType}`}
              type={gameType}
              seed={sc.seed + sc.index * 7919}
              year={Math.max(1, Math.min(4, Math.ceil(state.calendar.globalWeek / 48)))}
              style={meta.rhythm}
              field={meta.field}
              courseId={sc.courseId}
              onGrant={onGrant}
              onDone={(score, label) => dispatch({ type: 'CLASS_GAME_DONE', score, label })}
            />
          </div>
        </div>
      )}

      {/* 수업 종료 — 배너 쿵 */}
      {stage === 'stamp' && (
        <div className="class-center">
          <div className="class-end-banner">
            <img src="/images/class/ui/class_end_banner.png" alt="" />
            <span>수업 종료</span>
          </div>
        </div>
      )}

      {/* 평가창 */}
      {stage === 'panel' && sc.result && (
        <div className="class-center pointer-events-auto">
          <div className="class-result panel-royal">
            <div className="class-result-head">
              <div>
                <div className="class-title-kind">수업 평가</div>
                <div className="class-result-title">{sc.label}</div>
                <div className="text-[11px] opacity-70">{prof?.name}</div>
              </div>
              <div className="class-grade" data-g={sc.result.grade}>
                {sc.result.grade}
              </div>
            </div>
            <div className="class-result-scores">
              {sc.scores.map((s, i) => (
                <div key={i} className="class-score-row">
                  <span>{MINIGAME_META[s.type as MiniGameType]?.name ?? s.type}</span>
                  <div className="class-score-bar">
                    <div style={{ width: `${s.score}%` }} />
                  </div>
                  <span className="w-16 text-right">
                    {s.score}점 <em>{s.label}</em>
                  </span>
                </div>
              ))}
              <div className="class-score-total">종합 {sc.result.score}점</div>
            </div>
            <ul className="class-rewards">
              {sc.result.lines.map((l, i) => (
                <li key={i}>✦ {l}</li>
              ))}
            </ul>
            <button className="mg-btn mg-btn-gold self-end" onClick={() => dispatch({ type: 'CLASS_FINISH' })}>
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
