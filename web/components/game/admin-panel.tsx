'use client'

import { useMemo, useState } from 'react'
import { useGame } from '@/lib/game-state'
import { Button } from '@/components/ui/button'
import { SKILLS, MONSTERS, NPCS, itemById } from '@/lib/mock-data'
import { PET_DEFS } from '@/lib/pets'
import { GUEST_NPCS } from '@/lib/companions'
import { MINIGAME_META } from '@/lib/curriculum'
import { POSITION_META } from '@/lib/constants'
import { calendarLabel, TOTAL_WEEKS } from '@/lib/calendar'

const SKILL_GROUPS: { key: string; label: string; filter: (s: (typeof SKILLS)[number]) => boolean }[] = [
  { key: 'fire', label: '불꽃', filter: (s) => s.element === 'fire' && !s.owner },
  { key: 'ice', label: '얼음', filter: (s) => s.element === 'ice' && !s.owner },
  { key: 'earth', label: '대지', filter: (s) => s.element === 'earth' && !s.owner },
  { key: 'dark', label: '어둠', filter: (s) => s.element === 'dark' && !s.owner },
  { key: 'light', label: '빛', filter: (s) => s.element === 'light' && !s.owner },
  { key: 'none', label: '속성 없음', filter: (s) => s.element === null && !s.owner },
  { key: 'wind', label: '바람(모르스 전용 · 습득 불가)', filter: (s) => s.owner === 'mors' },
  { key: 'pet', label: '펫 스킬(습득 불가)', filter: (s) => s.owner === 'pet' },
]

type Section = 'char' | 'skills' | 'items' | 'pets' | 'school' | 'room' | null

export function AdminPanel() {
  const { state, dispatch } = useGame()
  const [open, setOpen] = useState(true)
  const [section, setSection] = useState<Section>('char')
  const [levelInput, setLevelInput] = useState(String(state.player.level))
  const [goldInput, setGoldInput] = useState(String(state.player.gold))
  const [weekInput, setWeekInput] = useState(String(state.calendar.globalWeek))

  const testroomMonsters = useMemo(
    () => (state.currentMapId === 'testroom' ? state.fieldMonsters : []),
    [state.currentMapId, state.fieldMonsters],
  )
  const testroomNpcs = useMemo(() => NPCS.filter((n) => n.zoneId === 'z-testroom'), [])

  if (!open) {
    // 테스트룸에서는 에버테일풍 HUD 아이콘 열에 가려 우상단 버튼이 잘 안 보이므로, 테스트룸 한정으로 상단 가운데에 띄운다.
    const inTestroom = state.currentMapId === 'testroom'
    return (
      <button
        onClick={() => setOpen(true)}
        className={
          inTestroom
            ? 'fixed left-1/2 top-2 z-[70] -translate-x-1/2 rounded-md border border-gold/60 bg-black/80 px-3 py-1.5 text-xs font-display text-gold-soft shadow-lg'
            : 'fixed right-2 top-2 z-[70] rounded-md border border-gold/60 bg-black/80 px-2.5 py-1.5 text-xs font-display text-gold-soft shadow-lg'
        }
      >
        관리자 패널 열기
      </button>
    )
  }

  return (
    <div className="fixed right-0 top-0 z-[70] flex h-full w-[min(94vw,340px)] flex-col border-l border-gold/50 bg-[#17130e]/96 text-xs text-white/90 shadow-2xl">
      <div className="flex items-center justify-between border-b border-gold/30 px-3 py-2">
        <span className="font-display text-gold-soft">관리자 테스트 패널</span>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          접기
        </Button>
      </div>

      {/* 상태 요약 */}
      <div className="border-b border-gold/20 px-3 py-2 text-[11px] text-white/70">
        <div>
          {state.player.name || '이름없음'} · Lv.{state.player.level} · {state.player.appearance.gender === 'male' ? '남' : '여'} ·{' '}
          {POSITION_META[state.formation.positions.hero ?? 'front'].label}
        </div>
        <div>
          HP {state.player.hp}/{state.player.stats.maxHp} · MP {state.player.mp}/{state.player.stats.maxMp} · Gold{' '}
          {state.player.gold}
        </div>
        <div>스킬 {state.player.learnedSkills.length}개(장착 {state.player.equippedSkills.length}) · 펫 {state.ownedPets.length}마리 · 맵 {state.currentMapId}</div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-gold/20 px-2 py-1.5">
        {(
          [
            ['char', '캐릭터'],
            ['skills', '스킬'],
            ['items', '아이템'],
            ['pets', '펫'],
            ['school', '학사'],
            ['room', '테스트룸'],
          ] as [Section, string][]
        ).map(([key, label]) => (
          <Button key={key} size="sm" variant={section === key ? 'default' : 'outline'} onClick={() => setSection(key)}>
            {label}
          </Button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-2">
        {section === 'char' && (
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-white/60">레벨 (1~100)</div>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={levelInput}
                  onChange={(e) => setLevelInput(e.target.value)}
                  className="w-16 rounded border border-gold/40 bg-black/40 px-1.5 py-1 text-white"
                />
                <Button size="sm" onClick={() => dispatch({ type: 'ADMIN_SET_LEVEL', level: Number(levelInput) || 1 })}>
                  적용
                </Button>
              </div>
            </div>
            <div>
              <div className="mb-1 text-white/60">골드</div>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min={0}
                  value={goldInput}
                  onChange={(e) => setGoldInput(e.target.value)}
                  className="w-24 rounded border border-gold/40 bg-black/40 px-1.5 py-1 text-white"
                />
                <Button size="sm" onClick={() => dispatch({ type: 'ADMIN_SET_GOLD', gold: Number(goldInput) || 0 })}>
                  적용
                </Button>
              </div>
            </div>
            <Button size="sm" className="w-full" onClick={() => dispatch({ type: 'ADMIN_HEAL_FULL' })}>
              HP/MP 전체 회복
            </Button>
          </div>
        )}

        {section === 'skills' && (
          <div className="space-y-3">
            <div className="flex gap-1.5">
              <Button size="sm" className="flex-1" onClick={() => dispatch({ type: 'ADMIN_LEARN_ALL_SKILLS' })}>
                전체 습득
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => dispatch({ type: 'ADMIN_CLEAR_SKILLS' })}>
                전체 해제
              </Button>
            </div>
            {SKILL_GROUPS.map((g) => (
              <div key={g.key}>
                <div className="mb-1 border-b border-gold/20 pb-0.5 text-gold-soft">{g.label}</div>
                <div className="grid grid-cols-1 gap-0.5">
                  {SKILLS.filter(g.filter).map((s) => (
                    <label key={s.id} className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 hover:bg-white/5">
                      <input
                        type="checkbox"
                        checked={state.player.learnedSkills.includes(s.id)}
                        onChange={() => dispatch({ type: 'ADMIN_TOGGLE_SKILL', skillId: s.id })}
                      />
                      <span className="flex-1 truncate">{s.name}</span>
                      <span className="text-[10px] text-white/40">Lv{s.levelRequired}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {section === 'items' && (
          <div className="space-y-2">
            <Button size="sm" className="w-full" onClick={() => dispatch({ type: 'ADMIN_GIVE_ALL_ITEMS' })}>
              모든 아이템(무기·방어구·물약·도구·먹이) 지급
            </Button>
            <div className="text-white/60">현재 인벤토리 {state.inventory.length}종</div>
            <div className="grid grid-cols-1 gap-0.5">
              {state.inventory.map((slot) => {
                const item = itemById(slot.itemId)
                if (!item) return null
                return (
                  <div key={slot.itemId} className="flex justify-between rounded px-1 py-0.5 odd:bg-white/5">
                    <span className="truncate">{item.name}</span>
                    <span className="text-white/50">×{slot.qty}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {section === 'pets' && (
          <div className="space-y-2">
            <Button size="sm" className="w-full" onClick={() => dispatch({ type: 'ADMIN_GRANT_ALL_PETS' })}>
              전체 펫 {PET_DEFS.length}종 획득
            </Button>
            <div className="text-white/60">활성 펫: {state.pet.nickname || petName(state.pet.defId)}</div>
            <div className="grid grid-cols-1 gap-0.5">
              {state.ownedPets.map((p) => (
                <div key={p.defId} className="flex items-center justify-between rounded px-1 py-0.5 odd:bg-white/5">
                  <span className="truncate">
                    {petName(p.defId)} Lv.{p.level}
                  </span>
                  <Button
                    size="sm"
                    variant={state.pet.defId === p.defId ? 'default' : 'outline'}
                    onClick={() => dispatch({ type: 'ADMIN_SET_ACTIVE_PET', defId: p.defId })}
                  >
                    활성화
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {section === 'school' && (
          <div className="space-y-3">
            <div className="text-white/70">{calendarLabel(state.calendar)} (전체 {state.calendar.globalWeek}/{TOTAL_WEEKS}주)</div>
            <div>
              <div className="mb-1 text-white/60">주차 이동 (1~{TOTAL_WEEKS})</div>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={TOTAL_WEEKS}
                  value={weekInput}
                  onChange={(e) => setWeekInput(e.target.value)}
                  className="w-20 rounded border border-white/20 bg-black/40 px-2 py-1"
                />
                <Button size="sm" onClick={() => dispatch({ type: 'ADMIN_SET_WEEK', week: Number(weekInput) || 1 })}>
                  이동
                </Button>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {[1, 13, 25, 37, 49, 97, 145, 181].map((w) => (
                  <Button key={w} size="sm" variant="outline" onClick={() => dispatch({ type: 'ADMIN_SET_WEEK', week: w })}>
                    {calendarLabel(w).replace(/ 1주차$/, '')}
                  </Button>
                ))}
              </div>
            </div>
            <Button size="sm" className="w-full" onClick={() => dispatch({ type: 'ADMIN_FORCE_END_WEEK' })}>
              이번 주 강제 마감 → 다음 주
            </Button>
            <Button size="sm" variant={state.storyFlags.DEBUG_UNLOCK_ALL ? 'default' : 'outline'} className="w-full" onClick={() => dispatch({ type: 'ADMIN_TOGGLE_UNLOCK_ALL' })}>
              생활 시스템 전체 해금 {state.storyFlags.DEBUG_UNLOCK_ALL ? 'ON' : 'OFF'}
            </Button>
            <Button size="sm" className="w-full" onClick={() => dispatch({ type: 'ADMIN_RECRUIT_ALL' })}>
              동료 전원 합류
            </Button>
            {/* 수업 미니게임 테스트(이번 주 수업 완료 여부 무시) */}
            <div className="grid grid-cols-3 gap-1">
              {(Object.keys(MINIGAME_META) as (keyof typeof MINIGAME_META)[]).map((g) => (
                <Button key={g} size="sm" variant="outline" onClick={() => dispatch({ type: 'ADMIN_CLASS_TEST', game: g })}>
                  {MINIGAME_META[g].name}
                </Button>
              ))}
            </div>
            {/* 임시 합류 NPC(호위·동행) 테스트 */}
            {GUEST_NPCS.map((g) => {
              const on = (state.companions.guests ?? []).some((x) => x.id === g.id)
              return (
                <Button
                  key={g.id}
                  size="sm"
                  variant={on ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => dispatch({ type: on ? 'REMOVE_GUEST' : 'ADD_GUEST', guestId: g.id })}
                >
                  {g.role === 'escort' ? '호위' : '동행'} NPC [{g.name}] {on ? '해제' : '합류'}
                </Button>
              )
            })}
            <Button size="sm" variant="outline" className="w-full" onClick={() => {
              for (const id of ['candy-mana-s', 'candy-mana', 'candy-mana-l']) dispatch({ type: 'ADMIN_GIVE_ITEM', itemId: id, qty: 10 })
            }}>
              마력캔디 3종 ×10
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => {
                for (const id of ['herb-mint', 'mush-button', 'flower-dew', 'wood-oak', 'hunt-meat', 'hunt-hide', 'fish-carp', 'sea-kelp', 'ore-iron', 'crystal-mana'])
                  dispatch({ type: 'ADMIN_GIVE_ITEM', itemId: id, qty: 10 })
                dispatch({ type: 'ADMIN_GIVE_ITEM', itemId: 'tool-rod-basic', qty: 1 })
              }}
            >
              생활 재료 세트 + 낚싯대 지급
            </Button>
            <div className="text-white/50">
              스토리 플래그 {Object.keys(state.storyFlags).length}개 · 대기 중 스토리 {state.storyQueue.length}개
            </div>
          </div>
        )}

        {section === 'room' && (
          <div className="space-y-3">
            <Button
              size="sm"
              className="w-full"
              disabled={state.currentMapId === 'testroom'}
              onClick={() => dispatch({ type: 'ADMIN_ENTER_TESTROOM' })}
            >
              테스트룸으로 이동
            </Button>
            {state.currentMapId === 'testroom' && (
              <>
                <Button size="sm" variant="outline" className="w-full" onClick={() => dispatch({ type: 'ADMIN_RESPAWN_MONSTERS' })}>
                  몬스터 리스폰
                </Button>
                <div>
                  <div className="mb-1 text-gold-soft">몬스터 {testroomMonsters.length}종 — 클릭 시 즉시 전투</div>
                  <div className="grid grid-cols-1 gap-0.5">
                    {testroomMonsters.map((fm) => {
                      const def = MONSTERS.find((m) => m.id === fm.monsterId)
                      if (!def) return null
                      return (
                        <button
                          key={fm.uid}
                          onClick={() => dispatch({ type: 'START_BATTLE', fieldMonsterUid: fm.uid })}
                          className="flex justify-between rounded px-1 py-0.5 text-left odd:bg-white/5 hover:bg-white/10"
                        >
                          <span className="truncate">{def.name}</span>
                          <span className="text-white/40">Lv.{def.level}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-gold-soft">NPC {testroomNpcs.length}명 — 클릭 시 대화/상점</div>
                  <div className="grid grid-cols-1 gap-0.5">
                    {testroomNpcs.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => dispatch({ type: n.shopItemIds ? 'OPEN_SHOP' : 'OPEN_NPC', npcId: n.id })}
                        className="flex justify-between rounded px-1 py-0.5 text-left odd:bg-white/5 hover:bg-white/10"
                      >
                        <span className="truncate">{n.name}</span>
                        <span className="text-white/40">{n.role}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function petName(defId: string) {
  return PET_DEFS.find((d) => d.id === defId)?.name ?? defId
}
