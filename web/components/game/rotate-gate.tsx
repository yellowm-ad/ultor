'use client'

// 휴대폰은 가로로만(2026-10-18) — 터치 기기(html.touch-ui)를 세로로 들면 게임 위를 덮어 "가로로 돌려 주세요"를 띄운다.
//   · 「전체 화면으로 시작」 = 전체 화면 + 가로 잠금(안드로이드 크롬 등 지원 브라우저). iOS 사파리는 잠금이 없어 직접 돌리면 사라진다
//   · 설치형 웹앱(app/manifest.ts orientation: landscape)으로 열면 처음부터 가로
import { useEffect, useState } from 'react'

export async function enterLandscapeFullscreen() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })
  } catch {}
  try {
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
    await o.lock?.('landscape')
  } catch {}
}

export function RotateGate() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)')
    const update = () => setShow(document.documentElement.classList.contains('touch-ui') && mq.matches)
    update()
    mq.addEventListener('change', update)
    window.addEventListener('resize', update)
    return () => {
      mq.removeEventListener('change', update)
      window.removeEventListener('resize', update)
    }
  }, [])
  if (!show) return null
  return (
    <div className="rotate-gate" role="dialog" aria-label="화면을 가로로 돌려 주세요">
      <div className="rotate-gate-phone" aria-hidden>
        <span />
      </div>
      <p className="rotate-gate-title">화면을 가로로 돌려 주세요</p>
      <p className="rotate-gate-sub">울토르는 가로 화면에서 플레이합니다.</p>
      <button type="button" className="rotate-gate-btn" onClick={enterLandscapeFullscreen}>
        전체 화면으로 시작
      </button>
    </div>
  )
}
