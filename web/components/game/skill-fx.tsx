'use client'

import type { BattleFx, Element } from '@/lib/types'

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
  none: { a: '#f0e6c0', b: '#ffffff' },
}

// PixelLab 도트 이펙트 스프라이트시트(9프레임) — 절차적 CSS 연출 위에 얹는 실제 픽셀아트 레이어.
// animate_image 로 생성(불/얼음/대지 임팩트 + 회복 반짝임), 가로 9프레임 시트로 합성됨.
const PIXEL_BURST_SHEET: Partial<Record<FxKey, string>> = {
  fire: '/images/battle/vfx/fire_burst.png',
  ice: '/images/battle/vfx/ice_burst.png',
  earth: '/images/battle/vfx/earth_burst.png',
}
const PIXEL_HEAL_SHEET = '/images/battle/vfx/heal_burst.png'
const PIXEL_SLASH_SHEET = '/images/battle/vfx/slash_burst.png'
const PIXEL_DEBUFF_SHEET = '/images/battle/vfx/debuff_burst.png'
const PIXEL_BUFF_SHEET = '/images/battle/vfx/buff_burst.png'
const PIXEL_FRAMES = 9

function PixelBurst({ pos, sheet, size = 84, duration = 420, delay = 0 }: { pos: FxPos; sheet: string; size?: number; duration?: number; delay?: number }) {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['--fx-dur' as any]: `${duration}ms`,
        ['--fx-steps' as any]: PIXEL_FRAMES - 1,
        ['--fx-end' as any]: `${-(PIXEL_FRAMES - 1) * size}px`,
      }}
    />
  )
}

export type FxTier = 1 | 2 | 3 | 4

/** MP 소모량(+ 전체 대상 여부)으로 연출 등급을 산정 — 클수록 더 화려한 연출이 추가된다. */
export function fxTier(fx: Pick<BattleFx, 'mpCost' | 'aoe'>): FxTier {
  const mp = fx.mpCost ?? 0
  let t: FxTier = mp >= 18 ? 4 : mp >= 11 ? 3 : mp >= 7 ? 2 : 1
  if (fx.aoe && t < 2) t = 2
  return t
}

export interface FxPos {
  left: number
  top: number
}

export function SkillFxLayer({
  fx,
  posOf,
}: {
  fx: BattleFx | undefined
  posOf: (uid: string) => FxPos | undefined
}) {
  if (!fx) return null
  const fxKey: FxKey = fx.element ?? 'none'
  const col = FX_COLORS[fxKey]
  const sourcePos = posOf(fx.sourceUid)
  const targetPositions = fx.targetUids.map((uid) => posOf(uid)).filter((p): p is FxPos => !!p)
  const tier = fxTier(fx)
  const scale = (0.85 + Math.min(1.4, fx.power) * 0.35) * (1 + (tier - 1) * 0.18)

  return (
    <div key={fx.fxId} className="pointer-events-none absolute inset-0 z-30" aria-hidden>
      {/* 시전자 캐스트 펄스 — 모든 갈래 공통. tier2+ 는 발밑에 룬 서클이 추가로 회전한다 */}
      {sourcePos && <CastPulse pos={sourcePos} color={col.a} tier={tier} />}
      {sourcePos && tier >= 2 && <RuneCircle pos={sourcePos} color={col.a} size={54 + tier * 12} />}
      {sourcePos && tier >= 3 && <RuneCircle pos={sourcePos} color={col.b} size={34 + tier * 8} reverse />}

      {fx.archetype === 'magicAttack' &&
        targetPositions.map((tp, i) => (
          <MagicBolt key={i} from={sourcePos} to={tp} color={col} element={fxKey} aoe={fx.aoe} scale={scale} tier={tier} delay={i * 70} />
        ))}

      {fx.archetype === 'attack' &&
        targetPositions.map((tp, i) => <SlashImpact key={i} pos={tp} color={col} scale={scale} tier={tier} delay={i * 50} />)}

      {fx.archetype === 'debuff' &&
        targetPositions.map((tp, i) => <DebuffCloud key={i} pos={tp} color={col} scale={scale} tier={tier} delay={i * 80} />)}

      {fx.archetype === 'heal' &&
        targetPositions.map((tp, i) => <HealGlow key={i} pos={tp} color={col} scale={scale} tier={tier} delay={i * 70} />)}

      {fx.archetype === 'buff' &&
        targetPositions.map((tp, i) => <BuffRing key={i} pos={tp} color={col} tier={tier} delay={i * 70} />)}

      {fx.archetype === 'utility' &&
        targetPositions.map((tp, i) => <UtilityPulse key={i} pos={tp} tier={tier} />)}

      {fx.archetype === 'item' && targetPositions.map((tp, i) => <ItemSparkle key={i} pos={tp} tier={tier} />)}

      {/* 전체 대상(aoe) 강한 스킬 — 화면 전체를 살짝 물들이는 플래시 */}
      {fx.aoe && fx.power >= 2 && (
        <div
          className="fx-screen-flash absolute inset-0"
          style={{ background: `radial-gradient(circle at 50% 45%, ${col.a}55, transparent 68%)` }}
        />
      )}

      {/* 궁극기(tier4) — 화면 전체가 반응하는 비네트 펄스 + 강한 2차 플래시 */}
      {tier === 4 && (
        <>
          <div
            className="fx-screen-flash-strong absolute inset-0"
            style={{ background: `radial-gradient(circle at 50% 45%, ${col.b}66, transparent 75%)` }}
          />
          <div className="fx-vignette-pulse absolute inset-0" style={{ boxShadow: `inset 0 0 120px 40px ${col.a}` }} />
        </>
      )}
    </div>
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

function LightPillar({ pos, color, delay = 0 }: { pos: FxPos; color: { a: string; b: string }; delay?: number }) {
  return (
    <div
      className="fx-light-pillar absolute -translate-x-1/2"
      style={{
        left: `${pos.left}%`,
        top: 0,
        bottom: 0,
        background: `linear-gradient(to bottom, transparent, ${color.b}, ${color.a}99, transparent)`,
        animationDelay: `${delay}ms`,
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

function MagicBolt({
  from,
  to,
  color,
  element,
  aoe,
  scale,
  tier,
  delay,
}: {
  from: FxPos | undefined
  to: FxPos
  color: { a: string; b: string }
  element: FxKey
  aoe: boolean
  scale: number
  tier: FxTier
  delay: number
}) {
  return (
    <>
      {from && !aoe && (
        <div
          className="fx-bolt-travel absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ['--fx-x0' as any]: `${from.left}%`,
            ['--fx-y0' as any]: `${from.top}%`,
            ['--fx-x1' as any]: `${to.left}%`,
            ['--fx-y1' as any]: `${to.top}%`,
            left: `${from.left}%`,
            top: `${from.top}%`,
            background: `radial-gradient(circle, ${color.b}, ${color.a})`,
            boxShadow: `0 0 ${8 + tier * 3}px ${3 + tier}px ${color.a}aa`,
            animationDelay: `${delay}ms`,
          }}
        />
      )}
      <div
        className="fx-burst absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          left: `${to.left}%`,
          top: `${to.top}%`,
          width: `${44 * scale}px`,
          height: `${44 * scale}px`,
          background: `radial-gradient(circle, ${color.b}ee, ${color.a}88 55%, transparent 75%)`,
          animationDelay: `${(aoe ? 0 : 280) + delay}ms`,
        }}
      />
      {tier >= 2 && <ShockwaveRing pos={to} color={color.a} size={58 * scale} delay={(aoe ? 0 : 280) + delay + 60} />}
      {tier >= 2 && (
        <ParticleBurst pos={to} color={color} count={tier >= 3 ? 8 : 5} radius={36 * scale} delay={(aoe ? 0 : 280) + delay + 40} />
      )}
      {tier === 4 && <UltimateBurst pos={to} element={element} color={color} delay={(aoe ? 0 : 280) + delay + 20} />}
      {PIXEL_BURST_SHEET[element] && (
        <PixelBurst
          pos={to}
          sheet={PIXEL_BURST_SHEET[element]!}
          size={60 * scale}
          delay={(aoe ? 0 : 280) + delay}
        />
      )}
    </>
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

function UtilityPulse({ pos, tier }: { pos: FxPos; tier: FxTier }) {
  return (
    <>
      <div className="fx-utility absolute -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${pos.left}%`, top: `${pos.top}%` }} />
      {tier >= 2 && <ParticleBurst pos={pos} color={{ a: '#bfe0ff', b: '#ffffff' }} count={4} radius={22} />}
    </>
  )
}

function ItemSparkle({ pos, tier }: { pos: FxPos; tier: FxTier }) {
  return (
    <>
      <div className="fx-item absolute -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${pos.left}%`, top: `${pos.top}%` }} />
      {tier >= 2 && <ParticleBurst pos={pos} color={{ a: '#f0c060', b: '#fff6d0' }} count={4} radius={20} direction="up" />}
    </>
  )
}
