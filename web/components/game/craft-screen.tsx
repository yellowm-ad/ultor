'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useGame } from '@/lib/game-state'
import { npcById, itemById, RECIPES } from '@/lib/mock-data'
import type { CraftStationKind, RecipeCategory } from '@/lib/types'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Portrait } from '@/components/game/portrait'
import { rarityGlowStyle } from '@/components/game/ui-motifs'
import { activityUnlockLabel, isActivityUnlocked, RECIPE_CATEGORY_ACTIVITY, RECIPE_CATEGORY_LABEL } from '@/lib/life'
import { ingredientLabel, ownedFor } from '@/lib/inventory'
import { Hammer, Lock } from 'lucide-react'

const CATEGORIES: RecipeCategory[] = ['equipment', 'candy', 'alchemy', 'cooking', 'magicTool', 'furniture', 'costume']

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

export function CraftScreen() {
  const { state, dispatch } = useGame()
  const npc = state.activeNpcId ? npcById(state.activeNpcId) : null
  const station: CraftStationKind = npc?.station ?? 'magic_workbench'
  const [tab, setTab] = useState<RecipeCategory>(STATION_DEFAULT_TAB[station])
  if (!npc || state.screen !== 'craft') return null

  const close = () => dispatch({ type: 'CLOSE_OVERLAY' })
  const activity = RECIPE_CATEGORY_ACTIVITY[tab]
  const unlocked = isActivityUnlocked(state, activity)
  const recipes = RECIPES.filter((r) => (r.category ?? 'equipment') === tab)

  return (
    <Modal open onClose={close} title={`${npc.name}`} widthClass="max-w-2xl">
      <div className="mb-3 flex items-center gap-3">
        <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg border-2 border-gold/70">
          <Portrait id={npc.id} className="h-full w-full" />
        </div>
        <div className="panel-parchment flex-1 p-2.5 text-xs leading-relaxed">{npc.greeting[0]}</div>
      </div>

      {/* 카테고리 탭 — 해금 전 카테고리는 자물쇠 */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => {
          const open = isActivityUnlocked(state, RECIPE_CATEGORY_ACTIVITY[c])
          return (
            <button
              key={c}
              type="button"
              onClick={() => setTab(c)}
              className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-display ${
                tab === c ? 'border-gold bg-gold/25 text-gold-soft' : 'border-white/25 bg-black/30 text-white/75'
              }`}
            >
              {!open && <Lock className="size-3" />}
              {RECIPE_CATEGORY_LABEL[c]}
            </button>
          )
        })}
      </div>

      {!unlocked && (
        <div className="mb-2 rounded-lg border border-gold/30 bg-black/30 px-3 py-2 text-[11px] text-gold-soft">
          {RECIPE_CATEGORY_LABEL[tab]} 제작은 {activityUnlockLabel(activity)}에 해금됩니다. 레시피는 미리 볼 수 있어요.
        </div>
      )}

      {recipes.length === 0 ? (
        <div className="panel-parchment flex flex-col items-center gap-2 p-6 text-center text-sm opacity-70">
          <Hammer className="size-6" />
          아직 이 분류의 레시피가 없습니다.
        </div>
      ) : (
        <div className="grid max-h-[50vh] grid-cols-1 gap-2 overflow-y-auto scrollbar-thin pr-1 sm:grid-cols-2">
          {recipes.map((recipe) => {
            const output = itemById(recipe.outputItemId)
            if (!output) return null
            const hasAll = recipe.ingredients.every((ing) => ownedFor(state.inventory, ing.itemId) >= ing.quantity)
            const atStation = recipe.station === station
            const canCraft = unlocked && hasAll && atStation
            return (
              <div key={recipe.id} className="panel-parchment flex flex-col gap-2 p-3">
                <div className="flex items-center gap-3">
                  <div
                    style={rarityGlowStyle(output.type)}
                    className="rarity-glow flex size-14 shrink-0 items-center justify-center rounded-full border-[3px] border-gold bg-white/45 shadow-[0_0_0_2px_rgba(0,0,0,0.15)]"
                  >
                    <Image src={output.icon} alt={output.name} width={34} height={34} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {output.name}
                      {recipe.outputQuantity > 1 ? ` x${recipe.outputQuantity}` : ''}
                    </div>
                    <div className="line-clamp-2 text-[11px] opacity-70">{output.description}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] opacity-80">
                  {recipe.ingredients.map((ing) => {
                    const owned = ownedFor(state.inventory, ing.itemId)
                    return (
                      <span key={ing.itemId} className={owned >= ing.quantity ? '' : 'text-destructive'}>
                        {ingredientLabel(ing.itemId)} {owned}/{ing.quantity}
                      </span>
                    )
                  })}
                </div>

                <Button variant="default" disabled={!canCraft} onClick={() => dispatch({ type: 'CRAFT_ITEM', recipeId: recipe.id })}>
                  {atStation ? '제작하기' : `${STATION_LABEL[recipe.station]}에서 제작`}
                </Button>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <Button variant="ghost" onClick={close}>
          닫기
        </Button>
      </div>
    </Modal>
  )
}
