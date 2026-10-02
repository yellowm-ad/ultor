'use client'

import Image from 'next/image'
import { useGame } from '@/lib/game-state'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { HeroSprite, playerSheet } from '@/components/game/pixel-hero'
import { DiamondMark, rarityGlowStyle } from '@/components/game/ui-motifs'
import { elementColor, elementLabel, POSITION_META, SKILL_LOADOUT_SIZE } from '@/lib/constants'
import { itemById, SKILLS } from '@/lib/mock-data'
import { getEffectiveStats } from '@/lib/derived'
import { expProgressPercent, expRequiredForLevel, MAX_LEVEL } from '@/lib/exp-table'
import type { EquipSlot } from '@/lib/types'

const STAT_LABELS: Record<string, string> = {
  maxHp: 'HP',
  maxMp: 'MP',
  atk: '공격력',
  def: '방어력',
  matk: '마법공격력',
  mdef: '마법방어력',
  spd: '속도',
  luck: '행운',
}

const SLOT_LABELS: Record<EquipSlot, string> = { weapon: '무기', armor: '방어구', accessory: '장신구' }

export function CharacterScreen() {
  const { state, dispatch } = useGame()
  if (state.screen !== 'character') return null
  const close = () => dispatch({ type: 'SET_SCREEN', screen: 'world' })

  const { player } = state
  const effStats = getEffectiveStats(player)
  const learnedSkills = SKILLS.filter((s) => player.learnedSkills.includes(s.id))
  const heroPos = state.formation.positions.hero ?? 'front'

  return (
    <Modal open onClose={close} title="내 정보" widthClass="max-w-2xl">
      <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
        <div className="flex flex-col items-center gap-2">
          <div
            className="flex h-32 w-24 items-end justify-center overflow-hidden rounded-lg border-2 border-gold/60"
            style={{ background: 'rgba(0,0,0,0.3)' }}
          >
            <HeroSprite sheet={playerSheet(player.appearance.gender)} dir="down" px={96} />
          </div>
          <div className="text-center">
            <div className="font-display text-lg text-gold-soft">{player.name}</div>
            <div className="text-xs text-muted-foreground">
              Lv.{player.level} · {POSITION_META[heroPos].label} · 고정 속성 없음
            </div>
          </div>
          <div className="w-full space-y-1">
            <Progress
              value={(player.hp / effStats.maxHp) * 100}
              barClassName="bg-hp"
              label={
                <span className="flex items-center gap-1">
                  <DiamondMark size={9} />
                  HP {player.hp}/{effStats.maxHp}
                </span>
              }
            />
            <Progress
              value={(player.mp / effStats.maxMp) * 100}
              barClassName="bg-mp"
              label={
                <span className="flex items-center gap-1">
                  <DiamondMark size={9} />
                  MP {player.mp}/{effStats.maxMp}
                </span>
              }
            />
            <Progress value={expProgressPercent(player.level, player.exp)} barClassName="bg-exp" className="h-2" />
            <div className="text-center text-[10px] text-muted-foreground">
              {player.level >= MAX_LEVEL ? '최대 레벨' : `다음 레벨까지 ${(expRequiredForLevel(player.level) - player.exp).toLocaleString()} EXP`}
            </div>
          </div>

          <div className="grid w-full grid-cols-3 gap-1.5 pt-1">
            {(['weapon', 'armor', 'accessory'] as EquipSlot[]).map((slot) => {
              const itemId = player.equipped[slot]
              const item = itemId ? itemById(itemId) : null
              return (
                <button
                  key={slot}
                  onClick={() => item && dispatch({ type: 'UNEQUIP_ITEM', slot })}
                  style={item ? rarityGlowStyle(item.type) : undefined}
                  className="panel-parchment rarity-glow flex aspect-square flex-col items-center justify-center gap-0.5 p-1"
                  title={item ? `${item.name} (클릭하여 해제)` : SLOT_LABELS[slot]}
                >
                  {item ? <Image src={item.icon} alt={item.name} width={22} height={22} /> : <span className="text-[9px] opacity-50">{SLOT_LABELS[slot]}</span>}
                </button>
              )
            })}
          </div>
        </div>

        <div className="panel-parchment space-y-3 p-4">
          <div>
            <h3 className="mb-1.5 flex items-center gap-1.5 font-display text-sm font-bold text-[#8a6a2c]">
              <DiamondMark size={11} />
              스탯
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {(Object.keys(STAT_LABELS) as (keyof typeof STAT_LABELS)[]).map((key) => (
                <div key={key} className="flex justify-between border-b border-[#c2a061]/40 py-0.5">
                  <span className="opacity-75">{STAT_LABELS[key]}</span>
                  <span className="font-semibold">{(effStats as any)[key]}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-1 flex items-center gap-1.5 font-display text-sm font-bold text-[#8a6a2c]">
              <DiamondMark size={11} />
              배운 마법 — 전투 장착 {player.equippedSkills.length}/{SKILL_LOADOUT_SIZE}
            </h3>
            <p className="mb-1.5 text-[10px] opacity-60">마법은 학교 수업으로 배웁니다. 눌러서 전투에 들고 갈 마법을 고르세요.</p>
            <div className="flex flex-wrap gap-1.5">
              {learnedSkills.length === 0 && <span className="text-xs opacity-50">배운 마법이 없습니다.</span>}
              {learnedSkills.map((s) => {
                const on = player.equippedSkills.includes(s.id)
                const locked = (s.levelRequired ?? 0) > player.level
                return (
                  <button
                    key={s.id}
                    title={`${s.description}${locked ? ` (Lv.${s.levelRequired}부터 사용 가능)` : ''}`}
                    onClick={() => dispatch({ type: 'TOGGLE_EQUIP_SKILL', skillId: s.id })}
                    className={`rounded-md border px-2 py-0.5 text-[11px] ${on ? 'border-[#8a6a2c] bg-[#8a6a2c]/20 font-semibold' : 'border-black/15 opacity-60'} ${locked ? 'line-through' : ''}`}
                  >
                    <span style={{ color: elementColor(s.element) }}>●</span> {s.name}
                    <span className="ml-1 text-[9px] opacity-60">{elementLabel(s.element)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <Button variant="ghost" onClick={close}>
          닫기
        </Button>
      </div>
    </Modal>
  )
}
