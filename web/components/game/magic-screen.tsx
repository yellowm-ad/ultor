'use client'

// 마법 — 공용 GameWindow(검은 틀 + 아이보리 패널). 2026-10-31 신설(HUD 「정보」와 「파티」 사이).
// 왼쪽 속성 분류 · 가운데 장착 칸(전투 8 + 소환 4)과 마법 목록 · 오른쪽 상세(이펙트 미리보기 · 숙련도 · 장착 · 숙련의 스크롤).

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useGame } from '@/lib/game-state'
import { itemById, SKILLS } from '@/lib/mock-data'
import { COURSES } from '@/lib/academics'
import { elementColor, elementLabel, SKILL_LOADOUT_SIZE, SUMMON_SLOT_SIZE } from '@/lib/constants'
import { petDefById } from '@/lib/pets'
import {
  GRADE_LABEL,
  MASTERY_MAX,
  masteredMpCost,
  masteryNeed,
  masteryOf,
  masteryPowerMult,
  skillGrade,
  summonTurnsFor,
} from '@/lib/skill-mastery'
import type { BattleFx, Skill } from '@/lib/types'
import { HeroSprite } from '@/components/game/pixel-hero'
import { CreatureSprite, spriteIdFromRefId } from '@/components/game/creature-sprite'
import { SkillFxLayer } from '@/components/game/skill-fx'
import { Bar, Divider, GameWindow, HeadPill, menuIcon, Ribbon, SideItem, Sparkle } from '@/components/game/game-window'
import { heroSheet, npcSheet } from '@/lib/costumes'
import { GradeBadge, GradeRibbon } from '@/components/game/grade-badge'
import { SKILL_GRADE_INFO } from '@/lib/grades'
import { TRIAL_OF_SKILL } from '@/lib/guild-trials'

type Tab = 'all' | 'fire' | 'ice' | 'earth' | 'dark' | 'light' | 'none' | 'summon'
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'all', label: '전체', icon: '/images/icons/hud/magic.png' },
  { id: 'fire', label: '불꽃', icon: '/images/elements/fire-crest.png' },
  { id: 'ice', label: '얼음', icon: '/images/elements/ice-crest.png' },
  { id: 'earth', label: '대지', icon: '/images/elements/earth-crest.png' },
  { id: 'dark', label: '어둠', icon: '/images/elements/dark-crest.png' },
  { id: 'light', label: '빛', icon: '/images/elements/light-crest.png' },
  { id: 'none', label: '무속성', icon: '/images/elements/neutral-crest.png' },
  { id: 'summon', label: '소환', icon: menuIcon('magic-summon') },
]


/** 학생이 가질 수 있는 마법(소환수 기술·모르스 전용 제외) */
const STUDENT_SKILLS = SKILLS.filter((s) => !s.owner)
const COURSE_OF = new Map<string, string>()
for (const c of COURSES) for (const id of c.teachesSkills ?? []) COURSE_OF.set(id, c.name)

const inTab = (s: Skill, tab: Tab) =>
  tab === 'all' ? true : tab === 'summon' ? s.kind === 'summon' : s.kind !== 'summon' && (s.element ?? 'none') === tab

/** 미리보기용 연출 갈래 — 전투 엔진 mkFx 와 같은 분류 */
export function previewFx(s: Skill, n: number): BattleFx {
  const archetype: BattleFx['archetype'] =
    s.kind === 'attack'
      ? s.physical
        ? 'attack'
        : 'magicAttack'
      : s.kind === 'heal' || s.kind === 'revive'
        ? 'heal'
        : s.kind === 'buff' || s.kind === 'stealth' || s.kind === 'summon'
          ? 'buff'
          : s.kind === 'utility'
            ? 'utility'
            : (s.kind === 'debuff' && s.power > 0) ? 'magicAttack' : 'debuff'
  const toSelf = archetype === 'heal' || archetype === 'buff' || archetype === 'utility'
  const aoe = s.targeting === 'allEnemies' || s.targeting === 'allAllies'
  return {
    fxId: `preview-${s.id}-${n}`,
    sourceUid: 'hero',
    targetUids: toSelf ? ['hero'] : aoe ? ['dummy', 'dummy2'] : ['dummy'],
    element: s.element,
    archetype,
    aoe,
    power: s.power || 1,
    mpCost: s.mpCost,
    skillName: s.name,
    skillId: s.id,
    physical: !!s.physical,
  }
}

const STAGE_POS: Record<string, { left: number; top: number }> = {
  hero: { left: 24, top: 78 },
  dummy: { left: 72, top: 70 },
  dummy2: { left: 86, top: 84 },
  summon: { left: 42, top: 86 },
}

/** 이펙트 미리보기 — 전투와 같은 연출 레이어(SkillFxLayer)를 작은 무대에서 재생 */
function SkillPreview({ skill, sheet }: { skill: Skill; sheet: string }) {
  const [n, setN] = useState(0)
  const [fx, setFx] = useState<BattleFx | undefined>(undefined)
  // 고를 때마다 한 번 자동 재생
  useEffect(() => {
    const t = setTimeout(() => setFx(previewFx(skill, Date.now())), 120)
    return () => clearTimeout(t)
  }, [skill])
  const creature = skill.summon ? petDefById(skill.summon.creatureId) : undefined
  const aoe = skill.targeting === 'allEnemies'
  return (
    <div className="magic-stage">
      <div className="magic-stage-floor" />
      {creature && fx && (
        <div key={fx.fxId} className="magic-stage-actor magic-summon-pop" style={{ left: `${STAGE_POS.summon.left}%`, top: `${STAGE_POS.summon.top}%` }}>
          <CreatureSprite spriteId={spriteIdFromRefId(creature.id)} fallbackSrc={creature.icon} px={56} dir="right" />
        </div>
      )}
      <div className="magic-stage-actor" style={{ left: `${STAGE_POS.hero.left}%`, top: `${STAGE_POS.hero.top}%` }}>
        <HeroSprite sheet={sheet} dir="right" px={74} />
      </div>
      {!creature && (
        <>
          <div className="magic-stage-actor" style={{ left: `${STAGE_POS.dummy.left}%`, top: `${STAGE_POS.dummy.top}%` }}>
            <CreatureSprite spriteId="mon-forest-raccoon" px={58} dir="left" />
          </div>
          {aoe && (
            <div className="magic-stage-actor" style={{ left: `${STAGE_POS.dummy2.left}%`, top: `${STAGE_POS.dummy2.top}%` }}>
              <CreatureSprite spriteId="mon-forest-raccoon" px={50} dir="left" />
            </div>
          )}
        </>
      )}
      <SkillFxLayer fx={fx} vfxScale={0.42} posOf={(uid) => STAGE_POS[uid] && { left: STAGE_POS[uid].left, top: STAGE_POS[uid].top - 12 }} groundOf={(uid) => STAGE_POS[uid]} />
      <button
        type="button"
        className="magic-stage-replay"
        onClick={() => {
          setN(n + 1)
          setFx(previewFx(skill, Date.now() + n))
        }}
      >
        ▶ 다시 보기
      </button>
    </div>
  )
}

export function MagicScreen() {
  const { state, dispatch } = useGame()
  const [tab, setTab] = useState<Tab>('all')
  const [showAll, setShowAll] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  if (state.screen !== 'magic') return null
  const close = () => dispatch({ type: 'SET_SCREEN', screen: 'world' })

  const { player } = state
  const learned = new Set(player.learnedSkills)
  const summons = player.summonSkills ?? []
  const pool = STUDENT_SKILLS.filter((s) => inTab(s, tab) && (showAll || learned.has(s.id)))
  const list = [...pool].sort((a, b) => Number(learned.has(b.id)) - Number(learned.has(a.id)) || skillGrade(a) - skillGrade(b))
  const selected = list.find((s) => s.id === selectedId) ?? list[0] ?? null
  const scrolls = state.inventory.map((slot) => ({ slot, item: itemById(slot.itemId) })).filter((x) => x.item?.type === 'scroll')
  const totalLv = player.learnedSkills.reduce((a, id) => a + masteryOf(player, id).lv, 0)

  return (
    <GameWindow
      title="마법"
      subtitle="MAGIC"
      onClose={close}
      tall
      cols
      width={1040}
      height={600}
      headerExtra={
        <>
          <HeadPill icon={'/images/icons/hud/magic.png'}>
            배운 마법 <b>{player.learnedSkills.length}</b>
          </HeadPill>
          <HeadPill icon={menuIcon('icon-exp')}>
            숙련도 합계 <b>{totalLv}</b>
          </HeadPill>
        </>
      }
    >
      <div className="gw-cols magic-cols">
        {/* 분류 */}
        <nav className="gw-side" aria-label="마법 분류">
          {TABS.map((t) => (
            <SideItem
              key={t.id}
              icon={t.icon}
              label={t.label}
              count={STUDENT_SKILLS.filter((s) => inTab(s, t.id) && learned.has(s.id)).length}
              active={tab === t.id}
              onClick={() => {
                setTab(t.id)
                setSelectedId(null)
              }}
            />
          ))}
        </nav>

        {/* 장착 칸 + 목록 */}
        <section className="gw-panel is-flex p-3">
          <div className="magic-loadout">
            <div className="magic-loadout-row">
              <span className="magic-loadout-label">
                전투 장착 {player.equippedSkills.length}/{SKILL_LOADOUT_SIZE}
                {player.equippedSkills.length > 0 && (
                  <button type="button" className="magic-clear" onClick={() => dispatch({ type: 'CLEAR_SKILL_LOADOUT' })} title="장착한 전투 마법을 모두 뺀다">
                    전부 해제
                  </button>
                )}
              </span>
              {Array.from({ length: SKILL_LOADOUT_SIZE }).map((_, i) => {
                const s = SKILLS.find((x) => x.id === player.equippedSkills[i])
                return (
                  <button key={i} type="button" className={`magic-slot ${s ? '' : 'is-empty'}`} title={s ? `${s.name} — 눌러서 보기 · 더블클릭/× 로 빼기` : '빈 칸'} onClick={() => s && setSelectedId(s.id)} onDoubleClick={() => s && dispatch({ type: 'TOGGLE_EQUIP_SKILL', skillId: s.id })}>
                    {s && <Image src={s.icon} alt={s.name} width={26} height={26} unoptimized />}
                    {s && <i style={{ background: elementColor(s.element) }} />}
                    {s && (
                      <span role="button" aria-label={`${s.name} 빼기`} className="magic-slot-x" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_EQUIP_SKILL', skillId: s.id }) }}>
                        ×
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <div className="magic-loadout-row">
              <span className="magic-loadout-label">소환 마법 {summons.length}/{SUMMON_SLOT_SIZE}</span>
              {Array.from({ length: SUMMON_SLOT_SIZE }).map((_, i) => {
                const s = SKILLS.find((x) => x.id === summons[i])
                return (
                  <button key={i} type="button" className={`magic-slot is-summon ${s ? '' : 'is-empty'}`} title={s ? `${s.name} — 다른 소환 마법의 [장착]을 누르면 바로 바뀝니다` : '빈 소환 칸'} onClick={() => s && setSelectedId(s.id)} onDoubleClick={() => s && dispatch({ type: 'TOGGLE_EQUIP_SKILL', skillId: s.id })}>
                    {s && <Image src={s.icon} alt={s.name} width={28} height={28} unoptimized />}
                    {s && (
                      <span role="button" aria-label={`${s.name} 빼기`} className="magic-slot-x" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_EQUIP_SKILL', skillId: s.id }) }}>
                        ×
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mb-2 mt-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="gw-chips">
              <button type="button" className={`gw-chip ${!showAll ? 'is-active' : ''}`} onClick={() => setShowAll(false)}>
                배운 마법
              </button>
              <button type="button" className={`gw-chip ${showAll ? 'is-active' : ''}`} onClick={() => setShowAll(true)}>
                전체 도감
              </button>
            </div>
            <span className="text-[12px] text-[#8a7c62]">{list.length}종</span>
          </div>

          <div className="gw-scroll is-fill flex flex-col gap-1.5 pr-1">
            {list.length === 0 && (
              <div className="gw-empty">
                <Sparkle />
                {showAll ? '이 분류의 마법이 없습니다.' : '아직 배운 마법이 없습니다. 수업을 들으면 배워요.'}
              </div>
            )}
            {list.map((s) => {
              const has = learned.has(s.id)
              const m = masteryOf(player, s.id)
              const g = skillGrade(s)
              const on = player.equippedSkills.includes(s.id) || summons.includes(s.id)
              // 최상급(히든) — 배우기 전에는 이름을 가린다
              const hidden = !has && g === 4
              return (
                <button key={s.id} type="button" className={`magic-row ${selected?.id === s.id ? 'is-active' : ''} ${has ? '' : 'is-dim'} ${hidden ? 'is-hidden-skill' : ''}`} onClick={() => setSelectedId(s.id)} onDoubleClick={() => has && dispatch({ type: 'TOGGLE_EQUIP_SKILL', skillId: s.id })}>
                  <span className="magic-row-icon" style={{ ['--el' as string]: elementColor(s.element) }}>
                    <Image src={s.icon} alt="" width={30} height={30} unoptimized />
                  </span>
                  <span className="magic-row-main">
                    <span className="magic-row-title">
                      {hidden ? '？？？' : s.name}
                      <GradeBadge info={SKILL_GRADE_INFO[g]} />
                      {on && <span className="gw-pill is-green">{s.kind === 'summon' ? '소환 칸' : '장착'}</span>}
                    </span>
                    {has ? (
                      <span className="magic-row-mastery">
                        <span className="magic-pips" aria-label={`숙련도 ${m.lv}/${MASTERY_MAX}`}>
                          {Array.from({ length: MASTERY_MAX }).map((_, i) => (
                            <i key={i} className={i < m.lv ? 'is-on' : ''} />
                          ))}
                        </span>
                        <b>Lv.{m.lv}</b>
                      </span>
                    ) : (
                      <span className="magic-row-sub">{hidden ? `히든 마법 — ${TRIAL_OF_SKILL.get(s.id)?.where ?? '어느 마을'} 길드에서 전수된다는 소문` : COURSE_OF.get(s.id) ? `수업 「${COURSE_OF.get(s.id)}」에서 배움` : '아직 배우지 않음'}</span>
                    )}
                  </span>
                  <span className="magic-row-mp">MP {masteredMpCost(s, m.lv)}</span>
                  {/* 바로 장착/해제 — 상세 창까지 가지 않아도 된다(더블클릭도 같음) */}
                  {has && (
                    <span role="button" className={`magic-quick ${on ? 'is-on' : ''}`} onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_EQUIP_SKILL', skillId: s.id }) }}>
                      {on ? '해제' : s.kind === 'summon' && summons.length >= SUMMON_SLOT_SIZE ? '교체' : '장착'}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </section>

        {/* 상세 */}
        <aside className="gw-panel is-flex is-pad">
          {selected ? (
            <MagicDetail
              skill={selected}
              has={learned.has(selected.id)}
              scrolls={scrolls.map((x) => ({ itemId: x.slot.itemId, qty: x.slot.qty }))}
            />
          ) : (
            <div className="gw-empty">
              <Sparkle />
              마법을 선택하세요
            </div>
          )}
        </aside>
      </div>
    </GameWindow>
  )
}

function MagicDetail({ skill, has, scrolls }: { skill: Skill; has: boolean; scrolls: { itemId: string; qty: number }[] }) {
  const { state, dispatch } = useGame()
  const { player } = state
  const m = masteryOf(player, skill.id)
  const g = skillGrade(skill)
  const need = masteryNeed(g, m.lv)
  const isSummon = skill.kind === 'summon'
  const on = isSummon ? (player.summonSkills ?? []).includes(skill.id) : player.equippedSkills.includes(skill.id)
  const creature = skill.summon ? petDefById(skill.summon.creatureId) : undefined
  const locked = (skill.levelRequired ?? 0) > player.level
  const nextLv = Math.min(MASTERY_MAX, m.lv + 1)
  const usable = scrolls.filter(({ itemId }) => {
    const it = itemById(itemId)
    return !!it && (!it.scrollElement || it.scrollElement === (skill.element ?? 'none'))
  })

  // 최상급(히든) — 배우기 전엔 정체를 감추고 전수 장소 소문만
  if (!has && g === 4) {
    const t = TRIAL_OF_SKILL.get(skill.id)
    return (
      <div className="gw-scroll is-fill">
        <div className="magic-hidden-card">
          <span className="magic-hidden-q">？</span>
          <GradeRibbon info={SKILL_GRADE_INFO[4]} suffix="· 히든" />
          <p className="mt-3 text-[12.5px] leading-relaxed text-[#4d4856]">학교에서는 가르치지 않는 마법. 이름도, 모습도 기록에 남아 있지 않다.</p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-[#6a4d1c]">
            소문 — <b>{t?.where ?? '어느 마을'}</b>의 길드 전수자가 「{t?.title ?? '시험'}」을 통과한 자에게만 전한다고 한다.
          </p>
          <p className="mt-1 text-[11.5px] text-[#8a7c62]">Lv.{t ? Math.max(40, skill.levelRequired ?? 40) : 40} 이상부터 시험을 받을 수 있다.</p>
        </div>
      </div>
    )
  }
  return (
    <>
      <div className="gw-scroll is-fill">
        <SkillPreview skill={skill} sheet={heroSheet(state)} />

        <div className="mt-3 flex items-start gap-3">
          <div className="craft-medal !size-14">
            <Image src={skill.icon} alt="" width={40} height={40} unoptimized />
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-[16px] font-bold text-[#2c2a33]">{skill.name}</h3>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <span className="gw-pill is-soft">
                <span style={{ color: elementColor(skill.element) }}>●</span> {elementLabel(skill.element)}
              </span>
              <GradeBadge info={SKILL_GRADE_INFO[g]} />
              {isSummon && <span className="gw-pill is-purple">소환</span>}
              {skill.levelRequired && <span className="gw-pill is-soft">Lv.{skill.levelRequired}부터</span>}
            </div>
          </div>
        </div>
        <GradeRibbon info={SKILL_GRADE_INFO[g]} />
        <p className="mt-2 text-[12.5px] leading-relaxed text-[#4d4856]">{skill.description}</p>

        {has ? (
          <>
            <Divider />
            <Ribbon>숙련도 Lv.{m.lv} / {MASTERY_MAX}</Ribbon>
            <div className="gw-box">
              <div className="magic-pips is-big">
                {Array.from({ length: MASTERY_MAX }).map((_, i) => (
                  <i key={i} className={i < m.lv ? 'is-on' : ''} />
                ))}
              </div>
              {m.lv < MASTERY_MAX ? (
                <>
                  <div className="mt-2 mb-1 flex justify-between text-[11.5px] text-[#6c6150]">
                    <span>다음 단계까지</span>
                    <b className="text-[#3b3843]">
                      {m.xp} / {need}
                    </b>
                  </div>
                  <Bar kind="exp" value={(m.xp / Math.max(1, need)) * 100} />
                </>
              ) : (
                <div className="mt-2 text-center text-[12px] font-bold text-[#8a6a2c]">최고 숙련 — 이 마법을 완전히 익혔다</div>
              )}
              <div className="magic-effects">
                <span>위력</span>
                <b>
                  +{Math.round((masteryPowerMult(m.lv) - 1) * 100)}%
                  {m.lv < MASTERY_MAX && <em> → +{Math.round((masteryPowerMult(nextLv) - 1) * 100)}%</em>}
                </b>
                <span>MP 소모</span>
                <b>
                  {masteredMpCost(skill, m.lv)}
                  {m.lv < MASTERY_MAX && <em> → {masteredMpCost(skill, nextLv)}</em>}
                  <small> (기본 {skill.mpCost})</small>
                </b>
                {isSummon && (
                  <>
                    <span>머무는 턴</span>
                    <b>
                      {summonTurnsFor(m.lv, skill.summon!.turns)}턴{m.lv < 7 && <em> (Lv.7부터 {summonTurnsFor(7, skill.summon!.turns)}턴)</em>}
                    </b>
                  </>
                )}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-[#8a7c62]">전투에서 쓸 때마다 · 이 마법을 다루는 수업 실습 · 숙련의 스크롤로 오릅니다. {GRADE_LABEL[g]} 마법일수록 오르기 어려워요.</p>
            </div>

            {creature && (
              <>
                <Ribbon>소환수 · {creature.name}</Ribbon>
                <div className="gw-box flex flex-col gap-1 text-[12px]">
                  <span className="text-[#6c6150]">{creature.species}</span>
                  {[...creature.innateSkills.map((id) => ({ skillId: id, minLevel: 1 })), ...creature.trainableSkills].map((t) => {
                    const sk = SKILLS.find((x) => x.id === t.skillId)
                    const open = m.lv >= t.minLevel
                    return sk ? (
                      <span key={t.skillId} className={`flex items-center justify-between ${open ? '' : 'opacity-50'}`} title={sk.description}>
                        <span>· {sk.name}</span>
                        <span className="text-[11px] text-[#8a7c62]">{open ? '사용' : `숙련 Lv.${t.minLevel}`}</span>
                      </span>
                    ) : null
                  })}
                </div>
              </>
            )}

            <Ribbon>숙련의 스크롤</Ribbon>
            <div className="gw-box flex flex-col gap-1.5">
              {usable.length === 0 && <span className="text-[12px] text-[#8a7c62]">이 마법에 읽을 스크롤이 없어요. (두루마리 상인 리코에게서 살 수 있어요)</span>}
              {usable.map(({ itemId, qty }) => {
                const it = itemById(itemId)!
                return (
                  <div key={itemId} className="flex items-center gap-2">
                    <Image src={it.icon} alt="" width={26} height={26} unoptimized />
                    <span className="min-w-0 flex-1 truncate text-[12px]">
                      {it.name} <span className="text-[#8a7c62]">×{qty}</span>
                    </span>
                    <button type="button" className="gw-btn is-quiet is-sm" disabled={m.lv >= MASTERY_MAX} onClick={() => dispatch({ type: 'USE_MASTERY_SCROLL', itemId, skillId: skill.id })}>
                      +{it.useEffect?.masteryXp} 읽기
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div className="gw-box mt-3 text-[12px] text-[#7a5a20]">{COURSE_OF.get(skill.id) ? `수업 「${COURSE_OF.get(skill.id)}」 진도를 나가면 배웁니다.` : '아직 배우는 방법이 알려지지 않은 마법입니다.'}</div>
        )}
      </div>

      {has && (
        <div className="pt-3">
          <button type="button" className={`gw-btn is-lg w-full ${on ? '' : 'is-gold'}`} onClick={() => dispatch({ type: 'TOGGLE_EQUIP_SKILL', skillId: skill.id })}>
            {isSummon ? (on ? '소환 칸에서 빼기' : '소환 칸에 넣기') : on ? '전투 장착 해제' : locked ? `Lv.${skill.levelRequired}부터 사용 (장착)` : '전투에 장착'}
          </button>
        </div>
      )}
    </>
  )
}
