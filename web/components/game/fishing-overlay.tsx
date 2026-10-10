'use client'

// 낚시 미니게임 (§35) — 입질을 기다렸다가, 좌우로 오가는 바늘이 초록 구간에 있을 때 당긴다.
// 어종 난이도(state.fishing.difficulty)가 높을수록 구간이 좁고 바늘이 빠르다.
// 결과는 FISHING_RESULT 로 리듀서에 넘기고(어획물·도감·퀘스트), 연출은 전부 여기서 처리.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useGame } from '@/lib/game-state'
import { itemById } from '@/lib/mock-data'
import { Button } from '@/components/ui/button'

type Phase = 'waiting' | 'bite' | 'result'

export function FishingOverlay() {
  const { state, dispatch } = useGame()
  const session = state.fishing
  const [phase, setPhase] = useState<Phase>('waiting')
  const [needle, setNeedle] = useState(0) // 0~1
  const [result, setResult] = useState<boolean | null>(null)
  const raf = useRef(0)
  const t0 = useRef(0)

  const difficulty = session?.difficulty ?? 0.3
  const zoneW = Math.max(0.1, 0.34 - difficulty * 0.24)
  const zoneStart = 0.5 - zoneW / 2
  const speed = 0.9 + difficulty * 1.6 // 왕복/초

  // 입질 대기 → 바늘 시작
  useEffect(() => {
    if (!session) return
    setPhase('waiting')
    setResult(null)
    const wait = 700 + Math.random() * 1500
    const id = window.setTimeout(() => {
      setPhase('bite')
      t0.current = performance.now()
    }, wait)
    return () => window.clearTimeout(id)
  }, [session])

  useEffect(() => {
    if (phase !== 'bite') return
    const tick = (t: number) => {
      const s = (t - t0.current) / 1000
      // 핑퐁 0→1→0
      const x = (s * speed) % 2
      setNeedle(x < 1 ? x : 2 - x)
      // 4초 안에 못 당기면 놓침
      if (s > 4) {
        setResult(false)
        setPhase('result')
        return
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [phase, speed])

  const pull = useCallback(() => {
    if (phase === 'waiting') {
      // 입질 전에 당기면 실패
      setResult(false)
      setPhase('result')
      return
    }
    if (phase !== 'bite') return
    cancelAnimationFrame(raf.current)
    setResult(needle >= zoneStart && needle <= zoneStart + zoneW)
    setPhase('result')
  }, [phase, needle, zoneStart, zoneW])

  const finish = useCallback(() => {
    dispatch({ type: 'FISHING_RESULT', success: !!result })
  }, [dispatch, result])

  useEffect(() => {
    if (!session) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'KeyE') {
        e.preventDefault()
        if (phase === 'result') finish()
        else pull()
      }
      if (e.key === 'Escape') dispatch({ type: 'FISHING_RESULT', success: false })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [session, phase, pull, finish, dispatch])

  if (!session) return null
  const fish = itemById(session.fishId)

  return (
    <div className="pointer-events-auto absolute inset-0 z-[46] flex items-end justify-center bg-black/35 p-4 pb-24">
      <div className="panel-royal w-full max-w-md p-4 text-center">
        <div className="mb-2 font-display text-gold-soft">낚시</div>
        {/* 물가 장면 — 찌가 까딱이다가 입질이 오면 물속으로 꺼지고, 낚으면 물고기가 튀어 오른다 */}
        <div className={`fish-scene is-${phase} ${phase === 'result' ? (result ? 'is-win' : 'is-lose') : ''}`}>
          <span className="fish-line" />
          <span className="fish-bobber" />
          <span className="fish-ripple" />
          <span className="fish-ripple is-late" />
          {phase === 'result' && result && fish && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fish.icon} alt="" className="fish-catch" />
          )}
        </div>
        {phase === 'waiting' && <div className="py-4 text-sm text-white/80">찌를 바라보며 입질을 기다리는 중… (지금 당기면 놓친다)</div>}
        {phase !== 'waiting' && (
          <div className="relative mx-auto my-3 h-6 w-full overflow-hidden rounded-full border border-gold/50 bg-black/50">
            <div className="absolute inset-y-0 bg-emerald-500/60" style={{ left: `${zoneStart * 100}%`, width: `${zoneW * 100}%` }} />
            <div className="absolute inset-y-[-2px] w-1.5 -translate-x-1/2 rounded bg-gold-soft shadow" style={{ left: `${needle * 100}%` }} />
          </div>
        )}
        {phase === 'bite' && <div className="text-sm font-bold text-gold-soft">입질이다! 초록 구간에서 당겨! (Space / E)</div>}
        {phase === 'result' && (
          <div className="py-1 text-sm text-white/90">{result ? `${fish?.name ?? '물고기'}을(를) 낚았다!` : '물고기가 도망갔다…'}</div>
        )}
        <div className="mt-3 flex justify-center gap-2">
          {phase === 'result' ? (
            <Button onClick={finish}>확인</Button>
          ) : (
            <>
              <Button onClick={pull}>당기기</Button>
              <Button variant="ghost" onClick={() => dispatch({ type: 'FISHING_RESULT', success: false })}>
                그만두기
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
