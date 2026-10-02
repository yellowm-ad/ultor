'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useGame } from '@/lib/game-state'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { calendarInfo, calendarLabel, TERM_META, TOTAL_WEEKS, WEEKS_PER_TERM } from '@/lib/calendar'
import { academicTitle, arcForWeek } from '@/lib/story'
import { acceptedSideCount, isRestWeek, questTemplateById, REQUIRED_OPTIONAL, SLOT_LABEL, weekCompletion, yearRewardMult } from '@/lib/quests'
import { classForWeek, classMetaFor, MASTERY_LABEL, masteryLevel, MINIGAME_META, professorById, type MasteryField } from '@/lib/curriculum'
import { isStoryWeek } from '@/lib/story'
import { MAPS } from '@/lib/maps'
import type { QuestInstance } from '@/lib/types'
import { courseName, coursesForWeek, DEPARTMENT_LABEL, GRADUATION_CREDITS, gradeForScore, skillScoreThreshold } from '@/lib/academics'
import { skillById } from '@/lib/mock-data'
import { ACTIVITY_META, activityUnlockLabel, activityUnlockWeek, isActivityUnlocked, type ActivityId } from '@/lib/life'
import { ITEMS, itemById, MONSTERS, NPCS } from '@/lib/mock-data'
import { SCHOOL_NPCS } from '@/lib/companions'
import { regionById } from '@/lib/regions'
import { CheckCircle2, Circle, Lock, Star } from 'lucide-react'

type Tab = 'week' | 'academic' | 'life' | 'codex' | 'relation'
const TABS: { id: Tab; label: string }[] = [
  { id: 'week', label: '이번 주' },
  { id: 'academic', label: '학사' },
  { id: 'life', label: '생활 해금' },
  { id: 'codex', label: '도감' },
  { id: 'relation', label: '관계' },
]

export function JournalScreen() {
  const { state, dispatch } = useGame()
  const [tab, setTab] = useState<Tab>('week')
  if (state.screen !== 'journal') return null
  const close = () => dispatch({ type: 'SET_SCREEN', screen: 'world' })
  const info = calendarInfo(state.calendar.globalWeek)
  const arc = arcForWeek(state.calendar.globalWeek)

  return (
    <Modal open onClose={close} title="학사 수첩" widthClass="max-w-3xl">
      {/* 달력 헤더 */}
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2 rounded-lg border border-gold/30 bg-black/30 px-3 py-2">
        <div>
          <div className="font-display text-base text-gold-soft">{calendarLabel(state.calendar)}</div>
          <div className="text-[11px] text-white/60">
            {TERM_META[info.termType].season} · {info.isVacation ? '방학 — 원정 중심' : '학기 — 학교 중심'} · {academicTitle(state.calendar.globalWeek)} · 이번 학기 이야기: {arc.name} · 무대: {regionById(arc.mainRegion).name}
          </div>
          {/* 시간 흐름 안내 — 남은 주와 곧 열릴 생활 시스템 */}
          <div className="text-[11px] text-gold-soft/90">
            {TERM_META[info.termType].label} 종료까지 {WEEKS_PER_TERM - info.week + 1}주
            {(() => {
              const next = (Object.keys(ACTIVITY_META) as ActivityId[])
                .filter((a) => activityUnlockWeek(a) > state.calendar.globalWeek)
                .sort((a, b) => activityUnlockWeek(a) - activityUnlockWeek(b))[0]
              return next ? ` · 다음 해금: ${ACTIVITY_META[next].name} (${activityUnlockWeek(next) - state.calendar.globalWeek}주 후)` : ''
            })()}
          </div>
        </div>
        <div className="text-right text-[11px] text-white/60">
          전체 {state.calendar.globalWeek}/{TOTAL_WEEKS}주
          <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-gold/70" style={{ width: `${(state.calendar.globalWeek / TOTAL_WEEKS) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full border px-3 py-1 text-xs font-display ${tab === t.id ? 'border-gold bg-gold/25 text-gold-soft' : 'border-white/25 bg-black/30 text-white/75'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'week' && <WeekTab />}
      {tab === 'academic' && <AcademicTab />}
      {tab === 'life' && <LifeTab />}
      {tab === 'codex' && <CodexTab />}
      {tab === 'relation' && <RelationTab />}

      <div className="mt-3 flex justify-end">
        <Button variant="ghost" onClick={close}>
          닫기
        </Button>
      </div>
    </Modal>
  )
}

function WeekTab() {
  const { state, dispatch } = useGame()
  const { classRequired, classDone, mainDone, optionalDone, canEnd } = weekCompletion(state.weekly)
  const mult = yearRewardMult(state.calendar.globalWeek)
  const wc = classForWeek(state.calendar.globalWeek)
  const meta = wc ? classMetaFor(wc.courseId) : null
  const prof = meta ? professorById(meta.professorId) : null
  const accepted = acceptedSideCount(state.weekly)
  const storyWeek = isStoryWeek(state.calendar.globalWeek)
  const lastClass = (state.academics.classLog ?? []).filter((c) => c.week === state.calendar.globalWeek).slice(-1)[0]
  const sides = state.weekly.quests.filter((q) => q.slot !== 'MAIN')
  const mains = state.weekly.quests.filter((q) => q.slot === 'MAIN')
  return (
    <div className="space-y-2">
      {/* ① 필수 수업 */}
      <div className={`panel-parchment p-3 ring-2 ${classDone ? 'ring-emerald-600/50 opacity-80' : 'ring-gold/70'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <Star className="size-3.5 fill-current text-[#b0791f]" />
              <span className="rounded bg-black/10 px-1.5 text-[10px]">필수 수업</span>
              {wc ? wc.label : '방학 — 수업 없음'}
            </div>
            {wc && meta && (
              <div className="text-[11px] opacity-70">
                {prof?.name} · {MAPS[meta.room]?.name ?? meta.room} · 미니게임: {Array.from(new Set(meta.games)).map((g) => MINIGAME_META[g].name).join(' / ')}
                {(wc.kind === 'midterm' || wc.kind === 'final') && ' — 시험은 미니게임 여러 개로 종합 평가'}
              </div>
            )}
            {!wc && <div className="text-[11px] opacity-70">방학에는 수업 대신 외부활동(지역 원정) 2개로 한 주가 끝납니다.</div>}
          </div>
          {wc && !classDone && (
            <Button size="sm" onClick={() => dispatch({ type: 'START_CLASS' })}>
              수업 참석
            </Button>
          )}
          {wc && classDone && <span className="shrink-0 text-[11px] font-semibold text-emerald-700">수료{lastClass ? ` · ${lastClass.grade}` : ''}</span>}
        </div>
      </div>

      {/* 스토리 지정 필수 과제(있을 때만) */}
      {mains.map((q) => (
        <QuestCard key={q.instanceId} q={q} mult={mult} />
      ))}

      {/* ② 외부활동 — 후보 중 2개 수락 */}
      <div className="flex items-center justify-between px-1 pt-1 text-xs font-display text-gold-soft">
        <span>외부활동 — 후보 중 {REQUIRED_OPTIONAL}개를 골라 수행{isRestWeek(state.calendar.globalWeek) && ' · 🎐 쉬어가는 주(축제·동아리·생활 중심)'}</span>
        <span className="text-[11px] text-white/70">
          수락 {accepted}/{REQUIRED_OPTIONAL}
        </span>
      </div>
      {sides.map((q) => (
        <QuestCard key={q.instanceId} q={q} mult={mult} canAccept={accepted < REQUIRED_OPTIONAL} />
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gold/30 bg-black/30 px-3 py-2 text-xs text-white/80">
        <span>
          수업 {classRequired ? (classDone ? '✔' : '✘') : '—'} · 외부활동 {optionalDone}/{REQUIRED_OPTIONAL}
          {mains.length > 0 && ` · 스토리 과제 ${mainDone ? '✔' : '✘'}`}
          {storyWeek && <span className="ml-1 text-gold-soft">· 이번 주를 마치면 메인스토리가 진행됩니다</span>}
        </span>
        <Button size="sm" disabled={!canEnd} onClick={() => dispatch({ type: 'END_WEEK' })}>
          이번 주 마치기
        </Button>
      </div>
    </div>
  )
}

function QuestCard({ q, mult, canAccept }: { q: QuestInstance; mult: number; canAccept?: boolean }) {
  const { dispatch } = useGame()
  const t = questTemplateById(q.templateId)
  if (!t) return null
  const isMain = q.slot === 'MAIN'
  const offered = q.status === 'offered'
  return (
    <div className={`panel-parchment p-3 ${isMain ? 'ring-2 ring-gold/70' : ''} ${q.status === 'claimed' ? 'opacity-60' : ''} ${offered ? 'opacity-85' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <span className="rounded bg-black/10 px-1.5 text-[10px]">{isMain ? '스토리' : SLOT_LABEL[q.slot]}</span>
            {t.title}
          </div>
          <div className="text-[11px] opacity-70">{t.description}</div>
        </div>
        {offered && (
          <Button size="sm" variant="parchment" disabled={!canAccept} onClick={() => dispatch({ type: 'ACCEPT_QUEST', instanceId: q.instanceId })}>
            수락
          </Button>
        )}
        {q.status === 'active' && !isMain && (
          <button className="shrink-0 text-[10px] underline opacity-60" onClick={() => dispatch({ type: 'DROP_QUEST', instanceId: q.instanceId })}>
            포기
          </button>
        )}
        {q.status === 'complete' && (
          <Button size="sm" onClick={() => dispatch({ type: 'CLAIM_QUEST', instanceId: q.instanceId })}>
            보상 받기
          </Button>
        )}
        {q.status === 'claimed' && <span className="shrink-0 text-[11px] font-semibold text-emerald-700">완료</span>}
      </div>
      {!offered && (
        <div className="mt-1.5 space-y-0.5">
          {t.objectives.map((ob, i) => {
            const p = q.progress[i] ?? 0
            const done = p >= ob.count
            return (
              <div key={i} className="flex items-center gap-1.5 text-[11px]">
                {done ? <CheckCircle2 className="size-3.5 text-emerald-700" /> : <Circle className="size-3.5 opacity-50" />}
                {ob.label} {Math.min(p, ob.count)}/{ob.count}
              </div>
            )
          })}
        </div>
      )}
      <div className="mt-1 text-[10px] opacity-60">
        {offered && `목표: ${t.objectives.map((o) => `${o.label} ${o.count}`).join(', ')} · `}
        보상:{' '}
        {t.rewards
          .map((r) =>
            r.type === 'EXP'
              ? `EXP ${Math.round(r.amount * mult)}`
              : r.type === 'GOLD'
                ? `${Math.round(r.amount * mult)}G`
                : r.type === 'ITEM'
                  ? `${itemById(r.itemId)?.name ?? r.itemId} x${r.amount}`
                  : r.type === 'COURSE'
                    ? `수업 점수 +${r.amount}`
                    : r.type === 'RELATIONSHIP'
                      ? `관계도 +${r.amount}`
                      : '스토리',
          )
          .join(' · ')}
      </div>
    </div>
  )
}

function AcademicTab() {
  const { state } = useGame()
  const open = coursesForWeek(state.calendar.globalWeek)
  return (
    <div className="space-y-3">
      <div className="panel-parchment p-3 text-xs">
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
        <div className="mb-1 text-xs font-display text-gold-soft">이번 학기 수강 과목</div>
        {open.length === 0 ? (
          <div className="panel-parchment p-3 text-center text-xs opacity-70">방학 중에는 수업이 없습니다.</div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {open.map((c) => {
              const score = state.academics.courseScore[c.id] ?? 0
              const g = gradeForScore(score)
              return (
                <div key={c.id} className="panel-parchment p-2.5 text-xs">
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
        <p className="mt-1 text-[10px] text-white/50">수업 미션(보상: 수업 점수)으로 점수를 올리면 진도에 따라 마법을 배우고, 학기 마지막 주 마감 때 성적과 학점이 정산됩니다. D 이상으로 이수하면 못 배운 마법도 모두 익힙니다.</p>
      </div>

      {state.academics.history.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-display text-gold-soft">성적 기록</div>
          <div className="space-y-1">
            {state.academics.history.map((h) => (
              <div key={h.termIndex} className="panel-parchment p-2 text-[11px]">
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
          <div key={a} className={`panel-parchment flex items-center gap-2 p-2.5 text-xs ${open ? '' : 'opacity-60'}`}>
            {open ? <CheckCircle2 className="size-4 text-emerald-700" /> : <Lock className="size-4" />}
            <div>
              <div className="font-semibold">{ACTIVITY_META[a].name}</div>
              <div className="text-[10px] opacity-70">{open ? '해금됨' : `${activityUnlockLabel(a)} 해금`}</div>
            </div>
          </div>
        )
      })}
      <p className="col-span-full text-[10px] text-white/50">
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
    <div className={`flex flex-col items-center gap-0.5 rounded-lg border border-gold/20 bg-black/25 p-1.5 text-center ${count ? '' : 'opacity-35 grayscale'}`} title={name}>
      <Image src={icon} alt="" width={28} height={28} />
      <span className="w-full truncate text-[9px] text-white/80">{count ? name : '???'}</span>
      {count > 0 && <span className="text-[9px] text-gold-soft">x{count}</span>}
    </div>
  )
  const section = (title: string, got: number, total: number, children: React.ReactNode) => (
    <div>
      <div className="mb-1 text-xs font-display text-gold-soft">
        {title} {got}/{total}
      </div>
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8">{children}</div>
    </div>
  )
  return (
    <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1 scrollbar-thin">
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
    ...NPCS.filter((n) => n.role !== 'craftStation' && !n.id.startsWith('tr-')).map((n) => ({ id: n.id, name: n.name, sub: '' })),
  ]
  const known = people.filter((p) => state.relationships[p.id])
  return (
    <div className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1 scrollbar-thin">
      {known.length === 0 && <div className="panel-parchment p-4 text-center text-xs opacity-70">아직 친해진 사람이 없습니다. NPC와 대화하면 관계도가 오릅니다(주 1회).</div>}
      {known
        .sort((a, b) => (state.relationships[b.id]?.affinity ?? 0) - (state.relationships[a.id]?.affinity ?? 0))
        .map((p) => {
          const aff = state.relationships[p.id]?.affinity ?? 0
          return (
            <div key={p.id} className="panel-parchment flex items-center gap-3 p-2 text-xs">
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
