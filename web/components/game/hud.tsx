'use client'

import Image from 'next/image'
import { memo } from 'react'
import type { GameState } from '@/lib/types'
import { useGame } from '@/lib/game-state'
import { POSITION_META } from '@/lib/constants'
import { HeroSprite } from '@/components/game/pixel-hero'
import { skillById } from '@/lib/mock-data'
import { expProgressPercent, MAX_LEVEL } from '@/lib/exp-table'
import { Sparkles } from 'lucide-react'
import { calendarShortLabel } from '@/lib/calendar'
import { questTemplateById, REQUIRED_OPTIONAL, weekCompletion } from '@/lib/quests'
import { itemById } from '@/lib/mock-data'
import { heroSheet, npcSheet } from '@/lib/costumes'

// 걷는 동안 게임 상태는 매 프레임 바뀌지만(위치) HUD 에 보이는 값은 그대로다 — 보이는 값만 넘겨 memo 로 다시 그리기를 건너뛴다
export function Hud() {
  const { state, dispatch } = useGame()
  return (
    <HudView
      player={state.player}
      sheet={heroSheet(state)}
      summons={state.player.summonSkills ?? []}
      heroPos={state.formation.positions.hero ?? 'front'}
      testMode={!!state.settings.testMode}
      weekly={state.weekly}
      calendar={state.calendar}
      mealBuff={state.mealBuff}
      dispatch={dispatch}
    />
  )
}

type HudProps = {
  /** 입은 코스튬 시트(lib/costumes) */
  sheet: string
  player: GameState['player']
  summons: string[]
  heroPos: NonNullable<GameState['formation']['positions']['hero']>
  testMode: boolean
  weekly: GameState['weekly']
  calendar: GameState['calendar']
  mealBuff: GameState['mealBuff']
  dispatch: ReturnType<typeof useGame>['dispatch']
}

const HudView = memo(function HudView({ player, sheet, summons, heroPos, testMode, weekly, calendar, mealBuff, dispatch }: HudProps) {

  return (
    <div className="hud-safe pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-3 sm:p-4">
      {/* 좌측: 캐릭터 상태 + 소환 칸 — 박스 없이 초상+바만 화면 위에 직접 떠 있음(원신풍) */}
      <div className="pointer-events-auto flex flex-col gap-2">
        <div className="title-enter-1 flex items-center gap-2.5">
          <div className="portrait-ring flex size-12 shrink-0 items-end justify-center overflow-hidden">
            <HeroSprite sheet={sheet} dir="down" px={44} />
          </div>
          <div className="flex w-40 flex-col gap-1 sm:w-48">
            <div className="hud-clean-text hud-clean-label flex items-center gap-1.5 text-[13px]">
              <span className="min-w-0 flex-1 truncate text-gold-soft">{player.name}</span>
              <span className="shrink-0 text-white/75">Lv.{player.level}</span>
            </div>
            <div className="hud-clean-bar-track hud-clean-bar-hp-size">
              <div className="hud-clean-bar-fill hud-bar-hp" style={{ width: `${(player.hp / player.stats.maxHp) * 100}%` }} />
            </div>
            <div className="hud-clean-bar-track hud-clean-bar-thin">
              <div className="hud-clean-bar-fill hud-bar-mp" style={{ width: `${(player.mp / player.stats.maxMp) * 100}%` }} />
            </div>
            <div className="hud-clean-bar-track hud-clean-bar-thin">
              <div className="hud-clean-bar-fill hud-bar-exp" style={{ width: `${expProgressPercent(player.level, player.exp)}%` }} />
            </div>
            <div className="hud-clean-text flex items-center justify-between text-[10px]">
              <span>
                {POSITION_META[heroPos].label}
                {player.level >= MAX_LEVEL ? <span className="ml-1 text-gold-soft">· 최고 레벨</span> : null}
              </span>
              <span className="text-gold-soft">{player.gold.toLocaleString()} G</span>
            </div>
          </div>
        </div>

        {/* 학사 달력 + 이번 주 필수 미션 + 식사 버프 */}
        <WeekTracker weekly={weekly} calendar={calendar} mealBuff={mealBuff} dispatch={dispatch} />

        {/* 소환 마법 칸(옛 펫 자리) — 작게 */}
        {summons.length > 0 && (
          <div className="title-enter-2 hidden items-center gap-1 pl-1 sm:flex" title="소환 마법 칸 — 전투에서 마법 › 소환으로 부른다">
            {summons.map((id) => {
              const s = skillById(id)
              return s ? (
                <span key={id} className="hud-summon-slot">
                  <Image src={s.icon} alt={s.name} width={22} height={22} unoptimized />
                </span>
              ) : null
            })}
          </div>
        )}
      </div>

      {/* 우측: 아이콘 메뉴 — 박스 버튼 대신 순수 아이콘 */}
      <div className="pointer-events-auto title-enter-3 flex flex-col items-end gap-2">
        <div className="flex gap-3 sm:gap-3.5">
          <MenuIcon src="/images/icons/menu/hud-journal.png" label="수첩" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'journal' })} />
          <MenuIcon src="/images/icons/hud/backpack.png" label="가방" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'inventory' })} />
          <MenuIcon src="/images/icons/menu/hud-craft.png" label="제작" onClick={() => dispatch({ type: 'OPEN_CRAFT', npcId: 'npc-workbench' })} />
          <MenuIcon src="/images/icons/hud/character.png" label="정보" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'character' })} />
          <MenuIcon src="/images/icons/hud/magic.png" label="마법" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'magic' })} />
          <MenuIcon src="/images/icons/hud/party.png" label="파티" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'party' })} />
          <MenuIcon src="/images/icons/hud/settings.png" label="설정" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'settings' })} />
        </div>
        {testMode && (
          <div className="hud-testmode hud-clean-text flex items-center gap-1 text-[10px] text-gold-soft">
            <Sparkles className="size-3" /> 테스트 모드 ON
          </div>
        )}
      </div>
    </div>
  )
})

function WeekTracker({ weekly, calendar, mealBuff, dispatch }: Pick<HudProps, 'weekly' | 'calendar' | 'mealBuff' | 'dispatch'>) {
  const state = { weekly, calendar, mealBuff }
  const main = state.weekly.quests.find((q) => q.slot === 'MAIN')
  const mainT = main ? questTemplateById(main.templateId) : undefined
  const { canEnd, optionalDone, requiredOptional } = weekCompletion(state.weekly)
  // 필수 미션 진행도 — 목표가 여러 개면 합산
  const mainP = mainT && main ? mainT.objectives.reduce((a, ob, i) => a + Math.min(main.progress[i] ?? 0, ob.count), 0) : 0
  const mainTotal = mainT ? mainT.objectives.reduce((a, ob) => a + ob.count, 0) : 1
  const ready = state.weekly.quests.some((q) => q.status === 'complete')
  const meal = state.mealBuff ? itemById(state.mealBuff.itemId) : undefined
  return (
    <button
      type="button"
      onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'journal' })}
      className="title-enter-2 flex w-56 flex-col items-start gap-0.5 pl-1 text-left"
      title="학사 수첩 (J)"
    >
      <span className="hud-clean-text hud-clean-label text-[11px] text-gold-soft">{calendarShortLabel(state.calendar)}</span>
      {mainT && main && (
        <span className="hud-clean-text truncate text-[10px] text-white/80">
          ★ {mainT.title}{' '}
          {main.status === 'claimed' ? '✔' : main.status === 'complete' ? '(보상 대기)' : `${mainP}/${mainTotal}`}
          <span className="ml-1 text-white/50">· 보조 {optionalDone}/{requiredOptional}</span>
        </span>
      )}
      {(ready || canEnd) && (
        <span className="hud-clean-text text-[10px] text-gold-soft">{canEnd ? '▶ 이번 주 마감 가능' : '● 받을 보상이 있어요'}</span>
      )}
      {meal && state.mealBuff && (
        <span className="hud-clean-text text-[10px] text-emerald-200">
          식사 버프 · {meal.mealBuff?.label} ({state.mealBuff.battlesLeft}전투)
        </span>
      )}
    </button>
  )
}

function MenuIcon({ src, label, onClick }: { src: string; label: string; onClick: () => void }) {
  return (
    <button type="button" className="hud-icon-btn" onClick={onClick} title={label} aria-label={label}>
      <Image src={src} alt="" width={42} height={42} />
      <span className="hud-icon-btn-label">{label}</span>
    </button>
  )
}
