'use client'

// 제작대 — 「제작대 UI 개선안.png」 참고 (2026-10-03). 공용 GameWindow(검은 틀 + 아이보리 패널).
// 왼쪽 분류(PixelLab 아이콘) · 가운데 레시피 목록 · 오른쪽 상세(완성품 · 제작 수량 · 필요 재료 · 제작하기).

import Image from 'next/image'
import { useState } from 'react'
import { useGame } from '@/lib/game-state'
import { npcById, itemById, ITEMS, RECIPES } from '@/lib/mock-data'
import type { CraftStationKind, RecipeCategory, RecipeDef } from '@/lib/types'
import { activityUnlockLabel, isActivityUnlocked, RECIPE_CATEGORY_ACTIVITY, RECIPE_CATEGORY_LABEL } from '@/lib/life'
import { ingredientLabel, ownedFor } from '@/lib/inventory'
import { Divider, GameWindow, HeadPill, menuIcon, Ribbon, SideItem, Slot, Sparkle } from '@/components/game/game-window'

const CATEGORIES: RecipeCategory[] = ['equipment', 'candy', 'alchemy', 'cooking', 'magicTool', 'furniture', 'costume']

const CATEGORY_ICON: Record<RecipeCategory, string> = {
  equipment: 'craft-equipment',
  candy: 'craft-candy',
  alchemy: 'craft-alchemy',
  cooking: 'craft-cooking',
  magicTool: 'craft-magictool',
  furniture: 'cat-furniture',
  costume: 'craft-costume',
}

const STATION_LABEL: Record<CraftStationKind, string> = {
  magic_workbench: '마도구 작업대',
  alchemy_pot: '연금술 가마',
  cooking_pot: '공동 식당 주방',
}

/** 스테이션을 열었을 때 처음 보여줄 탭 */
const STATION_DEFAULT_TAB: Record<CraftStationKind, RecipeCategory> = {
  magic_workbench: 'equipment',
  alchemy_pot: 'alchemy',
  cooking_pot: 'cooking',
}

type Filter = 'all' | 'ready' | 'short'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'ready', label: '제작 가능' },
  { id: 'short', label: '재료 부족' },
]

/** 'tag:herb' 같은 묶음 재료는 그 태그의 첫 아이템 그림으로 보여 준다 */
function ingredientIcon(target: string): string | undefined {
  if (!target.startsWith('tag:')) return itemById(target)?.icon
  const tag = target.slice(4)
  return ITEMS.find((i) => i.tags?.includes(tag as never))?.icon
}

/** 지금 재료로 몇 번 만들 수 있나 */
function maxCraftable(recipe: RecipeDef, inv: Parameters<typeof ownedFor>[0]) {
  return Math.min(...recipe.ingredients.map((ing) => Math.floor(ownedFor(inv, ing.itemId) / ing.quantity)))
}

export function CraftScreen() {
  const { state, dispatch } = useGame()
  const npc = state.activeNpcId ? npcById(state.activeNpcId) : null
  const station: CraftStationKind = npc?.station ?? 'magic_workbench'
  const [tab, setTab] = useState<RecipeCategory>(STATION_DEFAULT_TAB[station])
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  if (!npc || state.screen !== 'craft') return null

  const close = () => dispatch({ type: 'CLOSE_OVERLAY' })
  const activity = RECIPE_CATEGORY_ACTIVITY[tab]
  const unlocked = isActivityUnlocked(state, activity)
  const inTab = RECIPES.filter((r) => (r.category ?? 'equipment') === tab)
  const recipes = inTab.filter((r) => {
    const n = maxCraftable(r, state.inventory)
    return filter === 'all' || (filter === 'ready' ? n > 0 : n === 0)
  })
  const selected = recipes.find((r) => r.id === selectedId) ?? recipes[0] ?? null
  const output = selected ? itemById(selected.outputItemId) : null
  const max = selected ? maxCraftable(selected, state.inventory) : 0
  const atStation = selected ? selected.station === station : false
  const amount = Math.max(1, Math.min(qty, Math.max(1, max)))
  const canCraft = !!selected && unlocked && atStation && max >= amount
  const materialKinds = state.inventory.filter((s) => itemById(s.itemId)?.type === 'material').length

  const pick = (id: string) => {
    setSelectedId(id)
    setQty(1)
  }
  const craft = () => {
    if (!selected || !canCraft) return
    for (let i = 0; i < amount; i++) dispatch({ type: 'CRAFT_ITEM', recipeId: selected.id })
    setQty(1)
  }

  return (
    <GameWindow
      title="제작대"
      subtitle="CRAFTING"
      onClose={close}
      tall
      cols
      width={920}
      height={480}
      headerExtra={
        <>
          <span className="gw-head-pill hidden md:inline-flex">
            <Image src={npc.station ? menuIcon('hud-craft') : menuIcon('hud-craft')} alt="" width={24} height={24} unoptimized />
            {STATION_LABEL[station]}
          </span>
          <HeadPill icon={menuIcon('cat-material')}>
            보유 재료 <b>{materialKinds}</b>종
          </HeadPill>
          <HeadPill icon={menuIcon('icon-coin')}>
            <b>{state.player.gold.toLocaleString()}</b> G
          </HeadPill>
        </>
      }
    >
      <div className="gw-cols">
        {/* 분류 */}
        <nav className="gw-side" aria-label="제작 분류">
          {CATEGORIES.map((c) => (
            <SideItem
              key={c}
              icon={menuIcon(CATEGORY_ICON[c])}
              label={`${RECIPE_CATEGORY_LABEL[c]} 제작`}
              count={RECIPES.filter((r) => (r.category ?? 'equipment') === c && maxCraftable(r, state.inventory) > 0).length}
              locked={!isActivityUnlocked(state, RECIPE_CATEGORY_ACTIVITY[c])}
              active={tab === c}
              onClick={() => {
                setTab(c)
                setSelectedId(null)
                setQty(1)
              }}
            />
          ))}
        </nav>

        {/* 레시피 목록 */}
        <section className="gw-panel is-flex p-3">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="gw-chips">
              {FILTERS.map((f) => (
                <button key={f.id} type="button" className={`gw-chip ${filter === f.id ? 'is-active' : ''}`} onClick={() => setFilter(f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
            <span className="text-[12px] text-[#8a7c62]">레시피 {inTab.length}종</span>
          </div>
          {!unlocked && (
            <div className="gw-box mb-2 text-[12.5px] text-[#7a5a20]">
              {RECIPE_CATEGORY_LABEL[tab]} 제작은 {activityUnlockLabel(activity)}에 해금됩니다. 레시피는 미리 볼 수 있어요.
            </div>
          )}
          <div className="gw-scroll is-fill flex flex-col gap-2 pr-1">
            {recipes.length === 0 && (
              <div className="gw-empty">
                <Sparkle />
                {inTab.length === 0 ? '아직 이 분류의 레시피가 없습니다.' : '조건에 맞는 레시피가 없습니다.'}
              </div>
            )}
            {recipes.map((r) => {
              const out = itemById(r.outputItemId)
              if (!out) return null
              const n = maxCraftable(r, state.inventory)
              const owned = ownedFor(state.inventory, r.outputItemId)
              return (
                <button key={r.id} type="button" className={`gw-row ${selected?.id === r.id ? 'is-active' : ''}`} onClick={() => pick(r.id)}>
                  <span className="gw-row-icon is-tile">
                    <Image src={out.icon} alt="" width={38} height={38} unoptimized />
                  </span>
                  <span className="gw-row-main">
                    <span className="gw-row-title">
                      {out.name}
                      {r.outputQuantity > 1 && <span className="text-[12px] font-normal text-[#8a7c62]">x{r.outputQuantity}</span>}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      <span className="gw-pill is-soft">보유 {owned}</span>
                      {n > 0 ? <span className="gw-pill is-green">{n}회 가능</span> : <span className="gw-pill is-soft">재료 부족</span>}
                      {r.station !== station && <span className="gw-pill is-soft">{STATION_LABEL[r.station]}</span>}
                    </span>
                  </span>
                  <svg className="gw-row-chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )
            })}
          </div>
        </section>

        {/* 상세 */}
        <aside className="gw-panel is-flex is-pad">
          {selected && output ? (
            <>
              <div className="gw-scroll is-fill">
                <div className="flex gap-4">
                  <div className="craft-medal">
                    <Image src={output.icon} alt={output.name} width={64} height={64} unoptimized />
                  </div>
                  <div className="min-w-0 pt-1">
                    <h3 className="font-display text-[16px] font-bold text-[#2c2a33]">{output.name}</h3>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="gw-pill">{RECIPE_CATEGORY_LABEL[selected.category ?? 'equipment']}</span>
                      {selected.outputQuantity > 1 && <span className="gw-pill is-soft">1회 {selected.outputQuantity}개</span>}
                    </div>
                    <p className="mt-2 text-[13px] leading-relaxed text-[#4d4856]">{output.description}</p>
                  </div>
                </div>

                <Divider />

                <div className="mb-3 flex items-center justify-center gap-2">
                  <span className="mr-1 text-[13px] text-[#6c6150]">제작 수량</span>
                  <button type="button" className="craft-step" onClick={() => setQty(Math.max(1, amount - 1))} disabled={amount <= 1} aria-label="하나 줄이기">
                    −
                  </button>
                  <span className="craft-qty">{amount}</span>
                  <button type="button" className="craft-step" onClick={() => setQty(Math.min(Math.max(1, max), amount + 1))} disabled={amount >= max} aria-label="하나 늘리기">
                    +
                  </button>
                  <button type="button" className="gw-btn is-quiet is-sm" onClick={() => setQty(Math.max(1, max))} disabled={max <= 1}>
                    MAX
                  </button>
                </div>

                <Ribbon>필요 재료</Ribbon>
                <div className="gw-box flex flex-wrap gap-3">
                  {selected.ingredients.map((ing) => {
                    const have = ownedFor(state.inventory, ing.itemId)
                    const need = ing.quantity * amount
                    return <Slot key={ing.itemId} icon={ingredientIcon(ing.itemId)} qty={`${have}/${need}`} short={have < need} label={ingredientLabel(ing.itemId)} title={ingredientLabel(ing.itemId)} />
                  })}
                </div>
              </div>

              <div className="pt-3">
                {!atStation && <p className="mb-2 text-center text-[12px] text-[#8a7c62]">이 레시피는 {STATION_LABEL[selected.station]}에서 만들 수 있어요.</p>}
                <button type="button" className="gw-btn is-gold is-lg w-full" disabled={!canCraft} onClick={craft}>
                  {atStation ? (amount > 1 ? `${amount}개 제작하기` : '제작하기') : `${STATION_LABEL[selected.station]}에서 제작`}
                </button>
              </div>
            </>
          ) : (
            <div className="gw-empty">
              <Sparkle />
              레시피를 선택하세요
            </div>
          )}
        </aside>
      </div>
    </GameWindow>
  )
}
