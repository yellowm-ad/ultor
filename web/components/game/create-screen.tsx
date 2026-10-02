'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useGame } from '@/lib/game-state'
import { Button } from '@/components/ui/button'
import { HeroSprite, playerSheet } from '@/components/game/pixel-hero'
import { DiamondMark } from '@/components/game/ui-motifs'
import { PLAYER_ELEMENTS, ELEMENT_META } from '@/lib/constants'
import { STARTER_SKILLS } from '@/lib/player-factory'
import { petDefById, STARTER_PET_IDS } from '@/lib/pets'
import { skillById } from '@/lib/mock-data'
import type { Gender } from '@/lib/types'

// ============================================================================
// 주인공 생성(PRD v2.0 §2~3) — 커스터마이징 가능한 단일 주인공.
//   · 속성은 고르지 않는다(주인공은 고정 속성이 없고, 5속성을 전부 학교 수업으로 배운다).
//   · 외형은 고정 2종(흑발 금안 · 울토르 교복의 떠돌이 신입생) — 성별만 고른다. 커마는 폐기.
//   · 예전 주인공 후보 6인은 학교 NPC가 되어 이 화면에서 고를 수 없다.
// ============================================================================

const GOLD = '#e8c46a'

// 인게임 캐릭터 발밑 마법진 — iso-world.tsx 게이트 포탈과 같은 시각 언어(룬 링+회전 다이아) 재사용
function CreateMagicCircle({ color }: { color: string }) {
  const R = 92
  const runes = Array.from({ length: 10 }).map((_, i) => {
    const a = (i / 10) * Math.PI * 2
    return <rect key={i} x={Math.cos(a) * R - 2.5} y={Math.sin(a) * R * 0.5 - 2.5} width={5} height={5} style={{ fill: color }} />
  })
  return (
    <svg viewBox="-100 -55 200 110" className="pointer-events-none w-[260px] sm:w-[300px]" aria-hidden="true">
      <ellipse cx={0} cy={0} rx={R} ry={R * 0.5} fill="none" strokeWidth={4} style={{ stroke: color, opacity: 0.5, animation: 'portal-pulse 2.4s ease-in-out infinite' }} />
      <ellipse cx={0} cy={0} rx={R - 10} ry={(R - 10) * 0.5} strokeWidth={1.6} style={{ fill: `${color}22`, stroke: color }} />
      {runes}
      <g style={{ animation: 'mill-spin 7s linear infinite' }}>
        <rect x={-3} y={-R * 0.5} width={6} height={6} style={{ fill: color }} />
        <rect x={-3} y={R * 0.5 - 6} width={6} height={6} style={{ fill: color }} />
        <rect x={-R + 6} y={-3} width={6} height={6} style={{ fill: color }} />
        <rect x={R - 12} y={-3} width={6} height={6} style={{ fill: color }} />
      </g>
      <ellipse cx={0} cy={2} rx={R * 0.3} ry={R * 0.16} opacity={0.5} style={{ fill: color }} />
    </svg>
  )
}

export function CreateScreen() {
  const { dispatch } = useGame()
  const [name, setName] = useState('')
  const [gender, setGender] = useState<Gender>('male')
  const [petId, setPetId] = useState<string>(STARTER_PET_IDS[0])
  const starterSkill = skillById(STARTER_SKILLS[0])

  return (
    <div className="create-root screen-fade-in flex h-full w-full flex-col overflow-hidden bg-[#0b0907]">
      <div className="relative min-h-[260px] flex-1 overflow-hidden">
        <div className="title-bg-frame">
          <div className="title-bg" />
        </div>
        <div className="title-sunrays" />
        <div className="title-vignette" />

        <h1 className="relative z-[2] pt-5 text-center font-display text-2xl text-gold-soft text-shadow-ink">주인공 생성</h1>

        {/* 좌측: 주인공 소개 */}
        <div className="absolute top-5 left-5 z-[2] hidden w-64 sm:block">
          <div className="panel-glass p-3 text-xs leading-relaxed text-foreground/80">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] text-gold-soft">
              <DiamondMark size={9} />
              주인공
            </div>
            흑발에 금빛 눈을 가진 울토르 마법학교의 신입생. 어디서 왔는지 잘 말하지 않는 떠돌이 같은 분위기를 풍긴다.
            정해진 속성 없이, 학교에서 배우는 마법과 장비로 자신만의 전투 방식을 만들어 간다.
          </div>
        </div>

        {/* 우측: 시작 정보 — 첫 펫 선택 + 학습 안내 */}
        <div className="absolute top-5 right-5 z-[2] hidden w-60 sm:block">
          <div className="panel-glass p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-gold-soft">
              <DiamondMark size={9} />첫 펫
            </div>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {STARTER_PET_IDS.map((id) => {
                const d = petDefById(id)!
                return (
                  <button
                    key={id}
                    onClick={() => setPetId(id)}
                    className={`flex flex-col items-center gap-0.5 rounded-lg p-1.5 text-[10px] ${petId === id ? 'bg-gold/25 ring-2 ring-gold' : 'bg-white/5 ring-1 ring-white/10'}`}
                  >
                    <Image src={d.icon} alt="" width={28} height={28} />
                    {d.name}
                  </button>
                )
              })}
            </div>
            <p className="mt-1 text-[10px] text-foreground/55">펫은 주인공이 전위에 설 때 함께 싸웁니다.</p>

            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-gold-soft">
              <DiamondMark size={9} />
              시작 마술
            </div>
            {starterSkill && (
              <div className="mt-1 text-xs">
                <span className="font-semibold">{starterSkill.name}</span>
                <span className="ml-1 text-[10px] text-foreground/55">{starterSkill.description}</span>
              </div>
            )}

            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-gold-soft">
              <DiamondMark size={9} />
              학교에서 배울 마법
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {PLAYER_ELEMENTS.map((e) => (
                <span key={e} className="flex items-center gap-1 rounded-full bg-white/5 px-1.5 py-0.5 text-[10px]">
                  <span style={{ color: ELEMENT_META[e].color }}>●</span>
                  {ELEMENT_META[e].name}
                </span>
              ))}
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-foreground/55">
              불꽃·얼음·대지는 1학년부터, 어둠·빛은 3학년부터. 고정 속성 없이 배운 마법과 장비가 전투 스타일을 만듭니다.
            </p>
          </div>
        </div>

        {/* 인게임 캐릭터 + 마법진 */}
        <div className="absolute inset-x-0 bottom-4 z-[1] flex justify-center">
          <CreateMagicCircle color={GOLD} />
        </div>
        <div className="absolute inset-x-0 bottom-11 z-[2] flex flex-col items-center">
          <div className="create-hero-idle drop-shadow-[0_10px_14px_rgba(0,0,0,0.55)]">
            <HeroSprite sheet={playerSheet(gender)} px={152} />
          </div>
        </div>
      </div>

      {/* 하단: 이름 · 성별 · 시작 */}
      <div className="create-select-bar relative z-[3] shrink-0 px-6 py-6 sm:px-14">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-x-10 gap-y-5">
          <div>
            <label className="mb-2 block text-sm text-muted-foreground">이름</label>
            <input
              value={name}
              maxLength={10}
              onChange={(e) => setName(e.target.value)}
              placeholder="신입생의 이름"
              className="create-name-input w-64 rounded-lg px-5 py-3.5 text-lg outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-muted-foreground">성별</label>
            <div className="inline-flex rounded-full border border-gold/40 bg-black/35 p-2">
              {(['male', 'female'] as Gender[]).map((gd) => (
                <button
                  key={gd}
                  onClick={() => setGender(gd)}
                  className={`rounded-full px-8 py-3.5 text-base font-semibold transition-all ${
                    gender === gd ? 'bg-gold text-ink' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {gd === 'male' ? '남성' : '여성'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" size="lg" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'title' })}>
              뒤로
            </Button>
            <Button
              variant="default"
              size="lg"
              className="px-8 text-base"
              onClick={() => dispatch({ type: 'START_GAME', name: name.trim() || '이름없는 신입생', appearance: { gender }, starterPetId: petId })}
            >
              입학하기
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
