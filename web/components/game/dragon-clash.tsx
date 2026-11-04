'use client'

// 미르엘 vs 흑룡 — 최상급 마법 정면 충돌 연출(EP07_DRAGON_CLASH, lib/black-dragon).
//   대사 줄의 fx: 'clash-*' 로 단계가 바뀐다. 스토리 대화창 뒤 전체 무대.
//     arrive  — 미르엘이 일행 앞에 내려선다 / 흑룡이 오른쪽에서 몸을 들이민다
//     charge  — 미르엘: 멸화의 심판 기 모으기 · 흑룡: 입에 검은 폭풍을 삼킨다
//     collide — 불꽃 포격과 흑풍의 숨결이 한가운데서 부딪친다(섬광 · 흔들림)
//     retreat — 흑룡이 날개를 펴고 폭풍 속으로 물러난다
//   그림: 흑룡 전투용(PixelLab) · 미르엘 시전 모션(story-anims) · 스킬 이펙트 시트(battle/vfx) 재사용 — 새 생성 없음.

import { monsterById } from '@/lib/mock-data'
import { BLACK_DRAGON_ID } from '@/lib/black-dragon'

export type ClashPhase = 'arrive' | 'charge' | 'collide' | 'retreat'

const VFX = (n: string) => `/images/battle/vfx/skills/${n}.png`

/** 가로 프레임 띠를 반복 재생하는 칸 — frames 개, 한 칸 cell px, 표시 크기 size px */
function Strip({ src, frames = 16, cell = 64, size, dur, style, className = '', once = false }: { src: string; frames?: number; cell?: number; size: number; dur: number; style?: React.CSSProperties; className?: string; once?: boolean }) {
  return (
    <span
      className={`clash-strip ${className}`}
      style={{
        width: size,
        height: (size * 64) / 64,
        backgroundImage: `url(${src})`,
        backgroundSize: `${size * frames}px ${size}px`,
        ['--strip-end' as string]: `-${size * frames}px`,
        animationDuration: `${dur}s`,
        animationTimingFunction: `steps(${frames})`,
        animationIterationCount: once ? 1 : 'infinite',
        animationFillMode: once ? 'forwards' : undefined,
        ...style,
      }}
      data-cell={cell}
    />
  )
}

export function DragonClash({ phase }: { phase: ClashPhase }) {
  const col = monsterById(BLACK_DRAGON_ID)?.colossal
  return (
    <div className={`dragon-clash is-${phase}`} aria-hidden>
      <div className="clash-sky" />
      <div className="clash-rain" />
      {/* 흑룡 — 오른쪽에서 덮쳐 오는 구도(전투용 그림) */}
      {col && (
        <div className="clash-dragon">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={col.battle} alt="" />
          {(phase === 'charge' || phase === 'collide') && <Strip src={VFX('wind-tornado')} size={210} dur={0.9} className="clash-dragon-maw" />}
          {phase === 'retreat' && <Strip src={VFX('wind-tornado')} size={520} dur={1.1} className="clash-dragon-gale" />}
        </div>
      )}
      {/* 미르엘 — 시전 모션 96px × 8프레임 */}
      <div className="clash-mirel">
        <Strip src="/images/story-anims/mirel-cast.png" frames={8} cell={96} size={250} dur={1.1} />
        {phase === 'charge' && <Strip src={VFX('fire-master-1-cannon-charge')} size={260} dur={1.0} className="clash-mirel-charge" />}
        {phase === 'arrive' && <Strip src={VFX('fire-master-1-nova')} size={320} dur={0.9} once className="clash-mirel-land" />}
      </div>
      {/* 충돌 — 불꽃 포격(왼쪽) vs 흑풍의 숨결(오른쪽) */}
      {phase === 'collide' && (
        <>
          <div className="clash-beam is-fire">
            {[0, 1, 2, 3].map((i) => (
              <Strip key={i} src={VFX('fire-master-1-cannon-stream')} size={200} dur={0.42} style={{ left: i * 160 }} />
            ))}
          </div>
          <div className="clash-beam is-wind">
            {[0, 1, 2, 3].map((i) => (
              <Strip key={i} src={VFX('wind-gust')} size={200} dur={0.5} style={{ left: i * 160 }} />
            ))}
          </div>
          <Strip src={VFX('fire-master-1-cannon-head')} size={420} dur={0.62} className="clash-core" />
          <Strip src={VFX('fire-master-1-nova')} size={560} dur={0.8} className="clash-core is-back" />
          <div className="clash-flash" />
        </>
      )}
      <div className="clash-vignette" />
      {phase === 'collide' && <div className="clash-title">최상급 마법 — 멸화의 심판 × 흑풍의 숨결</div>}
    </div>
  )
}
