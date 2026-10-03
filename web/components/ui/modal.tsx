'use client'

import * as React from 'react'
import { GameWindow } from '@/components/game/game-window'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
  widthClass?: string
}

/** 남은 범용 모달(지도 등)도 공용 게임 창 틀(검은 머리띠 + 금테)로 보여 준다 */
export function Modal({ open, onClose, title, children, widthClass = 'max-w-xl' }: ModalProps) {
  if (!open) return null
  const size = /4xl|5xl|6xl/.test(widthClass) ? 'lg' : /2xl|3xl/.test(widthClass) ? 'md' : 'sm'
  return (
    <GameWindow title={title ?? ''} onClose={onClose} size={size}>
      {children}
    </GameWindow>
  )
}
