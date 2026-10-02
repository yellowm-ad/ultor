'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useGame } from '@/lib/game-state'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { countPositions, expSharePerMember, FORMATION_LIMITS, MAX_GUESTS, MAX_PARTY_SIZE, POSITION_META, POSITIONS } from '@/lib/constants'
import { AFFECTION_TIER_META, affectionTier, petDefById, petStatsForLevel } from '@/lib/pets'
import { canRecruit, COMBAT_NPCS, COMPANION_SLOTS, companionStats, guestNpcById, guestStats, schoolNpcById, type SchoolNpc } from '@/lib/companions'
import { expRequiredForLevel } from '@/lib/exp-table'
import { HeroSprite, playerSheet } from '@/components/game/pixel-hero'
import type { Position } from '@/lib/types'

const ROLE_LABEL = { student: '학생', professor: '교수', story: '조교' } as const

function NpcFace({ def, px = 56 }: { def: SchoolNpc; px?: number }) {
  return <HeroSprite sheet={def.sprite} dir="down" px={px} />
}

/** 포지션 선택 — 전위/후위/지원 */
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

/** 전위 캐릭터의 펫(통합 PRD §26) — 전위가 아니면 안내만 */
function PetPicker({ memberId, front }: { memberId: string; front: boolean }) {
  const { state, dispatch } = useGame()
  const current = memberId === 'hero' ? state.pet.defId : state.formation.pets?.[memberId]
  const taken = new Set([state.pet.defId, ...Object.entries(state.formation.pets ?? {}).filter(([k]) => k !== memberId).map(([, v]) => v)])
  if (!front) return <div className="text-[10px] opacity-50">펫: 전위만 동행</div>
  return (
    <select
      className="w-full rounded border border-black/20 bg-white/60 px-1 py-0.5 text-[10px]"
      value={current ?? ''}
      onChange={(e) => dispatch({ type: 'SET_MEMBER_PET', memberId, defId: e.target.value || null })}
    >
      {memberId !== 'hero' && <option value="">펫 없음</option>}
      {state.ownedPets.map((p) => {
        const d = petDefById(p.defId)
        if (!d) return null
        const busy = taken.has(p.defId) && p.defId !== current
        return (
          <option key={p.defId} value={p.defId} disabled={busy}>
            🐾 {p.nickname} Lv.{p.level}
            {busy ? ' (동행 중)' : ''}
          </option>
        )
      })}
    </select>
  )
}

export function PartyScreen() {
  const { state, dispatch } = useGame()
  const [swapSlot, setSwapSlot] = useState<number | null>(null)
  if (state.screen !== 'party') return null
  const close = () => dispatch({ type: 'SET_SCREEN', screen: 'world' })

  const { player, pet, companions, formation } = state
  const guests = companions.guests ?? []
  const pos = (id: string): Position => formation.positions[id] ?? 'rear'
  const petDef = petDefById(pet.defId)
  const petStats = petDef ? petStatsForLevel(petDef, pet.level) : null
  const petTierMeta = AFFECTION_TIER_META[affectionTier(pet.affection)]
  const partyCount = 1 + companions.party.length
  const bench = Object.keys(companions.recruited).filter((id) => !companions.party.includes(id))
  // 진형 6칸 사용 현황(파티 + 임시 NPC)
  const lineup = countPositions(['hero', ...companions.party, ...guests.map((g) => g.id)].map(pos))
  // 경험치 분배 미리보기 — 몬스터 경험치 100 기준 1인 몫
  const sharePct = expSharePerMember(100, partyCount)
  const petCount = (pos('hero') === 'front' && petDef ? 1 : 0) + Object.keys(state.formation.pets ?? {}).length

  return (
    <Modal open onClose={close} title={`파티 편성 (${partyCount}/${MAX_PARTY_SIZE})`} widthClass="max-w-3xl">
      {/* 성장 vs 전투 안정성 안내 */}
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-black/25 px-2.5 py-1.5 text-[11px]">
        <span className="font-display text-gold-soft">경험치 분배</span>
        <span>
          {partyCount === 1 ? '단독 전투 — 경험치 100% 획득 (성장 빠름 · 전투 어려움)' : `${partyCount}인 파티 — 1인당 ${sharePct}% (전투 안정 · 성장 더딤)`}
        </span>
        <span className="opacity-60">1인 100% · 2인 55% · 3인 40% · 4인 32.5% / 펫은 1인 몫을 따로 받음</span>
      </div>

      {/* 핵심 전투원 — 주인공 + 동료 최대 3 */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="panel-parchment flex flex-col items-center gap-1.5 p-2.5">
          <div className="flex h-14 items-end justify-center overflow-hidden">
            <HeroSprite sheet={playerSheet(player.appearance.gender)} dir="down" px={56} />
          </div>
          <div className="text-center text-xs font-semibold">{player.name}</div>
          <div className="text-[10px] opacity-70">Lv.{player.level} · 주인공</div>
          <Bars hp={player.hp / player.stats.maxHp} mp={player.mp / player.stats.maxMp} exp={player.exp / expRequiredForLevel(player.level)} />
          <PositionPicker memberId="hero" value={pos('hero')} />
          <PetPicker memberId="hero" front={pos('hero') === 'front'} />
        </div>

        {Array.from({ length: Math.max(0, COMPANION_SLOTS - guests.length) }).map((_, i) => {
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
                <div className="text-center text-[10px]">빈 자리 — 명단에서 선택</div>
              </button>
            )
          }
          const s = companionStats(def, prog.level)
          return (
            <div key={i} className={`panel-parchment flex flex-col items-center gap-1 p-2.5 ${swapping ? 'ring-2 ring-gold' : ''}`}>
              <div className="flex h-14 items-end justify-center overflow-hidden">
                <NpcFace def={def} />
              </div>
              <div className="text-center text-xs font-semibold">{def.name}</div>
              <div className="text-[10px] opacity-70">
                Lv.{prog.level} · {ROLE_LABEL[def.role]}
              </div>
              <Bars hp={prog.hp / s.maxHp} mp={prog.mp / s.maxMp} exp={prog.exp / expRequiredForLevel(prog.level)} />
              <PositionPicker memberId={def.id} value={pos(def.id)} />
              <PetPicker memberId={def.id} front={pos(def.id) === 'front'} />
              <div className="mt-0.5 flex gap-1">
                {bench.length > 0 && (
                  <Button size="sm" variant="parchment" className="h-6 px-2 text-[10px]" onClick={() => setSwapSlot(swapping ? null : i)}>
                    {swapping ? '취소' : '교체'}
                  </Button>
                )}
                <Button size="sm" variant="parchment" className="h-6 px-2 text-[10px]" onClick={() => dispatch({ type: 'TOGGLE_PARTY_MEMBER', companionId: def.id })}>
                  빼기
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {/* 펫 고정 슬롯 + 임시 합류 NPC 2칸 */}
      <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <div className="panel-parchment flex items-center gap-2 p-2.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-black/15">
            {petDef && <Image src={petDef.icon} alt="" width={28} height={28} />}
          </div>
          <div className="min-w-0 text-xs">
            <div className="font-semibold">펫 동행 {petCount}/2</div>
            <div className="text-[10px] opacity-70">전위 캐릭터만 펫 1마리씩(최대 2마리)</div>
          </div>
        </div>
        {Array.from({ length: MAX_GUESTS }).map((_, i) => {
          const g = guests[i]
          const def = g ? guestNpcById(g.id) : undefined
          if (!g || !def) {
            return (
              <div key={i} className="flex items-center justify-center rounded-lg border border-dashed border-violet-400/40 p-2.5 text-center text-[10px] text-white/50">
                임시 합류 자리 — 호위 임무 NPC · 임시 동행 NPC
              </div>
            )
          }
          const s = guestStats(def, g.level)
          return (
            <div key={i} className="panel-parchment flex items-center gap-2 p-2.5 ring-1 ring-violet-400/60">
              <div className="flex h-12 w-10 shrink-0 items-end justify-center overflow-hidden">
                <HeroSprite sheet={def.sprite} dir="down" px={44} />
              </div>
              <div className="min-w-0 flex-1 text-xs">
                <div className="flex items-center gap-1 font-semibold">
                  {def.name}
                  <span className="rounded bg-violet-900/60 px-1 text-[9px] text-violet-100">{def.role === 'escort' ? '호위' : '동행'}</span>
                </div>
                <div className="text-[10px] opacity-70">Lv.{g.level} · 자동 행동 · 경험치 분배 제외</div>
                <Bars hp={g.hp / s.maxHp} mp={g.mp / s.maxMp} />
                <div className="mt-1">
                  <PositionPicker memberId={def.id} value={pos(def.id)} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 진형 6칸 현황 */}
      <div className="mt-2 grid grid-cols-1 gap-1 text-[10px] text-muted-foreground sm:grid-cols-3">
        {POSITIONS.map((p) => (
          <div key={p}>
            <span className="font-semibold text-gold-soft">
              {POSITION_META[p].label} {lineup[p]}/{FORMATION_LIMITS[p].max}
            </span>{' '}
            {POSITION_META[p].bonus} — {POSITION_META[p].role}
          </div>
        ))}
      </div>

      {/* 주인공 펫 선택 */}
      <div className="mt-3 mb-1 text-xs font-display text-gold-soft">보유 펫 — 주인공 펫 선택(주인공이 전위일 때 동행)</div>
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
      {petDef && petStats && (
        <div className="mt-1 text-[10px] text-muted-foreground">
          {pet.nickname}: {petDef.species} · HP {pet.hp}/{petStats.maxHp} · 애정도 {pet.affection}% ({petTierMeta.label})
        </div>
      )}

      {/* 동료 명단 */}
      <div className="mt-4 mb-1 text-xs font-display text-gold-soft">
        동료 명단 {swapSlot != null && <span className="text-[10px] font-normal text-white/70">— {swapSlot + 1}번 자리에 넣을 동료를 고르세요</span>}
      </div>
      <div className="grid max-h-[30vh] grid-cols-1 gap-2 overflow-y-auto pr-1 scrollbar-thin sm:grid-cols-2">
        {COMBAT_NPCS.map((def) => {
          const prog = companions.recruited[def.id]
          const inParty = companions.party.includes(def.id)
          const check = canRecruit(state, def)
          const aff = state.relationships[def.id]?.affinity ?? 0
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
                <div className="truncate text-[10px] opacity-70">{def.title}</div>
                <div className="truncate text-[10px] italic opacity-70">“{prog ? def.lines.idle : def.lines.recruit}”</div>
                {prog && (
                  <div className="text-[10px] opacity-70">
                    Lv.{prog.level} · EXP {prog.exp}/{expRequiredForLevel(prog.level)} · 관계도 {aff}
                  </div>
                )}
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
              ) : companions.party.length < COMPANION_SLOTS - guests.length ? (
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
        4대4 진형은 전위 2 · 후위 1 · 보조 1입니다. 펫은 전위 캐릭터만 1마리씩(최대 2마리) 데려갈 수 있습니다. 호위 임무·임시 동행 NPC가 합류하면 동료 자리 하나를 대신 씁니다.
        동료는 전투에서 직접 조작하며(전투 화면 &lsquo;동료 수동/자동&rsquo;), 각자 레벨이 있어 승리 경험치를 나눠 받습니다. 동료를 모두 빼고 혼자 다닐 수도 있습니다. 합류 조건은 임시값입니다.
      </p>

      <div className="mt-3 flex justify-end">
        <Button variant="ghost" onClick={close}>
          닫기
        </Button>
      </div>
    </Modal>
  )
}

function Bars({ hp, mp, exp }: { hp: number; mp: number; exp?: number }) {
  const clamp = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0)) * 100
  return (
    <div className="w-full space-y-1">
      <Progress value={clamp(hp)} barClassName="bg-hp" className="h-1.5 w-full" />
      <Progress value={clamp(mp)} barClassName="bg-mp" className="h-1.5 w-full" />
      {exp != null && <Progress value={clamp(exp)} barClassName="bg-gold" className="h-1 w-full" />}
    </div>
  )
}
