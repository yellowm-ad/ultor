'use client'

// 길드 의뢰 게시판 — 길드관 안내원·의뢰 표지판에서 연다(lib/guild-quest-data · lib/quests guildBoard).
// 왼쪽: 받아 둔 의뢰(모든 길드) + 이 길드의 최상급 전수 시험 · 오른쪽: 이 길드 게시판.

import { useGame } from '@/lib/game-state'
import { activeGuildQuests, guildBoard, questTemplateById } from '@/lib/quests'
import { GUILD_ACTIVE_MAX, GUILD_LABEL, type GuildKey } from '@/lib/guild-quest-data'
import { GUILD_TRIALS, trialState } from '@/lib/guild-trials'
import { itemById, npcById, skillById } from '@/lib/mock-data'
import { GameWindow, Ribbon } from '@/components/game/game-window'
import type { QuestReward } from '@/lib/types'

const CAT_LABEL: Record<string, string> = {
  NPC: '주민', COMBAT: '토벌', EXPLORE: '탐사', GATHER: '채집', HUNT: '사냥', FISH: '낚시', ALCHEMY: '연금', COOK: '요리', CRAFT: '제작', HOUSING: '하우징',
}
const TRIAL_OF: Partial<Record<GuildKey, string>> = { village: 'light', ruin: 'dark', sky: 'earth', aurora: 'ice', demon: 'fire' }

function rewardText(r: QuestReward): string | null {
  switch (r.type) {
    case 'EXP': return `EXP ${r.amount}+`
    case 'GOLD': return `${r.amount}G+`
    case 'ITEM': return `${itemById(r.itemId)?.name ?? r.itemId} ×${r.amount}`
    case 'RELATIONSHIP': return `${npcById(r.npcId)?.name.split(' ').pop() ?? ''} 호감 +${r.amount}`
    default: return null
  }
}

export function GuildBoardScreen() {
  const { state, dispatch } = useGame()
  const guild = state.guildBoardKey as GuildKey | undefined
  if (state.screen !== 'guildBoard' || !guild || !GUILD_LABEL[guild]) return null
  const close = () => dispatch({ type: 'CLOSE_OVERLAY' })
  const board = guildBoard(state, guild)
  const active = activeGuildQuests(state.weekly)
  const full = active.length >= GUILD_ACTIVE_MAX
  const trial = GUILD_TRIALS.find((t) => t.el === TRIAL_OF[guild])
  const tst = trial ? trialState(state, trial) : null

  return (
    <GameWindow title={GUILD_LABEL[guild]} subtitle="GUILD QUESTS" size="md" width={820} onClose={close}>
      <div className="grid gap-3 md:grid-cols-[260px_1fr]">
        <section className="gw-panel is-pad">
          <Ribbon>받은 의뢰 {active.length}/{GUILD_ACTIVE_MAX}</Ribbon>
          {active.length === 0 && <p className="rep-note">아직 받은 의뢰가 없습니다. 오른쪽 게시판에서 골라 보세요.</p>}
          <div className="flex flex-col gap-2">
            {active.map((q) => {
              const t = questTemplateById(q.templateId)
              if (!t) return null
              return (
                <div key={q.instanceId} className="rep-req">
                  <div className="min-w-0 flex-1">
                    <div className="rep-req-who">{t.title}</div>
                    <div className="rep-req-text">{GUILD_LABEL[q.guild as GuildKey] ?? ''}</div>
                    <ul className="mt-1 text-[11.5px] leading-snug">
                      {t.objectives.map((ob, i) => {
                        const done = (q.progress[i] ?? 0) >= ob.count
                        return (
                          <li key={i} className={done ? 'line-through opacity-60' : ''}>
                            · {ob.label} {ob.count > 1 ? `${Math.min(q.progress[i] ?? 0, ob.count)}/${ob.count}` : ''}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                  <button type="button" className="gw-btn is-sm is-quiet" onClick={() => dispatch({ type: 'GUILD_DROP', instanceId: q.instanceId })}>
                    포기
                  </button>
                </div>
              )
            })}
          </div>
          {trial && (
            <>
              <Ribbon>최상급 전수 시험</Ribbon>
              <div className={`rep-req is-final ${tst === 'early' ? 'is-locked' : ''}`}>
                <div className="min-w-0 flex-1">
                  <div className="rep-req-who">{trial.title}</div>
                  <div className="rep-req-text">
                    {tst === 'early'
                      ? `레벨이 더 오르면 전수자 ${npcById(trial.npcId)?.name ?? ''}이(가) 시험을 꺼냅니다.`
                      : tst === 'offer'
                        ? `전수자 ${npcById(trial.npcId)?.name ?? ''}에게 말을 걸어 시험을 받으세요.`
                        : tst === 'asked'
                          ? `받은 시험 — ${trial.items.map((r) => `${itemById(r.itemId)?.name ?? r.itemId} ×${r.qty}`).join(', ')}을(를) 전수자에게 바치세요.`
                          : '전수 완료'}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {trial.skills.map((id) => (
                      <span key={id} className="gw-pill is-gold">{skillById(id)?.name ?? id}</span>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="gw-panel is-pad">
          <Ribbon>의뢰 게시판</Ribbon>
          <p className="rep-note">받고 싶은 만큼 골라 언제든 진행하세요. 주간 마감과는 상관없고, 목표를 다 채우면 바로 사례가 나갑니다.</p>
          <div className="flex max-h-[52vh] flex-col gap-2 overflow-y-auto pr-1 scrollbar-thin">
            {board.length === 0 && <p className="rep-note">지금은 붙어 있는 의뢰가 없습니다. 시간이 지나면 새 의뢰가 들어옵니다.</p>}
            {board.map(({ t, minLevel, locked }) => (
              <div key={t.id} className={`rep-req ${locked ? 'is-locked' : ''}`}>
                <div className="min-w-0 flex-1">
                  <div className="rep-req-who">
                    <span className="gw-pill is-soft mr-1">{CAT_LABEL[t.category] ?? t.category}</span>
                    {t.title}
                    {t.giver && <span className="ml-1 text-[11px] font-normal opacity-70">— {t.giver}</span>}
                  </div>
                  <div className="rep-req-text">{t.description}</div>
                  <div className="mt-1 text-[11.5px] leading-snug opacity-80">{t.objectives.map((o) => o.label).join(' → ')}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className="gw-pill is-soft">Lv.{minLevel}+</span>
                    {t.rewards.map(rewardText).filter(Boolean).map((r) => (
                      <span key={r} className="gw-pill is-gold">{r}</span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  className="gw-btn is-gold"
                  disabled={!!locked || full}
                  title={locked ?? (full ? '받은 의뢰가 가득 찼습니다' : undefined)}
                  onClick={() => dispatch({ type: 'GUILD_ACCEPT', guild, templateId: t.id })}
                >
                  {locked ? '잠김' : '받기'}
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </GameWindow>
  )
}
