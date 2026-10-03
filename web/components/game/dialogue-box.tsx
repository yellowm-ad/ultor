'use client'

// 공용 대화창 — NPC 대화(dialogue-screen)·스토리 비트(story-overlay)가 같이 쓴다.
// 참고: 「대화 UI 수정안.png」 — 아이보리 본문 + 깎은 모서리 금테 + 장미색 리본 이름표 + 왼쪽 초상 메달리온
// + 오른쪽 나침반 워터마크 + 우상단 AUTO/빨리감기. 전부 CSS/SVG 라 어떤 해상도에서도 선이 뭉개지지 않는다.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

const TYPE_MS = 26 // 한 글자당
const AUTO_DELAY_MS = 1500 // 타이핑이 끝난 뒤 자동 진행까지

/** 글자를 하나씩 드러낸다. `done`이 되기 전 클릭하면 `finish()`로 한 번에 다 보여 준다. */
function useTypewriter(text: string) {
  const [shown, setShown] = useState(0)
  const [prevText, setPrevText] = useState(text)
  if (prevText !== text) {
    setPrevText(text)
    setShown(0)
  }
  const done = shown >= text.length
  useEffect(() => {
    if (done) return
    const t = setTimeout(() => setShown((n) => n + 1), TYPE_MS)
    return () => clearTimeout(t)
  }, [shown, done])
  return { visible: text.slice(0, shown), done, finish: () => setShown(text.length) }
}

export interface DialogueBoxProps {
  speaker?: string
  /** 이름표 옆 작은 직함(교수·상인 등) */
  role?: string
  portrait?: ReactNode
  text: string
  italic?: boolean
  /** 스토리 비트 제목 — 화면 왼쪽 위 장 표시 */
  title?: string
  /** 클릭·스페이스·AUTO 로 넘길 수 있는 상태인가 (마지막 줄에서 선택지/버튼을 기다리면 false) */
  canAdvance: boolean
  onAdvance: () => void
  /** ▶▶ — 마지막 줄로 건너뛰기 */
  onSkip?: () => void
  onClose?: () => void
  /** 타이핑이 끝난 뒤 본문 아래에 나오는 버튼들 */
  actions?: ReactNode
  zClass?: string
}

export function DialogueBox({ speaker, role, portrait, text, italic, title, canAdvance, onAdvance, onSkip, onClose, actions, zClass = 'z-40' }: DialogueBoxProps) {
  const { visible, done, finish } = useTypewriter(text)
  const [auto, setAuto] = useState(false)

  const advance = useCallback(() => {
    if (!done) return finish()
    if (canAdvance) onAdvance()
  }, [done, finish, canAdvance, onAdvance])

  // 엔터/스페이스로 넘기기. 선택지·액션 버튼에 포커스가 있으면 그 버튼을 누르게 두고,
  // AUTO 같은 컨트롤 버튼에 포커스가 남아 있어도 엔터는 "다음 대사"로 동작한다.
  const advanceRef = useRef(advance)
  useEffect(() => {
    advanceRef.current = advance
  }, [advance])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || (e.code !== 'Enter' && e.code !== 'NumpadEnter' && e.code !== 'Space')) return
      const t = e.target as HTMLElement | null
      if (t?.closest('.dlg-actions button')) return
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      e.preventDefault()
      e.stopPropagation()
      advanceRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // AUTO — 다 읽히면 잠시 뒤 자동으로 다음 줄
  useEffect(() => {
    if (!auto || !done || !canAdvance) return
    const t = setTimeout(onAdvance, AUTO_DELAY_MS)
    return () => clearTimeout(t)
  }, [auto, done, canAdvance, onAdvance, text])

  return (
    <div className={`dlg-root pointer-events-auto absolute inset-0 ${zClass}`} onClick={advance}>
      <div className="absolute inset-x-0 bottom-0 flex justify-center px-3 pb-3 sm:px-6 sm:pb-6">
        <div className={`dlg-wrap relative w-full max-w-4xl ${portrait ? 'has-portrait' : ''}`}>
          {/* 대화창 바로 위 오른쪽 — 화면 구석에 두면 HUD(파티·설정·체력바)와 겹친다 */}
          <div className="dlg-toolbar" onClick={(e) => e.stopPropagation()}>
            {title && <span className="dlg-chapter">{title}</span>}
            <button type="button" className={`dlg-ctl ${auto ? 'is-on' : ''}`} onClick={() => setAuto((a) => !a)} aria-pressed={auto} title="자동 진행">
              <span className="text-[10px] font-bold tracking-wide">AUTO</span>
            </button>
            {onSkip && (
              <button type="button" className="dlg-ctl" onClick={onSkip} title="건너뛰기">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                  <path d="M3 5l9 7-9 7zM12 5l9 7-9 7z" fill="currentColor" />
                </svg>
              </button>
            )}
            {onClose && (
              <button type="button" className="dlg-ctl" onClick={onClose} title="닫기">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>

          {/* 초상 메달리온 — 본문 위로 솟아오르게 */}
          {portrait && (
            <div className="dlg-portrait">
              <div className="dlg-portrait-frame">
                <div className="dlg-portrait-mat">
                  <div className="dlg-portrait-line">
                    <div className="dlg-portrait-img">{portrait}</div>
                  </div>
                </div>
              </div>
              {/* 울토르 문장(PixelLab) */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/icons/menu/ultor-emblem.png" alt="" className="dlg-star" />
            </div>
          )}

          {/* 본문 */}
          <div className="dlg-frame">
            <div className="dlg-panel">
              <Compass className="dlg-watermark" />
              <p className={`dlg-text ${italic ? 'italic' : ''}`}>
                {visible}
                {/* 남은 글자는 투명하게 깔아 두어 타이핑 중에도 줄바꿈 위치·높이가 흔들리지 않게 */}
                <span className="invisible">{text.slice(visible.length)}</span>
              </p>
              <div className="dlg-actions" onClick={(e) => e.stopPropagation()}>
                {done && actions}
              </div>
              {/* 클릭은 바깥(.dlg-root)의 advance 로 전달된다 */}
              {done && canAdvance && (
                <button type="button" className="dlg-next" aria-label="다음 대사 (Enter)">
                  <span className="dlg-next-label">다음</span>
                  <NextMark className="dlg-next-icon" />
                </button>
              )}
            </div>
          </div>

          {/* 깎은 모서리 바깥 장식(프레임 클립 밖이라 형제로 둔다) */}
          <Sparkle className="dlg-edge-spark" />
          <span className="dlg-corner-tr" aria-hidden />

          {speaker && (
            <div className="dlg-name">
              <span className="dlg-name-emblem" aria-hidden>
                <Sparkle />
              </span>
              <span className="dlg-name-text">{speaker}</span>
              {role && <span className="dlg-name-role">{role}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** 4방향 반짝임 */
function Sparkle({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 0c.7 6.2 2.6 9.8 12 12-9.4 2.2-11.3 5.8-12 12-.7-6.2-2.6-9.8-12-12 9.4-2.2 11.3-5.8 12-12Z" fill="currentColor" />
    </svg>
  )
}

/** ▼ 다음 표시 — 마름모 + 화살촉 */
function NextMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 2l3 3-3 3-3-3z" fill="currentColor" />
      <path d="M4 10l8 7 8-7-2.2-.1L12 14.2 6.2 9.9z" fill="currentColor" />
      <path d="M8 18.5l4 3.5 4-3.5z" fill="currentColor" opacity=".7" />
    </svg>
  )
}

/** 본문 오른쪽 나침반 워터마크 */
function Compass({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <g fill="none" stroke="currentColor">
        <circle cx="100" cy="100" r="92" strokeWidth="1" />
        <circle cx="100" cy="100" r="84" strokeWidth=".6" strokeDasharray="2 4" />
        <circle cx="100" cy="100" r="58" strokeWidth=".8" />
        <circle cx="100" cy="100" r="30" strokeWidth=".6" />
      </g>
      {[0, 90, 180, 270].map((a) => (
        <path key={a} d="M100 4 L111 89 L100 100 L89 89Z" transform={`rotate(${a} 100 100)`} fill="currentColor" opacity=".9" />
      ))}
      {[45, 135, 225, 315].map((a) => (
        <path key={a} d="M100 40 L106 94 L100 100 L94 94Z" transform={`rotate(${a} 100 100)`} fill="currentColor" opacity=".6" />
      ))}
    </svg>
  )
}
