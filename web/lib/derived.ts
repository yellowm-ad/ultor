import type { PlayerCharacter, Stats } from '@/lib/types'
import { itemById } from '@/lib/mock-data'
import { gearOf, gearTotalBonus } from '@/lib/gear-enhance'

/** 장비 보정치(강화 단계 + 잠재력 포함)를 합산한 실효 스탯을 계산한다 */
export function getEffectiveStats(player: PlayerCharacter): Stats {
  const out: Stats = { ...player.stats }
  for (const itemId of Object.values(player.equipped)) {
    if (!itemId) continue
    const item = itemById(itemId)
    if (!item?.statBonus) continue
    const bonus = gearTotalBonus(item, gearOf(player.gear, itemId))
    ;(Object.keys(bonus) as (keyof Stats)[]).forEach((key) => {
      out[key] = (out[key] ?? 0) + (bonus[key] ?? 0)
    })
  }
  return out
}
