// ============================================================================
// 탐사 마법(2026-10-18) — 전투가 아니라 맵을 돌아다닐 때 쓰는 마법. 레벨이 오르면 하나씩 열린다.
//   순간이동(전체 지도) · 끌어오기(주변 채집물 원격 수확) · 질주(이동 속도) · 등불(어두운 곳 밝게) · 투명화(몬스터 무시)
//   지속형(질주·등불·투명화)은 GameState 의 …Until(Date.now 기준 ms)에 끝나는 시각을 적는다. 투명한 물약도 invisibleUntil 을 쓴다.
// 사용: 화면 오른쪽 아래 탐사 마법 줄(components/game/field-spell-bar) 또는 숫자 키 1~5. 처리: lib/game-state CAST_FIELD_SPELL
// ============================================================================

import type { GameState } from '@/lib/types'

export type FieldSpellId = 'teleport' | 'pull' | 'haste' | 'light' | 'vanish'

export interface FieldSpell {
  id: FieldSpellId
  name: string
  /** 배우는 레벨 */
  level: number
  mp: number
  /** 지속형이면 지속 시간(초) */
  sec?: number
  icon: string
  desc: string
}

export const FIELD_SPELLS: FieldSpell[] = [
  { id: 'teleport', name: '순간이동', level: 1, mp: 5, icon: '✦', desc: '한 번 가 본 곳으로 순간이동한다(전체 지도가 열린다).' },
  { id: 'pull', name: '끌어오기', level: 10, mp: 12, icon: '⟲', desc: '주변 6칸 안의 채집물을 마력으로 끌어와 한꺼번에 줍는다.' },
  { id: 'haste', name: '질주', level: 15, mp: 18, sec: 120, icon: '»', desc: '2분 동안 걷는 속도가 1.4배가 된다.' },
  { id: 'light', name: '등불', level: 20, mp: 12, sec: 180, icon: '☀', desc: '3분 동안 어두운 곳을 밝히고, 야생 곳곳에 숨은 룬 상자를 빛기둥으로 드러낸다.' },
  { id: 'vanish', name: '투명화', level: 30, mp: 40, sec: 120, icon: '◌', desc: '2분 동안 몸이 투명해진다. 몬스터가 알아채지 못하고, 닿아도 싸움이 붙지 않는다.' },
]
export const fieldSpellById = (id: FieldSpellId) => FIELD_SPELLS.find((s) => s.id === id)!

/** 끌어오기 범위(칸) */
export const PULL_RANGE = 6
/** 질주 배율 */
export const HASTE_MULT = 1.4

type Buffs = Pick<GameState, 'invisibleUntil' | 'hasteUntil' | 'lightUntil'>
export const isInvisible = (s: Buffs, now = Date.now()) => (s.invisibleUntil ?? 0) > now
export const isHasted = (s: Buffs, now = Date.now()) => (s.hasteUntil ?? 0) > now
export const isLit = (s: Buffs, now = Date.now()) => (s.lightUntil ?? 0) > now
