// ============================================================================
// 테마 마을 3종 설정 — 버려진 신전(ruin) · 오로라 마을(aurora) · 마물 마을(demon)
// 실제 배치 로직은 lib/town-builder.ts (아틀란티스/천공 신전과 같은 구조).
// ============================================================================
import { createTown, spr, type Spr } from '@/lib/town-builder'

const A = '/images/map/props/atlantis/'
const benches = {
  SE: spr(A + 'atl3_benchSE.png', 53, 57, 0.55, 1.25),
  NW: spr(A + 'atl3_benchNW.png', 55, 50, 0.55, 1.25),
  SW: spr(A + 'atl3_benchSW.png', 53, 57, 1.25, 0.55),
  NE: spr(A + 'atl3_benchNE.png', 55, 50, 1.25, 0.55),
}

// ═══════════════ 버려진 신전 ═══════════════
const R = '/images/map/props/templeruin/'
const ruinFloat1 = spr(R + 'rt_float1.png', 71, 106, 1.2)
const ruinFloat2 = spr(R + 'rt_float2.png', 84, 102, 1.2)
const ruin = createTown({
  id: 'ruin',
  tiles: { outside: 'ruin-mist', road: 'ruin-road', square: 'ruin-stone', garden: 'ruin-moss' },
  blockOutside: true,
  temple: spr(R + 'rt_cathedral.png', 280, 275, 4.3), // 쿼터뷰 입체 성당(이끼 받침) — 구 ruin_temple 은 정면 일러스트
  templeCy: 6.2,
  templeLabel: '버려진 신전',
  hall: spr(R + 'ruin_guild.png', 197, 224, 2.6),
  hallLabel: '수도자의 관리 건물',
  houses: [
    spr(R + 'rt_h0.png', 92, 116),
    spr(R + 'rt_h1.png', 96, 120),
    spr(R + 'rt_h2.png', 99, 122),
    spr(R + 'rt_h3.png', 104, 124),
    spr(R + 'rt_h4.png', 92, 96),
    spr(R + 'rt_tavern.png', 102, 107), // 선술집
    spr(R + 'ruin_shopB_new.png', 103, 121),
    spr(R + 'ruin_shopC_new.png', 96, 120),
    spr(R + 'ruin_shopD_new.png', 103, 120),
  ],
  stallA: spr(R + 'ruin_stallA.png', 71, 72, 1.0),
  stallB: spr(R + 'ruin_stallB.png', 70, 70, 1.0),
  centerFountain: spr(R + 'ruin_landmark.png', 81, 144, 1.2),
  centerFountainLabel: '보랏빛 수정 기념비',
  parkFountain: spr(R + 'rt_fountain.png', 100, 138, 1.5),
  parkFountainLabel: '메마른 분수',
  statue: spr(R + 'rt_statue.png', 58, 98, 0.7),
  stairs: spr(R + 'rt_stairs.png', 128, 97, 1.8),
  gtower: spr(R + 'rt_gtower.png', 84, 149, 1.2),
  crystals: spr(R + 'rt_crystals.png', 54, 60, 0.7),
  planter: spr(R + 'rt_planter.png', 43, 54, 0.6),
  patch: spr(R + 'rt_patch.png', 58, 38, 0.8),
  lamp: spr(R + 'ruin_lamp.png', 23, 83, 0.2),
  tree: spr(R + 'ruin_tree.png', 62, 97, 0.7),
  benches,
  rim: [spr(R + 'rt_mist.png', 80, 40, 0.9)],
  floats: [
    [ruinFloat1, 6, 11], [ruinFloat2, 58, 19], [ruinFloat1, 58, 43], [ruinFloat2, 5, 40], [ruinFloat1, 17, 3.6], [ruinFloat2, 49, 3.2],
    [ruinFloat1, 40, 55.0], [ruinFloat2, 22, 55.2], [ruinFloat2, 4, 24], [ruinFloat1, 59.5, 31], [ruinFloat1, 3, 51], [ruinFloat2, 61, 53],
  ] as [Spr, number, number][],
  seed: 20260921,
})

export const RUIN_TOWN_TILE_AT = ruin.tileAt
export const RUIN_TOWN_PROPS = ruin.props
export const RUIN_TOWN_BLOCKERS = ruin.blockers

// ═══════════════ 오로라 마을 ═══════════════
const U = '/images/map/props/aurora/'
const SK = '/images/map/props/skytemple/'
const cloudSm = spr(SK + 'sk2_cloudSm.png', 50, 33, 0.8)
const cloudBig = spr(SK + 'sk2_cloudBig.png', 116, 57, 1.4)
const floe = spr(U + 'au_float1.png', 78, 84, 1.2)
const aurora = createTown({
  id: 'aur',
  tiles: { outside: 'aurora-mist', road: 'aurora-road', square: 'aurora-stone', garden: 'aurora-snow' },
  blockOutside: true,
  temple: spr(U + 'aurora_temple_new.png', 297, 305, 4.2),
  templeCy: 6.6,
  templeLabel: '설원 성소',
  hall: spr(U + 'aurora_hall_new.png', 188, 194, 2.6),
  hallLabel: '설인족 마을 회관',
  houses: [
    spr(U + 'au_h0.png', 67, 69),
    spr(U + 'au_h1.png', 90, 111),
    spr(U + 'au_h2.png', 84, 85),
    spr(U + 'au_h3.png', 96, 97),
    spr(U + 'au_h4.png', 82, 89),
    spr(U + 'au_tavern.png', 105, 93), // 선술집
    spr(U + 'aurora_shopA_new.png', 107, 123),
    spr(U + 'aurora_shopB_new.png', 106, 116),
    spr(U + 'aurora_shopC_new.png', 97, 118),
  ],
  stallA: spr(U + 'aurora_stallA.png', 67, 67, 1.0),
  stallB: spr(U + 'aurora_stallB.png', 58, 58, 0.9),
  centerFountain: spr(U + 'aurora_landmark.png', 90, 102, 1.3),
  centerFountainLabel: '오로라 수정',
  parkFountain: spr(U + 'au_fountain.png', 78, 120, 1.2),
  parkFountainLabel: '얼어붙은 분수',
  statue: spr(U + 'au_statue.png', 66, 94, 0.8),
  stairs: spr(U + 'au_stairs.png', 124, 102, 1.8),
  gtower: spr(U + 'au_gtower.png', 88, 151, 1.2),
  crystals: spr(U + 'au_crystals.png', 58, 65, 0.7),
  planter: spr(U + 'au_planter.png', 41, 56, 0.6),
  patch: spr(U + 'au_patch.png', 56, 34, 0.8),
  lamp: spr(U + 'aurora_lamp.png', 19, 60, 0.2),
  tree: spr(U + 'aurora_tree.png', 46, 66, 0.6),
  benches,
  rim: [cloudSm, cloudBig, cloudSm],
  floats: [
    [floe, 6, 11], [floe, 58, 19], [floe, 58, 43], [floe, 5, 40], [floe, 17, 3.6], [floe, 49, 3.2], [floe, 40, 55.0], [floe, 22, 55.2],
    [floe, 4, 24], [floe, 59.5, 31], [floe, 3, 51], [floe, 61, 53],
  ] as [Spr, number, number][],
  seed: 20260922,
})

export const AUR_TOWN_TILE_AT = aurora.tileAt
export const AUR_TOWN_PROPS = aurora.props
export const AUR_TOWN_BLOCKERS = aurora.blockers

// ═══════════════ 마물 마을 ═══════════════
const D = '/images/map/props/demon/'
const smoke = spr(D + 'dm_smoke.png', 64, 46, 0.8)
const lavaFloat = spr(D + 'dm_float1.png', 82, 110, 1.2)
const lavaSpire = spr(D + 'dm_spire.png', 78, 112, 0.9)
const demon = createTown({
  id: 'dem',
  tiles: { outside: 'demon-lava', road: 'demon-road', square: 'demon-stone', garden: 'demon-ash' },
  blockOutside: true,
  temple: spr(D + 'demon_temple.png', 298, 301, 4.2),
  templeCy: 6.6,
  templeLabel: '화산 성채',
  hall: spr(D + 'demon_hall_new.png', 183, 196, 2.5),
  hallLabel: '마물 회의관',
  houses: [
    spr(D + 'dm_h0.png', 92, 107),
    spr(D + 'dm_h1.png', 96, 107),
    spr(D + 'dm_h2.png', 97, 117),
    spr(D + 'dm_h3.png', 100, 109),
    spr(D + 'dm_forge.png', 96, 113),
    spr(D + 'dm_tavern.png', 108, 120), // 선술집
    spr(D + 'demon_shopA_new.png', 102, 114),
    spr(D + 'demon_shopC_new.png', 107, 125),
    spr(D + 'demon_shopB_new.png', 79, 93),
  ],
  stallA: spr(D + 'demon_stallA.png', 64, 64, 1.0),
  stallB: spr(D + 'demon_stallB.png', 68, 69, 1.0),
  centerFountain: spr(D + 'demon_landmark.png', 126, 152, 1.8),
  centerFountainLabel: '용암 분수',
  parkFountain: spr(D + 'dm_fountain.png', 106, 130, 1.5),
  parkFountainLabel: '용암 우물',
  statue: spr(D + 'dm_statue.png', 57, 107, 0.7),
  stairs: spr(D + 'dm_stairs.png', 127, 100, 1.8),
  gtower: spr(D + 'dm_gtower.png', 92, 156, 1.2),
  crystals: spr(D + 'dm_crystals.png', 54, 56, 0.7),
  planter: spr(D + 'dm_planter.png', 40, 52, 0.6),
  // 2026-10-18 가독성 — 불 화분이 골목마다 29개라 화면 전체가 불꽃으로 번쩍여 NPC·길이 묻혔다. 흩뿌리는 건 버섯 덤불로
  scatterPlanter: spr('/images/map/props/demon/dem_mushrooms.png', 50, 54, 0.6),
  // 불 사발(dm_crystals) 38개도 — 광장·입구 장식만 남기고 골목엔 잉걸불 가시덤불
  scatterCrystals: spr(D + 'dem_thorn_bush.png', 45, 52, 0.6),
  patch: spr(D + 'dm_patch.png', 59, 37, 0.8),
  lamp: spr(D + 'demon_lamp.png', 28, 64, 0.2),
  tree: spr(D + 'demon_tree.png', 59, 76, 0.7),
  benches,
  rim: [smoke, smoke, lavaSpire],
  floats: [
    [lavaFloat, 6, 11], [lavaFloat, 58, 19], [lavaFloat, 58, 43], [lavaFloat, 5, 40], [lavaFloat, 17, 3.6], [lavaFloat, 49, 3.2],
    [lavaFloat, 40, 55.0], [lavaFloat, 22, 55.2], [lavaFloat, 4, 24], [lavaFloat, 59.5, 31], [lavaFloat, 3, 51], [lavaFloat, 61, 53],
  ] as [Spr, number, number][],
  seed: 20260923,
})

export const DEMON_TOWN_TILE_AT = demon.tileAt
export const DEMON_TOWN_PROPS = demon.props
export const DEMON_TOWN_BLOCKERS = demon.blockers
