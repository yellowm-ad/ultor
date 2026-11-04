// ============================================================================
// 마을 길드 전수 시험(2026-11-04) — 최상급(히든) 마법은 학교가 아니라 각 마을 길드에서만 얻는다
//
//   학교 수업으로 갈고닦을 수 있는 건 상급까지. 최상급은 길드 전수자의 시험을 통과해야 전수된다.
//     빛    — 울토르 마을 성역 대성당(village-guild)
//     어둠  — 버려진 폐허 · 수도자의 관리 건물(ruin-guild)
//     대지  — 스톰헤이븐 · 바람의 교단 회관(sky-guild)
//     얼음  — 루미나 설원 · 설인족 마을 회관(aurora-guild)
//     불꽃  — 화산지대 · 마물 회의관(demon-guild)
//   흐름: 레벨 MIN_LEVEL 이 되면 전수자가 시험을 꺼낸다 → 받기(trial:<el> = 1) → 지역 재료를 모아 바치기
//        → 완료(trial:<el> = 2, 플래그 GUILD_MASTER_<EL> 켜짐) → 그 속성 최상급 마법이 레벨 조건에 맞춰 습득된다.
//   스킬 쪽 습득 조건은 lib/mock-data(MASTER_REQ)가 이 플래그를 본다.
// ============================================================================
import type { GameState, PlayerElement } from '@/lib/types'

export const TRIAL_MIN_LEVEL = 40

export interface GuildTrial {
  el: PlayerElement
  /** 전수하는 곳(도감 소문 문구) */
  where: string
  /** 전수자 NPC(lib/mock-data GUILD_NPCS) */
  npcId: string
  title: string
  /** 완료 시 켜지는 플래그 — 최상급 마법 습득 조건 */
  flag: string
  items: { itemId: string; qty: number }[]
  /** 레벨이 모자랄 때 */
  early: string
  /** 시험을 꺼내는 대사 */
  offer: string
  /** 받은 뒤 떠올리게 하는 대사 */
  remind: string
  /** 완료 대사 */
  thanks: string
  /** 전수되는 최상급 마법 */
  skills: string[]
}

export const GUILD_TRIALS: GuildTrial[] = [
  {
    el: 'light', where: '울토르 마을 · 성역 대성당', npcId: 'npc-guild-light', title: '성광의 시험', flag: 'GUILD_MASTER_LIGHT',
    items: [{ itemId: 'mat-fairy-dust', qty: 6 }, { itemId: 'mat-ancient-heartwood', qty: 1 }],
    early: '빛의 마지막 장은 아직 네 그릇에 담기지 않는다. 더 자라서 오너라.',
    offer: '성역은 꺼진 숨을 다시 켜는 빛을 지켜 왔다. 요정 가루 여섯 줌과 고대목 심재 하나 — 숲의 숨을 모아 오면 대부활의 빛을 맡기마.',
    remind: '숲의 숨은 아직 모이지 않았구나.',
    thanks: '빛은 받은 만큼만 돌려준다. 이제 너는 쓰러진 이들을 다시 일으킬 수 있다.',
    skills: ['light-rebirth'],
  },
  {
    el: 'dark', where: '버려진 폐허 · 수도자의 관리 건물', npcId: 'npc-guild-dark', title: '그림자의 시험', flag: 'GUILD_MASTER_DARK',
    items: [{ itemId: 'mat-dark-ink', qty: 3 }, { itemId: 'mat-wraith-echo', qty: 4 }],
    early: '그림자는 약한 그릇을 먼저 삼킨다. 아직은 이르다.',
    offer: '수도자들은 금지된 장을 지키려고 여기 남았다. 흑마법 잉크 셋, 원귀의 잔향 넷. 죽은 자의 목소리를 견딜 수 있다는 증거를 가져와라.',
    remind: '잔향은 아직 네 귀에 닿지 않았다.',
    thanks: '죽음의 선고 — 함부로 내리지 마라. 내리는 순간 너도 그 무게를 진다.',
    skills: ['dark-sentence'],
  },
  {
    el: 'earth', where: '스톰헤이븐 · 바람의 교단 회관', npcId: 'npc-guild-earth', title: '반석의 시험', flag: 'GUILD_MASTER_EARTH',
    items: [{ itemId: 'mat-ash-fang', qty: 5 }, { itemId: 'mat-tide-essence', qty: 2 }],
    early: '폭풍 위에서 땅을 디디려면 다리가 더 단단해야 한다.',
    offer: '바람의 교단은 떠 있는 섬을 땅으로 붙들어 왔다. 잿빛 송곳니 다섯, 밀물 정수 둘 — 흔들리는 것들 속에서 버틴 흔적을 가져와라.',
    remind: '흔들림을 버틴 흔적이 아직 모자라다.',
    thanks: '이제 대지가 네 편이다. 하늘 위에서도.',
    skills: ['earth-master-1', 'earth-master-2'],
  },
  {
    el: 'ice', where: '오로라 마을 · 설인족 마을 회관', npcId: 'npc-guild-ice', title: '빙설의 시험', flag: 'GUILD_MASTER_ICE',
    items: [{ itemId: 'mat-frost-crystal', qty: 6 }],
    early: '설원의 끝을 보기엔 아직 몸이 덜 식었구나. 더 단련하고 오렴.',
    offer: '설인족은 녹지 않는 얼음의 노래를 기억한단다. 서리 결정 여섯 개 — 서리 망령이 품은 차가움을 모아 오면 그 노래를 가르쳐 주마.',
    remind: '서리 결정이 아직 덜 모였어. 손이 시려도 조금만 더.',
    thanks: '영겁의 얼음은 시간을 멈춘단다. 멈춘 틈에 무엇을 할지는 네 몫이야.',
    skills: ['ice-master-1', 'ice-master-2'],
  },
  {
    el: 'fire', where: '마물 마을 · 마물 회의관', npcId: 'npc-guild-fire', title: '멸화의 시험', flag: 'GUILD_MASTER_FIRE',
    items: [{ itemId: 'mat-flame-core', qty: 3 }, { itemId: 'mat-ember-shard', qty: 5 }],
    early: '인간. 그 불씨로는 화산이 웃는다. 더 키워서 와라.',
    offer: '마물 회의관은 태초의 불을 꺼뜨리지 않으려고 모인 자리다. 화염핵 셋과 잿불 조각 다섯 — 불을 다룰 줄 안다는 걸 손으로 증명해라.',
    remind: '아직 불이 모자라다. 화염 파수꾼들이 핵을 품고 있다.',
    thanks: '태초의 불꽃을 넘긴다. 인간에게 넘기는 건 처음이다 — 꺼뜨리지 마라.',
    skills: ['fire-master-1', 'fire-master-2'],
  },
]

export const trialByNpc = (npcId: string) => GUILD_TRIALS.find((t) => t.npcId === npcId)
export const trialByEl = (el: string) => GUILD_TRIALS.find((t) => t.el === el)
export const trialKey = (el: string) => `trial:${el}`
/** 최상급 마법 → 그 마법을 전수하는 시험 */
export const TRIAL_OF_SKILL = new Map(GUILD_TRIALS.flatMap((t) => t.skills.map((s) => [s, t] as const)))

export type TrialState = 'early' | 'offer' | 'asked' | 'done'
export function trialState(state: Pick<GameState, 'storyFlags' | 'player'>, t: GuildTrial): TrialState {
  const v = Number(state.storyFlags[trialKey(t.el)] ?? 0)
  if (v >= 2 || state.storyFlags[t.flag]) return 'done'
  if (v === 1) return 'asked'
  return state.player.level >= TRIAL_MIN_LEVEL ? 'offer' : 'early'
}
export function trialHave(state: Pick<GameState, 'inventory'>, t: GuildTrial) {
  return t.items.map((r) => ({ ...r, have: state.inventory.filter((s) => s.itemId === r.itemId).reduce((a, s) => a + s.qty, 0) }))
}
export const trialReady = (state: Pick<GameState, 'inventory'>, t: GuildTrial) => trialHave(state, t).every((r) => r.have >= r.qty)
