// ============================================================================
// 지역 해금 · 첫 이동 연출(2026-10-10)
//
//   · 지역 해금 — 군 통문의 목적지는 메인 스토리가 그 지역에 닿은 주부터 열린다(lib/story STORY_ARCS 의 시작 주).
//     (주간 의뢰가 '이미 도달한 지역'만 내는 규칙 lib/quests reachedRegions 와 같은 기준)
//   · 첫 이동 연출 — 어떤 맵에 처음 들어갈 때 한 번, 그 길을 건너는 미니게임을 거친다. 통과하면
//     `passage:<id>` 플래그가 켜져 다시는 나오지 않는다. 화면은 components/game/passage-overlay.tsx.
//       voyage   해안 → 아틀란티스 : 함선 — 달려드는 물고기 잡기 + 큰 파도에 매달리기
//       spiral   → 스톰헤이븐      : 나선 계단 — 바닥 가시·측면 가시·구르는 돌·마법 함정 피하기
//       maze     → 버려진 신전      : 어두운 회랑 미로 빠져나가기
//       survival → 루미나 설원      : 캠프·사냥으로 체온과 허기를 지키며 설원을 건너는 갈림길 스테이지
//     화산지대는 미니게임 대신 장면 — 루스벨(찾았다면) 또는 미르엘의 도움으로 용암을 건넌다(lib/story PASSAGE_BEATS).
// ============================================================================

import type { GameState, MapId } from '@/lib/types'
import { calendarInfo } from '@/lib/calendar'
import { regionById, regionOfMap, type RegionId } from '@/lib/regions'
import { STORY_ARCS } from '@/lib/story'

export type PassageId = 'voyage' | 'spiral' | 'maze' | 'survival'

export interface PassageDef {
  id: PassageId
  /** 이 맵에 처음 들어갈 때 */
  toMap: MapId
  title: string
  /** 시작 화면 설명 */
  intro: string
  /** 조작 안내 */
  howto: string[]
}

export const PASSAGES: PassageDef[] = [
  {
    id: 'voyage',
    toMap: 'atlantis',
    title: '아틀란티스로 가는 배',
    intro: '해류사제가 보낸 큰 범선에 올랐다. 암초 해역을 지나는 동안 날치 떼가 갑판으로 달려들고, 집채만 한 파도가 배를 덮친다.',
    howto: ['범선은 저절로 앞으로 달린다 — 다가오는 장애물 위에 뜨는 키를 보고 피한다', '암초 · 큰 파도 · 크라켄 촉수 → 스페이스바(너울 타고 뛰어넘기, 길게 누르면 더 높이)', '돛 높이로 날아드는 날치 떼 → S 또는 ↓(누르고 있는 동안 돛을 내리고 엎드리기)', '공중의 금빛 물고기는 뛰어올라 낚아챈다', '네 번 부딪히면 배가 항구로 되돌아간다'],
  },
  {
    id: 'spiral',
    toMap: 'stormhaven',
    title: '폭풍의 나선 계단',
    intro: '스톰헤이븐으로 오르는 길은 절벽을 감아 도는 나선 계단 하나뿐이다. 옛 방어 마법이 아직 살아 있다.',
    howto: ['일행은 8층 탑을 저절로 오른다 — 함정 위에 뜨는 키를 보고 제때 누른다', '바닥 가시 · 마법 룬 → 스페이스바(뛰기)', '벽에서 튀어나오는 칼날 → S 또는 ↓(숙이기)', '위에서 굴러오는 바위 → W 또는 ↑(벽에 붙기)', '네 번 맞으면 탑 아래로 굴러떨어진다'],
  },
  {
    id: 'maze',
    toMap: 'temple-ruin',
    title: '무너진 회랑',
    intro: '버려진 신전으로 이어지는 회랑은 반쯤 무너져 미로가 되었다. 횃불이 꺼지기 전에 빛이 새어 드는 출구를 찾아야 한다.',
    howto: ['W·A·S·D 또는 방향키(누르고 있으면 계속 걷는다)로 회랑을 헤맨다 — 미로와 벽 모양은 올 때마다 바뀐다', '횃불이 비추는 둘레만 보이고, 횃불이 줄수록 시야가 좁아진다', '화로를 지나면 불을 옮겨 붙인다(+40초) · 보랏빛 그림자 도깨비불은 피한다', '빛이 새는 출구에 닿으면 통과 — 횃불이 다 타면 입구로 돌아간다'],
  },
  {
    id: 'survival',
    toMap: 'snowfield',
    title: '설원 횡단',
    intro: '루미나 설원 어귀에서 오로라가 보이는 능선까지는 며칠 길이다. 갈림길마다 한 곳을 골라 나아가며 체온과 허기를 지켜야 한다.',
    howto: ['설원 위를 직접 걸어 갈림길마다 다음 거점으로 간다 — ← ↑ →(A W D) 또는 거점을 누른다', '캠프 · 사냥터 · 얼음 동굴 · 눈보라 길 · 버려진 보급소 · 수상한 발자국 — 거점마다 일이 벌어진다', '걷는 동안 체온과 허기가 줄어든다. 바닥나면 체력이 깎이고, 체력이 다하면 어귀로 되돌아간다', '마지막 눈보라(체온 28 · 허기 16 필요)를 넘어 오로라 능선에 오르면 통과'],
  },
]

const BY_MAP = new Map(PASSAGES.map((p) => [p.toMap, p]))
export const passageById = (id: PassageId) => PASSAGES.find((p) => p.id === id)!
export const passageFlag = (id: PassageId) => `passage:${id}`

type S = Pick<GameState, 'storyFlags' | 'calendar'>

/** 이 맵으로 넘어갈 때 거쳐야 하는 첫 이동 연출(이미 통과했으면 null) */
export function passageFor(state: S, toMap: MapId): PassageDef | null {
  const p = BY_MAP.get(toMap)
  if (!p || state.storyFlags[passageFlag(p.id)] || state.storyFlags.DEBUG_UNLOCK_ALL) return null
  return p
}

/** 처음부터 열려 있는 지역 — 학교와 첫 실습지 */
const ALWAYS_OPEN: RegionId[] = ['ACADEMY', 'ERDIA', 'MORS']

/** 그 지역이 열리는 주(메인 스토리가 처음 닿는 주). 처음부터 열려 있으면 0 */
export function regionOpenWeek(region: RegionId): number {
  if (ALWAYS_OPEN.includes(region)) return 0
  const weeks = STORY_ARCS.filter((a) => a.mainRegion === region).map((a) => a.startWeek)
  return weeks.length ? Math.min(...weeks) : 0
}

/**
 * 임시 전체 개방(2026-10-10) — 맵 점검 동안 지역 잠금을 꺼 둔다. 점검이 끝나면 false 로 되돌리면
 * 다시 메인 스토리 진행에 따라 열린다.
 */
export const REGION_LOCK_OFF = true

/** 아직 갈 수 없는 맵이면 그 이유(갈 수 있으면 null) */
export function mapLockReason(state: S, mapId: MapId): string | null {
  if (REGION_LOCK_OFF || state.storyFlags.DEBUG_UNLOCK_ALL) return null
  const region = regionOfMap(mapId)
  const open = regionOpenWeek(region)
  if (state.calendar.globalWeek >= open) return null
  const info = calendarInfo(open)
  const arc = STORY_ARCS.find((a) => a.mainRegion === region && a.startWeek === open)
  return `${regionById(region).name} — 메인 스토리 「${arc?.name ?? ''}」(${info.year}학년 ${info.isVacation ? '방학' : '학기'} ${info.week}주차)부터 갈 수 있다.`
}
