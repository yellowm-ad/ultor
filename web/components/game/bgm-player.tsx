'use client'

// 배경음 재생기 — lib/bgm 의 bgmChain(지금 상황 → 후보 칸)으로 곡을 골라, 곡이 바뀌면 부드럽게 겹쳐 넘긴다.
//   · 음량 = 설정 「배경음 음량」. 0 이면 멈춘다.
//   · 브라우저는 사용자가 한 번 누르기 전엔 소리를 막는다 → 첫 클릭·키 입력 때 다시 튼다.
//   · 마을·야생 곡은 전투·스토리로 잠깐 바뀌었다 돌아오면 멈췄던 자리부터 이어서 튼다.
//   · 탭이 가려지면 멈추고, 돌아오면 이어서 튼다.
//   · 한 번만 나오는 곡(승리·패배·수업 종료)은 되풀이하지 않는다.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '@/lib/game-state'
import { bgmChain, bgmSlot, initBgm, onBgmChange, resolveBgm } from '@/lib/bgm'

const FADE_MS = 900
/** 이어 틀 곡(돌아왔을 때 멈춘 자리부터) */
const RESUMABLE = /^(town|field)/

type Track = { el: HTMLAudioElement; url: string; slot: string; fade: number }

function fadeTo(t: Track, to: number, ms: number, done?: () => void) {
  cancelAnimationFrame(t.fade)
  const from = t.el.volume
  const t0 = performance.now()
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / ms)
    t.el.volume = Math.max(0, Math.min(1, from + (to - from) * k))
    if (k < 1) t.fade = requestAnimationFrame(step)
    else done?.()
  }
  // 탭이 가려져 있으면 rAF 가 멈추므로 바로 맞춘다
  if (document.hidden || ms <= 0) {
    t.el.volume = Math.max(0, Math.min(1, to))
    done?.()
  } else t.fade = requestAnimationFrame(step)
}

export function BgmPlayer() {
  const { state } = useGame()
  const [version, setVersion] = useState(0)
  const cur = useRef<Track | null>(null)
  const resumeAt = useRef(new Map<string, number>())
  const volume = Math.max(0, Math.min(100, state.settings.bgmVolume ?? 60)) / 100
  const volRef = useRef(volume)
  volRef.current = volume

  useEffect(() => {
    void initBgm().then(() => setVersion((v) => v + 1))
    return onBgmChange(() => setVersion((v) => v + 1))
  }, [])

  // 상황이 바뀔 때만 다시 고른다(이동 중 매 프레임 바뀌는 값은 넣지 않는다)
  const chain = bgmChain(state)
  const chainKey = chain.join('|')
  const pick = useMemo(() => resolveBgm(chainKey.split('|')), [chainKey, version])
  const url = volume > 0 ? (pick?.src.url ?? null) : null

  useEffect(() => {
    const prev = cur.current
    if (prev && prev.url === url) {
      prev.slot = pick?.slot ?? prev.slot
      return
    }
    // 이전 곡 — 이어 틀 곡이면 자리를 기억하고 서서히 줄여 멈춘다
    if (prev) {
      if (RESUMABLE.test(prev.slot) && !prev.el.ended) resumeAt.current.set(prev.url, prev.el.currentTime)
      cur.current = null
      fadeTo(prev, 0, FADE_MS, () => {
        prev.el.pause()
        prev.el.removeAttribute('src')
        prev.el.load()
      })
    }
    if (!url || !pick) return
    const el = new Audio(url)
    const once = !!bgmSlot(pick.slot)?.once
    el.loop = !once
    el.preload = 'auto'
    el.volume = 0
    const at = RESUMABLE.test(pick.slot) ? resumeAt.current.get(url) : undefined
    if (at) el.addEventListener('loadedmetadata', () => (el.currentTime = at % (el.duration || Infinity)), { once: true })
    const t: Track = { el, url, slot: pick.slot, fade: 0 }
    cur.current = t
    const start = () => {
      if (document.hidden) return
      el.play()
        .then(() => fadeTo(t, volRef.current, prev ? FADE_MS : FADE_MS / 2))
        .catch(() => {
          /* 아직 사용자가 누르지 않음 — 아래 첫 입력 때 다시 */
        })
    }
    start()
  }, [url, pick])

  // 음량 바꾸기
  useEffect(() => {
    const t = cur.current
    if (t && !t.el.paused) fadeTo(t, volume, 150)
  }, [volume])

  // 첫 입력 때 막혀 있던 재생 풀기 · 탭이 가려지면 멈춤
  useEffect(() => {
    const kick = () => {
      const t = cur.current
      if (t && t.el.paused && !t.el.ended && !document.hidden) t.el.play().then(() => fadeTo(t, volRef.current, FADE_MS / 2)).catch(() => {})
    }
    const vis = () => {
      const t = cur.current
      if (!t) return
      if (document.hidden) t.el.pause()
      else kick()
    }
    window.addEventListener('pointerdown', kick)
    window.addEventListener('keydown', kick)
    document.addEventListener('visibilitychange', vis)
    return () => {
      window.removeEventListener('pointerdown', kick)
      window.removeEventListener('keydown', kick)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [])

  // 화면을 떠날 때 정리
  useEffect(
    () => () => {
      const t = cur.current
      if (t) {
        cancelAnimationFrame(t.fade)
        t.el.pause()
      }
    },
    [],
  )

  return null
}
