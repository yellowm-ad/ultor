'use client'

// 등급 배지 · 등급 액자(2026-11-04, lib/grades)
//   GradeBadge  — 목록용 작은 배지: 단계별 색 + 장식 기호(◇ ◆ ✧ ✦), 높은 단계는 반짝임이 흐른다
//   GradeRibbon — 상세용 띠: 기존 리본 그림(ui/px/banner.png) 위에 등급 이름 + 수식 문구
//   GradeFrame  — 아이템 그림 창: 단계별 배경색 · 테두리, 희귀부터 금빛 모서리 장식(ui/px/corner.png), 신화·고유는 빛살이 돈다

import type { GradeInfo } from '@/lib/grades'

export function GradeBadge({ info, className = '' }: { info: GradeInfo; className?: string }) {
  return (
    <span className={`grade-badge tone-${info.tone} ${className}`} title={info.epithet}>
      {info.mark && <i aria-hidden>{info.mark}</i>}
      <b>{info.label}</b>
      {info.mark && <i aria-hidden>{info.mark}</i>}
    </span>
  )
}

export function GradeRibbon({ info, suffix }: { info: GradeInfo; suffix?: string }) {
  return (
    <div className={`grade-ribbon tone-${info.tone}`}>
      <span className="grade-ribbon-name">
        {info.mark && <i aria-hidden>{info.mark}</i>}
        {info.label}
        {suffix ? ` ${suffix}` : ''}
        {info.mark && <i aria-hidden>{info.mark}</i>}
      </span>
      <span className="grade-ribbon-epithet">{info.epithet}</span>
    </div>
  )
}

export function GradeFrame({ tone, children, size = 84 }: { tone: number; children: React.ReactNode; size?: number }) {
  return (
    <div className={`grade-frame tone-${tone}`} style={{ width: size, height: size }}>
      {tone >= 4 && <span className="grade-frame-rays" aria-hidden />}
      <span className="grade-frame-inner">{children}</span>
      {tone >= 3 && (
        <>
          <span className="grade-frame-corner is-tl" aria-hidden />
          <span className="grade-frame-corner is-tr" aria-hidden />
          {tone >= 4 && <span className="grade-frame-corner is-bl" aria-hidden />}
          {tone >= 4 && <span className="grade-frame-corner is-br" aria-hidden />}
        </>
      )}
      {tone >= 5 && <span className="grade-frame-shine" aria-hidden />}
    </div>
  )
}
