'use client'

import { PASSAGES } from '@/lib/passages'
import { useMemo, useState } from 'react'
import { useGame } from '@/lib/game-state'
import { Button } from '@/components/ui/button'
import { SKILLS, MONSTERS, NPCS, itemById } from '@/lib/mock-data'
import { GUEST_NPCS } from '@/lib/companions'
import { MINIGAME_META } from '@/lib/curriculum'
import { POSITION_META } from '@/lib/constants'
import { calendarLabel, TOTAL_WEEKS } from '@/lib/calendar'
import { STORY_BEATS, ENDING_EMBLEM_FLAGS, storyLineRoute } from '@/lib/story'
import { ALL_CUTSCENES as CUTSCENES } from '@/lib/cutscenes'
import { CutsceneManager } from '@/components/game/cutscene-manager'
import { BgmManager } from '@/components/game/bgm-manager'
import { DialogueEditor } from '@/components/game/dialogue-editor'
import { MAPS } from '@/lib/maps'
import { PROP_CATALOG } from '@/lib/prop-catalog'
import { beginDrag, getMapEditor, placeCatalogItem, setMapEditor, useMapEditor, type EditorTool } from '@/lib/map-editor'
import { TILE_SPRITES, type TileKind } from '@/lib/iso'
import { TEX_FILE } from '@/components/game/iso-terrain'
import {
  exportMapOverrides,
  importMapOverrides,
  localChangeCount,
  canUndoMapEdit,
  flipProp,
  moveProp,
  removeProp,
  resetLocalMap,
  setWallTex,
  undoMapEdit,
  wallKey,
  wallTextures,
  resetMapToOriginal,
  useMapOverridesVersion,
} from '@/lib/map-overrides'

function downloadText(name: string, text: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
const CATALOG_GROUPS = [...new Set(PROP_CATALOG.map((c) => c.group))]
/** 바닥 붓 팔레트 — 칸 타일 맵은 그림이 있는 칸 타일 전부(빈 아트리움 칸 제외), 자연 지형 맵은 그 맵이 그릴 수 있는 지면 종류 */
const FLOOR_TILES = (Object.entries(TILE_SPRITES) as [TileKind, string][]).filter(([k]) => k !== 'academy-void')
function floorPalette(map: { terrain?: { tex?: Partial<Record<TileKind, string>> } }): [TileKind, string][] {
  const T = map.terrain
  if (!T) return FLOOR_TILES
  const kinds = new Set<TileKind>([...(Object.keys(TEX_FILE) as TileKind[]), ...(Object.keys(T.tex ?? {}) as TileKind[])])
  return [...kinds].map((k) => [k, `/images/map/terrain/${T.tex?.[k] ?? TEX_FILE[k] ?? 'grass'}.png`])
}

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

type Section = 'char' | 'skills' | 'items' | 'school' | 'story' | 'obj' | 'room' | null

/** 컷신·연출 동작이 들어 있는 스토리 장면 — 관리자 '컷신' 탭에서 바로 재생 */
const CUT_BEATS = STORY_BEATS.filter((b) => b.lines.some((l) => l.cut || l.anim))

export function AdminPanel() {
  const { state, dispatch } = useGame()
  const [open, setOpen] = useState(true)
  const [section, setSection] = useState<Section>('char')
  const [levelInput, setLevelInput] = useState(String(state.player.level))
  const [goldInput, setGoldInput] = useState(String(state.player.gold))
  const [weekInput, setWeekInput] = useState(String(state.calendar.globalWeek))
  const [cutManager, setCutManager] = useState(false)
  const [bgmManager, setBgmManager] = useState(false)
  const [dlgEditor, setDlgEditor] = useState(false)
  const [catGroup, setCatGroup] = useState(CATALOG_GROUPS[0] ?? '')
  const [catQuery, setCatQuery] = useState('')
  const editor = useMapEditor()
  useMapOverridesVersion()

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
        <div>스킬 {state.player.learnedSkills.length}개(장착 {state.player.equippedSkills.length}) · 소환 {(state.player.summonSkills ?? []).length}칸 · 맵 {state.currentMapId}</div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-gold/20 px-2 py-1.5">
        {(
          [
            ['char', '캐릭터'],
            ['skills', '스킬'],
            ['items', '아이템'],
            ['school', '학사'],
            ['story', '컷신'],
            ['obj', '오브젝트'],
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
              생활 시스템 · 지역 전체 해금 {state.storyFlags.DEBUG_UNLOCK_ALL ? 'ON' : 'OFF'}
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
            <Button size="sm" variant="outline" className="w-full" onClick={() => dispatch({ type: 'ADMIN_GIVE_ALL_COSTUMES' })}>
              코스튬 전부 지급
            </Button>
            <Button size="sm" variant="outline" className="w-full" onClick={() => dispatch({ type: 'ADMIN_FISH_TEST' })}>
              낚시 미니게임 테스트
            </Button>
            {/* 첫 이동 연출 미니게임 테스트(lib/passages) — 이동 없이 한 판 */}
            <div className="grid grid-cols-2 gap-1">
              {PASSAGES.map((p) => (
                <Button key={p.id} size="sm" variant="outline" onClick={() => dispatch({ type: 'ADMIN_PASSAGE_TEST', id: p.id })}>
                  {p.title}
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

        {section === 'story' && (
          <div className="space-y-3">
            <Button size="sm" className="w-full" onClick={() => setDlgEditor(true)}>
              대사 편집
            </Button>
            <Button size="sm" className="w-full" onClick={() => setCutManager(true)}>
              컷신 이미지 관리 ({CUTSCENES.length}칸)
            </Button>
            <Button size="sm" className="w-full" onClick={() => setBgmManager(true)}>
              브금 관리 (마을·전투맵·전투·스토리)
            </Button>
            <div>
              <div className="mb-1 text-white/60">엔딩 루트 (지금: {storyLineRoute(state)})</div>
              <div className="flex gap-1">
                {(
                  [
                    ['A', { RUSPELL_FOUND: false }],
                    ['B', { RUSPELL_FOUND: true, EMBLEM_MONSTER_VILLAGE: true, ...Object.fromEntries(ENDING_EMBLEM_FLAGS.filter((f) => f !== 'EMBLEM_MONSTER_VILLAGE').map((f) => [f, false])) }],
                    ['C', { RUSPELL_FOUND: true, ...Object.fromEntries(ENDING_EMBLEM_FLAGS.map((f) => [f, true])) }],
                  ] as [string, Record<string, boolean>][]
                ).map(([r, flags]) => (
                  <Button key={r} size="sm" className="flex-1" variant={storyLineRoute(state) === r ? 'default' : 'outline'} onClick={() => dispatch({ type: 'ADMIN_SET_FLAGS', flags })}>
                    {r} 루트
                  </Button>
                ))}
              </div>
            </div>
            <div className="text-white/55">이미지를 넣은 뒤 아래 장면을 재생하면 게임 화면 그대로 확인할 수 있다. 이미지가 없는 컷은 관리자 페이지에서만 점선 자리 표시로 보인다.</div>
            <div className="space-y-1">
              {CUT_BEATS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  disabled={state.screen !== 'world'}
                  onClick={() => dispatch({ type: 'ADMIN_PLAY_BEAT', beatId: b.id })}
                  className="flex w-full items-center justify-between rounded border border-gold/25 px-2 py-1 text-left hover:bg-gold/10 disabled:opacity-40"
                >
                  <span className="truncate">{b.title}</span>
                  <span className="shrink-0 text-[10px] text-white/45">컷 {new Set(b.lines.map((l) => l.cut).filter(Boolean)).size} · 동작 {b.lines.filter((l) => l.anim).length}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {section === 'obj' && <ObjectEditorSection
          mapId={state.currentMapId}
          catGroup={catGroup}
          setCatGroup={setCatGroup}
          catQuery={catQuery}
          setCatQuery={setCatQuery}
          editor={editor}
        />}

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
      {cutManager && <CutsceneManager onClose={() => setCutManager(false)} />}
      {bgmManager && <BgmManager onClose={() => setBgmManager(false)} />}
      {dlgEditor && (
        <DialogueEditor
          onClose={() => setDlgEditor(false)}
          onPlay={(beatId) => {
            setDlgEditor(false)
            dispatch({ type: 'ADMIN_PLAY_BEAT', beatId })
          }}
        />
      )}
    </div>
  )
}


/** 관리자 '오브젝트' 탭 — 편집 모드 · 도구(오브젝트/바닥/벽) · 선택한 오브젝트 회전·이동·제거 · 끌어다 놓기 · 파일 저장/불러오기 */
function ObjectEditorSection({
  mapId,
  catGroup,
  setCatGroup,
  catQuery,
  setCatQuery,
  editor,
}: {
  mapId: string
  catGroup: string
  setCatGroup: (g: string) => void
  catQuery: string
  setCatQuery: (q: string) => void
  editor: ReturnType<typeof useMapEditor>
}) {
  const map = (MAPS as unknown as Record<string, (typeof MAPS)[keyof typeof MAPS]>)[mapId]
  const sel = editor.selected ? map.props?.find((p) => p.id === editor.selected) : undefined
  const nudge = (dx: number, dy: number) => sel && moveProp(map.id, sel.id, { x: sel.cell.x + dx, y: sel.cell.y + dy })
  const items = PROP_CATALOG.filter((c) => (catQuery ? c.name.includes(catQuery) : c.group === catGroup))
  const tools: [EditorTool, string][] = [
    ['object', '오브젝트'],
    ['floor', '바닥'],
    ['wall', '벽면'],
  ]
  // 벽 도구 — 고른 면(또는 같은 무늬 전부)의 키
  const wallKeys = (): string[] => {
    const w = editor.wall
    if (!w) return []
    if (!editor.wallAll) return [w.key]
    const keys: string[] = []
    for (const g of map.structures ?? []) g.parts.forEach((p, i) => p.kind === 'face' && p.tex?.src === w.src && !p.img && keys.push(wallKey(g.id, i)))
    return keys
  }
  return (
    <div className="space-y-3">
      <Button size="sm" className="w-full" variant={editor.on ? 'default' : 'outline'} onClick={() => setMapEditor({ on: !editor.on, selected: null, placing: null, wall: null })}>
        오브젝트 편집 모드 {editor.on ? 'ON' : 'OFF'}
      </Button>
      <div className="text-white/55">
        {map.name} · 오브젝트 {map.props?.length ?? 0}개 · 이 브라우저 수정 {localChangeCount(map.id)}건
      </div>

      {editor.on && (
        <>
          <div className="grid grid-cols-3 gap-1">
            {tools.map(([t, label]) => (
              <Button key={t} size="sm" variant={editor.tool === t ? 'default' : 'outline'} onClick={() => setMapEditor({ tool: t, selected: null, placing: null, wall: null })}>
                {label}
              </Button>
            ))}
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="flex-1" disabled={!canUndoMapEdit(map.id)} onClick={() => undoMapEdit(map.id)}>
              되돌리기 (Ctrl+Z)
            </Button>
            <Button size="sm" variant={editor.showBlockers ? 'default' : 'outline'} className="flex-1" onClick={() => setMapEditor({ showBlockers: !editor.showBlockers })}>
              길막 보기
            </Button>
          </div>
        </>
      )}

      {editor.on && editor.tool === 'object' && (
        <>
          <div className="text-white/55">오브젝트를 잡고 끌면 옮겨집니다(초록 = 빈 자리, 빨강 = 길막과 겹침). 목록에서 맵으로 끌어다 놓거나, 고른 뒤 땅을 눌러 놓습니다. R 회전 · Del 제거 · Esc 해제</div>
          <div className="rounded border border-gold/30 p-2">
            {sel ? (
              <>
                <div className="mb-1 truncate text-gold-soft">선택: {sel.id}</div>
                <div className="mb-1 text-white/55">
                  {sel.kind} · 위치 ({sel.cell.x}, {sel.cell.y}) {sel.solid ? '· 길막' : ''} {sel.mirrorX || sel.facing === 'left' ? '· 반전' : ''}
                </div>
                <div className="grid grid-cols-4 gap-1">
                  <Button size="sm" variant="outline" onClick={() => nudge(0, -0.25)}>↗</Button>
                  <Button size="sm" variant="outline" onClick={() => nudge(0.25, 0)}>↘</Button>
                  <Button size="sm" variant="outline" onClick={() => nudge(-0.25, 0)}>↖</Button>
                  <Button size="sm" variant="outline" onClick={() => nudge(0, 0.25)}>↙</Button>
                </div>
                <div className="mt-1 flex gap-1">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => flipProp(map.id, sel.id)}>
                    회전 (R)
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 text-red-200" onClick={() => { removeProp(map.id, sel.id); setMapEditor({ selected: null }) }}>
                    제거
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setMapEditor({ selected: null })}>
                    해제
                  </Button>
                </div>
              </>
            ) : editor.placing ? (
              <div className="text-gold-soft">놓을 오브젝트: {editor.placing.name} — 맵에서 놓을 자리를 누르세요</div>
            ) : (
              <div className="text-white/55">맵에서 오브젝트를 눌러 선택하세요</div>
            )}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-white/60">
              <span>오브젝트 추가 ({PROP_CATALOG.length}종)</span>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={editor.solid} onChange={(e) => setMapEditor({ solid: e.target.checked })} />
                길막
              </label>
            </div>
            <input
              value={catQuery}
              onChange={(e) => setCatQuery(e.target.value)}
              placeholder="이름 검색"
              className="mb-1 w-full rounded border border-gold/40 bg-black/40 px-1.5 py-1 text-white"
            />
            {!catQuery && (
              <select value={catGroup} onChange={(e) => setCatGroup(e.target.value)} className="mb-1 w-full rounded border border-gold/40 bg-black/40 px-1 py-1 text-white">
                {CATALOG_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            )}
            <div className="grid max-h-64 grid-cols-4 gap-1 overflow-y-auto scrollbar-thin">
              {items.map((c) => (
                <button
                  key={c.src}
                  type="button"
                  title={`${c.name} — 맵으로 끌어다 놓기`}
                  style={{ touchAction: 'none' }}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return
                    e.preventDefault()
                    setMapEditor({ placing: c, selected: null })
                    // 목록에서 맵으로 끌어다 놓기 — 놓는 순간 포인터 아래가 맵이면 거기에 놓는다(끌지 않고 떼면 '고른 상태'로 남음)
                    beginDrag(e, { kind: 'new-prop', id: null, grab: { x: 0, y: 0 } }, {
                      onEnd: (d) => {
                        if (!d.moved || !d.cell) return
                        const id = placeCatalogItem(map.id, c, d.cell, getMapEditor().solid)
                        setMapEditor({ selected: id, placing: null })
                      },
                    })
                  }}
                  className={`flex aspect-square items-center justify-center rounded border bg-black/30 p-0.5 ${editor.placing?.src === c.src ? 'border-gold' : 'border-white/10'}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.src} alt={c.name} draggable={false} className="pointer-events-none max-h-full max-w-full" style={{ imageRendering: 'pixelated' }} />
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {editor.on && editor.tool === 'floor' && (
        <div className="space-y-2">
              <div className="text-white/55">
                타일을 고르고 맵을 누르거나 끌어서 칠합니다. 「원래대로」는 칠한 칸을 원래 바닥으로 되돌립니다.
                {map.terrain ? ' 자연 지형 맵은 놓는 순간 지면을 다시 그립니다(넓은 맵은 1~2초). 물웅덩이 위를 칠하면 땅으로 메워집니다.' : ''}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-white/60">붓</span>
                {([1, 2, 3] as const).map((n) => (
                  <Button key={n} size="sm" variant={editor.brush === n ? 'default' : 'outline'} onClick={() => setMapEditor({ brush: n })}>
                    {n}×{n}
                  </Button>
                ))}
              </div>
              <div className="grid max-h-72 grid-cols-4 gap-1 overflow-y-auto scrollbar-thin">
                <button
                  type="button"
                  onClick={() => setMapEditor({ tile: null })}
                  className={`flex aspect-square items-center justify-center rounded border bg-black/30 text-[10px] text-white/70 ${editor.tile === null ? 'border-gold' : 'border-white/10'}`}
                >
                  원래대로
                </button>
                {floorPalette(map).map(([k, src]) => (
                  <button
                    key={k}
                    type="button"
                    title={k}
                    onClick={() => setMapEditor({ tile: k })}
                    className={`flex aspect-square flex-col items-center justify-center rounded border bg-black/30 p-0.5 ${editor.tile === k ? 'border-gold' : 'border-white/10'}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={k} className="max-h-[70%] max-w-full" style={{ imageRendering: 'pixelated' }} />
                    <span className="w-full truncate text-center text-[8px] text-white/55">{k}</span>
                  </button>
                ))}
              </div>
        </div>
      )}

      {editor.on && editor.tool === 'wall' && (
        <div className="space-y-2">
          {!(map.structures ?? []).some((g) => g.parts.some((p) => p.kind === 'face' && p.tex)) ? (
            <div className="text-white/55">이 맵에는 무늬를 바꿀 수 있는 벽면이 없습니다(실내·신전 맵에서 쓰세요).</div>
          ) : (
            <>
              <div className="text-white/55">맵의 벽면(점선 테두리)을 눌러 고른 뒤 아래 무늬를 누르면 바뀝니다.</div>
              <label className="flex items-center gap-1 text-white/70">
                <input type="checkbox" checked={editor.wallAll} onChange={(e) => setMapEditor({ wallAll: e.target.checked })} />
                같은 무늬 벽면 한꺼번에
              </label>
              <div className="truncate text-gold-soft">{editor.wall ? `고른 면: ${editor.wall.key} (${wallKeys().length}면)` : '고른 벽면 없음'}</div>
              <div className="grid max-h-72 grid-cols-3 gap-1 overflow-y-auto scrollbar-thin">
                <button
                  type="button"
                  disabled={!editor.wall}
                  onClick={() => {
                    setWallTex(map.id, wallKeys(), null)
                    setMapEditor({ wall: null })
                  }}
                  className="flex aspect-square items-center justify-center rounded border border-white/10 bg-black/30 text-[10px] text-white/70 disabled:opacity-40"
                >
                  원래대로
                </button>
                {wallTextures().map((t) => (
                  <button
                    key={t.src}
                    type="button"
                    title={t.src.split('/').pop()}
                    disabled={!editor.wall}
                    onClick={() => {
                      setWallTex(map.id, wallKeys(), t)
                      if (editor.wall) setMapEditor({ wall: { ...editor.wall, src: t.src } })
                    }}
                    className="flex aspect-square flex-col items-center justify-center rounded border border-white/10 bg-black/30 p-0.5 disabled:opacity-40"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.src} alt="" className="max-h-[75%] max-w-full" style={{ imageRendering: 'pixelated' }} />
                    <span className="w-full truncate text-center text-[8px] text-white/55">{t.src.split('/').pop()?.replace('.png', '')}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="space-y-1 border-t border-gold/20 pt-2">
        <Button size="sm" variant="outline" className="w-full" onClick={() => downloadText('map-overrides.json', exportMapOverrides())}>
          파일로 저장 (map-overrides.json)
        </Button>
        <label className="block cursor-pointer rounded border border-gold/40 px-2 py-1 text-center">
          파일 불러오기
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (f) importMapOverrides(await f.text())
              e.target.value = ''
            }}
          />
        </label>
        <Button size="sm" variant="outline" className="w-full" onClick={() => resetLocalMap(map.id)}>
          이 맵: 이 브라우저 수정 지우기
        </Button>
        <Button size="sm" variant="outline" className="w-full text-red-200" onClick={() => resetMapToOriginal(map.id)}>
          이 맵: 원래 게임 배치로
        </Button>
        <div className="text-white/45">모두에게 반영하려면 저장한 파일을 web/public/map-overrides.json 에 넣고 배포.</div>
      </div>
    </div>
  )
}
