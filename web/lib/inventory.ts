// 인벤토리 헬퍼 — 레시피 재료가 'tag:herb' 처럼 태그일 때 해당 태그 재료를 싼 것부터 소모한다.

import type { InventorySlot } from '@/lib/types'
import { itemById } from '@/lib/mock-data'
import { itemMatches, TAG_LABEL } from '@/lib/life'
import type { MaterialTag } from '@/lib/types'

export function addToInventory(inv: InventorySlot[], itemId: string, qty = 1): InventorySlot[] {
  const idx = inv.findIndex((s) => s.itemId === itemId)
  if (idx >= 0) {
    const copy = [...inv]
    copy[idx] = { ...copy[idx], qty: copy[idx].qty + qty }
    return copy
  }
  return [...inv, { itemId, qty }]
}

export function removeFromInventory(inv: InventorySlot[], itemId: string, qty = 1): InventorySlot[] {
  const idx = inv.findIndex((s) => s.itemId === itemId)
  if (idx < 0) return inv
  const copy = [...inv]
  const remaining = copy[idx].qty - qty
  if (remaining <= 0) copy.splice(idx, 1)
  else copy[idx] = { ...copy[idx], qty: remaining }
  return copy
}

export function hasItem(inv: InventorySlot[], itemId: string): boolean {
  return inv.some((s) => s.itemId === itemId && s.qty > 0)
}

/** 재료 id(또는 'tag:x')에 해당하는 보유 수량 */
export function ownedFor(inv: InventorySlot[], target: string): number {
  if (!target.startsWith('tag:')) return inv.find((s) => s.itemId === target)?.qty ?? 0
  return inv.reduce((sum, s) => (itemMatches(itemById(s.itemId), target) ? sum + s.qty : sum), 0)
}

export function ingredientLabel(target: string): string {
  if (target.startsWith('tag:')) return `아무 ${TAG_LABEL[target.slice(4) as MaterialTag] ?? target.slice(4)}`
  return itemById(target)?.name ?? target
}

/** 재료 전부 소모. 하나라도 부족하면 null */
export function consumeIngredients(inv: InventorySlot[], ingredients: { itemId: string; quantity: number }[]): InventorySlot[] | null {
  let out = inv
  for (const ing of ingredients) {
    if (ownedFor(out, ing.itemId) < ing.quantity) return null
    if (!ing.itemId.startsWith('tag:')) {
      out = removeFromInventory(out, ing.itemId, ing.quantity)
      continue
    }
    // 태그 재료: 판매가 낮은(흔한) 것부터 소모
    let need = ing.quantity
    const candidates = out
      .filter((s) => itemMatches(itemById(s.itemId), ing.itemId))
      .sort((a, b) => (itemById(a.itemId)?.sellPrice ?? 0) - (itemById(b.itemId)?.sellPrice ?? 0))
    for (const c of candidates) {
      if (need <= 0) break
      const take = Math.min(need, c.qty)
      out = removeFromInventory(out, c.itemId, take)
      need -= take
    }
  }
  return out
}
