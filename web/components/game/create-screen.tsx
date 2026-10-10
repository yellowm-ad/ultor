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

  // 화면을 꽉 채우지 않는 창 형식(2026-10-10) — 타이틀 삽화를 흐리게 깔고, 가운데 '입학 원서' 창 하나에 전부 담는다.
  //   왼쪽 = 주인공 모습(마법진 위) + 성별, 오른쪽 = 이름 · 첫 펫 · 시작 마술 · 배울 마법, 아래 = 뒤로 / 입학하기
  return (
    <div className="create-root screen-fade-in relative flex h-full w-full items-center justify-center overflow-hidden bg-[#0b0907] p-4 sm:p-8">
      <div className="title-bg-frame">
        <div className="title-bg" />
      </div>
      <div className="create-dim" />

      <div className="create-window">
        <div className="create-window-head">
          <DiamondMark size={10} />
          <h1>입학 원서</h1>
          <DiamondMark size={10} />
          <span>울토르 마법학교 · 신입생 등록</span>
        </div>

        <div className="create-window-body">
          {/* 왼쪽 — 주인공 */}
          <div className="create-stage">
            <div className="create-stage-art">
              <div className="absolute inset-x-0 bottom-3 flex justify-center">
                <CreateMagicCircle color={GOLD} />
              </div>
              <div className="absolute inset-x-0 bottom-9 flex justify-center">
                <div className="create-hero-idle drop-shadow-[0_10px_14px_rgba(0,0,0,0.55)]">
                  <HeroSprite sheet={playerSheet(gender)} px={152} />
                </div>
              </div>
            </div>
            <div className="create-gender">
              {(['male', 'female'] as Gender[]).map((gd) => (
                <button key={gd} type="button" onClick={() => setGender(gd)} className={gender === gd ? 'is-on' : ''}>
                  {gd === 'male' ? '남성' : '여성'}
                </button>
              ))}
            </div>
            <p className="create-blurb">
              흑발에 금빛 눈을 가진 신입생. 어디서 왔는지 잘 말하지 않는 떠돌이 같은 분위기를 풍긴다. 정해진 속성 없이, 학교에서 배우는 마법과 장비로 자신만의 전투 방식을 만들어 간다.
            </p>
          </div>

          {/* 오른쪽 — 적어 넣는 칸 */}
          <div className="create-form">
            <label className="create-field">
              <span className="create-label">
                <DiamondMark size={8} />
                이름
              </span>
              <input value={name} maxLength={10} onChange={(e) => setName(e.target.value)} placeholder="신입생의 이름" className="create-name-input w-full rounded-md px-4 py-2.5 text-base outline-none" />
            </label>

            <div className="create-field">
              <span className="create-label">
                <DiamondMark size={8} />첫 펫
              </span>
              <div className="grid grid-cols-3 gap-2">
                {STARTER_PET_IDS.map((id) => {
                  const d = petDefById(id)!
                  return (
                    <button key={id} type="button" onClick={() => setPetId(id)} className={`create-pet ${petId === id ? 'is-on' : ''}`}>
                      <Image src={d.icon} alt="" width={40} height={40} />
                      {d.name}
                    </button>
                  )
                })}
              </div>
              <p className="create-note">펫은 주인공이 전위에 설 때 함께 싸웁니다.</p>
            </div>

            <div className="create-field">
              <span className="create-label">
                <DiamondMark size={8} />
                시작 마술
              </span>
              {starterSkill && (
                <div className="create-skill">
                  <Image src={starterSkill.icon} alt="" width={30} height={30} />
                  <div>
                    <b>{starterSkill.name}</b>
                    <span>{starterSkill.description}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="create-field">
              <span className="create-label">
                <DiamondMark size={8} />
                학교에서 배울 마법
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PLAYER_ELEMENTS.map((e) => (
                  <span key={e} className="create-chip">
                    <span style={{ color: ELEMENT_META[e].color }}>●</span>
                    {ELEMENT_META[e].name}
                  </span>
                ))}
              </div>
              <p className="create-note">불꽃·얼음·대지는 1학년부터, 어둠·빛은 3학년부터 배웁니다.</p>
            </div>
          </div>
        </div>

        <div className="create-window-foot">
          <Button variant="ghost" size="lg" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'title' })}>
            뒤로
          </Button>
          <Button
            variant="default"
            size="lg"
            className="px-10 text-base"
            onClick={() => dispatch({ type: 'START_GAME', name: name.trim() || '이름없는 신입생', appearance: { gender }, starterPetId: petId })}
          >
            입학하기
          </Button>
        </div>
      </div>
    </div>
  )
}
