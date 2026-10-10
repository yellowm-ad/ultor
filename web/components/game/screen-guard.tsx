'use client'

import { Component, type ReactNode } from 'react'

/**
 * 창(대화·상점·가방 등) 하나가 그리다 죽어도 게임 전체가 하얗게 꺼지지 않게 막는다.
 * 죽은 창은 닫고(onCrash) 월드로 돌아가며, 무엇이 문제였는지 콘솔에 남긴다.
 */
export class ScreenGuard extends Component<{ onCrash: () => void; children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false }

  static getDerivedStateFromError() {
    return { crashed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[ScreenGuard] 창을 그리다 오류가 나서 닫았습니다:', error)
    this.props.onCrash()
    // 창이 닫힌 다음 틱에 다시 그릴 수 있게 되돌린다
    setTimeout(() => this.setState({ crashed: false }), 0)
  }

  render() {
    return this.state.crashed ? null : this.props.children
  }
}
