'use client'

// 펫 훈련소 — 공용 GameWindow. 왼쪽 펫 프로필 · 오른쪽 보유/훈련 가능 스킬.

import Image from 'next/image'
import { useGame } from '@/lib/game-state'
import { skillById, itemById } from '@/lib/mock-data'
import { AFFECTION_TIER_META, affectionTier, canTrain, petDefById, petStatsForLevel } from '@/lib/pets'
import { Bar, GameWindow, HeadPill, menuIcon, Ribbon } from '@/components/game/game-window'

export function TamerScreen() {
  const { state, dispatch } = useGame()
  if (state.screen !== 'tamer') return null
  const close = () => dispatch({ type: 'CLOSE_OVERLAY' })

  const { pet, player } = state
  const def = petDefById(pet.defId)!
  const maxHp = petStatsForLevel(def, pet.level).maxHp
  const tierMeta = AFFECTION_TIER_META[affectionTier(pet.affection)]
  const hasItem = (id: string) => state.inventory.some((s) => s.itemId === id)

  return (
    <GameWindow
      title="펫 훈련소"
      subtitle="PET TRAINING"
      size="md"
      width={700}
      onClose={close}
      headerExtra={
        <HeadPill icon={menuIcon('icon-coin')}>
          <b>{player.gold.toLocaleString()}</b> G
        </HeadPill>
      }
    >
      <div className="grid gap-3 md:grid-cols-[220px_1fr]">
        <section className="gw-panel is-pad flex flex-col items-center text-center">
          <div className="craft-medal">
            <Image src={def.icon} alt={pet.nickname} width={64} height={64} unoptimized />
          </div>
          <div className="mt-3 font-display text-[16px] font-bold text-[#2c2a33]">{pet.nickname}</div>
          <div className="mt-1 flex flex-wrap justify-center gap-1.5">
            <span className="gw-pill is-gold">Lv.{pet.level}</span>
            <span className="gw-pill is-soft">{def.species}</span>
          </div>
          <div className="mt-3 w-full space-y-2 text-left text-[12.5px] text-[#6c6150]">
            <div>
              <div className="mb-1 flex justify-between">
                <span>HP</span>
                <b className="text-[#3b3843]">
                  {pet.hp}/{maxHp}
                </b>
              </div>
              <Bar kind="hp" value={(pet.hp / maxHp) * 100} />
            </div>
            <div>
              <div className="mb-1 flex justify-between">
                <span>애정도 · {tierMeta.label}</span>
                <b className="text-[#3b3843]">{pet.affection}%</b>
              </div>
              <Bar kind="pink" value={pet.affection} />
              <div className="mt-1 text-[11.5px]">{tierMeta.note}</div>
            </div>
          </div>
        </section>

        <section className="gw-panel is-pad">
          <Ribbon>보유 스킬</Ribbon>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {pet.learnedSkills.map((id) => {
              const s = skillById(id)
              return s ? (
                <span key={id} className="gw-pill is-soft" title={s.description}>
                  {s.name}
                </span>
              ) : null
            })}
          </div>

          <Ribbon>훈련 가능한 스킬</Ribbon>
          <div className="flex flex-col gap-2">
            {def.trainableSkills.map((t) => {
              const s = skillById(t.skillId)
              if (!s) return null
              const check = canTrain(pet, t.skillId, player.gold, hasItem)
              const learned = pet.learnedSkills.includes(t.skillId)
              return (
                <div key={t.skillId} className={`gw-row !cursor-default ${learned ? 'is-dim' : ''}`}>
                  <span className="gw-row-main">
                    <span className="gw-row-title">{s.name}</span>
                    <span className="gw-row-desc">{s.description}</span>
                    <span className="gw-row-meta">
                      요구 Lv.{t.minLevel} · {t.costGold}G{t.costItemId ? ` · ${itemById(t.costItemId)?.name ?? '훈련서'}` : ''}
                    </span>
                  </span>
                  <button type="button" className="gw-btn is-gold is-sm" disabled={learned || !check.ok} title={learned ? '이미 배움' : check.reason} onClick={() => dispatch({ type: 'PET_TRAIN', skillId: t.skillId })}>
                    {learned ? '습득함' : '훈련'}
                  </button>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-[#8a7c62]">먹이를 주면 애정도가 오릅니다(가방 › 먹이). 애정도가 높을수록 펫의 전투 능력치와 지원 공격 확률이 올라갑니다.</p>
        </section>
      </div>
    </GameWindow>
  )
}
