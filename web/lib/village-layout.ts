// ============================================================================
// 울토르 마을 북쪽 확장(2026-10-10) — 3×3 지구 위에 지구 한 줄(3칸)을 더 붙였다.
//   · 기존 배치 코드는 옛 좌표(52×40) 그대로 두고, 맵을 만들 때 전부 남쪽으로 VILLAGE_NORTH 칸 민다.
//   · 마을 좌표를 직접 적은 곳(NPC 자리·귀환 지점·옛 세이브 위치·관리자 편집 기록)도 같은 값으로 보정한다.
// ============================================================================

/** 북쪽에 늘어난 칸 수(셀) — 옛 마을 좌표 y 에 이만큼 더하면 지금 좌표 */
export const VILLAGE_NORTH = 13

/** 마을 배치 판 번호 — 세이브·관리자 편집 기록이 어느 좌표계로 적혔는지 구분(없으면 확장 전) */
export const VILLAGE_LAYOUT = 2

/** 확장 전부터 있던 마을 구역 — 이 구역 소속 NPC 자리는 옛 좌표로 적혀 있다 */
export const VILLAGE_BASE_ZONE_IDS = new Set([
  'z-magic-hall', 'z-quad', 'z-housing', 'z-dorm', 'z-plaza', 'z-park', 'z-shops', 'z-temple', 'z-farm', 'z-barracks',
])

/** 옛 마을 좌표 → 지금 좌표 */
export const villageShift = <T extends { x: number; y: number }>(c: T): T => ({ ...c, y: c.y + VILLAGE_NORTH })
