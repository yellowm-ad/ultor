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
    howto: ['달려드는 물고기를 눌러(터치) 잡는다 — 갑판에 닿으면 미끄러진다', '「파도!」가 뜨면 스페이스바(또는 꽉 잡기 버튼)로 난간을 붙잡는다', '세 번 넘어지면 배가 항구로 되돌아간다'],
  },
  {
    id: 'spiral',
    toMap: 'stormhaven',
    title: '폭풍의 나선 계단',
    intro: '스톰헤이븐으로 오르는 길은 절벽을 감아 도는 나선 계단 하나뿐이다. 옛 방어 마법이 아직 살아 있다.',
    howto: ['바닥 가시 · 마법 함정 → 스페이스바(뛰어넘기)', '측면 가시 → A 또는 ←(몸을 틀어 피하기)', '굴러오는 돌 → S 또는 ↓(벽의 틈에 숨기)', '함정이 발밑 표시선에 닿을 때 누른다 — 세 번 맞으면 처음부터'],
  },
  {
    id: 'maze',
    toMap: 'temple-ruin',
    title: '무너진 회랑',
    intro: '버려진 신전으로 이어지는 회랑은 반쯤 무너져 미로가 되었다. 횃불이 꺼지기 전에 빛이 새어 드는 출구를 찾아야 한다.',
    howto: ['W·A·S·D 또는 방향키(화면 버튼)로 한 칸씩 움직인다', '횃불이 비추는 둘레만 보인다 — 지나온 길은 흐리게 남는다', '횃불이 다 타면 입구에서 다시 시작한다'],
  },
  {
    id: 'survival',
    toMap: 'snowfield',
    title: '설원 횡단',
    intro: '루미나 설원 어귀에서 오로라가 보이는 능선까지는 며칠 길이다. 갈림길마다 한 곳을 골라 나아가며 체온과 허기를 지켜야 한다.',
    howto: ['갈림길에서 다음 장소 하나를 고른다 — 캠프 · 사냥터 · 얼음 동굴 · 눈보라 길 …', '한 칸 나아갈 때마다 체온과 허기가 줄어든다', '체온이나 허기가 바닥나면 체력이 깎이고, 체력이 다하면 어귀로 되돌아간다'],
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

/** 아직 갈 수 없는 맵이면 그 이유(갈 수 있으면 null) */
export function mapLockReason(state: S, mapId: MapId): string | null {
  if (state.storyFlags.DEBUG_UNLOCK_ALL) return null
  const region = regionOfMap(mapId)
  const open = regionOpenWeek(region)
  if (state.calendar.globalWeek >= open) return null
  const info = calendarInfo(open)
  const arc = STORY_ARCS.find((a) => a.mainRegion === region && a.startWeek === open)
  return `${regionById(region).name} — 메인 스토리 「${arc?.name ?? ''}」(${info.year}학년 ${info.isVacation ? '방학' : '학기'} ${info.week}주차)부터 갈 수 있다.`
}
