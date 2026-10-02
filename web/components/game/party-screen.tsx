'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useGame } from '@/lib/game-state'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { MAX_PARTY_SIZE, POSITION_META, POSITIONS } from '@/lib/constants'
import { AFFECTION_TIER_META, affectionTier, petDefById, petStatsForLevel } from '@/lib/pets'
import { canRecruit, COMBAT_NPCS, COMPANION_SLOTS, companionStats, schoolNpcById, type SchoolNpc } from '@/lib/companions'
import { HeroSprite, playerSheet } from '@/components/game/pixel-hero'
import type { Position } from '@/lib/types'

const ROLE_LABEL = { student: '학생', professor: '교수', story: '조교' } as const

function NpcFace({ def, px = 56 }: { def: SchoolNpc; px?: number }) {
  return <HeroSprite sheet={def.sprite} dir="down" px={px} />
}

/** 포지션 선택 — 전위/후위/보조 */
function PositionPicker({ memberId, value }: { memberId: string; value: Position }) {
  const { dispatch } = useGame()
  return (
    <div className="flex gap-0.5">
      {POSITIONS.map((p) => (
        <button
          key={p}
          title={`${POSITION_META[p].label} — ${POSITION_META[p].bonus}`}
          onClick={() => dispatch({ type: 'SET_POSITION', memberId, position: p })}
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${value === p ? 'bg-gold text-ink' : 'bg-black/15 opacity-70 hover:opacity-100'}`}
        >
          {POSITION_META[p].label}
        </button>
      ))}
    </div>
  )
}

export function PartyScreen() {
  const { state, dispatch } = useGame()
  const [swapSlot, setSwapSlot] = useState<number | null>(null)
  if (state.screen !== 'party') return null
  const close = () => dispatch({ type: 'SET_SCREEN', screen: 'world' })

  const { player, pet, companions, formation } = state
  const pos = (id: string): Position => formation.positions[id] ?? 'rear'
  const petDef = petDefById(pet.defId)!
  const petStats = petStatsForLevel(petDef, pet.level)
  const petTierMeta = AFFECTION_TIER_META[affectionTier(pet.affection)]
  const partyCount = 1 + companions.party.length
  const bench = Object.keys(companions.recruited).filter((id) => !companions.party.includes(id))

  return (
    <Modal open onClose={close} title={`파티 편성 (${partyCount}/${MAX_PARTY_SIZE})`} widthClass="max-w-3xl">
      {/* 핵심 전투원 4명 — 주인공 + 학교 NPC 3 */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="panel-parchment flex flex-col items-center gap-1.5 p-2.5">
          <div className="flex h-14 items-end justify-center overflow-hidden">
            <HeroSprite sheet={playerSheet(player.appearance.gender)} dir="down" px={56} />
          </div>
          <div className="text-center text-xs font-semibold">{player.name}</div>
          <div className="text-[10px] opacity-70">Lv.{player.level} · 주인공</div>
          <Bars hp={player.hp / player.stats.maxHp} mp={player.mp / player.stats.maxMp} />
          <PositionPicker memberId="hero" value={pos('hero')} />
          <div className={`flex items-center gap-1 text-[10px] ${pos('hero') === 'front' ? '' : 'opacity-50'}`}>
            <Image src={petDef.icon} alt="" width={14} height={14} />
            {pet.nickname} {pos('hero') === 'front' ? '동행' : '(전위만 동행)'}
          </div>
        </div>

        {Array.from({ length: COMPANION_SLOTS }).map((_, i) => {
          const id = companions.party[i]
          const def = id ? schoolNpcById(id) : undefined
          const prog = id ? companions.recruited[id] : undefined
          const swapping = swapSlot === i
          if (!def || !prog) {
            return (
              <button
                key={i}
                onClick={() => setSwapSlot(swapping ? null : i)}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed p-2.5 text-white/60 ${swapping ? 'border-gold bg-gold/10' : 'border-gold/40'}`}
              >
                <div className="text-center text-[10px]">빈 자리 — 대기 명단에서 선택</div>
              </button>
            )
          }
          const s = companionStats(def, prog.level)
          const npcPet = def.combat ? petDefById(def.combat.petDefId) : undefined
          return (
            <div key={i} className={`panel-parchment flex flex-col items-center gap-1 p-2.5 ${swapping ? 'ring-2 ring-gold' : ''}`}>
              <div className="flex h-14 items-end justify-center overflow-hidden">
                <NpcFace def={def} />
              </div>
              <div className="text-center text-xs font-semibold">{def.name}</div>
              <div className="text-[10px] opacity-70">
                Lv.{prog.level} · {ROLE_LABEL[def.role]}
              </div>
              <Bars hp={prog.hp / s.maxHp} mp={prog.mp / s.maxMp} />
              <PositionPicker memberId={def.id} value={pos(def.id)} />
              {npcPet && (
                <div className={`flex items-center gap-1 text-[10px] ${pos(def.id) === 'front' ? '' : 'opacity-50'}`}>
                  <Image src={npcPet.icon} alt="" width={14} height={14} />
                  {npcPet.name} {pos(def.id) === 'front' ? '동행' : '(전위만)'}
                </div>
              )}
              {bench.length > 0 && (
                <Button size="sm" variant="parchment" className="mt-0.5 h-6 px-2 text-[10px]" onClick={() => setSwapSlot(swapping ? null : i)}>
                  {swapping ? '교체 취소' : '교체'}
                </Button>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-2 grid grid-cols-1 gap-1 text-[10px] text-muted-foreground sm:grid-cols-3">
        {POSITIONS.map((p) => (
          <div key={p}>
            <span className="font-semibold text-gold-soft">{POSITION_META[p].label}</span> {POSITION_META[p].bonus} — {POSITION_META[p].role}
          </div>
        ))}
      </div>

      {/* 주인공 펫 선택 */}
      <div className="mt-3 mb-1 text-xs font-display text-gold-soft">주인공 펫 (전위일 때 함께 싸움)</div>
      <div className="flex flex-wrap gap-2">
        {state.ownedPets.map((p) => {
          const d = petDefById(p.defId)
          if (!d) return null
          const active = p.defId === pet.defId
          return (
            <button
              key={p.defId}
              onClick={() => dispatch({ type: 'SET_ACTIVE_PET', defId: p.defId })}
              className={`panel-parchment flex items-center gap-1.5 px-2 py-1 text-[11px] ${active ? 'ring-2 ring-gold' : 'opacity-75'}`}
            >
              <Image src={d.icon} alt="" width={20} height={20} />
              {p.nickname} Lv.{p.level}
              {active && <span className="text-[9px]">({AFFECTION_TIER_META[affectionTier(p.affection)].label})</span>}
            </button>
          )
        })}
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">
        {pet.nickname}: {petDef.species} · HP {pet.hp}/{petStats.maxHp} · 애정도 {pet.affection}% ({petTierMeta.label})
      </div>

      {/* 학교 NPC 명단 */}
      <div className="mt-4 mb-1 text-xs font-display text-gold-soft">
        학교 NPC 명단 {swapSlot != null && <span className="text-[10px] font-normal text-white/70">— {swapSlot + 1}번 자리에 넣을 NPC를 고르세요</span>}
      </div>
      <div className="grid max-h-[30vh] grid-cols-1 gap-2 overflow-y-auto pr-1 scrollbar-thin sm:grid-cols-2">
        {COMBAT_NPCS.map((def) => {
          const prog = companions.recruited[def.id]
          const inParty = companions.party.includes(def.id)
          const check = canRecruit(state, def)
          const aff = state.relationships[def.id]?.affinity ?? 0
          const npcPet = def.combat ? petDefById(def.combat.petDefId) : undefined
          return (
            <div key={def.id} className={`panel-parchment flex items-center gap-2.5 p-2.5 ${!prog && !check.ok ? 'opacity-60' : ''}`}>
              <div className="flex h-12 w-12 shrink-0 items-end justify-center overflow-hidden">
                <NpcFace def={def} px={48} />
              </div>
              <div className="min-w-0 flex-1 text-xs">
                <div className="flex items-center gap-1.5 font-semibold">
                  {def.name}
                  <span className="rounded bg-black/10 px-1 text-[9px]">{ROLE_LABEL[def.role]}</span>
                  {def.combat && <span className="text-[10px] font-normal opacity-70">기본 {POSITION_META[def.combat.defaultPosition].label}</span>}
                </div>
                <div className="truncate text-[10px] opacity-70">
                  {def.title}
                  {npcPet ? ` · 펫 ${npcPet.name}` : ''}
                </div>
                <div className="truncate text-[10px] italic opacity-70">“{prog ? def.lines.idle : def.lines.recruit}”</div>
                {prog && <div className="text-[10px] opacity-70">Lv.{prog.level} · 관계도 {aff}</div>}
              </div>
              {!prog ? (
                <Button size="sm" disabled={!check.ok} onClick={() => dispatch({ type: 'RECRUIT_COMPANION', companionId: def.id })} title={check.reason}>
                  {check.ok ? '합류' : check.reason}
                </Button>
              ) : inParty ? (
                <span className="text-[10px] text-gold-soft">출전 중</span>
              ) : swapSlot != null ? (
                <Button
                  size="sm"
                  onClick={() => {
                    dispatch({ type: 'SWAP_PARTY_MEMBER', slot: swapSlot, companionId: def.id })
                    setSwapSlot(null)
                  }}
                >
                  이 자리에
                </Button>
              ) : companions.party.length < COMPANION_SLOTS ? (
                <Button size="sm" onClick={() => dispatch({ type: 'TOGGLE_PARTY_MEMBER', companionId: def.id })}>
                  편성
                </Button>
              ) : (
                <span className="text-[10px] opacity-60">대기</span>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        전투는 주인공과 학교 NPC 3명, 4대4로 진행됩니다. 진형은 전위 1~2 · 후위 1~2 · 보조 0~1명이며, 펫은 전위에 선 캐릭터만 데려갈 수 있습니다(최대 2마리).
        예전 주인공 후보 6인은 이제 학교 NPC입니다. 합류 조건(학년·스토리)은 임시값입니다.
      </p>

      <div className="mt-3 flex justify-end">
        <Button variant="ghost" onClick={close}>
          닫기
        </Button>
      </div>
    </Modal>
  )
}

function Bars({ hp, mp }: { hp: number; mp: number }) {
  return (
    <div className="w-full space-y-1">
      <Progress value={Math.max(0, Math.min(1, hp)) * 100} barClassName="bg-hp" className="h-1.5 w-full" />
      <Progress value={Math.max(0, Math.min(1, mp)) * 100} barClassName="bg-mp" className="h-1.5 w-full" />
    </div>
  )
}
