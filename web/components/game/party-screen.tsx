'use client'

import Image from 'next/image'
import { useGame } from '@/lib/game-state'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ELEMENT_META, JOB_TIERS, jobTierForLevel, MAX_PARTY_SIZE } from '@/lib/constants'
import { AFFECTION_TIER_META, affectionTier, petDefById, petStatsForLevel } from '@/lib/pets'
import { canRecruit, COMPANION_SLOTS, COMPANIONS, companionById, companionStats, type CompanionDef } from '@/lib/companions'
import { HeroSprite } from '@/components/game/pixel-hero'
import { UserPlus } from 'lucide-react'

const ROLE_LABEL = { student: '학생', professor: '교수', story: '스토리' } as const

function CompanionFace({ def, px = 56 }: { def: CompanionDef; px?: number }) {
  const a = def.appearance
  if (a?.kind === 'hero') return <HeroSprite element={a.element} gender={a.gender} dir="down" px={px} />
  return <Image src={`/images/elements/${def.element}-crest.png`} alt="" width={28} height={28} />
}

export function PartyScreen() {
  const { state, dispatch } = useGame()
  if (state.screen !== 'party') return null
  const close = () => dispatch({ type: 'SET_SCREEN', screen: 'world' })

  const { player, pet, companions } = state
  const elem = ELEMENT_META[player.element]
  const jobTier = JOB_TIERS.find((t) => t.id === player.jobTierId)!
  const petDef = petDefById(pet.defId)!
  const petStats = petStatsForLevel(petDef, pet.level)
  const petTierMeta = AFFECTION_TIER_META[affectionTier(pet.affection)]
  const partyCount = 2 + companions.party.length

  return (
    <Modal open onClose={close} title={`파티 (${partyCount}/${MAX_PARTY_SIZE})`} widthClass="max-w-3xl">
      {/* 전투 파티 — 주인공 · 펫 · 동료 2 */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="panel-parchment flex flex-col items-center gap-1.5 p-2.5">
          <div
            className="portrait-ring flex size-14 items-center justify-center"
            style={{ ['--ring-col' as string]: elem.color as string, ['--ring-glow' as string]: `${elem.color}88` }}
          >
            <Image src={elem.icon} alt="" width={28} height={28} />
          </div>
          <div className="text-center text-xs font-semibold">{player.name}</div>
          <div className="text-[10px] opacity-70">
            Lv.{player.level} · {jobTier.shortName}
          </div>
          <Bars hp={player.hp / player.stats.maxHp} mp={player.mp / player.stats.maxMp} />
        </div>

        <div className="panel-parchment flex flex-col items-center gap-1.5 p-2.5">
          <div className="portrait-ring flex size-14 items-center justify-center">
            <Image src={petDef.icon} alt="" width={28} height={28} />
          </div>
          <div className="text-center text-xs font-semibold">{pet.nickname}</div>
          <div className="text-center text-[10px] opacity-70">
            {petDef.species} · Lv.{pet.level} · 애정도 {pet.affection}% ({petTierMeta.label})
          </div>
          <Bars hp={pet.hp / Math.max(1, petStats.maxHp)} mp={pet.mp / Math.max(1, petStats.maxMp)} />
        </div>

        {Array.from({ length: COMPANION_SLOTS }).map((_, i) => {
          const id = companions.party[i]
          const def = id ? companionById(id) : undefined
          const prog = id ? companions.recruited[id] : undefined
          if (!def || !prog) {
            return (
              <div key={i} className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-gold/40 p-2.5 text-white/60">
                <UserPlus className="size-6" />
                <div className="text-center text-[10px]">동료 슬롯 — 아래 명부에서 편성</div>
              </div>
            )
          }
          const s = companionStats(def, prog.level)
          return (
            <div key={i} className="panel-parchment flex flex-col items-center gap-1 p-2.5">
              <div className="flex h-14 items-end justify-center overflow-hidden">
                <CompanionFace def={def} />
              </div>
              <div className="text-center text-xs font-semibold">{def.name}</div>
              <div className="text-[10px] opacity-70">
                Lv.{prog.level} · {jobTierForLevel(prog.level).shortName}
              </div>
              <Bars hp={prog.hp / s.maxHp} mp={prog.mp / s.maxMp} />
              <Button size="sm" variant="parchment" className="mt-1 h-6 px-2 text-[10px]" onClick={() => dispatch({ type: 'TOGGLE_PARTY_MEMBER', companionId: def.id })}>
                빼기
              </Button>
            </div>
          )
        })}
      </div>

      {/* 동료 명부 */}
      <div className="mt-4 mb-1 text-xs font-display text-gold-soft">동료 명부</div>
      <div className="grid max-h-[34vh] grid-cols-1 gap-2 overflow-y-auto pr-1 scrollbar-thin sm:grid-cols-2">
        {COMPANIONS.map((def) => {
          const prog = companions.recruited[def.id]
          const inParty = companions.party.includes(def.id)
          const check = canRecruit(state, def)
          const aff = state.relationships[def.id]?.affinity ?? 0
          return (
            <div key={def.id} className={`panel-parchment flex items-center gap-2.5 p-2.5 ${!prog && !check.ok ? 'opacity-60' : ''}`}>
              <div className="flex h-12 w-12 shrink-0 items-end justify-center overflow-hidden">
                <CompanionFace def={def} px={48} />
              </div>
              <div className="min-w-0 flex-1 text-xs">
                <div className="flex items-center gap-1.5 font-semibold">
                  {def.name}
                  <span className="rounded bg-black/10 px-1 text-[9px]">{ROLE_LABEL[def.role]}</span>
                  <span className="text-[10px] font-normal" style={{ color: ELEMENT_META[def.element].color }}>
                    {ELEMENT_META[def.element].line}
                  </span>
                </div>
                <div className="truncate text-[10px] opacity-70">{def.title}</div>
                <div className="truncate text-[10px] italic opacity-70">
                  “{prog ? def.lines.idle : def.lines.recruit}”
                </div>
                {prog && <div className="text-[10px] opacity-70">Lv.{prog.level} · 관계도 {aff}</div>}
              </div>
              {!prog ? (
                <Button size="sm" disabled={!check.ok} onClick={() => dispatch({ type: 'RECRUIT_COMPANION', companionId: def.id })} title={check.reason}>
                  {check.ok ? '합류' : check.reason}
                </Button>
              ) : (
                <Button size="sm" variant={inParty ? 'parchment' : 'default'} onClick={() => dispatch({ type: 'TOGGLE_PARTY_MEMBER', companionId: def.id })}>
                  {inParty ? '빼기' : '편성'}
                </Button>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        파티는 주인공 · 펫 · 동료 최대 {COMPANION_SLOTS}명으로 {MAX_PARTY_SIZE}인입니다. 동료는 전투에서 자동으로 행동하고, 승리하면 주인공과 같은 경험치를 받습니다.
        합류 조건(학년·스토리)은 임시값이며 스토리 작업 때 확정됩니다.
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
