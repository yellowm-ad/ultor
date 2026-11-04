// ============================================================================
// 흑룡 강림(2026-11-04) — EP07 '고목의 문장' 직후의 초반부 하이라이트
//
//   ① 고대목 골렘을 쓰러뜨리면 봉인이 흔들리고, 새어 나온 힘에 '로(怒)'의 기척이 반응한다.
//      그 기척을 쫓아 모르스의 오른팔 — 흑룡이 안개 늪지 북쪽에 내려앉는다(DRAGON_DESCENDED).
//      필드에서는 상반신이 맵을 덮는 크기로, 양 앞발로 땅을 짚은 채 숨을 고른다(components/game/colossus-field).
//   ② 가까이 다가가면 그대로 흑룡전 — 이길 수 없는 상대. DRAGON_ROUNDS 라운드를 버티면 전투가 중단된다
//      (BattleState.scripted — 패배·후송 없음). 전투 화면은 세븐나이츠식 거대 보스 구도(MonsterDef.colossal).
//   ③ 중단과 함께 DRAGON_FOUGHT → 스토리 장면 EP07_DRAGON_CLASH: 미르엘이 난입해 최상급 마법끼리 정면 충돌
//      (components/game/dragon-clash 연출) → 흑룡이 물러나고 DRAGON_CLASH_DONE. 일행은 '최상급'이 무엇인지 보고 여정을 떠난다.
// ============================================================================
import type { GameState, MapId } from '@/lib/types'
import { BLACK_DRAGON_ID } from '@/lib/constants'

export const DRAGON_FLAGS = {
  descended: 'DRAGON_DESCENDED',
  fought: 'DRAGON_FOUGHT',
  done: 'DRAGON_CLASH_DONE',
} as const

/** 흑룡이 내려앉는 맵 · 앞발이 땅을 짚는 자리(셀) */
export const DRAGON_MAP: MapId = 'swamp'
export const DRAGON_ANCHOR = { x: 6.5, y: 6.5 }
/** 필드 그림 배율(256px 프레임 → 맵을 덮는 크기). 늪지 맵은 padTop 을 넉넉히 줘서(lib/maps) 몸 위쪽이 맵 밖에서도 그려진다 */
export const DRAGON_FIELD_SCALE = 2.2
/** 이만큼 다가가면 전투 */
export const DRAGON_ENGAGE_R = 3.8
/** 버티면 전투가 중단되는 라운드 */
export const DRAGON_ROUNDS = 3

export function dragonOnMap(state: Pick<GameState, 'storyFlags' | 'currentMapId'>): boolean {
  const f = state.storyFlags
  return state.currentMapId === DRAGON_MAP && !!f[DRAGON_FLAGS.descended] && !f[DRAGON_FLAGS.fought]
}

export function dragonInReach(state: Pick<GameState, 'storyFlags' | 'currentMapId'>, x: number, y: number): boolean {
  return dragonOnMap(state) && Math.hypot(x - DRAGON_ANCHOR.x, y - DRAGON_ANCHOR.y) < DRAGON_ENGAGE_R
}

export { BLACK_DRAGON_ID }
