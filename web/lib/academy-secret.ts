// ════════ 마법학교 숨겨진 통로 — 2층 서쪽 회랑 벽(옛 벤치 자리)에서 이어지는 복도 + 오망성 제단실 (2026-10-08) ════════
// 2층 회랑 y=17.5 서벽의 흰 반짝임에서 E → 이 맵. 남쪽 끝에서 들어와 좁은 복도를 지나 북쪽 제단실로.
// 제단실: 바닥 오망성 마법진(scripts/gen-secret-floor.mjs) + 한가운데 제단 + 다섯 꼭짓점 푸른 촛대.
//   · 한가운데 제단(SECRET_ALTAR)은 임시 — 스토리 확정 후 교체할 자리. id 'secret-altar' 하나만 바꾸면 된다.
// 사용자 규칙(feedback-wall-furniture-iso-rules): 벽은 맵 끝선(x=0, y=0)에 높게, 가구는 PixelLab 아이소 스프라이트.
import type { IsoPart, IsoStructGroup, PropDef, TileKind } from '@/lib/iso'
import { isoBox } from '@/lib/iso'
import { HALL_TEX as T, isoProp } from '@/lib/academy-hall'

type Blocker = { x0: number; y0: number; x1: number; y1: number }
type Spr = { s: string; w: number; h: number }

const D = '/images/map/academy/secret/'
const spr = (f: string, w: number, h: number): Spr => ({ s: D + f, w, h })
/** PixelLab(크롬 Objects, 가로등 스타일 레퍼런스) 생성 — 투명 여백 트림 후 저장 */
export const SECRET_SPR = {
  candelabra: spr('iso_candelabra.png', 49, 145),
  candelabra5: spr('iso_candelabra5.png', 83, 148),
  candles: spr('iso_candles.png', 85, 90),
  altar: spr('iso_altar.png', 112, 143),
}

// ── 치수 ──
export const SECRET_W = 18
export const SECRET_H = 30
const WALL_H = 380
export const SECRET_PAD_TOP = WALL_H + 80
/** 복도(남북) x 범위 · 제단실 앞선 y */
const COR = { x0: 7, x1: 11 }
const ROOM_Y = 14
/** 오망성 중심·반경(셀) — 바닥 그림과 촛대 위치가 같은 값을 쓴다 */
export const PENTA = { cx: 9, cy: 7, r: 5 }
const BLUE = '#5fb4ff'

/** 제단실은 앞쪽 두 모서리를 깎은 팔각형(복도 서벽에 가리는 남서 구석을 비움) */
const inRoom = (x: number, y: number) => y < ROOM_Y && y - 9 < 10 - Math.abs(x - 9)
const inCorridor = (x: number, y: number) => x > COR.x0 && x < COR.x1 && y >= ROOM_Y - 0.5
export const secretTileAt = (x: number, y: number): TileKind => (inRoom(x, y) || inCorridor(x, y) ? 'academy-dark' : 'academy-void')

/** 어두운 돌벽 — 홀 벽 텍스처를 눌러 쓰고 남색 그늘을 한 겹 */
function darkFace(plane: 'x' | 'y', from: number, to: number, z1: number, at = 0): IsoPart[] {
  return [
    { kind: 'face', plane, at, from, to, z0: 0, z1, tex: T.wall, shade: plane === 'x' ? 0.62 : 0.55 },
    { kind: 'face', plane, at, from, to, z0: 0, z1, fill: '#0b0e22', opacity: 0.38 },
    { kind: 'face', plane, at, from, to, z0: 0, z1: 12, fill: '#1c1712' },
  ]
}

/** 오망성 꼭짓점(화면 위쪽 = 셀 -x,-y 방향을 향함). k=0..4 */
export function pentaPoint(k: number, r = PENTA.r) {
  const a = ((225 + 72 * k) * Math.PI) / 180
  return { x: PENTA.cx + Math.cos(a) * r, y: PENTA.cy + Math.sin(a) * r }
}

export function buildSecretPassage(): { props: PropDef[]; structures: IsoStructGroup[]; blockers: Blocker[] } {
  const walls: IsoStructGroup = {
    id: 'secret-walls',
    back: 0,
    parts: [...darkFace('y', 0, SECRET_W, WALL_H), ...darkFace('x', 0, 10, WALL_H)],
  }
  // 복도 서벽(낮게 — 제단실 남서 구석을 덜 가리게) + 동쪽 낮은 턱
  const corridor: IsoStructGroup = {
    id: 'secret-corridor',
    back: 5,
    parts: [
      ...darkFace('x', ROOM_Y - 0.5, SECRET_H, 150, COR.x0),
      ...isoBox(COR.x1, ROOM_Y - 0.5, COR.x1 + 0.35, SECRET_H, 0, 22, { sideFill: '#2a2620', topFill: '#3a342c' }),
    ],
  }
  // 바닥 오망성 마법진 — 셀 좌표 정사각 이미지를 바닥에 눕힘
  const { cx, cy, r } = PENTA
  const R = r + 1.2
  const circle: IsoStructGroup = {
    id: 'secret-pentagram',
    back: -50,
    parts: [{ kind: 'top', x0: cx - R, y0: cy - R, x1: cx + R, y1: cy + R, z: 0, img: D + 'pentagram.png' }],
  }

  const S = SECRET_SPR
  const glow = (y: number, rr = 26) => ({ glow: { color: BLUE, y, r: rr } })
  const props: PropDef[] = [
    // 한가운데 제단 — 스토리 확정 전 임시(교체 자리)
    { ...isoProp('secret-altar', S.altar, cx, cy, 0.75, { scale: 0.85 }), label: '오망성 제단', ...glow(58, 34) },
  ]
  // 다섯 꼭짓점 — 푸른 촛대
  for (let k = 0; k < 5; k++) {
    const p = pentaPoint(k, r + 0.9)
    props.push({ ...isoProp(`secret-candle${k}`, S.candelabra, p.x, p.y, 0.4), ...glow(132) })
  }
  // 뒤쪽 벽 앞 큰 촛대 · 복도 입구와 복도 바닥 촛불
  ;[[2.4, 2.4], [15.6, 1.6], [1.6, 7.6]].forEach(([x, y], i) => props.push({ ...isoProp(`secret-candelabra${i}`, S.candelabra5, x, y, 0.5), ...glow(126, 32) }))
  ;[[COR.x0 + 0.6, ROOM_Y + 0.9], [COR.x1 - 0.6, ROOM_Y + 0.9], [COR.x0 + 0.6, 18.5], [COR.x1 - 0.6, 22.5], [COR.x0 + 0.6, 26.5]].forEach(([x, y], i) =>
    props.push({ ...isoProp(`secret-candles${i}`, S.candles, x, y, 0.4, { solid: false, scale: 0.6 }), ...glow(40, 20) }),
  )

  const blockers: Blocker[] = [
    { x0: 0, y0: 0, x1: SECRET_W, y1: 0.5 },
    { x0: 0, y0: 0, x1: 0.5, y1: ROOM_Y },
    { x0: SECRET_W - 0.4, y0: 0, x1: SECRET_W, y1: ROOM_Y },
    { x0: 0, y0: SECRET_H - 0.3, x1: SECRET_W, y1: SECRET_H },
    // 복도 양옆(어둠)
    { x0: 0, y0: ROOM_Y, x1: COR.x0 + 0.3, y1: SECRET_H },
    { x0: COR.x1 - 0.3, y0: ROOM_Y, x1: SECRET_W, y1: SECRET_H },
    // 제단실 깎인 앞 모서리(계단식 근사)
    { x0: 0, y0: 10, x1: 1.2, y1: ROOM_Y },
    { x0: 0, y0: 12, x1: 3.2, y1: ROOM_Y },
    { x0: SECRET_W - 1.2, y0: 10, x1: SECRET_W, y1: ROOM_Y },
    { x0: SECRET_W - 3.2, y0: 12, x1: SECRET_W, y1: ROOM_Y },
  ]
  return { props, structures: [walls, corridor, circle], blockers }
}

/** 들어온 자리(복도 남쪽 끝) · 나가는 타일 */
export const SECRET_SPAWN = { x: 9, y: SECRET_H - 2.2 }
export const SECRET_EXIT = { x: 9, y: SECRET_H - 0.8 }
/** 2층 회랑 쪽 입구 — 서벽 y=17.5(옛 벤치 자리) 앞 */
export const SECRET_DOOR_2F = { x: 1.3, y: 17.5 }
export const SECRET_RETURN_2F = { x: 2.6, y: 17.5 }
