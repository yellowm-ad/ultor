'use client'

// 공용 게임 창 — 가방 UI 디자인(검은 머리띠·사이드바 + 금 실선 + 아이보리 패널)을 모든 창이 같이 쓴다.
// 스타일: app/game-window.css. 아이콘은 PixelLab 도트(public/images/icons/menu/*).

import Image from 'next/image'
import type { ReactNode } from 'react'

export const EMBLEM_SRC = '/images/icons/menu/ultor-emblem.png'
export const menuIcon = (name: string) => `/images/icons/menu/${name}.png`

export interface GameWindowProps {
  title: string
  subtitle?: string
  onClose: () => void
  size?: 'sm' | 'md' | 'lg'
  /** 3단(사이드바·목록·상세) 화면 — 넓은 화면에서 높이를 고정하고 안쪽만 스크롤 */
  tall?: boolean
  /** 본문이 .gw-cols 3단일 때(바깥 스크롤 대신 칸별 스크롤) */
  cols?: boolean
  /** 머리띠 오른쪽(닫기 왼쪽)에 놓을 정보 알약 등 */
  headerExtra?: ReactNode
  /** 창마다 다른 최대 폭/높이(px) — 내용에 딱 맞게 */
  width?: number
  height?: number
  children: ReactNode
  zClass?: string
}

export function GameWindow({ title, subtitle, onClose, size = 'lg', tall, cols, headerExtra, width, height, children, zClass }: GameWindowProps) {
  const style = { ...(width ? { ['--gw-w' as string]: `${width}px` } : {}), ...(height ? { ['--gw-h' as string]: `${height}px` } : {}) }
  return (
    <div className={`gw-backdrop ${zClass ?? ''}`} onClick={onClose}>
      <div className={`gw-window is-${size} ${tall ? 'is-tall' : ''}`} style={style} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <header className="gw-head">
          <Image src={EMBLEM_SRC} alt="" width={56} height={56} className="gw-emblem" unoptimized />
          <h2 className="gw-title">{title}</h2>
          {subtitle && <span className="gw-subtitle hidden sm:inline">{subtitle}</span>}
          {headerExtra ? <div className="gw-head-extra">{headerExtra}</div> : <span className="ml-auto" />}
          <button type="button" className="gw-close" onClick={onClose} aria-label="닫기">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className={`gw-body ${cols ? 'is-cols' : ''}`}>{children}</div>
      </div>
    </div>
  )
}

/** 검은 사이드바 한 줄(아이콘 + 이름 + 개수) */
export function SideItem({ icon, label, count, active, locked, onClick }: { icon: string; label: string; count?: number; active?: boolean; locked?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`gw-side-item ${active ? 'is-active' : ''} ${locked ? 'is-locked' : ''}`} aria-pressed={active}>
      <Image src={icon} alt="" width={64} height={64} unoptimized />
      <span className="gw-side-label">{label}</span>
      {locked ? <span className="gw-lock">잠김</span> : count != null && count > 0 ? <span className="gw-count">{count}</span> : null}
    </button>
  )
}

/** 4방향 반짝임(구분선·리본·빈 상태) */
export function Sparkle({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 2c.5 5.2 1.8 8 10 10-8.2 2-9.5 4.8-10 10-.5-5.2-1.8-8-10-10 8.2-2 9.5-4.8 10-10Z" fill="currentColor" />
    </svg>
  )
}

export function Ribbon({ children }: { children: ReactNode }) {
  return (
    <div className="gw-ribbon">
      <Sparkle />
      {children}
    </div>
  )
}

export function Divider() {
  return (
    <div className="gw-divider" aria-hidden>
      <Sparkle />
    </div>
  )
}

/** 아이템 칸(보상·재료·장비) */
export function Slot({ icon, qty, short, label, title }: { icon?: string; qty?: number | string; short?: boolean; label?: string; title?: string }) {
  return (
    <div className="flex flex-col items-center" title={title}>
      <div className="gw-slot">
        {icon && <Image src={icon} alt="" width={44} height={44} unoptimized />}
        {qty != null && qty !== '' && <span className={`gw-slot-qty ${short ? 'is-short' : ''}`}>{qty}</span>}
      </div>
      {label && <span className="gw-slot-label">{label}</span>}
    </div>
  )
}

export function Bar({ value, kind }: { value: number; kind?: 'hp' | 'mp' | 'exp' | 'pink' }) {
  const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
  return (
    <div className={`gw-bar ${kind ? `is-${kind}` : ''}`}>
      <i style={{ width: `${v}%` }} />
    </div>
  )
}

/** 머리띠 정보 알약 — 골드 등 */
export function HeadPill({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <span className="gw-head-pill">
      <Image src={icon} alt="" width={24} height={24} unoptimized />
      {children}
    </span>
  )
}
