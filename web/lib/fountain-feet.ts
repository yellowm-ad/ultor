// ============================================================================
// 분수·연못 길막 보정(2026-11-04)
//
//   분수 그림은 정쿼터뷰(2:1)보다 위에서 내려다본 구도라, '그림 밑단 = 바닥 앞꼭짓점'으로 잡은 길막이
//   분수 앞쪽(화면 아래)으로 쏠려 있었다 — 뒤쪽 수반은 걸어 들어가고 앞의 빈 바닥에서 막힘.
//   여기에 그림마다 '수반(물받이) 바닥 중심'을 그림 픽셀로 재 둔 값을 두고(가장 넓은 가로줄 띠의 가운데),
//   maps.ts 가 분수 프롭에 collide + collideOffset 을 달아 길막을 다시 만든다.
//   길막이 프롭에 붙어 있으므로 관리자 편집기로 분수를 옮겨도 길막이 같이 따라간다.
//   측정: 스프라이트를 게임 표시 크기(px)로 줄인 뒤 알파>40 픽셀 기준.
// ============================================================================

export interface FountainFoot {
  /** 게임 표시 크기(px) — 프롭 px 와 다르면 적용하지 않는다 */
  pw: number
  ph: number
  /** 수반 바닥 중심(그림 좌상단 기준 px) */
  cx: number
  cy: number
  /** 길막 크기(셀) */
  w: number
  d: number
}

/** 파일 이름 → 수반 바닥 중심 · 길막 크기 */
export const FOUNTAIN_FEET: Record<string, FountainFoot> = {
  'atl_fountain_new.png': { pw: 113, ph: 143, cx: 56.2, cy: 105, w: 1.45, d: 1.45 },
  'atl3_octo.png': { pw: 120, ph: 160, cx: 59.5, cy: 120, w: 1.55, d: 1.55 },
  'sk2_fountainBig.png': { pw: 116, ph: 158, cx: 57.5, cy: 120.5, w: 1.5, d: 1.5 },
  'sky_fountain_new.png': { pw: 102, ph: 154, cx: 50.5, cy: 121.5, w: 1.3, d: 1.3 },
  'ruin_landmark.png': { pw: 81, ph: 144, cx: 40.4, cy: 115.5, w: 1.05, d: 1.05 },
  'rt_fountain.png': { pw: 100, ph: 138, cx: 49.4, cy: 101.5, w: 1.3, d: 1.3 },
  'aurora_landmark.png': { pw: 90, ph: 102, cx: 44.5, cy: 86, w: 1.15, d: 1.15 },
  'au_fountain.png': { pw: 78, ph: 120, cx: 38.5, cy: 96, w: 1.0, d: 1.0 },
  'demon_landmark.png': { pw: 126, ph: 152, cx: 62.4, cy: 114, w: 1.6, d: 1.6 },
  'dm_fountain.png': { pw: 106, ph: 130, cx: 52.2, cy: 98.5, w: 1.35, d: 1.35 },
  // 학교 본관 천사의 분수(0.9배 표시) — 앞 계단은 빼고 수반만
  'ac_fountain.png': { pw: 270, ph: 270, cx: 134.9, cy: 179.5, w: 3.5, d: 3.5 },
  // 성역 대성당 앞 연못 — 직사각 연못(앞꼭짓점 x=70 → x 방향 2.19 · y 방향 2.78 셀, 0.9배)
  'temple_pond.png': { pw: 160, ph: 96, cx: 79.6, cy: 55.2, w: 1.97, d: 2.5 },
}

/** 그림 기준 화면 오프셋(px) → 셀 오프셋 (iso 64×32) */
export function footOffset(f: FountainFoot, anchor: { x: number; y: number }): { x: number; y: number } {
  const dsx = f.cx - anchor.x
  const dsy = f.cy - anchor.y
  const a = dsx / 32 // x - y
  const b = dsy / 16 // x + y
  return { x: Math.round(((a + b) / 2) * 100) / 100, y: Math.round(((b - a) / 2) * 100) / 100 }
}
