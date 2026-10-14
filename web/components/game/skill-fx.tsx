'use client'

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { BattleFx, Element } from '@/lib/types'
import { fxTier, skillMotion, type MotionTier } from '@/lib/skill-motion'

/** 연출 색 키 — 속성 없음(null)은 'none' */
type FxKey = Element | 'none'

// ============================================================================
// 스킬 모션(VFX) — 참고: 데스크톱 "스킬 모션.png" 연출 가이드(시전준비→발동→대상이동→임팩트→상태효과).
// 67개 스킬/물약/도구 전부를 낱개로 손그림 애니메이션화하는 대신, element × archetype 로 조합되는
// 소수의 재사용 가능한 절차적 연출(투사체·버스트·디버프 안개·힐 광휘·버프 링)을 만들어 전체를 커버한다.
// 매 행동마다 lib/battle-engine.ts 의 resolveAction() 이 새 fxId 로 BattleFx 를 발급 → 이 컴포넌트가
// fxId 를 React key 로 써서 매번 새로 마운트되며 CSS 애니메이션을 재생하고, 끝나면 그대로 사라진다.
//
// 등급(tier) — MP 소모량이 클수록 더 복잡하고 더 광범위한 연출이 추가로 겹겹이 쌓인다(fxTier 참고).
// tier1(기초): 기존 연출 그대로. tier2: 룬 서클 + 파티클. tier3: 이중 룬 + 충격파 링.
// tier4(궁극기): 원소별 시그니처 노바(불=스타버스트+불티, 얼음=크리스탈 샤드, 대지=균열+암석,
// 무속성=강림하는 빛기둥) + 화면 비네트 펄스 + (battle-screen.tsx 에서) 화면 흔들림.
// ============================================================================

const FX_COLORS: Record<FxKey, { a: string; b: string }> = {
  fire: { a: '#ff7a3c', b: '#ffd580' },
  ice: { a: '#7fd0f5', b: '#e6faff' },
  earth: { a: '#c99a52', b: '#8a6a35' },
  dark: { a: '#7b4fc4', b: '#d6b8ff' },
  light: { a: '#ffe27a', b: '#fffbe6' },
  wind: { a: '#5fd4a8', b: '#e2fff4' },
  // 무속성 = 무채색(흰·은회색) — 어느 속성 색에도 기울지 않게
  none: { a: '#c4c9d0', b: '#ffffff' },
}

// PixelLab 도트 이펙트 스프라이트시트(9프레임) — 절차적 CSS 연출 위에 얹는 실제 픽셀아트 레이어.
// animate_image 로 생성(불/얼음/대지 임팩트 + 회복 반짝임), 가로 9프레임 시트로 합성됨.
// 어둠·빛·바람·무속성은 같은 규격·화풍으로 직접 찍은 시트(scripts/gen-vfx-sheets.mjs)
const PIXEL_BURST_SHEET: Partial<Record<FxKey, string>> = {
  fire: '/images/battle/vfx/fire_burst.png',
  ice: '/images/battle/vfx/ice_burst.png',
  earth: '/images/battle/vfx/earth_burst.png',
  dark: '/images/battle/vfx/dark_burst.png',
  light: '/images/battle/vfx/light_burst.png',
  wind: '/images/battle/vfx/wind_burst.png',
  none: '/images/battle/vfx/neutral_burst.png',
}
const PIXEL_HEAL_SHEET = '/images/battle/vfx/heal_burst.png'
const PIXEL_SLASH_SHEET = '/images/battle/vfx/slash_burst.png'
const PIXEL_DEBUFF_SHEET = '/images/battle/vfx/debuff_burst.png'
const PIXEL_BUFF_SHEET = '/images/battle/vfx/buff_burst.png'
const PIXEL_FRAMES = 9

/**
 * 도트 질감 텍스처 — 작은 캔버스에 칸 단위로 찍고(디더링) 화면에선 image-rendering: pixelated 로 키운다.
 * 같은 색·모양은 한 번만 만든다. (벡터처럼 매끈한 그라데이션 대신 PixelLab 이펙트와 같은 도트 결)
 */
const PIX_CACHE = new Map<string, string>()
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
function pixelTex(key: string, w: number, h: number, paint: (x: number, y: number) => string | null): string {
  const hit = PIX_CACHE.get(key)
  if (hit) return hit
  if (typeof document === 'undefined') return ''
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d')!
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = paint(x, y)
      if (!c) continue
      ctx.fillStyle = c
      ctx.fillRect(x, y, 1, 1)
    }
  const url = cv.toDataURL()
  PIX_CACHE.set(key, url)
  return url
}
const dither = (x: number, y: number) => (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16

function PixelBurst({ pos, sheet, size = 84, duration = 420, delay = 0, filter }: { pos: FxPos; sheet: string; size?: number; duration?: number; delay?: number; filter?: string }) {
  return (
    <div
      className="fx-pixel-burst absolute -translate-x-1/2 -translate-y-1/2"
      style={{
        left: `${pos.left}%`,
        top: `${pos.top}%`,
        width: size,
        height: size,
        backgroundImage: `url(${sheet})`,
        backgroundSize: `${PIXEL_FRAMES * size}px ${size}px`,
        animationDelay: `${delay}ms`,
        filter,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['--fx-dur' as any]: `${duration}ms`,
        ['--fx-steps' as any]: PIXEL_FRAMES - 1,
        ['--fx-end' as any]: `${-(PIXEL_FRAMES - 1) * size}px`,
      }}
    />
  )
}

export type FxTier = MotionTier
export { fxTier }

export interface FxPos {
  left: number
  top: number
}

interface FxBox {
  w: number
  h: number
}

/**
 * 전투 연출 레이어. fx 가 바뀔 때마다(fxId) 장면을 새로 마운트해 CSS 애니메이션을 처음부터 재생한다.
 * posOf = 몸통 가운데, groundOf = 발밑(마법진·솟구치는 바위가 놓이는 자리).
 * 빔은 두 점 사이의 실제 픽셀 거리·각도가 필요해서 레이어 크기를 재 둔다.
 */
export function SkillFxLayer({
  fx,
  posOf,
  groundOf,
  speed = 1,
}: {
  fx: BattleFx | undefined
  posOf: (uid: string) => FxPos | undefined
  groundOf?: (uid: string) => FxPos | undefined
  speed?: 1 | 2
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<FxBox>({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const read = () => setBox((b) => (b.w === el.clientWidth && b.h === el.clientHeight ? b : { w: el.clientWidth, h: el.clientHeight }))
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={boxRef} className="pointer-events-none absolute inset-0 z-30" aria-hidden>
      {fx && <FxScene key={fx.fxId} fx={fx} posOf={posOf} groundOf={groundOf ?? posOf} speed={speed} box={box} stage={boxRef} />}
    </div>
  )
}

function FxScene({
  fx,
  posOf,
  groundOf,
  speed,
  box,
  stage,
}: {
  fx: BattleFx
  posOf: (uid: string) => FxPos | undefined
  groundOf: (uid: string) => FxPos | undefined
  speed: 1 | 2
  box: FxBox
  stage: React.RefObject<HTMLDivElement | null>
}) {
  const m = skillMotion(fx, speed)
  const fxKey: FxKey = fx.element ?? 'none'
  const col = FX_COLORS[fxKey]
  const sourcePos = posOf(fx.sourceUid)
  const sourceGround = groundOf(fx.sourceUid)
  const targets = fx.targetUids
    .map((uid) => ({ pos: posOf(uid), ground: groundOf(uid) }))
    .filter((t): t is { pos: FxPos; ground: FxPos } => !!t.pos && !!t.ground)
  const targetPositions = targets.map((t) => t.pos)
  const tier = m.tier
  const scale = (0.85 + Math.min(1.4, fx.power) * 0.35) * (1 + (tier - 1) * 0.18)
  const waveAt = (w: number) => m.impactMs + w * m.waveGapMs
  const waves = Array.from({ length: m.waves }, (_, w) => w)
  // 쏟아붓는 구간 길이(빔·빛기둥·바위가 유지되는 시간)
  const sustainMs = Math.max(380, m.waves * m.waveGapMs + 260)
  const center: FxPos | undefined = targetPositions.length
    ? { left: targetPositions.reduce((s, p) => s + p.left, 0) / targetPositions.length, top: targetPositions.reduce((s, p) => s + p.top, 0) / targetPositions.length }
    : undefined
  const supportCol =
    fx.archetype === 'heal' ? { a: '#8fe89a', b: '#f2fff0' } : col
  const hits = fx.archetype === 'magicAttack' || fx.archetype === 'attack'
  // 타격감 — 맞는 순간마다 전장이 짧게 흔들린다(첫 타·궁극기 마무리는 크게). 전장(battle-stage)의 큰 흔들림(tier3+)과 겹치지 않게 작은 것만
  useShakes(stage, hits ? waves.map((w) => ({ at: waveAt(w), px: w === 0 ? 2 + tier : 1.5 + tier * 0.5 })) : [])

  return (
    <>
      {/* 궁극기 — 전장이 어두워지고 기술 이름이 뜬다 */}
      {m.ultimate && <div className="fx-dim absolute inset-0" style={dur(m.finaleMs + 250)} />}
      {m.ultimate && fx.skillName && (
        <div className="fx-ult-name" style={{ ...dur(m.castMs + 450), color: col.b, textShadow: `0 0 10px ${col.a}, 0 0 22px ${col.a}, 0 2px 0 #000` }}>
          {fx.skillName}
        </div>
      )}

      {/* 궁극기 — 기를 모으는 동안 화면 가장자리에서 시전자 쪽으로 몰리는 집중선 */}
      {m.ultimate && sourcePos && (
        <div
          className="fx-speedlines absolute inset-0"
          style={{
            ...dur(m.castMs + 260),
            backgroundImage: `url(${speedLinesTex(col.b, Math.round(sourcePos.left), Math.round(sourcePos.top))})`,
            backgroundSize: '100% 100%',
            imageRendering: 'pixelated',
          }}
        />
      )}

      {/* ── 시전: 기 모으기 — 발밑 마법진 + 모여드는 빛 + 커지는 구체 ── */}
      {sourcePos && m.castMs === 0 && <CastPulse pos={sourcePos} color={col.a} tier={tier} />}
      {sourcePos && sourceGround && m.castMs > 0 && (
        <>
          <FloorCircle pos={sourceGround} color={col.a} size={62 + tier * 30} durMs={m.ultimate ? m.finaleMs : m.castMs + 380} star={tier >= 3} />
          {tier >= 3 && <FloorCircle pos={sourceGround} color={col.b} size={36 + tier * 18} durMs={m.ultimate ? m.finaleMs : m.castMs + 380} reverse />}
          {m.ultimate && <AuraColumn pos={sourceGround} color={col} durMs={m.castMs + 200} />}
          <Gather pos={sourcePos} color={col} count={3 + tier * 4} radius={28 + tier * 16} durMs={m.castMs} />
          {fx.archetype === 'magicAttack' && <ChargeOrb pos={sourcePos} color={col} size={10 + tier * 9} durMs={m.castMs} />}
        </>
      )}

      {/* ── 공격 마법 ── */}
      {fx.archetype === 'magicAttack' && (
        <>
          {(m.style === 'quick' || m.style === 'bolt') &&
            sourcePos &&
            targetPositions.map((tp, i) => (
              <Travel key={`t${i}`} from={sourcePos} to={tp} color={col} size={8 + tier * 3} startMs={Math.max(0, m.impactMs - 280) + i * 60} durMs={Math.min(280, m.impactMs)} />
            ))}

          {m.style === 'beam' && sourcePos && center && (
            <Beam
              from={sourcePos}
              to={fx.aoe ? center : targetPositions[0]}
              extend={fx.aoe ? 1.5 : 1.04}
              box={box}
              width={(fx.aoe ? 20 : 8) + tier * (fx.aoe ? 9 : 5)}
              color={col}
              startMs={m.castMs}
              durMs={sustainMs + 200}
            />
          )}

          {m.style === 'rain' &&
            targetPositions.flatMap((tp, i) =>
              waves.flatMap((w) =>
                Array.from({ length: m.ultimate ? 5 : 3 }, (_, j) => {
                  const jx = Math.sin((i + 1) * 7.1 + w * 3.3 + j * 5.7) * 7
                  return (
                    <Travel
                      key={`r${i}-${w}-${j}`}
                      from={{ left: tp.left + jx - 7, top: -8 }}
                      to={{ left: tp.left + jx * 0.4, top: tp.top + 2 }}
                      color={col}
                      size={9 + tier * 2}
                      shard
                      startMs={Math.max(0, waveAt(w) - 300) + j * 70 + i * 40}
                      durMs={300}
                    />
                  )
                }),
              ),
            )}

          {m.style === 'erupt' &&
            targets.map((t, i) => <Spikes key={`e${i}`} pos={t.ground} color={col} scale={scale} startMs={m.impactMs - 80 + i * 70} durMs={sustainMs + 250} />)}

          {m.style === 'gale' &&
            sourcePos &&
            center &&
            waves.flatMap((w) =>
              [-1, 0, 1].map((o) => (
                <Beam
                  key={`g${w}-${o}`}
                  from={{ left: sourcePos.left, top: sourcePos.top + o * 9 }}
                  to={{ left: center.left, top: center.top + o * (6 + w * 2) }}
                  extend={1.45}
                  box={box}
                  width={4 + tier}
                  color={col}
                  startMs={Math.max(0, waveAt(w) - 160) + (o + 1) * 55}
                  durMs={360}
                  ripples={0}
                />
              )),
            )}

          {m.style === 'pillar' &&
            targetPositions.map((tp, i) => <LightPillar key={`p${i}`} pos={tp} color={col} delay={m.impactMs - 60 + i * 60} durMs={sustainMs + 300} wide={tier >= 3} />)}

          {/* 타격마다 튀는 작은 파편 · 맞은 자리에 잠깐 남는 속성 빛 자국 */}
          {targetPositions.flatMap((tp, i) =>
            waves.map((w) => <ParticleBurst key={`hs${i}-${w}`} pos={tp} color={col} count={4 + tier * 2} radius={24 + tier * 9} delay={waveAt(w) + i * 60} />),
          )}
          {targets.map((t, i) => (
            <GroundMark key={`gm${i}`} pos={t.ground} color={col} size={(46 + tier * 16) * (fx.aoe ? 0.9 : 1)} startMs={m.impactMs + i * 60} holdMs={sustainMs + 500} />
          ))}

          {/* 타격 — 쏟아붓는 동안 여러 번 터진다 */}
          {targetPositions.flatMap((tp, i) =>
            waves.map((w) => <ImpactWave key={`i${i}-${w}`} pos={tp} color={col} element={fxKey} scale={scale * (w === 0 ? 1 : 0.85)} tier={tier} at={waveAt(w) + i * 60} up={m.style === 'erupt'} />),
          )}

          {/* 궁극기 마무리 — 한가운데 큰 폭발 + 대상마다 시그니처 노바 */}
          {m.ultimate && (
            <>
              {targetPositions.map((tp, i) => (
                <UltimateBurst key={`u${i}`} pos={tp} element={fxKey} color={col} delay={m.finaleMs + i * 50} />
              ))}
              {center && (
                <>
                  <ShockwaveRing pos={center} color={col.b} size={260} delay={m.finaleMs} />
                  <ShockwaveRing pos={center} color={col.a} size={380} delay={m.finaleMs + 140} />
                  <ParticleBurst pos={center} color={col} count={16} radius={150} delay={m.finaleMs + 40} />
                </>
              )}
            </>
          )}
        </>
      )}

      {fx.archetype === 'attack' &&
        targetPositions.map((tp, i) => (
          <span key={i}>
            <SlashImpact pos={tp} color={col} scale={scale} tier={tier} delay={m.impactMs - 120 + i * 50} />
            <ParticleBurst pos={tp} color={col} count={5 + tier} radius={22 + tier * 6} delay={m.impactMs + i * 50} />
          </span>
        ))}

      {fx.archetype === 'debuff' &&
        targetPositions.flatMap((tp, i) => waves.map((w) => <DebuffCloud key={`${i}-${w}`} pos={tp} color={col} scale={scale} tier={tier} delay={waveAt(w) - 150 + i * 80} />))}

      {fx.archetype === 'heal' &&
        targetPositions.flatMap((tp, i) => waves.map((w) => <HealGlow key={`${i}-${w}`} pos={tp} color={col} scale={scale} tier={tier} delay={waveAt(w) - 150 + i * 70} />))}

      {fx.archetype === 'buff' &&
        targetPositions.flatMap((tp, i) => waves.map((w) => <BuffRing key={`${i}-${w}`} pos={tp} color={col} tier={tier} delay={waveAt(w) - 150 + i * 70} />))}

      {fx.archetype === 'utility' && targetPositions.map((tp, i) => <UtilityPulse key={i} pos={tp} tier={tier} delay={m.impactMs - 120} />)}

      {fx.archetype === 'item' && targetPositions.map((tp, i) => <ItemSparkle key={i} pos={tp} tier={tier} delay={m.impactMs - 120} />)}

      {/* 큰 지원 주문(대부활·성역) — 대상마다 발밑 마법진과 빛기둥 */}
      {m.ultimate &&
        fx.archetype !== 'magicAttack' &&
        targets.map((t, i) => (
          <span key={`s${i}`}>
            <FloorCircle pos={t.ground} color={supportCol.a} size={84} durMs={m.finaleMs - m.castMs + 500} startMs={m.castMs - 200} star />
            <LightPillar pos={t.pos} color={supportCol} delay={m.impactMs + i * 60} durMs={m.finaleMs - m.impactMs + 500} />
            <ShockwaveRing pos={t.pos} color={supportCol.b} size={120} delay={m.finaleMs + i * 50} />
          </span>
        ))}

      {/* 전체 대상(aoe) 강한 스킬 — 화면 전체를 살짝 물들이는 플래시 */}
      {fx.aoe && fx.power >= 2 && (
        <div
          className="fx-screen-flash absolute inset-0"
          style={{ background: `radial-gradient(circle at 50% 45%, ${col.a}55, transparent 68%)`, animationDelay: `${m.impactMs}ms` }}
        />
      )}

      {/* 궁극기(tier4) — 마무리 순간 화면 전체가 반응하는 비네트 펄스 + 강한 플래시 */}
      {tier === 4 && (
        <>
          <div
            className="fx-screen-flash-strong absolute inset-0"
            style={{ background: `radial-gradient(circle at 50% 45%, ${col.b}88, transparent 78%)`, animationDelay: `${m.finaleMs}ms` }}
          />
          <div className="fx-vignette-pulse absolute inset-0" style={{ boxShadow: `inset 0 0 120px 40px ${col.a}`, animationDelay: `${m.finaleMs}ms` }} />
        </>
      )}
    </>
  )
}

/** 맞는 순간마다 전장을 짧게 흔든다 — Web Animations(합성 단계 transform)라 다시 그리기 없음 */
function useShakes(stage: React.RefObject<HTMLDivElement | null>, list: { at: number; px: number }[]) {
  const key = list.map((s) => `${s.at}:${s.px}`).join(',')
  useEffect(() => {
    const el = stage.current?.parentElement
    if (!el || !list.length || typeof el.animate !== 'function') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const anims = list.map(({ at, px }) =>
      el.animate(
        [
          { transform: 'translate(0,0)' },
          { transform: `translate(${px}px,${-px * 0.6}px)` },
          { transform: `translate(${-px}px,${px * 0.5}px)` },
          { transform: `translate(${px * 0.5}px,${px * 0.3}px)` },
          { transform: 'translate(0,0)' },
        ],
        { duration: 180, delay: at, easing: 'ease-out', composite: 'add' },
      ),
    )
    return () => anims.forEach((a) => a.cancel())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}

/** 집중선 텍스처 — 160×90 칸 화면에 가장자리에서 시전자 쪽으로 향하는 도트 선(가운데는 비움) */
function speedLinesTex(color: string, cxPct: number, cyPct: number) {
  return pixelTex(`sl:${color}:${cxPct}:${cyPct}`, 160, 90, (x, y) => {
    const dx = x + 0.5 - (cxPct / 100) * 160
    const dy = (y + 0.5 - (cyPct / 100) * 90) * 1.7
    const r = Math.hypot(dx, dy)
    if (r < 38) return null
    const a = Math.atan2(dy, dx)
    // 선 64가닥 — 각도 칸마다 굵기·시작 거리가 조금씩 다르다
    const k = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 64)
    const center = ((k + 0.5) / 64) * Math.PI * 2 - Math.PI
    const width = 0.012 + ((k * 37) % 5) * 0.004
    const start = 44 + ((k * 53) % 7) * 6
    if (r < start || Math.abs(a - center) > width) return null
    return r - start < 6 && dither(x, y) > 0.5 ? null : color
  })
}

/** 자국 텍스처 — 24×10 칸 타원을 안쪽은 밝은색, 바깥은 짙은색으로 디더링해 찍는다 */
function groundMarkTex(color: { a: string; b: string }) {
  return pixelTex(`gm:${color.a}:${color.b}`, 24, 10, (x, y) => {
    const d = Math.hypot((x + 0.5 - 12) / 12, (y + 0.5 - 5) / 5)
    if (d >= 1) return null
    const t = dither(x, y)
    if (d < 0.35) return t < 0.85 ? color.b : color.a
    if (d < 0.7) return t < 1.15 - d ? color.a : null
    return t < (1 - d) * 1.6 ? color.a : null
  })
}

/** 맞은 자리 바닥에 잠깐 남는 속성 빛 자국(불=그을음 위 잔불, 얼음=서리, 대지=먼지 …) — 도트 */
function GroundMark({ pos, color, size, startMs, holdMs }: { pos: FxPos; color: { a: string; b: string }; size: number; startMs: number; holdMs: number }) {
  return (
    <div
      className="fx-ground-mark"
      style={{
        left: `${pos.left}%`,
        top: `${pos.top}%`,
        width: size,
        height: size * 0.42,
        backgroundImage: `url(${groundMarkTex(color)})`,
        backgroundSize: '100% 100%',
        imageRendering: 'pixelated',
        ...dur(holdMs + 700, startMs),
      }}
    />
  )
}

/** 길이를 CSS 변수(--d)로 넘긴다 — 길이가 스킬마다 다른 연출용 */
function dur(ms: number, startMs = 0): CSSProperties {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { ['--d' as any]: `${Math.max(120, Math.round(ms))}ms`, animationDelay: `${Math.max(0, Math.round(startMs))}ms` }
}

/** 발밑 마법진 — 바닥에 누운 룬 서클이 기를 모으는 동안 돌고 있다 */
function FloorCircle({ pos, color, size, durMs, startMs = 0, reverse, star }: { pos: FxPos; color: string; size: number; durMs: number; startMs?: number; reverse?: boolean; star?: boolean }) {
  const tri = (rot: number) =>
    [0, 1, 2]
      .map((i) => {
        const a = ((i * 120 + rot) * Math.PI) / 180
        return `${50 + Math.cos(a) * 34},${50 + Math.sin(a) * 34}`
      })
      .join(' ')
  return (
    <div
      className="fx-floor absolute"
      style={{ left: `${pos.left}%`, top: `${pos.top}%`, width: size, height: size, background: `radial-gradient(circle, ${color}55, ${color}1a 55%, transparent 70%)`, ...dur(durMs, startMs) }}
    >
      <svg viewBox="0 0 100 100" className={reverse ? 'fx-rune-spin-rev h-full w-full' : 'fx-rune-spin h-full w-full'} style={{ filter: `drop-shadow(0 0 6px ${color})` }}>
        <circle cx="50" cy="50" r="46" fill="none" stroke={color} strokeWidth="2.4" opacity="0.95" />
        <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="1" opacity="0.6" strokeDasharray="3 5" />
        <circle cx="50" cy="50" r="22" fill="none" stroke={color} strokeWidth="1.4" opacity="0.7" />
        {star && <polygon points={tri(-90)} fill="none" stroke={color} strokeWidth="1.6" opacity="0.85" />}
        {star && <polygon points={tri(90)} fill="none" stroke={color} strokeWidth="1.6" opacity="0.85" />}
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2
          return <line key={i} x1={50 + Math.cos(a) * 40} y1={50 + Math.sin(a) * 40} x2={50 + Math.cos(a) * 46} y2={50 + Math.sin(a) * 46} stroke={color} strokeWidth="1.6" opacity="0.8" />
        })}
      </svg>
    </div>
  )
}

/** 모여드는 빛 — 바깥에서 시전자에게로 빨려 든다(기 모으기) */
function Gather({ pos, color, count, radius, durMs }: { pos: FxPos; color: { a: string; b: string }; count: number; radius: number; durMs: number }) {
  const one = Math.min(520, Math.max(220, durMs * 0.55))
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const ang = (i / count) * Math.PI * 2 + Math.sin(i * 12.9898) * 0.5
        const r = radius * (0.75 + 0.35 * Math.abs(Math.sin(i * 7.233 + 1)))
        const delay = (i / count) * one
        return (
          <div
            key={i}
            className="fx-gather absolute rounded-full"
            style={{
              left: `${pos.left}%`,
              top: `${pos.top}%`,
              background: i % 2 ? color.b : color.a,
              boxShadow: `0 0 6px 1px ${color.a}`,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ['--fx-dx' as any]: `${Math.cos(ang) * r}px`,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ['--fx-dy' as any]: `${Math.sin(ang) * r * 0.8}px`,
              animationDuration: `${one}ms`,
              animationDelay: `${delay}ms`,
              animationIterationCount: Math.max(1, Math.floor((durMs - delay) / one)),
            }}
          />
        )
      })}
    </>
  )
}

/** 손끝에서 커지는 구체 — 다 차면 터지듯 사라지고 그 자리에서 빔·탄이 나간다 */
function ChargeOrb({ pos, color, size, durMs }: { pos: FxPos; color: { a: string; b: string }; size: number; durMs: number }) {
  return (
    <div
      className="fx-charge absolute rounded-full"
      style={{
        left: `${pos.left}%`,
        top: `${pos.top}%`,
        width: size,
        height: size,
        background: `radial-gradient(circle, #fff, ${color.b} 35%, ${color.a} 70%, transparent 78%)`,
        boxShadow: `0 0 ${size * 0.7}px ${size * 0.25}px ${color.a}cc`,
        ...dur(durMs),
      }}
    />
  )
}

/** 궁극기 시전자를 감싸고 치솟는 기운 */
function AuraColumn({ pos, color, durMs }: { pos: FxPos; color: { a: string; b: string }; durMs: number }) {
  return (
    <div
      className="fx-aura-col absolute"
      style={{ left: `${pos.left}%`, top: `${pos.top}%`, background: `linear-gradient(to top, ${color.a}cc, ${color.b}66 45%, transparent)`, ...dur(durMs) }}
    />
  )
}

/** 날아가는 탄 / 떨어지는 파편 */
function Travel({ from, to, color, size, startMs, durMs, shard }: { from: FxPos; to: FxPos; color: { a: string; b: string }; size: number; startMs: number; durMs: number; shard?: boolean }) {
  return (
    <div
      className={`fx-travel absolute ${shard ? 'fx-travel-shard' : 'rounded-full'}`}
      style={{
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['--fx-x0' as any]: `${from.left}%`,
        ['--fx-y0' as any]: `${from.top}%`,
        ['--fx-x1' as any]: `${to.left}%`,
        ['--fx-y1' as any]: `${to.top}%`,
        left: `${from.left}%`,
        top: `${from.top}%`,
        width: size,
        height: shard ? size * 3 : size,
        background: shard ? `linear-gradient(to bottom, ${color.b}, #fff 45%, ${color.a})` : `radial-gradient(circle, #fff, ${color.b} 40%, ${color.a})`,
        boxShadow: shard ? undefined : `0 0 ${size}px ${size / 3}px ${color.a}aa`,
        filter: shard ? `drop-shadow(0 0 5px ${color.a})` : undefined,
        ...dur(durMs, startMs),
      }}
    />
  )
}

/** 빔 — 시전자에게서 대상 쪽으로 쭉 뻗어 나가 유지되다가 가늘어지며 사라진다. 안쪽으로 물결이 계속 흘러간다. */
function Beam({
  from,
  to,
  box,
  width,
  color,
  startMs,
  durMs,
  extend = 1,
  ripples = 4,
}: {
  from: FxPos
  to: FxPos
  box: FxBox
  width: number
  color: { a: string; b: string }
  startMs: number
  durMs: number
  extend?: number
  ripples?: number
}) {
  if (!box.w || !box.h) return null
  const x0 = (from.left / 100) * box.w
  const y0 = (from.top / 100) * box.h
  const dx = ((to.left - from.left) / 100) * box.w * extend
  const dy = ((to.top - from.top) / 100) * box.h * extend
  const len = Math.hypot(dx, dy)
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI
  return (
    <div
      className="fx-beam absolute"
      style={{
        left: x0,
        top: y0 - width / 2,
        width: len,
        height: width,
        borderRadius: width / 2,
        background: `linear-gradient(to bottom, transparent, ${color.a} 20%, ${color.b} 40%, #fff 50%, ${color.b} 60%, ${color.a} 80%, transparent)`,
        boxShadow: `0 0 ${width}px ${Math.round(width / 3)}px ${color.a}99`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['--ang' as any]: `${ang}deg`,
        ...dur(durMs, startMs),
      }}
    >
      {ripples > 0 && <span className="fx-beam-head" style={{ width: width * 2.1, height: width * 2.1, background: `radial-gradient(circle, #fff, ${color.b} 45%, ${color.a}00 72%)` }} />}
      {Array.from({ length: ripples }).map((_, i) => (
        <span key={i} className="fx-beam-ripple" style={{ animationDelay: `${startMs + i * 95}ms`, width: Math.max(10, width * 1.1) }} />
      ))}
    </div>
  )
}

/** 대상 발밑에서 솟구치는 바위 */
function Spikes({ pos, color, scale, startMs, durMs }: { pos: FxPos; color: { a: string; b: string }; scale: number; startMs: number; durMs: number }) {
  const spikes = [
    { x: -20, h: 44, w: 20, d: 60 },
    { x: 0, h: 66, w: 26, d: 0 },
    { x: 19, h: 38, w: 18, d: 110 },
    { x: -8, h: 28, w: 14, d: 170 },
  ]
  return (
    <div className="absolute" style={{ left: `${pos.left}%`, top: `calc(${pos.top}% + 16px)` }}>
      {spikes.map((s, i) => (
        <span
          key={i}
          className="fx-spike"
          style={{
            left: s.x * scale - (s.w * scale) / 2,
            width: s.w * scale,
            height: s.h * scale,
            background: `linear-gradient(100deg, ${color.a}, ${color.b} 55%, #3d2c18)`,
            ...dur(durMs, startMs + s.d),
          }}
        />
      ))}
    </div>
  )
}

/** 타격 한 번 — 폭발 + (tier2+) 충격파·파편 + 도트 이펙트 */
function ImpactWave({ pos, color, element, scale, tier, at, up }: { pos: FxPos; color: { a: string; b: string }; element: FxKey; scale: number; tier: FxTier; at: number; up?: boolean }) {
  return (
    <>
      <div
        className="fx-burst absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          left: `${pos.left}%`,
          top: `${pos.top}%`,
          width: `${44 * scale}px`,
          height: `${44 * scale}px`,
          background: `radial-gradient(circle, ${color.b}ee, ${color.a}88 55%, transparent 75%)`,
          animationDelay: `${at}ms`,
        }}
      />
      {tier >= 2 && <ShockwaveRing pos={pos} color={color.a} size={58 * scale} delay={at + 60} />}
      {tier >= 2 && <ParticleBurst pos={pos} color={color} count={tier >= 3 ? 8 : 5} radius={36 * scale} delay={at + 40} direction={up ? 'up' : 'radial'} />}
      {PIXEL_BURST_SHEET[element] && <PixelBurst pos={pos} sheet={PIXEL_BURST_SHEET[element]!} size={60 * scale} delay={at} />}
    </>
  )
}

// ── 파티클(불티/파편/광점) — 원형 배열 + 결정적(deterministic) 지터로 매 렌더 안정적으로 흩뿌린다 ──
function ParticleBurst({
  pos,
  color,
  count,
  radius,
  delay = 0,
  direction = 'radial',
}: {
  pos: FxPos
  color: { a: string; b: string }
  count: number
  radius: number
  delay?: number
  direction?: 'radial' | 'up' | 'down'
}) {
  const items = Array.from({ length: count }).map((_, i) => {
    const jitter = Math.sin(i * 12.9898) * 0.4
    const ang =
      direction === 'up'
        ? -Math.PI / 2 + jitter
        : direction === 'down'
          ? Math.PI / 2 + jitter
          : (i / count) * Math.PI * 2 + jitter * 0.5
    const r = radius * (0.7 + 0.3 * Math.sin(i * 7.233 + 1))
    const dx = Math.cos(ang) * r
    const dy = Math.sin(ang) * r
    const d = delay + i * 16 + Math.abs(Math.sin(i * 3.1)) * 50
    return { dx, dy, d }
  })
  return (
    <>
      {items.map((p, i) => (
        <div
          key={i}
          className="fx-particle absolute rounded-full"
          style={{
            left: `${pos.left}%`,
            top: `${pos.top}%`,
            background: i % 2 ? color.b : color.a,
            boxShadow: `0 0 5px 1px ${color.a}aa`,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ['--fx-dx' as any]: `${p.dx}px`,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ['--fx-dy' as any]: `${p.dy}px`,
            animationDelay: `${p.d}ms`,
          }}
        />
      ))}
    </>
  )
}

// ── 회전하는 룬 서클 — 위치브룩류 소환진 참고. tier2+ 캐스트/궁극기에 겹쳐 화려함을 더한다 ──
function RuneCircle({ pos, color, size, reverse, delay = 0 }: { pos: FxPos; color: string; size: number; reverse?: boolean; delay?: number }) {
  return (
    <div
      className="fx-rune absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${pos.left}%`, top: `${pos.top}%`, width: size, height: size, animationDelay: `${delay}ms` }}
    >
      <svg
        viewBox="0 0 100 100"
        className={reverse ? 'fx-rune-spin-rev h-full w-full' : 'fx-rune-spin h-full w-full'}
        style={{ filter: `drop-shadow(0 0 5px ${color})` }}
      >
        <circle cx="50" cy="50" r="44" fill="none" stroke={color} strokeWidth="2" opacity="0.85" />
        <circle cx="50" cy="50" r="34" fill="none" stroke={color} strokeWidth="1.2" opacity="0.55" strokeDasharray="4 6" />
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2
          const x1 = 50 + Math.cos(a) * 44
          const y1 = 50 + Math.sin(a) * 44
          const x2 = 50 + Math.cos(a) * 50
          const y2 = 50 + Math.sin(a) * 50
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1.5" opacity="0.7" />
        })}
      </svg>
    </div>
  )
}

function ShockwaveRing({ pos, color, size, delay = 0 }: { pos: FxPos; color: string; size: number; delay?: number }) {
  return (
    <div
      className="fx-shockwave absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{ left: `${pos.left}%`, top: `${pos.top}%`, width: size, height: size, borderColor: color, animationDelay: `${delay}ms` }}
    />
  )
}

/** 원소별 시그니처 코어 — 궁극기(tier4)에서만 등장하는 큰 형상(스타버스트/크리스탈/육각/빔) */
function NovaCore({
  pos,
  colorA,
  colorB,
  size,
  shape,
  delay = 0,
}: {
  pos: FxPos
  colorA: string
  colorB: string
  size: number
  shape: 'star' | 'diamond' | 'hex'
  delay?: number
}) {
  const clipPath = {
    star: 'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)',
    diamond: 'polygon(50% 2%,80% 30%,98% 50%,80% 70%,50% 98%,20% 70%,2% 50%,20% 30%)',
    hex: 'polygon(25% 4%,75% 4%,100% 50%,75% 96%,25% 96%,0% 50%)',
  }[shape]
  return (
    <div
      className="fx-nova-core absolute -translate-x-1/2 -translate-y-1/2"
      style={{
        left: `${pos.left}%`,
        top: `${pos.top}%`,
        width: size,
        height: size,
        background: `radial-gradient(circle, ${colorB}, ${colorA} 60%, transparent 80%)`,
        clipPath,
        animationDelay: `${delay}ms`,
      }}
    />
  )
}

function LightPillar({ pos, color, delay = 0, durMs, wide }: { pos: FxPos; color: { a: string; b: string }; delay?: number; durMs?: number; wide?: boolean }) {
  return (
    <div
      className="fx-light-pillar absolute -translate-x-1/2"
      style={{
        left: `${pos.left}%`,
        top: 0,
        bottom: 0,
        background: `linear-gradient(to bottom, transparent, ${color.b}, ${color.a}99, transparent)`,
        animationDelay: `${delay}ms`,
        animationDuration: durMs ? `${durMs}ms` : undefined,
        width: wide ? 44 : undefined,
      }}
    />
  )
}

/** 궁극기 임팩트 — 충격파 링 2겹 + 노바 코어 + 파티클 + (원소별) 균열/불티/빛기둥 */
function UltimateBurst({ pos, element, color, delay }: { pos: FxPos; element: FxKey; color: { a: string; b: string }; delay: number }) {
  const shape = element === 'ice' ? 'diamond' : element === 'earth' ? 'hex' : 'star'
  return (
    <>
      <ShockwaveRing pos={pos} color={color.a} size={92} delay={delay} />
      <ShockwaveRing pos={pos} color={color.b} size={136} delay={delay + 100} />
      <NovaCore pos={pos} colorA={color.a} colorB={color.b} size={80} shape={shape} delay={delay + 40} />
      <ParticleBurst pos={pos} color={color} count={10} radius={72} delay={delay + 50} direction={element === 'fire' ? 'up' : 'radial'} />
      {(element === 'none' || element === 'light') && <LightPillar pos={pos} color={color} delay={delay} />}
      {element === 'earth' && <ParticleBurst pos={pos} color={color} count={6} radius={38} delay={delay + 140} direction="up" />}
      {element === 'ice' && <ParticleBurst pos={pos} color={color} count={8} radius={90} delay={delay + 20} direction="radial" />}
    </>
  )
}

function CastPulse({ pos, color, tier }: { pos: FxPos; color: string; tier: FxTier }) {
  return (
    <div
      className="fx-cast-pulse absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{
        left: `${pos.left}%`,
        top: `${pos.top}%`,
        borderColor: color,
        width: tier >= 3 ? 40 : 30,
        height: tier >= 3 ? 16 : 12,
      }}
    />
  )
}

function SlashImpact({ pos, color, scale, tier, delay }: { pos: FxPos; color: { a: string; b: string }; scale: number; tier: FxTier; delay: number }) {
  return (
    <>
      <div
        className="fx-slash absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${pos.left}%`, top: `${pos.top}%`, width: `${52 * scale}px`, height: `${52 * scale}px`, animationDelay: `${delay}ms` }}
      >
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <path d="M12 78 L82 22" stroke="#fff" strokeWidth="9" strokeLinecap="round" opacity="0.9" />
          <path d="M24 88 L90 34" stroke="#ffe9c0" strokeWidth="5" strokeLinecap="round" opacity="0.7" />
          {tier >= 2 && <path d="M2 60 L64 6" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.5" />}
        </svg>
      </div>
      {tier >= 2 && <ParticleBurst pos={pos} color={color} count={5} radius={28 * scale} delay={delay + 30} />}
      <PixelBurst pos={pos} sheet={PIXEL_SLASH_SHEET} size={56 * scale} delay={delay} />
    </>
  )
}

function DebuffCloud({ pos, color, scale, tier, delay }: { pos: FxPos; color: { a: string; b: string }; scale: number; tier: FxTier; delay: number }) {
  return (
    <>
      <div
        className="fx-debuff absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          left: `${pos.left}%`,
          top: `${pos.top}%`,
          width: `${40 * scale}px`,
          height: `${40 * scale}px`,
          background: `radial-gradient(circle, ${color.a}cc, transparent 70%)`,
          animationDelay: `${delay}ms`,
        }}
      />
      {tier >= 2 && <RuneCircle pos={pos} color={color.a} size={38 * scale} delay={delay} />}
      {tier >= 3 && <ParticleBurst pos={pos} color={color} count={6} radius={30 * scale} delay={delay + 60} direction="down" />}
      <PixelBurst pos={pos} sheet={PIXEL_DEBUFF_SHEET} size={56 * scale} delay={delay} />
    </>
  )
}

function HealGlow({ pos, color, scale, tier, delay }: { pos: FxPos; color: { a: string; b: string }; scale: number; tier: FxTier; delay: number }) {
  return (
    <>
      <div
        className="fx-heal absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ left: `${pos.left}%`, top: `${pos.top}%`, animationDelay: `${delay}ms` }}
      />
      <PixelBurst pos={pos} sheet={PIXEL_HEAL_SHEET} size={56 * scale} delay={delay} />
      {tier >= 2 && <ParticleBurst pos={pos} color={{ a: '#bff7c8', b: '#ffffff' }} count={6} radius={30 * scale} delay={delay + 40} direction="up" />}
      {tier === 4 && (
        <>
          <RuneCircle pos={pos} color="#ffe9a8" size={70} delay={delay} />
          <LightPillar pos={pos} color={{ a: '#ffe9a8', b: '#ffffff' }} delay={delay} />
          <ShockwaveRing pos={pos} color="#ffffff" size={110} delay={delay + 100} />
        </>
      )}
    </>
  )
}

function BuffRing({ pos, color, tier, delay }: { pos: FxPos; color: { a: string; b: string }; tier: FxTier; delay: number }) {
  return (
    <>
      <div
        className="fx-buff-ring absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-4"
        style={{ left: `${pos.left}%`, top: `${pos.top}%`, borderColor: color.b, boxShadow: `0 0 14px 2px ${color.a}aa`, animationDelay: `${delay}ms` }}
      />
      {tier >= 2 && <RuneCircle pos={pos} color={color.a} size={46} delay={delay} />}
      {tier >= 3 && <ParticleBurst pos={pos} color={color} count={6} radius={30} delay={delay + 80} direction="up" />}
      <PixelBurst pos={pos} sheet={PIXEL_BUFF_SHEET} size={52} delay={delay} />
    </>
  )
}

function UtilityPulse({ pos, tier, delay = 0 }: { pos: FxPos; tier: FxTier; delay?: number }) {
  return (
    <>
      <div className="fx-utility absolute -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${pos.left}%`, top: `${pos.top}%`, animationDelay: `${delay}ms` }} />
      {tier >= 2 && <ParticleBurst pos={pos} color={{ a: '#bfe0ff', b: '#ffffff' }} count={4} radius={22} delay={delay} />}
    </>
  )
}

function ItemSparkle({ pos, tier, delay = 0 }: { pos: FxPos; tier: FxTier; delay?: number }) {
  return (
    <>
      <div className="fx-item absolute -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${pos.left}%`, top: `${pos.top}%`, animationDelay: `${delay}ms` }} />
      {tier >= 2 && <ParticleBurst pos={pos} color={{ a: '#f0c060', b: '#fff6d0' }} count={4} radius={20} delay={delay} direction="up" />}
    </>
  )
}
