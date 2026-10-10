// ════════ 랜드마크 실내 5곳 — 아틀란티스 대성당 / 화산 성채 / 천공 대신전 / 버려진 신전 / 설원 성소 ════════
// 사용자 규칙(feedback-wall-furniture-iso-rules): 벽은 맵 끝선에 높게, 구조물·가구는 쿼터뷰 축 정합.
// 테마 참고(크롬 구글 이미지 검색, 2026-09-30):
//   아틀란티스 = 청록 수중 고딕 아치·산호 감긴 기둥·빛줄기 / 화산 = 흑요석 벽·용암 수로·단상 위 옥좌·화로
//   천공 = 흰 대리석 열주·금 장식·구름 / 폐허 = 이끼·덩굴·무너진 기둥·돌무더기 / 설원 = 얼음 결정 아치·오로라 창
// 공통 구도: 뒤쪽 단상(계단 1단) 위 중심 오브젝트, 좌우 열주가 신랑(身廊)을 만들고, 열주 바깥에 테마 수로.
import type { GameMap, MapId } from '@/lib/types'
import type { IsoPart, IsoStructGroup, IsoTex, PropDef, TileKind } from '@/lib/iso'
import { isoBox } from '@/lib/iso'
import { isoProp } from '@/lib/academy-hall'

type Blocker = { x0: number; y0: number; x1: number; y1: number }
type Spr = { s: string; w: number; h: number }
const L = '/images/map/landmark/'
const spr = (f: string, w: number, h: number): Spr => ({ s: L + f, w, h })
const sq = (f: string, cells = 1): IsoTex & { cells: number } => ({ src: L + f, w: 16, h: 16, cells })

export const LM_W = 28
export const LM_H = 30
const WALL_Z = 520
const DAIS = { x0: 8, x1: 20, y0: 0, y1: 6.5, z: 48 }
const COL_XS = [6, 22]
const COL_YS = [10, 15.5, 21, 26.5]
const COL_Z = 300

interface Theme {
  key: 'atlantis' | 'demon' | 'sky' | 'ruin' | 'aurora'
  tile: TileKind
  wall: IsoTex
  window: Spr
  /** 단상·기둥머리 색 */
  accent: string
  runner: IsoTex & { cells: number }
  channel: IsoTex & { cells: number }
  centerpiece: { sp: Spr; scale: number; r: number; label: string }
  statue: Spr
  lamp: Spr
  corner: Spr
  /** 좌우반전해 두 축 방향으로 배치할지(비대칭 가구) */
  flipSide?: boolean
}

const wall = (f: string): IsoTex => ({ src: L + f, w: 64, h: 64, scale: 1.5 })
export const THEMES: Record<Theme['key'], Theme> = {
  atlantis: {
    key: 'atlantis', tile: 'atlantis-cathedral', wall: wall('wall_atlantis.png'), window: spr('win_atlantis.png', 45, 156), accent: '#2e8c8a',
    runner: sq('run_atlantis.png', 1), channel: sq('ch_water.png', 1),
    centerpiece: { sp: spr('iso_clam_altar.png', 93, 89), scale: 1.3, r: 1.2, label: '진주 제단' },
    statue: spr('iso_coral.png', 68, 94), lamp: spr('iso_jelly_lamp.png', 43, 136), corner: spr('iso_coral.png', 68, 94),
  },
  demon: {
    key: 'demon', tile: 'demon-stone', wall: wall('wall_demon.png'), window: spr('win_demon.png', 48, 160), accent: '#5a1f16',
    runner: sq('run_demon.png', 1), channel: sq('ch_lava.png', 1),
    centerpiece: { sp: spr('iso_throne.png', 108, 129), scale: 1.35, r: 1.3, label: '화염 옥좌' },
    statue: spr('iso_gargoyle.png', 65, 106), lamp: spr('iso_lava_brazier.png', 51, 88), corner: spr('iso_gargoyle.png', 65, 106),
  },
  sky: {
    key: 'sky', tile: 'sky-marble', wall: wall('wall_sky.png'), window: spr('win_sky.png', 48, 160), accent: '#e9d9a0',
    runner: sq('run_sky.png', 1), channel: sq('ch_cloud.png', 1),
    centerpiece: { sp: spr('iso_sun_altar.png', 76, 109), scale: 1.35, r: 1.1, label: '빛의 제단' },
    statue: spr('iso_angel.png', 54, 110), lamp: spr('iso_cloud_brazier.png', 48, 92), corner: spr('iso_harp.png', 56, 89),
  },
  ruin: {
    key: 'ruin', tile: 'ruin-stone', wall: wall('wall_ruin.png'), window: spr('win_ruin.png', 48, 139), accent: '#5b5a4a',
    runner: sq('run_ruin.png', 1), channel: sq('ch_moss.png', 1),
    centerpiece: { sp: spr('iso_broken_altar.png', 108, 100), scale: 1.3, r: 1.2, label: '깨어진 제단' },
    statue: spr('iso_ruin_statue.png', 60, 114), lamp: spr('iso_ruin_brazier.png', 50, 79), corner: spr('iso_rubble.png', 98, 87),
  },
  aurora: {
    key: 'aurora', tile: 'aurora-stone', wall: wall('wall_aurora.png'), window: spr('win_aurora.png', 38, 153), accent: '#9fd8ea',
    runner: sq('run_aurora.png', 1), channel: sq('ch_ice.png', 1),
    centerpiece: { sp: spr('iso_ice_throne.png', 96, 112), scale: 1.3, r: 1.2, label: '오로라 제단' },
    statue: spr('iso_ice_fountain.png', 88, 97), lamp: spr('iso_ice_lamp.png', 36, 134), corner: spr('iso_ice_fountain.png', 88, 97),
  },
}

function build(t: Theme): { props: PropDef[]; structures: IsoStructGroup[]; blockers: Blocker[] } {
  // 벽 + 창(양 벽 전체 길이)
  const wallParts: IsoPart[] = [
    { kind: 'face', plane: 'y', at: 0, from: 0, to: LM_W, z0: 0, z1: WALL_Z, tex: t.wall },
    { kind: 'face', plane: 'x', at: 0, from: 0, to: LM_H, z0: 0, z1: WALL_Z, tex: t.wall, shade: 0.14 },
    { kind: 'face', plane: 'y', at: 0, from: 0, to: LM_W, z0: 0, z1: 12, fill: '#000', opacity: 0.35 },
    { kind: 'face', plane: 'x', at: 0, from: 0, to: LM_H, z0: 0, z1: 12, fill: '#000', opacity: 0.4 },
  ]
  const win = (plane: 'x' | 'y', at: number): Extract<IsoPart, { kind: 'face' }> => {
    const h = 260
    const wc = (h * (t.window.w / t.window.h)) / 32
    return { kind: 'face', plane, at: 0, from: at - wc / 2, to: at + wc / 2, z0: 150, z1: 150 + h, img: t.window.s }
  }
  for (let x = 3; x < LM_W - 1; x += 4) if (x < DAIS.x0 - 1 || x > DAIS.x1 + 1) wallParts.push(win('y', x))
  wallParts.push({ ...win('y', (DAIS.x0 + DAIS.x1) / 2), z0: 180, z1: 480, from: (DAIS.x0 + DAIS.x1) / 2 - 1.5, to: (DAIS.x0 + DAIS.x1) / 2 + 1.5 })
  for (let y = 4; y < LM_H - 1; y += 4) wallParts.push(win('x', y))

  // 열주 바깥 수로 + 신랑 러너(바닥 윗면)
  const floor: IsoPart[] = [
    { kind: 'top', x0: 2.2, y0: 8, x1: 4.4, y1: LM_H - 1, z: 0, tex: t.channel },
    { kind: 'top', x0: LM_W - 4.4, y0: 8, x1: LM_W - 2.2, y1: LM_H - 1, z: 0, tex: t.channel },
    { kind: 'top', x0: LM_W / 2 - 1.6, y0: DAIS.y1 + 1, x1: LM_W / 2 + 1.6, y1: LM_H, z: 0, tex: t.runner },
  ]
  // 단상 + 앞 계단 1단
  const dais: IsoStructGroup[] = [
    { id: `${t.key}-dais`, sortY: DAIS.x0 + DAIS.y0, parts: isoBox(DAIS.x0, DAIS.y0, DAIS.x1, DAIS.y1, 0, DAIS.z, { top: t.runner, side: t.wall }) },
    { id: `${t.key}-dais-step`, sortY: DAIS.x0 + 1 + DAIS.y1, parts: isoBox(DAIS.x0 + 1.5, DAIS.y1, DAIS.x1 - 1.5, DAIS.y1 + 0.8, 0, DAIS.z / 2, { top: t.runner, side: t.wall }) },
  ]
  // 열주 — 벽 텍스처 기둥 + 기둥머리
  const cols: IsoStructGroup[] = []
  for (const cx of COL_XS)
    for (const cy of COL_YS) {
      const k = 0.36
      cols.push({
        id: `${t.key}-col-${cx}-${cy}`,
        sortY: cx + cy,
        parts: [
          ...isoBox(cx - k, cy - k, cx + k, cy + k, 0, COL_Z, { side: t.wall, topFill: t.accent }),
          ...isoBox(cx - k - 0.15, cy - k - 0.15, cx + k + 0.15, cy + k + 0.15, COL_Z, COL_Z + 22, { sideFill: t.accent, topFill: t.accent }),
        ],
      })
    }

  const props: PropDef[] = [
    { ...isoProp(`${t.key}-center`, t.centerpiece.sp, LM_W / 2, 3.4, t.centerpiece.r, { scale: t.centerpiece.scale * 1.25, elev: DAIS.z }), label: t.centerpiece.label },
    isoProp(`${t.key}-lamp-dw`, t.lamp, DAIS.x0 + 0.7, 1.2, 0.3, { elev: DAIS.z }),
    isoProp(`${t.key}-lamp-de`, t.lamp, DAIS.x1 - 0.7, 1.2, 0.3, { elev: DAIS.z }),
    isoProp(`${t.key}-corner-w`, t.corner, 3, 3, 0.8),
    isoProp(`${t.key}-corner-e`, t.corner, LM_W - 3, 3, 0.8, { flip: true }),
    // 신랑 양옆 석상(기둥 사이, 안쪽을 향해)
    ...[12.75, 23.75].flatMap((y, i) => [
      isoProp(`${t.key}-statue-w${i}`, t.statue, COL_XS[0] + 1.6, y, 0.6),
      isoProp(`${t.key}-statue-e${i}`, t.statue, COL_XS[1] - 1.6, y, 0.6, { flip: true }),
    ]),
    // 단상 앞·입구 쪽 등불
    ...[[LM_W / 2 - 3, DAIS.y1 + 1.6], [LM_W / 2 + 3, DAIS.y1 + 1.6], [LM_W / 2 - 3, LM_H - 3], [LM_W / 2 + 3, LM_H - 3]].map(([x, y], i) => isoProp(`${t.key}-lamp${i}`, t.lamp, x, y, 0.3)),
  ].map((p) => (p.elev ? { ...p, solid: false } : p))

  const structures: IsoStructGroup[] = [
    { id: `${t.key}-walls`, back: 0, parts: wallParts },
    { id: `${t.key}-floor`, back: 5, parts: floor },
    ...dais,
    ...cols,
  ]
  const blockers: Blocker[] = [
    { x0: 0, y0: 0, x1: LM_W, y1: 0.5 },
    { x0: 0, y0: 0, x1: 0.5, y1: LM_H },
    { x0: LM_W - 0.3, y0: 0, x1: LM_W, y1: LM_H },
    { x0: 0, y0: LM_H - 0.3, x1: LM_W / 2 - 1.4, y1: LM_H },
    { x0: LM_W / 2 + 1.4, y0: LM_H - 0.3, x1: LM_W, y1: LM_H },
    { x0: DAIS.x0, y0: 0, x1: DAIS.x1, y1: DAIS.y1 + 0.8 }, // 단상(올라갈 수 없음)
    ...cols.map((g) => {
      const [cx, cy] = g.id.split('-').slice(-2).map(Number)
      return { x0: cx - 0.4, y0: cy - 0.4, x1: cx + 0.4, y1: cy + 0.4 }
    }),
  ]
  return { props, structures, blockers }
}

// ── 지하실(2026-10-10) — 랜드마크 아래의 작은 방. 벽은 같은 테마 텍스처를 어둡게, 가운데 러너 한 줄. ──
//    가구·유물은 lib/town-decor 의 목록으로 놓는다(관리자 오브젝트 편집으로 손볼 수 있게).
export const CRYPT_W = 16
export const CRYPT_H = 14
const CRYPT_WALL = 300
export const CRYPT_PAD_TOP = CRYPT_WALL + 60
export const CRYPT_SPAWN = { x: CRYPT_W / 2, y: CRYPT_H - 2 }
export const CRYPT_EXIT = { x: CRYPT_W / 2, y: CRYPT_H - 0.8 }
export function cryptRoom(key: Theme['key']) {
  const t = THEMES[key]
  const structures: IsoStructGroup[] = [
    {
      id: `${key}-crypt-walls`,
      back: 0,
      parts: [
        { kind: 'face', plane: 'y', at: 0, from: 0, to: CRYPT_W, z0: 0, z1: CRYPT_WALL, tex: t.wall, shade: 0.3 },
        { kind: 'face', plane: 'x', at: 0, from: 0, to: CRYPT_H, z0: 0, z1: CRYPT_WALL, tex: t.wall, shade: 0.42 },
        { kind: 'face', plane: 'y', at: 0, from: 0, to: CRYPT_W, z0: 0, z1: 12, fill: '#000', opacity: 0.4 },
        { kind: 'face', plane: 'x', at: 0, from: 0, to: CRYPT_H, z0: 0, z1: 12, fill: '#000', opacity: 0.45 },
      ],
    },
    { id: `${key}-crypt-floor`, back: 5, parts: [{ kind: 'top', x0: CRYPT_W / 2 - 1.2, y0: 2.5, x1: CRYPT_W / 2 + 1.2, y1: CRYPT_H, z: 0, tex: t.runner }] },
  ]
  const blockers: Blocker[] = [
    { x0: 0, y0: 0, x1: CRYPT_W, y1: 0.5 },
    { x0: 0, y0: 0, x1: 0.5, y1: CRYPT_H },
    { x0: CRYPT_W - 0.3, y0: 0, x1: CRYPT_W, y1: CRYPT_H },
    { x0: 0, y0: CRYPT_H - 0.3, x1: CRYPT_W / 2 - 1.4, y1: CRYPT_H },
    { x0: CRYPT_W / 2 + 1.4, y0: CRYPT_H - 0.3, x1: CRYPT_W, y1: CRYPT_H },
  ]
  return { structures, blockers, tileAt: (): TileKind => t.tile }
}

export const LANDMARK_PAD_TOP = WALL_Z + 60
export const LM_SPAWN = { x: LM_W / 2, y: LM_H - 2.2 }
export const LM_EXIT = { x: LM_W / 2, y: LM_H - 0.8 }
export function landmarkInterior(key: Theme['key']) {
  const t = THEMES[key]
  return { ...build(t), tileAt: (): TileKind => t.tile }
}
export type LandmarkKey = Theme['key']
export type { GameMap, MapId }
