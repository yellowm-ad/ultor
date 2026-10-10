// ============================================================================
// 마을 꾸미기 소품(2026-10-10) — 맵 꾸미기용 오브젝트(scripts/_pixellab/map-decor.txt 로 만든 210종)와
// 기존 프롭을 각 마을의 빈자리에 섞어 놓는다. 마을을 만드는 코드(lib/maps.ts · town-builder 등)는 건드리지 않고
// 여기 목록만 맵 props 뒤에 덧붙인다(lib/maps.ts 맨 끝 applyTownDecor).
//   · 한 줄 = [그림 이름(props/ 아래 경로), x, y, 옵션?]  — 좌표는 그 맵의 셀 좌표
//   · 관리자 오브젝트 편집으로 놓은 것과 같은 모양의 프롭이 된다(id 는 `dc-<그림>-<순번>` — 옮기기·지우기 가능)
//   · 미리보기: node --experimental-transform-types --import ./scripts/_ts-loader.mjs scripts/preview-map.mjs <mapId> out.png
// ============================================================================

import type { PropDef } from '@/lib/iso'
import { ISO_TILE_W } from '@/lib/iso'
import { PROP_CATALOG } from '@/lib/prop-catalog'

interface DecorOpt {
  /** 지나갈 수 있는가(기본: 폭 40px 이상이면 길막) */
  walk?: boolean
  /** 좌우 반전 그림(<이름>_f.png)이 없을 때 그림을 거울상으로 */
  mirror?: boolean
  /** 충돌·정렬 바닥 크기(셀) 직접 지정 */
  size?: number
  /** 바닥에 깔리는 것(러그·화단 바닥) — 항상 사람 뒤에 그린다 */
  flat?: boolean
}
export type DecorItem = [sprite: string, x: number, y: number, opt?: DecorOpt]

const CATALOG = new Map(PROP_CATALOG.map((c) => [c.src, c]))

/** 꾸미기 목록 → 프롭. 그림이 카탈로그에 없으면 건너뛴다(오타 방지용으로 콘솔에 알림) */
export function decorProps(items: DecorItem[]): PropDef[] {
  const count = new Map<string, number>()
  const out: PropDef[] = []
  for (const [name, x, y, opt = {}] of items) {
    const src = `/images/map/props/${name}.png`
    const it = CATALOG.get(src)
    if (!it) {
      console.warn('[town-decor] 그림 없음:', name)
      continue
    }
    const base = name.split('/').pop()!
    const n = count.get(base) ?? 0
    count.set(base, n + 1)
    const solid = opt.walk === undefined ? it.w >= 40 && !opt.flat : !opt.walk
    // 바닥 다이아몬드(폭 = 그림 폭)의 중심을 발밑으로 — 건물·좌대처럼 자기 바닥이 있는 그림이 칸 가운데에 앉는다
    const baseH = Math.min(it.h, it.w / 2)
    const fp = opt.size ?? Math.max(0.5, Math.round((it.w / ISO_TILE_W) * 0.8 * 2) / 2)
    out.push({
      id: `dc-${base}-${n}`,
      kind: solid ? 'statue' : 'bicycle',
      cell: { x, y },
      sprite: src,
      px: { w: it.w, h: it.h },
      anchor: { x: it.w / 2, y: it.h - baseH / 2 },
      radial: true,
      size: { w: fp, d: fp },
      solid,
      ...(opt.mirror ? { mirrorX: true } : {}),
      ...(opt.flat ? { backdrop: true } : {}),
    })
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// 마을별 꾸미기 목록
// ─────────────────────────────────────────────────────────────────────────────
const W: DecorOpt = { walk: true }

/** 울토르 마법학교 마을 (52×53 — 북쪽 띠 y2.5–13, 그 아래 옛 3×3 지구) */
const VILLAGE: DecorItem[] = [
  // ── 꽃길 장터 (x36–50, y2.5–13) — 우물 마당(43, 7.8)을 가게가 둘러쌈 ──
  ['village/vil_bakery', 38.4, 4.6],
  ['village/vil_florist', 41.8, 4.4],
  ['village/vil_bookshop', 45.2, 4.4],
  ['village/vil_potion', 48.4, 4.8],
  ['village/vil_smithy', 38.2, 11.2],
  ['village/vil_cafe_f', 48.2, 11.0],
  ['village/vil_well', 43.0, 7.8],
  ['village/vil_cart_flower', 40.6, 6.9],
  ['village/vil_cart_fruit_f', 45.5, 6.9],
  ['village/vil_stall_cloth', 40.4, 9.6],
  ['village/vil_bunting', 43.0, 5.9, W],
  ['village/vil_cafe_table', 46.0, 9.4],
  ['village/vil_cafe_table', 47.3, 8.5],
  ['village/vil_tree_blossom', 37.0, 7.6],
  ['village/vil_tree_blossom', 49.3, 8.0],
  ['village/vil_flowerbed', 40.6, 12.0],
  ['village/vil_flowerbed_f', 45.6, 12.0],
  ['village/vil_planter', 39.9, 5.6, W],
  ['village/vil_planter', 46.9, 5.5, W],
  ['village/vil_crates', 40.1, 10.9],
  ['village/vil_signpost', 36.6, 12.3, W],
  // ── 학교 정원 (x20–33, y2.5–13) ──
  ['village/vil_arch_rose', 26.5, 3.4, W],
  ['village/vil_arch_rose_f', 26.5, 12.2, W],
  ['village/vil_flowerbed', 22.2, 6.2],
  ['village/vil_flowerbed_f', 22.4, 9.6],
  ['village/vil_flowerbed', 31.4, 10.2],
  ['village/vil_tree_blossom', 24.0, 5.6],
  ['village/vil_tree_blossom', 29.0, 10.6],
  ['academy/wb_flowerbox', 24.6, 8.6],
  ['academy/wb_flowerbox_f', 28.4, 5.0],
  ['academy/wb_hedge_glass', 21.0, 8.0],
  ['academy/wb_hedge_glass', 32.2, 6.2],
  // ── 학교 북관 (x2.5–17, y2.5–13) ──
  ['academy/wb_owl_statue', 6.2, 10.4],
  ['village/vil_planter', 5.2, 6.4, W],
  ['village/vil_planter', 9.6, 6.2, W],
  ['village/vil_planter', 14.2, 6.4, W],
  // 관측대 — 안뜰 동쪽 잔디에 망원경과 지구본(옛 회색 성곽 탑 자리)
  ['academy/wb_telescope', 14.6, 9.4],
  ['academy/wb_globe', 15.8, 10.6],
  ['village/vil_signpost', 13.4, 10.2, W],
  ['village/vil_flowerbed', 5.0, 12.0],
  ['academy/ac_cafe', 12.4, 8.2],
  // ── 학교 본교 쿼드 (y15–26) ──
  ['village/vil_planter', 5.9, 20.4, W],
  ['village/vil_planter', 8.0, 20.4, W],
  ['village/vil_flowerbed', 11.0, 23.4],
  ['academy/ac_cafe', 11.6, 20.4],
  ['academy/wb_hedge_glass', 12.4, 25.2],
  // ── 중앙 대광장 (분수 26.5, 20.5) ──
  ['village/vil_cart_flower_f', 22.4, 23.6],
  ['village/vil_cart_fruit', 30.8, 17.2],
  ['village/vil_planter', 24.3, 18.3, W],
  ['village/vil_planter', 28.7, 18.3, W],
  ['village/vil_planter', 24.3, 22.7, W],
  ['village/vil_planter', 28.7, 22.7, W],
  ['village/vil_cafe_table', 30.4, 23.2],
  // ── 하우징 마을 (y15–26) ──
  ['village/vil_laundry', 39.8, 19.3],
  ['village/vil_laundry_f', 46.4, 19.2],
  ['village/vil_fence', 39.6, 24.2],
  ['village/vil_fence_f', 46.2, 24.4],
  ['village/vil_flowerbed', 41.6, 24.4],
  ['village/vil_flowerbed_f', 48.0, 24.0],
  ['village/vil_well', 44.6, 23.4],
  // ── 기숙사 마을 (y29–38) ──
  ['village/vil_laundry', 11.6, 30.4],
  ['village/vil_well', 11.2, 36.2],
  ['village/vil_cafe_table', 13.6, 35.6],
  ['village/vil_cafe_table', 15.0, 35.2],
  ['village/vil_flowerbed', 6.6, 32.2],
  ['village/vil_flowerbed_f', 6.6, 35.4],
  // ── 별빛 상점가 (y29–38) ──
  ['village/vil_bunting', 41.2, 33.5, W],
  ['village/vil_bunting_f', 48.6, 33.5, W],
  ['village/vil_crates', 44.0, 37.2],
  ['village/vil_wagon_f', 46.6, 37.0],
  ['village/vil_planter', 41.4, 31.2, W],
  ['village/vil_planter', 46.0, 31.2, W],
  // ── 햇살 농가 (y41–51) ──
  ['village/vil_scarecrow', 26.6, 48.0],
  // 농가 연못 낚시터(lib/activity-spots fish-village) · 경비대 훈련장(arc-village)
  ['temple_pond', 34.6, 50.4],
  ['village/vil_haystack', 31.6, 50.0],
  ['village/vil_haystack', 32.3, 46.2],
]

/** 오로라 마을 — scripts/scatter-decor.mjs 초안(길가 빈자리)에서 손본 것 */
const AURORA: DecorItem[] = [
  ['aurora/aur_house_a', 44.2, 39.2],
  ['aurora/aur_house_b_f', 45.2, 25.8],
  ['aurora/aur_house_c', 34.6, 28.6],
  ['aurora/aur_bakery', 51.2, 41.6],
  ['aurora/aur_fur_shop_f', 25.8, 39.2],
  ['aurora/aur_ice_smith', 35.4, 20],
  ['aurora/aur_teahouse_f', 43.4, 44.6],
  ['aurora/aur_sauna', 23.2, 42],
  ['aurora/aur_house_a_f', 12.8, 36.8],
  ['aurora/aur_house_c_f', 29.2, 25.8],
  ['aurora/aur_well', 35.2, 25.8],
  ['aurora/aur_sled', 35.4, 35.8],
  ['aurora/aur_ice_sculpture', 26.4, 35.2],
  ['aurora/aur_ice_arch', 32, 17.4, W], // 성소로 올라가는 길의 얼음 문(지나다닐 수 있다)
  ['aurora/aur_stall_soup', 32, 28.2],
  ['aurora/aur_fish_rack', 24.4, 36.6],
  ['aurora/aur_pine_big', 41.6, 36.8],
  ['aurora/aur_pine_lights', 26, 29.8],
  ['aurora/aur_pine_big', 54.2, 34.2],
  ['aurora/aur_pine_lights', 26.4, 23],
  ['aurora/aur_firepit', 14.2, 41.4],
  ['aurora/aur_fish_rack_f', 21.8, 50.2],
  ['aurora/aur_sled_f', 26.6, 44.6],
  ['aurora/aur_ice_sculpture_f', 37.8, 34.4],
  ['aurora/aur_stall_soup_f', 38, 23.6],
  ['aurora/aur_fence', 24.6, 18],
  ['aurora/aur_fence_f', 35.8, 47.2],
  ['aurora/aur_snowman', 24.4, 26.2],
  ['aurora/aur_snowman', 48.8, 36.4],
  ['aurora/aur_woodpile', 30.2, 28.2],
  ['aurora/aur_woodpile_f', 15.4, 44.4],
  ['aurora/aur_signpost', 29.2, 35.2],
  ['aurora/aur_crates', 45.4, 45.4],
  ['aurora/aur_crates', 32.2, 37],
  ['aurora/aur_bush', 29.6, 46.8],
  ['aurora/aur_bush', 48.6, 44.2],
  ['aurora/aur_bush', 48.6, 41.4],
  ['aurora/aur_lantern_post', 15.4, 36.2],
  ['aurora/aur_lantern_post', 44.2, 42.2],
  ['aurora/aur_lantern_post', 11.8, 20.8],
  ['aurora/aur_bench_fur', 23.6, 20.2],
  ['aurora/aur_bench_fur_f', 50.8, 20],
  ['aurora/aur_firepit', 44.8, 29.8],
  ['aurora/aur_signpost', 34.2, 37.2],
]

/** 마물 마을 — scripts/scatter-decor.mjs 초안(길가 빈자리)에서 손본 것 */
const DEMON: DecorItem[] = [
  ['demon/dem_house_a', 25.2, 36.8],
  ['demon/dem_house_b_f', 41.8, 48.6],
  ['demon/dem_house_c', 28.6, 36],
  ['demon/dem_alchemy', 37, 35.8],
  ['demon/dem_armory_f', 34.6, 18.4],
  ['demon/dem_butcher', 28.8, 26.6],
  ['demon/dem_tavern2_f', 19.8, 41.6],
  ['demon/dem_shrine', 34.4, 28.2],
  ['demon/dem_house_b', 14, 36.8],
  ['demon/dem_house_c_f', 10.6, 36.8],
  ['demon/dem_well', 45, 37.4],
  ['demon/dem_gate_arch', 32, 17.4, W], // 성채로 올라가는 길의 뿔 문
  ['demon/dem_gargoyle', 26.4, 23.8],
  ['demon/dem_gargoyle_f', 9.2, 34.6],
  ['demon/dem_stall_curio', 28, 21.2],
  ['demon/dem_wagon', 36.2, 25],
  ['demon/dem_tree_ember', 48.8, 36.4],
  ['demon/dem_tree_ember', 53.2, 29.6],
  ['demon/dem_tree_ember', 31.8, 37.2],
  ['demon/dem_lava_pool', 21.8, 50.2],
  ['demon/dem_lava_pool', 41.4, 41.6],
  ['demon/dem_fence', 21.8, 43.6],
  ['demon/dem_stall_curio_f', 45.2, 26],
  ['demon/dem_wagon_f', 22, 36.4],
  ['demon/dem_banner', 27.8, 47.6],
  ['demon/dem_banner', 48.6, 18.6],
  ['demon/dem_cage', 29.8, 47],
  ['demon/dem_cage', 49.2, 44.2],
  ['demon/dem_brazier', 26.4, 34.4],
  ['demon/dem_brazier', 45, 29.6],
  ['demon/dem_brazier', 34.6, 36.4],
  ['demon/dem_signpost', 37.8, 33.8],
  ['demon/dem_signpost', 44.6, 43.8],
  ['demon/dem_crates', 34.2, 46.4],
  ['demon/dem_crates', 37.8, 22.8],
  ['demon/dem_skull_pile', 49, 42.4],
  ['demon/dem_skull_pile', 52.4, 25],
  ['demon/dem_thorn_bush', 31.2, 46.4],
  ['demon/dem_thorn_bush', 11.6, 25.2],
  ['demon/dem_thorn_bush', 50.8, 20],
  ['demon/dem_mushrooms', 23.2, 25],
  ['demon/dem_mushrooms', 32.8, 46.6],
  ['demon/dem_anvil', 48.6, 28.4],
]

/** 천공 신전 — scripts/scatter-decor.mjs 초안(길가 빈자리)에서 손본 것 */
const SKY: DecorItem[] = [
  ['skytemple/sky_house_c', 36, 36],
  ['skytemple/sky_house_d_f', 30.6, 28.4],
  ['skytemple/sky_house_e', 28, 36],
  ['skytemple/sky_bakery', 37.8, 23],
  ['skytemple/sky_harp_shop_f', 44, 41.4],
  ['skytemple/sky_feather_shop', 44.4, 44.6],
  ['skytemple/sky_observatory', 36.6, 47.6],
  ['skytemple/sky_teahouse_f', 23.4, 20.2],
  ['skytemple/sky_house_d', 34.6, 25.4],
  ['skytemple/sky_house_e_f', 35.2, 20],
  ['skytemple/sky_well', 53.8, 34.2],
  ['skytemple/sky_arch', 32, 17.4, W], // 대신전으로 올라가는 길의 구름 문
  ['skytemple/sky_colonnade', 45.2, 29.6],
  ['skytemple/sky_colonnade_f', 23.8, 17.2],
  ['skytemple/sky_bell', 25.4, 29.8],
  ['skytemple/sky_tree_gold', 25.8, 34],
  ['skytemple/sky_tree_gold', 28, 47.6],
  ['skytemple/sky_tree_blossom', 24.2, 27.2],
  ['skytemple/sky_tree_blossom', 21.2, 44],
  ['skytemple/sky_balloon_cart', 13.8, 43.2],
  ['skytemple/sky_stall_fruit', 33.6, 37.2],
  ['skytemple/sky_statue_wing', 38.8, 37.2],
  ['skytemple/sky_flowerbed', 28.2, 21.2],
  ['skytemple/sky_flowerbed_f', 22.4, 37],
  ['skytemple/sky_hedge', 33.6, 28.2],
  ['skytemple/sky_stall_fruit_f', 50, 36.6],
  ['skytemple/sky_planter', 25.8, 22.4],
  ['skytemple/sky_planter', 14.8, 36],
  ['skytemple/sky_planter', 54, 28.8],
  ['skytemple/sky_planter', 35, 34],
  ['skytemple/sky_signpost', 15.4, 26.2],
  ['skytemple/sky_signpost', 48.6, 45.2],
  ['skytemple/sky_crates', 44.8, 37.2],
  ['skytemple/sky_crates', 49.8, 18],
  ['skytemple/sky_cloud_bench', 15.4, 34.4],
  ['skytemple/sky_cloud_bench_f', 14.8, 40.6],
  ['skytemple/sky_cloud_bench', 21.8, 50.2],
  ['skytemple/sky_wind_chime', 26.4, 24.2],
  ['skytemple/sky_wind_chime', 31.6, 37.6],
  ['skytemple/sky_sundial', 29, 34],
  ['skytemple/sky_balloon_cart_f', 9.2, 34.2],
]

/** 버려진 신전 — scripts/scatter-decor.mjs 초안(길가 빈자리)에서 손본 것 */
const RUIN: DecorItem[] = [
  ['templeruin/rui_house_a', 49.6, 41.6],
  ['templeruin/rui_house_b_f', 29.4, 28],
  ['templeruin/rui_house_c', 27.6, 34.8],
  ['templeruin/rui_relic_shop', 26.6, 23.2],
  ['templeruin/rui_scribe_f', 34.6, 18.4],
  ['templeruin/rui_herbalist', 14.6, 44.4],
  ['templeruin/rui_chapel', 37.2, 35.6],
  ['templeruin/rui_crypt_f', 37.6, 23.2],
  ['templeruin/rui_house_a_f', 45, 39.4],
  ['templeruin/rui_house_c_f', 26.6, 38],
  ['templeruin/rui_well', 10.8, 38.2],
  ['templeruin/rui_broken_arch', 32, 17.4, W], // 신전으로 올라가는 길의 무너진 문
  ['templeruin/rui_broken_arch_f', 25.2, 47.6],
  ['templeruin/rui_columns', 34, 28],
  ['templeruin/rui_columns', 24.2, 37],
  ['templeruin/rui_fallen_statue', 32.8, 46.8],
  ['templeruin/rui_tree_willow', 20, 37],
  ['templeruin/rui_tree_willow', 49.4, 44.2],
  ['templeruin/rui_tree_gnarled', 26.4, 30],
  ['templeruin/rui_tree_gnarled', 31.2, 37.2],
  ['templeruin/rui_altar_small', 49.8, 18],
  ['templeruin/rui_stall_candle', 24.6, 17.4],
  ['templeruin/rui_cart', 12.2, 36.4],
  ['templeruin/rui_stall_candle_f', 31.6, 24.8],
  ['templeruin/rui_signpost', 51.2, 20.6],
  ['templeruin/rui_signpost', 35, 30],
  ['templeruin/rui_crates', 33.2, 37],
  ['templeruin/rui_crates', 29.2, 46.8],
  ['templeruin/rui_tombstones', 54.4, 33.8],
  ['templeruin/rui_tombstones', 44.2, 34.4],
  ['templeruin/rui_tombstones', 19.4, 40.6],
  ['templeruin/rui_rune_stone', 40, 25],
  ['templeruin/rui_rune_stone', 32.6, 29],
  ['templeruin/rui_rune_stone', 29, 37],
  ['templeruin/rui_fence', 35.6, 48.8],
  ['templeruin/rui_fence_f', 28.8, 48.8],
  ['templeruin/rui_bush', 53.4, 28.8],
  ['templeruin/rui_bush', 24.6, 26.4],
  ['templeruin/rui_bush', 52, 25],
  ['templeruin/rui_mushroom_ring', 45.4, 30],
  ['templeruin/rui_mushroom_ring', 35, 37],
]

/** 아틀란티스 마을 — scripts/scatter-decor.mjs 초안(길가 빈자리)에서 손본 것 */
const ATLANTIS: DecorItem[] = [
  ['atlantis/atx_house_a', 34.4, 19.6],
  ['atlantis/atx_house_b_f', 26, 43],
  ['atlantis/atx_house_c', 37, 23.4],
  ['atlantis/atx_pearl_shop', 44.6, 41.8],
  ['atlantis/atx_fishmonger_f', 30.6, 28.4],
  ['atlantis/atx_dive_shop', 24.8, 18],
  ['atlantis/atx_teahouse', 26.8, 23.2],
  ['atlantis/atx_lighthouse', 52.5, 42],
  ['atlantis/atx_well', 45.8, 17.6],
  ['atlantis/atx_shell_arch', 14.2, 40.8],
  ['atlantis/atx_statue_mermaid', 23.6, 40.8],
  ['atlantis/atx_statue_seahorse_f', 49.4, 17.8],
  ['atlantis/atx_stall_shell', 27.4, 34],
  ['atlantis/atx_cart_ice', 22.6, 48.8],
  ['atlantis/atx_palm', 37, 41],
  ['atlantis/atx_palm', 18.8, 41],
  ['atlantis/atx_palm', 51.2, 20.8],
  ['atlantis/atx_seaweed_tree', 29, 25.8],
  ['atlantis/atx_seaweed_tree', 37, 29.8],
  ['atlantis/atx_net_rack', 51.2, 45.4],
  ['atlantis/atx_coral_big', 42.4, 48.8],
  ['atlantis/atx_coral_big', 24.8, 26.6],
  ['atlantis/atx_stall_shell_f', 33.8, 25.6],
  ['atlantis/atx_fence', 39.2, 41.2],
  ['atlantis/atx_fence_f', 21, 41.2],
  ['atlantis/atx_planter', 33.8, 46.6],
  ['atlantis/atx_planter', 44.2, 34.2],
  ['atlantis/atx_planter', 40.4, 25],
  ['atlantis/atx_coral_blue', 15.4, 28],
  ['atlantis/atx_coral_blue', 44, 25.2],
  ['atlantis/atx_coral_blue', 11.8, 20.6],
  ['atlantis/atx_signpost', 45, 27.8],
  ['atlantis/atx_signpost', 9, 33.8],
  ['atlantis/atx_anchor', 44.8, 39],
  ['atlantis/atx_anchor_f', 27.4, 47.4],
  ['atlantis/atx_treasure', 25, 29],
  ['atlantis/atx_bubble_lamp', 25.2, 47],
  ['atlantis/atx_bubble_lamp', 52.2, 26.4],
  ['atlantis/atx_bubble_lamp', 24, 20],
  ['atlantis/atx_cafe_table', 28.8, 47.4],
  ['atlantis/atx_cafe_table', 20.8, 25],
  ['atlantis/atx_cart_ice_f', 43.2, 44],
]

// ── 아카데미 실내 — 참고 이미지(위치브룩풍)의 전시 케이스·꽃 테이블·벤치·석상을 방마다 조금씩 ──
const FLAT: DecorOpt = { flat: true }

/** 마법학교 본관 중앙 홀 (40×36 — 분수 24,23.5 · 출입 24,35) */
const SCHOOL_HALL: DecorItem[] = [
  ['academy/wb_table_hydrangea', 21.0, 20.4],
  ['academy/wb_table_tulip', 27.0, 20.4],
  ['academy/wb_table_bouquet', 21.0, 26.6],
  ['academy/wb_table_tulip', 27.0, 26.6],
  ['academy/wb_bench_double', 12.6, 20.0],
  ['academy/wb_bench_double_f', 12.6, 26.0],
  ['academy/wb_case_potion', 18.0, 20.6],
  ['academy/wb_case_fossil_f', 30.0, 26.6],
  ['academy/wb_case_wide', 27.2, 31.8],
  ['academy/wb_candelabra', 21.6, 15.2, W],
  ['academy/wb_candelabra', 26.4, 15.2, W],
  ['academy/wb_potted_palm', 12.2, 13.8],
  ['academy/wb_potted_palm', 35.8, 13.8],
  ['academy/wb_notice', 20.4, 33.6],
  ['academy/wb_sofa_grey', 34.5, 24.0],
  ['academy/wb_lamp_orange', 36.2, 21.0, W],
  ['academy/wb_owl_statue', 28.4, 33.4],
]

/** 학교 도서관 (20×16) */
const ACADEMY_LIBRARY: DecorItem[] = [
  ['academy/wb_rug_round', 10.0, 8.4, FLAT],
  ['academy/wb_armchair', 7.6, 2.6],
  ['academy/wb_armchair_f', 12.4, 2.6],
  ['academy/wb_candelabra', 8.2, 8.2, W],
  ['academy/wb_candelabra', 11.8, 8.2, W],
  ['academy/wb_globe', 17.8, 8.4],
  ['academy/wb_catalog', 18.2, 11.8],
  ['academy/wb_book_stack', 7.4, 9.4, W],
  ['academy/wb_book_stack', 13.2, 12.0, W],
  ['academy/wb_potted_palm', 1.8, 14.6],
  ['academy/wb_potted_fern', 18.4, 14.6, W],
  ['academy/wb_lamp_orange', 2.6, 7.2, W],
]

/** 교장실 (15×13) */
const HEADMASTER_OFFICE: DecorItem[] = [
  ['academy/wb_armchair', 5.4, 9.0],
  ['academy/wb_armchair_f', 9.6, 9.0],
  ['academy/wb_clock', 13.6, 2.2],
  ['academy/wb_telescope', 13.2, 5.2],
  ['academy/wb_teatable', 3.6, 11.0],
  ['academy/wb_candelabra', 5.4, 2.2, W],
  ['academy/wb_candelabra', 9.6, 2.2, W],
  ['academy/wb_crystal_ball', 12.6, 9.2],
]

/** 회의실 (18×14) */
const COUNCIL_ROOM: DecorItem[] = [
  ['academy/wb_armor', 16.4, 2.4],
  ['academy/wb_trophy', 11.6, 1.8],
  ['academy/wb_bust', 16.4, 6.6],
  ['academy/wb_candelabra', 5.6, 11.8, W],
  ['academy/wb_candelabra', 12.4, 11.8, W],
  ['academy/wb_potted_palm', 16.6, 9.2],
]

/** 대강당 (24×20) */
const GRAND_AUDITORIUM: DecorItem[] = [
  ['academy/wb_piano', 20.6, 3.4],
  ['academy/wb_candelabra', 8.4, 5.8, W],
  ['academy/wb_candelabra', 15.6, 5.8, W],
  ['academy/wb_potted_palm', 1.8, 17.6],
  ['academy/wb_potted_palm', 22.2, 17.6],
  ['academy/wb_bust', 21.8, 11.0],
]

/** 3층 회랑 (46×10 — 남쪽 벽을 따라) */
const ACADEMY_3F: DecorItem[] = [
  ['academy/wb_armor', 12.5, 8.6],
  ['academy/wb_potted_tree', 20.0, 8.6],
  ['academy/wb_bust', 27.5, 8.6],
  ['academy/wb_case_crystal', 34.0, 8.6],
  ['academy/wb_potted_tree', 40.5, 8.6],
]

/** 실습실 (20×16) */
const PRACTICE_LAB: DecorItem[] = [
  ['academy/wb_shelf_potion', 8.0, 1.8],
  ['academy/wb_cauldron', 13.4, 13.2],
  ['academy/wb_crystal_ball', 18.2, 5.0],
  ['academy/wb_book_stack', 2.6, 13.6, W],
]

/** 아틀란티스 대성당 지하 벽화실 (16×14 — 북벽 앞에 네 장의 석판, 가운데 러너) */
const ATLANTIS_CRYPT: DecorItem[] = [
  // 네 장의 벽화 석판(희·노·애·락) — 북벽을 따라
  ['templeruin/rui_rune_stone', 3.6, 2.0],
  ['templeruin/rui_rune_stone', 6.4, 1.8],
  ['templeruin/rui_rune_stone', 9.6, 1.8],
  ['templeruin/rui_rune_stone', 12.4, 2.0],
  ['atlantis/atx_statue_mermaid', 8.0, 4.4],
  ['templeruin/rui_columns', 2.2, 6.4],
  ['templeruin/rui_columns', 13.8, 6.4],
  ['atlantis/atx_bubble_lamp', 5.4, 5.2, W],
  ['atlantis/atx_bubble_lamp', 10.6, 5.2, W],
  ['atlantis/atx_bubble_lamp', 5.4, 10.6, W],
  ['atlantis/atx_bubble_lamp', 10.6, 10.6, W],
  ['atlantis/atx_coral_blue', 2.0, 11.6],
  ['atlantis/atx_treasure', 13.6, 11.2],
  ['academy/wb_book_stack', 12.2, 4.0, W],
]

export const TOWN_DECOR: Record<string, DecorItem[]> = {
  'atlantis-crypt': ATLANTIS_CRYPT,
  village: VILLAGE,
  'aurora-village': AURORA,
  'demon-village': DEMON,
  'sky-temple': SKY,
  'temple-ruin': RUIN,
  atlantis: ATLANTIS,
  'school-hall': SCHOOL_HALL,
  'academy-library': ACADEMY_LIBRARY,
  'headmaster-office': HEADMASTER_OFFICE,
  'council-room': COUNCIL_ROOM,
  'grand-auditorium': GRAND_AUDITORIUM,
  'academy-3f': ACADEMY_3F,
  'practice-lab': PRACTICE_LAB,
}
