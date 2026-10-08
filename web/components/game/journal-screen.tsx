'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useGame } from '@/lib/game-state'
import { Bar, GameWindow, HeadPill, menuIcon, Ribbon, SideItem, Slot, Sparkle } from '@/components/game/game-window'
import { calendarInfo, calendarLabel, TERM_META, TOTAL_WEEKS, WEEKS_PER_TERM } from '@/lib/calendar'
import { academicTitle, arcForWeek } from '@/lib/story'
import { acceptedSideCount, isRestWeek, questTemplateById, REQUIRED_OPTIONAL, SLOT_LABEL, weekCompletion, yearRewardMult } from '@/lib/quests'
import { classForWeek, classMetaFor, MASTERY_LABEL, masteryLevel, MINIGAME_META, professorById, type MasteryField } from '@/lib/curriculum'
import { MAPS } from '@/lib/maps'
import type { QuestInstance, QuestReward } from '@/lib/types'
import { courseName, coursesForWeek, DEPARTMENT_LABEL, GRADUATION_CREDITS, gradeForScore, skillScoreThreshold } from '@/lib/academics'
import { skillById } from '@/lib/mock-data'
import { ACTIVITY_META, activityUnlockLabel, activityUnlockWeek, isActivityUnlocked, type ActivityId } from '@/lib/life'
import { ITEMS, itemById, MONSTERS, NPCS } from '@/lib/mock-data'
import { SCHOOL_NPCS } from '@/lib/companions'
import { regionById } from '@/lib/regions'
import { CheckCircle2, Circle, Lock, Star } from 'lucide-react'

type Tab = 'week' | 'academic' | 'life' | 'codex' | 'relation'
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'week', label: '이번 주 퀘스트', icon: 'nav-quest' },
  { id: 'academic', label: '학사', icon: 'nav-academic' },
  { id: 'life', label: '생활 해금', icon: 'nav-life' },
  { id: 'codex', label: '도감', icon: 'nav-codex' },
  { id: 'relation', label: '관계', icon: 'nav-relation' },
]

export function JournalScreen() {
  const { state, dispatch } = useGame()
  const [tab, setTab] = useState<Tab>('week')
  if (state.screen !== 'journal') return null
  const close = () => dispatch({ type: 'SET_SCREEN', screen: 'world' })
  const { optionalDone, requiredOptional } = weekCompletion(state.weekly)
  const claimable = state.weekly.quests.filter((q) => q.status === 'complete').length

  return (
    <GameWindow
      title="수첩"
      subtitle="JOURNAL"
      onClose={close}
      tall
      cols
      width={980}
      height={540}
      headerExtra={
        <>
          <span className="gw-head-pill hidden md:inline-flex">
            <Image src={menuIcon('hud-journal')} alt="" width={24} height={24} unoptimized />
            {calendarLabel(state.calendar)}
          </span>
          <HeadPill icon={menuIcon('badge-side')}>
            외부활동 <b>{optionalDone}</b>/{requiredOptional}
          </HeadPill>
        </>
      }
    >
      <div className={`gw-cols ${tab === 'week' ? '' : 'is-2'}`}>
        <nav className="gw-side" aria-label="수첩 항목">
          {TABS.map((t) => (
            <SideItem key={t.id} icon={menuIcon(t.icon)} label={t.label} count={t.id === 'week' ? claimable : undefined} active={tab === t.id} onClick={() => setTab(t.id)} />
          ))}
          <div className="mt-auto hidden px-1 pt-3 lg:block">
            <JournalCalendar />
          </div>
        </nav>

        {tab === 'week' && <WeekTab />}
        {tab !== 'week' && (
          <section className="gw-panel is-flex is-pad">
            <div className="gw-scroll is-fill pr-1">
              {tab === 'academic' && <AcademicTab />}
              {tab === 'life' && <LifeTab />}
              {tab === 'codex' && <CodexTab />}
              {tab === 'relation' && <RelationTab />}
            </div>
          </section>
        )}
      </div>
    </GameWindow>
  )
}

/** 사이드바 아래 — 학기 진행도 */
function JournalCalendar() {
  const { state } = useGame()
  const info = calendarInfo(state.calendar.globalWeek)
  const arc = arcForWeek(state.calendar.globalWeek)
  const next = (Object.keys(ACTIVITY_META) as ActivityId[])
    .filter((a) => activityUnlockWeek(a) > state.calendar.globalWeek)
    .sort((a, b) => activityUnlockWeek(a) - activityUnlockWeek(b))[0]
  return (
    <div className="space-y-1.5 text-[11.5px] leading-relaxed text-[rgba(243,234,214,0.75)]">
      <div className="font-display text-[13px] text-[#f3e6c2]">{academicTitle(state.calendar.globalWeek)}</div>
      <div>
        {TERM_META[info.termType].season} · {info.isVacation ? '방학 — 원정 중심' : '학기 — 학교 중심'}
      </div>
      <div>
        이번 학기 이야기: {arc.name} · {regionById(arc.mainRegion).name}
      </div>
      <div>
        {TERM_META[info.termType].label} 종료까지 {WEEKS_PER_TERM - info.week + 1}주
        {next ? ` · 다음 해금 ${ACTIVITY_META[next].name}(${activityUnlockWeek(next) - state.calendar.globalWeek}주 후)` : ''}
      </div>
      <Bar value={(state.calendar.globalWeek / TOTAL_WEEKS) * 100} />
      <div className="text-right text-[10.5px]">
        전체 {state.calendar.globalWeek}/{TOTAL_WEEKS}주
      </div>
    </div>
  )
}

// ── 이번 주 퀘스트 ────────────────────────────────────────────────────────

type Kind = 'class' | 'main' | 'side'
type Filter = 'all' | 'active' | 'offered' | 'done'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'active', label: '진행 중' },
  { id: 'offered', label: '수락 가능' },
  { id: 'done', label: '완료' },
]
const KIND_BADGE: Record<Kind, string> = { class: 'badge-class', main: 'badge-main', side: 'badge-side' }
const KIND_PILL: Record<Kind, string> = { class: 'is-purple', main: 'is-gold', side: 'is-blue' }

interface Entry {
  key: string
  kind: Kind
  title: string
  desc: string
  pill: string
  status: 'offered' | 'active' | 'complete' | 'claimed'
  progress: string
  q?: QuestInstance
}

function rewardSlot(r: QuestReward, mult: number, i: number) {
  switch (r.type) {
    case 'EXP':
      return <Slot key={i} icon={menuIcon('icon-exp')} qty={Math.round(r.amount * mult)} label="경험치" />
    case 'GOLD':
      return <Slot key={i} icon={menuIcon('icon-coin')} qty={Math.round(r.amount * mult)} label="골드" />
    case 'ITEM': {
      const it = itemById(r.itemId)
      return <Slot key={i} icon={it?.icon} qty={r.amount} label={it?.name ?? r.itemId} title={it?.description} />
    }
    case 'COURSE':
      return <Slot key={i} icon={menuIcon('nav-academic')} qty={`+${r.amount}`} label="수업 점수" />
    case 'RELATIONSHIP':
      return <Slot key={i} icon={menuIcon('nav-relation')} qty={`+${r.amount}`} label="관계도" />
    default:
      return <Slot key={i} icon={menuIcon('badge-main')} label="스토리 진행" />
  }
}

function WeekTab() {
  const { state, dispatch } = useGame()
  const [filter, setFilter] = useState<Filter>('all')
  const [selKey, setSelKey] = useState<string | null>(null)
  const { classRequired, classDone, mainDone, optionalDone, requiredOptional, storyWeek: episodeWeek, canEnd } = weekCompletion(state.weekly)
  const mult = yearRewardMult(state.calendar.globalWeek)
  const wc = classForWeek(state.calendar.globalWeek)
  const meta = wc ? classMetaFor(wc.courseId) : null
  const prof = meta ? professorById(meta.professorId) : null
  const accepted = acceptedSideCount(state.weekly)
  const lastClass = (state.academics.classLog ?? []).filter((c) => c.week === state.calendar.globalWeek).slice(-1)[0]

  const entries: Entry[] = []
  if (wc && meta) {
    entries.push({
      key: 'class',
      kind: 'class',
      title: wc.label,
      desc: `${prof?.name ?? ''} · ${MAPS[meta.room]?.name ?? meta.room}`,
      pill: '필수 수업',
      status: classDone ? 'claimed' : 'active',
      progress: classDone ? `수료${lastClass ? ` · ${lastClass.grade}` : ''}` : '0/1',
    })
  }
  for (const q of state.weekly.quests) {
    const t = questTemplateById(q.templateId)
    if (!t) continue
    const main = q.slot === 'MAIN'
    const p = t.objectives.reduce((a, ob, i) => a + Math.min(q.progress[i] ?? 0, ob.count), 0)
    const total = t.objectives.reduce((a, ob) => a + ob.count, 0)
    entries.push({
      key: q.instanceId,
      kind: main ? 'main' : 'side',
      title: t.title,
      desc: t.description,
      pill: main ? '메인 스토리' : `외부활동 · ${SLOT_LABEL[q.slot]}`,
      status: q.status,
      progress: q.status === 'offered' ? '후보' : q.status === 'claimed' ? '완료' : `${p}/${total}`,
      q,
    })
  }
  const shown = entries.filter((e) =>
    filter === 'all' ? true : filter === 'active' ? e.status === 'active' || e.status === 'complete' : filter === 'offered' ? e.status === 'offered' : e.status === 'claimed',
  )
  const sel = shown.find((e) => e.key === selKey) ?? shown[0] ?? null

  return (
    <>
      {/* 목록 */}
      <section className="gw-panel is-flex p-3">
        <div className="gw-chips mb-2.5">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" className={`gw-chip ${filter === f.id ? 'is-active' : ''}`} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="gw-scroll is-fill flex flex-col gap-2 pr-1">
          {shown.length === 0 && (
            <div className="gw-empty">
              <Sparkle />
              해당하는 퀘스트가 없습니다.
            </div>
          )}
          {shown.map((e) => (
            <button key={e.key} type="button" className={`gw-row ${sel?.key === e.key ? 'is-active' : ''} ${e.status === 'claimed' ? 'is-dim' : ''}`} onClick={() => setSelKey(e.key)}>
              <span className="quest-badge">
                <Image src={menuIcon(e.status === 'claimed' ? 'badge-done' : KIND_BADGE[e.kind])} alt="" width={48} height={48} unoptimized />
              </span>
              <span className="gw-row-main">
                <span className="gw-row-title">
                  {e.title}
                  <span className={`gw-pill ${KIND_PILL[e.kind]}`}>{e.pill}</span>
                  {e.status === 'complete' && <span className="gw-pill is-green">보상 대기</span>}
                </span>
                <span className="gw-row-desc">{e.desc}</span>
              </span>
              <span className="gw-row-side">
                {e.progress}
                <svg className="gw-row-chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                  <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>
          ))}
        </div>
        <div className="gw-foot">
          <span>
            {`수업 ${classRequired ? (classDone ? '✔' : '✘') : '—'}`}{episodeWeek ? ' · 메인 스토리' : ''} · 외부활동 {optionalDone}/{requiredOptional} (수락 {accepted}/{REQUIRED_OPTIONAL})
            {entries.some((e) => e.kind === 'main') && ` · 스토리 ${mainDone ? '✔' : '✘'}`}
            {isRestWeek(state.calendar.globalWeek) && ' · 쉬어가는 주'}
            
          </span>
          <button type="button" className="gw-btn is-gold is-sm" disabled={!canEnd} onClick={() => dispatch({ type: 'END_WEEK' })}>
            이번 주 마치기
          </button>
        </div>
      </section>

      {/* 상세 */}
      <aside className="gw-panel is-flex is-pad">
        {sel ? (
          <QuestDetail e={sel} mult={mult} canAccept={accepted < REQUIRED_OPTIONAL} />
        ) : (
          <div className="gw-empty">
            <Sparkle />
            퀘스트를 선택하세요
          </div>
        )}
      </aside>
    </>
  )
}

function QuestDetail({ e, mult, canAccept }: { e: Entry; mult: number; canAccept: boolean }) {
  const { state, dispatch } = useGame()
  const t = e.q ? questTemplateById(e.q.templateId) : undefined
  const wc = classForWeek(state.calendar.globalWeek)
  const meta = wc ? classMetaFor(wc.courseId) : null
  const badge = menuIcon(e.status === 'claimed' ? 'badge-done' : KIND_BADGE[e.kind])
  return (
    <>
      <div className="gw-scroll is-fill">
        <div className="quest-hero">
          <Image src={badge} alt="" width={64} height={64} unoptimized />
          <div className="min-w-0">
            <h3 className="font-display text-[16px] font-bold leading-snug text-[#2c2a33]">{e.title}</h3>
            <span className={`gw-pill mt-1 ${KIND_PILL[e.kind]}`}>{e.pill}</span>
          </div>
        </div>
        <p className="mb-3 text-[13.5px] leading-relaxed text-[#4d4856]">
          {e.kind === 'class' && meta
            ? `미니게임: ${Array.from(new Set(meta.games))
                .map((g) => MINIGAME_META[g].name)
                .join(' / ')}${wc && (wc.kind === 'midterm' || wc.kind === 'final') ? ' — 시험은 미니게임 여러 개로 종합 평가' : ''}`
            : e.desc}
        </p>

        <Ribbon>목표</Ribbon>
        <div className="gw-box mb-3">
          {e.kind === 'class' ? (
            <div className={`quest-obj ${e.status === 'claimed' ? 'is-done' : ''}`}>
              <span className="dot">{e.status === 'claimed' && '✓'}</span>
              수업 참석 — {e.desc}
              <span className="cnt">{e.status === 'claimed' ? '1/1' : '0/1'}</span>
            </div>
          ) : (
            t?.objectives.map((ob, i) => {
              const p = Math.min(e.q?.progress[i] ?? 0, ob.count)
              const done = e.status !== 'offered' && p >= ob.count
              return (
                <div key={i} className={`quest-obj ${done ? 'is-done' : ''}`}>
                  <span className="dot">{done && '✓'}</span>
                  {ob.label}
                  <span className="cnt">{e.status === 'offered' ? ob.count : `${p}/${ob.count}`}</span>
                </div>
              )
            })
          )}
          {t?.regionId && <div className="mt-1 text-[12px] text-[#8a7c62]">지역 · {regionById(t.regionId).name}</div>}
        </div>

        {t && t.rewards.length > 0 && (
          <>
            <Ribbon>보상</Ribbon>
            <div className="gw-box flex flex-wrap gap-3">{t.rewards.map((r, i) => rewardSlot(r, mult, i))}</div>
          </>
        )}
        {e.kind === 'class' && <p className="mt-1 text-[12px] leading-relaxed text-[#8a7c62]">수업 점수가 오르면 진도에 따라 마법을 배우고, 학기 마지막 주에 성적과 학점이 정산됩니다.</p>}
      </div>

      <div className="flex gap-2 pt-3">
        {e.kind === 'class' && e.status !== 'claimed' && (
          <button type="button" className="gw-btn is-gold is-lg flex-1" onClick={() => dispatch({ type: 'START_CLASS' })}>
            수업 참석
          </button>
        )}
        {e.q && e.status === 'offered' && (
          <button type="button" className="gw-btn is-gold is-lg flex-1" disabled={!canAccept} onClick={() => dispatch({ type: 'ACCEPT_QUEST', instanceId: e.q!.instanceId })}>
            {canAccept ? '수락하기' : `이미 ${REQUIRED_OPTIONAL}개 수락함`}
          </button>
        )}
        {e.q && e.status === 'complete' && (
          <button type="button" className="gw-btn is-gold is-lg flex-1" onClick={() => dispatch({ type: 'CLAIM_QUEST', instanceId: e.q!.instanceId })}>
            보상 받기
          </button>
        )}
        {e.q && e.status === 'active' && e.kind !== 'main' && (
          <button type="button" className="gw-btn is-quiet flex-1" onClick={() => dispatch({ type: 'DROP_QUEST', instanceId: e.q!.instanceId })}>
            포기하기
          </button>
        )}
        {e.status === 'claimed' && (
          <button type="button" className="gw-btn is-lg flex-1" disabled>
            완료
          </button>
        )}
      </div>
    </>
  )
}

function AcademicTab() {
  const { state } = useGame()
  const open = coursesForWeek(state.calendar.globalWeek)
  return (
    <div className="space-y-3">
      <div className="gw-box p-3 text-xs">
        <div className="mb-1 font-semibold">
          총 학점 {state.academics.totalCredits} / 졸업 요건 {GRADUATION_CREDITS}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-black/15">
          <div className="h-full bg-[#b0791f]" style={{ width: `${Math.min(100, (state.academics.totalCredits / GRADUATION_CREDITS) * 100)}%` }} />
        </div>
        {/* 졸업 요건(통합 PRD §32) — 메인스토리를 끝내면 시스템상 자연스럽게 충족된다 */}
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
          {[
            ['필수 학점', state.academics.totalCredits >= GRADUATION_CREDITS],
            ['핵심 마법 과목(3원소 기초) 이수', ['FIRE_101', 'ICE_101', 'EARTH_101'].every((id) => state.storyFlags[`COURSE_${id}_PASSED`])],
            ['현장실습(실전 탐사 I) 이수', !!state.storyFlags.COURSE_FIELD_101_PASSED],
            ['졸업 프로젝트', !!state.storyFlags.GRADUATION_PROJECT_DONE || !!state.storyFlags.MORS_DEFEATED],
          ].map(([label, ok]) => (
            <span key={label as string}>
              {ok ? '✔' : '○'} {label as string}
            </span>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          {Object.entries(state.academics.mastery ?? {}).map(([f, xp]) => (
            <span key={f} className="rounded bg-black/10 px-1.5 py-0.5">
              {MASTERY_LABEL[f as MasteryField]} 숙련 Lv.{masteryLevel(xp).level}
            </span>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 text-[13px] font-display font-bold text-[#7a5a20]">이번 학기 수강 과목</div>
        {open.length === 0 ? (
          <div className="gw-box p-3 text-center text-xs opacity-70">방학 중에는 수업이 없습니다.</div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {open.map((c) => {
              const score = state.academics.courseScore[c.id] ?? 0
              const g = gradeForScore(score)
              return (
                <div key={c.id} className="gw-box p-2.5 text-xs">
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-[10px] opacity-70">
                    {DEPARTMENT_LABEL[c.department]} · {c.required ? '필수' : '선택'} · {c.credit}학점
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/15">
                    <div className="h-full bg-[#4f7fbf]" style={{ width: `${score}%` }} />
                  </div>
                  <div className="mt-0.5 text-[10px]">
                    점수 {score}/100 · 예상 {g.grade}
                  </div>
                  {(c.teachesSkills ?? []).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(c.teachesSkills ?? []).map((id, i) => {
                        const need = skillScoreThreshold(c, i)
                        const got = state.player.learnedSkills.includes(id)
                        return (
                          <span key={id} className={`rounded px-1 py-0.5 text-[9px] ${got ? 'bg-[#4f7fbf]/25 font-semibold' : 'bg-black/10 opacity-60'}`} title={skillById(id)?.description}>
                            {got ? '✔ ' : `${need}점 · `}
                            {skillById(id)?.name ?? id}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        <p className="mt-1 text-[10px] text-[#8a7c62]">수업 미션(보상: 수업 점수)으로 점수를 올리면 진도에 따라 마법을 배우고, 학기 마지막 주 마감 때 성적과 학점이 정산됩니다. D 이상으로 이수하면 못 배운 마법도 모두 익힙니다.</p>
      </div>

      {state.academics.history.length > 0 && (
        <div>
          <div className="mb-1 text-[13px] font-display font-bold text-[#7a5a20]">성적 기록</div>
          <div className="space-y-1">
            {state.academics.history.map((h) => (
              <div key={h.termIndex} className="gw-box p-2 text-[11px]">
                <span className="font-semibold">{calendarLabel(h.termIndex * 12 + 1).replace(/ 1주차$/, '')}</span>{' '}
                {h.courses.map((c) => `${courseName(c.courseId)} ${c.grade}(${c.credit})`).join(' · ')}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function LifeTab() {
  const { state } = useGame()
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {(Object.keys(ACTIVITY_META) as ActivityId[]).map((a) => {
        const open = isActivityUnlocked(state, a)
        return (
          <div key={a} className={`gw-box flex items-center gap-2 p-2.5 text-xs ${open ? '' : 'opacity-60'}`}>
            {open ? <CheckCircle2 className="size-4 text-emerald-700" /> : <Lock className="size-4" />}
            <div>
              <div className="font-semibold">{ACTIVITY_META[a].name}</div>
              <div className="text-[10px] opacity-70">{open ? '해금됨' : `${activityUnlockLabel(a)} 해금`}</div>
            </div>
          </div>
        )
      })}
      <p className="col-span-full text-[10px] text-[#8a7c62]">
        채집: 필드의 반짝이는 채집 지점에서 E · 낚시: 낚싯대를 들고 물가에서 E · 사냥: 해금 후 전투 승리 시 부산물 · 요리/연금: 공동 식당 주방·연금술 가마
      </p>
    </div>
  )
}

function CodexTab() {
  const { state } = useGame()
  const fish = ITEMS.filter((i) => i.type === 'fish')
  const gatherables = ITEMS.filter((i) => i.tags && i.type === 'material' && !i.id.startsWith('hunt-') && !i.id.startsWith('alch-'))
  const monsters = MONSTERS.filter((m) => !m.isTestMonster)
  const Cell = ({ icon, name, count }: { icon: string; name: string; count: number }) => (
    <div className={`flex flex-col items-center gap-0.5 rounded-lg border border-[#c8b48a] bg-[#efe6d3] p-1.5 text-center ${count ? '' : 'opacity-35 grayscale'}`} title={name}>
      <Image src={icon} alt="" width={28} height={28} />
      <span className="w-full truncate text-[9px] text-[#4d4856]">{count ? name : '???'}</span>
      {count > 0 && <span className="text-[9px] text-[#8a6a2c]">x{count}</span>}
    </div>
  )
  const section = (title: string, got: number, total: number, children: React.ReactNode) => (
    <div>
      <div className="mb-1 text-[13px] font-display font-bold text-[#7a5a20]">
        {title} {got}/{total}
      </div>
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8">{children}</div>
    </div>
  )
  return (
    <div className="space-y-3 overflow-y-auto pr-1 scrollbar-thin">
      {section(
        '낚시 도감',
        fish.filter((f) => state.collections.fish[f.id]).length,
        fish.length,
        fish.map((f) => <Cell key={f.id} icon={f.icon} name={f.name} count={state.collections.fish[f.id] ?? 0} />),
      )}
      {section(
        '채집 도감',
        gatherables.filter((g) => state.collections.gathered[g.id]).length,
        gatherables.length,
        gatherables.map((g) => <Cell key={g.id} icon={g.icon} name={g.name} count={state.collections.gathered[g.id] ?? 0} />),
      )}
      {section(
        '몬스터 도감',
        monsters.filter((m) => state.collections.monsters[m.id]).length,
        monsters.length,
        monsters.map((m) => <Cell key={m.id} icon={m.icon} name={m.name} count={state.collections.monsters[m.id] ?? 0} />),
      )}
    </div>
  )
}

function RelationTab() {
  const { state } = useGame()
  const people = [
    ...SCHOOL_NPCS.map((c) => ({ id: c.id, name: c.name, sub: c.title })),
    ...NPCS.filter((n) => !n.id.startsWith('tr-')).map((n) => ({ id: n.id, name: n.name, sub: '' })),
  ]
  const known = people.filter((p) => state.relationships[p.id])
  return (
    <div className="space-y-1.5 overflow-y-auto pr-1 scrollbar-thin">
      {known.length === 0 && <div className="gw-box p-4 text-center text-xs opacity-70">아직 친해진 사람이 없습니다. NPC와 대화하면 관계도가 오릅니다(주 1회).</div>}
      {known
        .sort((a, b) => (state.relationships[b.id]?.affinity ?? 0) - (state.relationships[a.id]?.affinity ?? 0))
        .map((p) => {
          const aff = state.relationships[p.id]?.affinity ?? 0
          return (
            <div key={p.id} className="gw-box flex items-center gap-3 p-2 text-xs">
              <div className="w-28 shrink-0 truncate font-semibold">{p.name}</div>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/15">
                <div className="h-full bg-[#c2566b]" style={{ width: `${aff}%` }} />
              </div>
              <div className="w-10 text-right">{aff}</div>
            </div>
          )
        })}
    </div>
  )
}
