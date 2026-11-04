// ============================================================================
// 마을 길드관 실내 6곳(2026-11-04) — 각 마을의 '서브 랜드마크'
//
//   마을 건물        → 실내 맵
//   울토르 마을 성역 대성당(돔)        → village-guild
//   아틀란티스 마을 회관              → atlantis-guild
//   천공 신전 '바람의 교단 회관'       → sky-guild
//   버려진 신전 '수도자의 관리 건물'    → ruin-guild
//   오로라 마을 '설인족 마을 회관'      → aurora-guild
//   마물 마을 '마물 회의관'           → demon-guild
//
//   용도(앞으로 붙일 기능의 자리를 미리 잡아 둔 배치):
//     · 뒤 벽(북) 가운데 = 의뢰 접수대. 접수대 뒤 GUILD_SPOTS.clerk 자리는 비워 둠(접수원 NPC 자리)
//     · 왼쪽 벽(서) = 의뢰 게시판 두 장 — 주민 의뢰 받기/완료
//     · 오른쪽(동) 단상 = 마을 속성 전수 제단 — 마을 컨셉 스킬 배우기. GUILD_SPOTS.mentor = 전수자 NPC 자리
//     · 남서 = 휴게 공간, 남동 = 공훈 진열장
//   벽은 맵 끝선(x=0, y=0)에 높게, 가구는 쿼터뷰 축 정합(landmark-interiors 와 같은 규칙).
//   GameMap 조립(충돌·구역·문)은 lib/maps.ts(GUILD_MAPS)가 한다.
// ============================================================================

import type { MapId } from '@/lib/types'
import type { IsoPart, IsoStructGroup, IsoTex, PropDef, TileKind } from '@/lib/iso'
import { isoBox } from '@/lib/iso'
import { HALL_SPR, isoProp } from '@/lib/academy-hall'
import { ROOM_SPR } from '@/lib/academy-rooms'
import { THEMES } from '@/lib/landmark-interiors'

type Spr = { s: string; w: number; h: number }
type Blocker = { x0: number; y0: number; x1: number; y1: number }
const P = '/images/map/props/academy/'
const sp = (f: string, w: number, h: number, dir = P): Spr => ({ s: dir + f, w, h })

/** 공용 가구(학교 wb_* 세트) */
const W = {
  armchair: sp('wb_armchair.png', 49, 61),
  bookStack: sp('wb_book_stack.png', 32, 30),
  candelabra: sp('wb_candelabra.png', 36, 88),
  caseRelic: sp('wb_case_relic.png', 75, 89),
  caseCrystal: sp('wb_case_crystal.png', 68, 84),
  casePotion: sp('wb_case_potion.png', 78, 90),
  notice: sp('wb_notice.png', 50, 78),
  rugRed: sp('wb_rug_red.png', 95, 62),
  rugRound: sp('wb_rug_round.png', 107, 54),
  rugSquare: sp('wb_rug_square.png', 118, 70),
  shelfCrest: sp('wb_shelf_crest.png', 85, 115),
  shelfLow: sp('wb_shelf_low.png', 78, 73),
  teatable: sp('wb_teatable.png', 75, 54),
  trophy: sp('wb_trophy.png', 72, 104),
  pottedTree: sp('wb_potted_tree.png', 54, 84),
  fern: sp('wb_potted_fern.png', 34, 50),
  bust: sp('wb_bust.png', 33, 88),
  clock: sp('wb_clock.png', 30, 90),
  globe: sp('wb_globe.png', 40, 56),
  crystalBall: sp('wb_crystal_ball.png', 32, 52),
}
const H = HALL_SPR
const R = ROOM_SPR
const RT = '/images/map/props/templeruin/'

export type GuildKey = 'village' | 'atlantis' | 'sky' | 'ruin' | 'aurora' | 'demon'

export const GUILD_W = 22
export const GUILD_H = 20
const WALL_Z = 340
export const GUILD_PAD_TOP = WALL_Z + 60
export const GUILD_SPAWN = { x: GUILD_W / 2, y: GUILD_H - 2.2 }
export const GUILD_EXIT = { x: GUILD_W / 2, y: GUILD_H - 0.8 }
/** 오른쪽 전수 단상 */
const DAIS = { x0: 15.2, y0: 5.0, x1: 20.6, y1: 11.0, z: 34 }
/** 앞으로 NPC 를 세울 자리(접수원 · 속성 전수자) — 가구가 이 자리를 막지 않게 비워 둔다 */
export const GUILD_SPOTS = {
  clerk: { x: GUILD_W / 2, y: 1.9 },
  mentor: { x: DAIS.x0 - 0.9, y: (DAIS.y0 + DAIS.y1) / 2 },
  board: { x: 2.6, y: 7.6 },
}

interface GuildTheme {
  key: GuildKey
  id: MapId
  name: string
  desc: string
  bg: 'school' | 'atlantis' | 'temple' | 'aurora' | 'demon'
  tile: TileKind
  wall: IsoTex
  window: Spr
  /** 바닥 러너·단상 윗면 */
  runner: IsoTex & { cells: number }
  /** 단상 옆면·기둥머리 색 */
  accent: string
  /** 동쪽 벽을 따라 흐르는 테마 수로(없으면 생략) */
  channel?: IsoTex & { cells: number }
  altar: { sp: Spr; scale: number; r: number }
  altarLabel: string
  lamp: Spr
  statue: Spr
  /** 구석 장식(테마 소품) */
  corner: Spr
  plant: Spr
  ambientTone?: number
}

const LM = THEMES
const GUILDS: Record<GuildKey, GuildTheme> = {
  village: {
    key: 'village', id: 'village-guild', name: '성역 대성당 · 마을 길드',
    desc: '돔 대성당 안쪽의 마을 길드. 신관들이 주민의 부탁을 모아 학생 마법사에게 맡기고, 빛의 마법을 전수한다.',
    bg: 'school', tile: 'academy-light',
    wall: { src: P + 'wall_light.png', w: 64, h: 160, scale: 2.25 }, window: H.window,
    runner: LM.sky.runner, accent: '#e2cf8f',
    altar: { sp: R.lightAltar, scale: 1.05, r: 0.8 }, altarLabel: '성광 전수 제단',
    lamp: H.lamp, statue: W.bust, corner: H.plant, plant: W.pottedTree,
  },
  atlantis: {
    key: 'atlantis', id: 'atlantis-guild', name: '아틀란티스 마을 회관',
    desc: '해저 도시 주민들의 의뢰가 모이는 회관. 산호 기둥 사이로 물결 마법을 가르친다.',
    bg: 'atlantis', tile: 'atlantis-cathedral', wall: LM.atlantis.wall, window: LM.atlantis.window,
    runner: LM.atlantis.runner, accent: LM.atlantis.accent, channel: LM.atlantis.channel,
    altar: { sp: LM.atlantis.centerpiece.sp, scale: 1.3, r: 1.0 }, altarLabel: '조류 전수 제단',
    lamp: LM.atlantis.lamp, statue: LM.atlantis.statue, corner: LM.atlantis.corner, plant: W.fern,
  },
  sky: {
    key: 'sky', id: 'sky-guild', name: '바람의 교단 회관',
    desc: '바람을 읽는 사제들이 순례자의 부탁을 받아 주는 회관. 하프 소리 속에서 바람의 마법을 전한다.',
    bg: 'temple', tile: 'sky-marble', wall: LM.sky.wall, window: LM.sky.window,
    runner: LM.sky.runner, accent: LM.sky.accent, channel: LM.sky.channel,
    altar: { sp: LM.sky.centerpiece.sp, scale: 0.95, r: 0.9 }, altarLabel: '바람 전수 제단',
    lamp: LM.sky.lamp, statue: LM.sky.statue, corner: LM.sky.corner, plant: W.pottedTree,
  },
  ruin: {
    key: 'ruin', id: 'ruin-guild', name: '수도자의 관리 건물',
    desc: '유물을 지키는 수도자들의 관리 건물. 순례자에게 일을 맡기고, 보랏빛 수정 곁에서 그림자 마법을 가르친다.',
    bg: 'temple', tile: 'ruin-stone', wall: LM.ruin.wall, window: LM.ruin.window,
    runner: LM.ruin.runner, accent: '#6a4f86', channel: LM.ruin.channel,
    altar: { sp: R.darkAltar, scale: 1.1, r: 0.9 }, altarLabel: '그림자 전수 제단',
    lamp: LM.ruin.lamp, statue: LM.ruin.statue, corner: sp('rt_crystals.png', 54, 60, RT), plant: W.fern,
    ambientTone: 0.9,
  },
  aurora: {
    key: 'aurora', id: 'aurora-guild', name: '설인족 마을 회관',
    desc: '설인족 주민들의 의뢰가 걸리는 따뜻한 회관. 얼음 분수 옆 제단에서 빙설 마법을 배운다.',
    bg: 'aurora', tile: 'aurora-stone', wall: LM.aurora.wall, window: LM.aurora.window,
    runner: LM.aurora.runner, accent: LM.aurora.accent, channel: LM.aurora.channel,
    altar: { sp: R.iceAltar, scale: 1.1, r: 0.9 }, altarLabel: '빙설 전수 제단',
    lamp: LM.aurora.lamp, statue: R.iceCrystal, corner: LM.aurora.statue, plant: W.pottedTree,
  },
  demon: {
    key: 'demon', id: 'demon-guild', name: '마물 회의관',
    desc: '화산 마을 마물들이 모여 일을 나누는 회의관. 용암 수로 곁 제단에서 화염 마법을 전수한다.',
    bg: 'demon', tile: 'demon-stone', wall: LM.demon.wall, window: LM.demon.window,
    runner: LM.demon.runner, accent: LM.demon.accent, channel: LM.demon.channel,
    altar: { sp: R.fireAltar, scale: 1.05, r: 0.9 }, altarLabel: '화염 전수 제단',
    lamp: LM.demon.lamp, statue: LM.demon.statue, corner: LM.demon.statue, plant: W.fern,
    ambientTone: 0.92,
  },
}

/** 벽면 평면 장식(창·문·배너) */
function decal(plane: 'x' | 'y', at: number, hPx: number, z0: number, s: Spr): IsoPart {
  const wc = (hPx * (s.w / s.h)) / 32
  return { kind: 'face', plane, at: 0, from: at - wc / 2, to: at + wc / 2, z0, z1: z0 + hPx, img: s.s }
}
/** 바닥에 깔리는 것(러그) — 충돌 없이 사람 뒤에 */
const flat = (id: string, s: Spr, x: number, y: number, scale = 1): PropDef => ({ ...isoProp(id, s, x, y, 0.2, { scale, solid: false }), backdrop: true, backOrder: 0 })

function build(t: GuildTheme) {
  const w = GUILD_W
  const h = GUILD_H
  const cx = w / 2
  const k = t.key

  // ── 벽 + 창 ──
  const wallParts: IsoPart[] = [
    { kind: 'face', plane: 'y', at: 0, from: 0, to: w, z0: 0, z1: WALL_Z, tex: t.wall },
    { kind: 'face', plane: 'x', at: 0, from: 0, to: h, z0: 0, z1: WALL_Z, tex: t.wall, shade: 0.14 },
    { kind: 'face', plane: 'y', at: 0, from: 0, to: w, z0: 0, z1: 12, fill: '#000', opacity: 0.35 },
    { kind: 'face', plane: 'x', at: 0, from: 0, to: h, z0: 0, z1: 12, fill: '#000', opacity: 0.4 },
  ]
  // 북벽: 접수대 뒤(가운데)는 비우고 양옆 창 / 서벽: 게시판 위는 비우고 창
  for (const x of [2.6, 5.8, 16.2, 19.4]) wallParts.push(decal('y', x, 200, 100, t.window))
  for (const y of [12.4, 16.2]) wallParts.push(decal('x', y, 200, 100, t.window))
  // 접수대 뒤 벽 — 배너 둘
  wallParts.push(decal('y', cx - 1.6, 150, 150, H.banner), decal('y', cx + 1.6, 150, 150, H.banner))

  // ── 바닥: 입구→접수대 러너, 동쪽 수로, 전수 단상 ──
  const floor: IsoPart[] = [
    { kind: 'top', x0: cx - 1.4, y0: 5.4, x1: cx + 1.4, y1: h, z: 0, tex: t.runner },
  ]
  if (t.channel) floor.push({ kind: 'top', x0: w - 1.6, y0: 12.6, x1: w - 0.3, y1: h - 0.6, z: 0, tex: t.channel })
  const structures: IsoStructGroup[] = [
    { id: `${k}-guild-walls`, back: 0, parts: wallParts },
    { id: `${k}-guild-floor`, back: 5, parts: floor },
    { id: `${k}-guild-dais`, sortY: DAIS.x0 + DAIS.y0, parts: isoBox(DAIS.x0, DAIS.y0, DAIS.x1, DAIS.y1, 0, DAIS.z, { top: t.runner, sideFill: t.accent }) },
  ]

  const dz = DAIS.z
  const dcx = (DAIS.x0 + DAIS.x1) / 2
  const dcy = (DAIS.y0 + DAIS.y1) / 2
  const props: PropDef[] = [
    // ① 의뢰 접수대(북벽 가운데) + 뒤 선반
    { ...isoProp(`${k}-g-counter`, H.counter, cx, 3.4, 1.1, { scale: 1.15 }), label: '의뢰 접수대' },
    isoProp(`${k}-g-shelfL`, W.shelfCrest, cx - 4.0, 1.1, 0.7),
    isoProp(`${k}-g-shelfR`, R.bookcase, cx + 4.0, 1.2, 0.8),
    isoProp(`${k}-g-clock`, W.clock, cx - 2.4, 0.9, 0.3),

    // ② 의뢰 게시판(서벽) — 반전해 서벽에 붙임
    { ...isoProp(`${k}-g-board0`, R.board, 1.2, 6.0, 0.8, { flip: true }), label: '의뢰 게시판' },
    { ...isoProp(`${k}-g-board1`, W.notice, 1.0, 9.0, 0.4, { flip: true }), label: '완료 보고함' },
    isoProp(`${k}-g-books`, W.bookStack, 1.1, 10.6, 0.2),
    isoProp(`${k}-g-plantNW`, t.plant, 1.3, 1.4, 0.4),

    // ③ 마을 속성 전수 제단(동쪽 단상)
    { ...isoProp(`${k}-g-altar`, t.altar.sp, dcx + 0.4, dcy - 0.6, t.altar.r, { scale: t.altar.scale, elev: dz, solid: false }), label: t.altarLabel },
    isoProp(`${k}-g-dlamp0`, t.lamp, DAIS.x0 + 0.6, DAIS.y0 + 0.6, 0.3, { elev: dz, solid: false }),
    isoProp(`${k}-g-dlamp1`, t.lamp, DAIS.x0 + 0.6, DAIS.y1 - 0.6, 0.3, { elev: dz, solid: false }),
    isoProp(`${k}-g-statueNE`, t.statue, w - 1.5, 2.0, 0.6, { flip: true }),
    isoProp(`${k}-g-cornerNE`, t.corner, 17.8, 1.6, 0.6),

    // ④ 휴게 공간(남서)
    flat(`${k}-g-rug`, W.rugSquare, 4.6, 14.6, 1.1),
    isoProp(`${k}-g-tea`, W.teatable, 4.6, 14.6, 0.6),
    isoProp(`${k}-g-chairA`, W.armchair, 2.8, 14.6, 0.4, { flip: true }),
    isoProp(`${k}-g-chairB`, W.armchair, 4.6, 12.8, 0.4),
    isoProp(`${k}-g-plantSW`, t.plant, 1.3, h - 1.6, 0.4),
    isoProp(`${k}-g-cornerSW`, t.corner, 7.2, h - 1.6, 0.6),

    // ⑤ 공훈 진열장(남동) — 길드 등급·보상 진열 자리
    isoProp(`${k}-g-trophy`, W.trophy, 15.6, 15.2, 0.6),
    isoProp(`${k}-g-case0`, W.caseRelic, 17.8, 14.0, 0.6),
    isoProp(`${k}-g-case1`, W.caseCrystal, 15.6, 17.6, 0.6),
    isoProp(`${k}-g-plantSE`, t.plant, w - 3.0, h - 1.6, 0.4),

    // 입구 양옆 등불
    isoProp(`${k}-g-lampS0`, t.lamp, cx - 2.6, h - 2.2, 0.3),
    isoProp(`${k}-g-lampS1`, t.lamp, cx + 2.6, h - 2.2, 0.3),
  ]

  const blockers: Blocker[] = [
    { x0: 0, y0: 0, x1: w, y1: 0.5 },
    { x0: 0, y0: 0, x1: 0.5, y1: h },
    { x0: w - 0.3, y0: 0, x1: w, y1: h },
    { x0: 0, y0: h - 0.3, x1: cx - 1.4, y1: h },
    { x0: cx + 1.4, y0: h - 0.3, x1: w, y1: h },
    { x0: DAIS.x0, y0: DAIS.y0, x1: DAIS.x1, y1: DAIS.y1 }, // 단상(올라갈 수 없음)
    ...(t.channel ? [{ x0: w - 1.6, y0: 12.6, x1: w, y1: h - 0.6 }] : []),
  ]
  return { props, structures, blockers }
}

export interface GuildSpace {
  key: GuildKey
  id: MapId
  name: string
  desc: string
  bg: GuildTheme['bg']
  ambientTone?: number
  tileAt: (x: number, y: number) => TileKind
  props: PropDef[]
  structures: IsoStructGroup[]
  blockers: Blocker[]
}

export function guildSpace(key: GuildKey): GuildSpace {
  const t = GUILDS[key]
  return { key, id: t.id, name: t.name, desc: t.desc, bg: t.bg, ambientTone: t.ambientTone, tileAt: () => t.tile, ...build(t) }
}
export const GUILD_KEYS: GuildKey[] = ['village', 'atlantis', 'sky', 'ruin', 'aurora', 'demon']
