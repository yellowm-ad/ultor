// ============================================================================
// 학교 NPC + 파티 전투 프로필 (PRD v2.0 §2, §16~20 · 학사 PRD §63, §75)
//
//   예전 플레이어블 주인공 6인(남/녀 × 3원소 시트)은 더 이상 플레이어 캐릭터가 아니다.
//   이들은 울토르 학교 NPC(동기·선배·조교·교수)로 편입되었고, 외형·성격·말투는 그대로 유지한다.
//
//   전투: 주인공 + 학교 NPC 최대 3명 = 핵심 전투원 최대 4명(4대4). 0명(솔로)도 가능.
//   · 학교 NPC 는 npcCombatProfile 이 있어야 파티에 들어올 수 있다(없으면 전투 불가 — 순수 학교 NPC).
//   · 과거 플레이어블 속성을 그대로 상속하지 않는다 — 스킬은 프로필에 명시된 목록을 레벨에 따라 쓴다.
//   · 동료는 각자 레벨/경험치를 갖고, 전투 턴에는 플레이어가 직접 조작한다(설정에서 자동 전환 가능).
//   · 펫은 주인공만 데리고 다닌다(동료 고유 펫 없음).
//   · 진형 6칸 중 파티가 쓰고 남는 2칸은 임시 합류 NPC(GUEST_NPCS — 호위 대상·임시 동행) 자리.
//
// 합류 방식(2026-10-14 개편 — 처음엔 혼자, 직접 찾아가 말을 걸어 동료를 모은다). 화면에 등급은 드러내지 않는다.
//   · invite — 한 번 이야기를 나누면 대화 끝에 "같이 다닐래?"로 바로 합류
//   · favor  — 대화로 관계도가 오르면(주 1회 +2) 대화 중에 부탁(재료 가져다주기)을 꺼낸다 → 들어주면 합류 가능
//   · story  — 메인 스토리가 진행되면 합류(joinFlag)
// (2026-10-14) 학생 동료 "카엘"은 수업 조교 카엘(mock-data prof-kael)과 겹쳐 제거 — 카엘은 조교 한 명뿐
// ⚠ story 합류 시점은 임시값(스토리 문서에 동료 합류 시점이 아직 없음).
// ============================================================================

import type { Combatant, CompanionProgress, GameState, Gender, GuestMember, MapId, Position, SpriteSheet, Stats } from '@/lib/types'
import { computeStatsForLevel, MAX_PARTY_SIZE } from '@/lib/constants'
import { calendarInfo } from '@/lib/calendar'
import { flagOn } from '@/lib/story'

export type SchoolNpcRole = 'student' | 'professor' | 'story'

/** 전투가 가능한 학교 NPC 의 전투 설정 */
export interface NpcCombatProfile {
  /** 기본 스탯(PRD §15 공용 성장식)에 곱하는 성향 보정 */
  statMult?: Partial<Stats>
  /** 레벨이 오르면 쓸 수 있게 되는 스킬(속성 무관 — 명시 목록) */
  skills: { skillId: string; level: number }[]
  /** 처음 편성될 때의 포지션 */
  defaultPosition: Position
  /** 합류 시 레벨 — 생략하면 주인공 레벨에 맞춘다 */
  joinLevel?: number
}

export type JoinRule =
  | { kind: 'invite' }
  | {
      kind: 'favor'
      /** 이 관계도가 되면 부탁을 꺼낸다 */
      affinity: number
      itemId: string
      qty: number
      /** 부탁하는 말 · 받았을 때 말 */
      ask: string
      thanks: string
    }
  | { kind: 'story' }

export interface SchoolNpc {
  id: string
  name: string
  /** 학교 내 역할 한 줄(동기·선배·조교·교수) */
  title: string
  role: SchoolNpcRole
  gender: Gender
  personality: string
  /** 외형 — 4등신 도트 시트 키(예전 주인공 시트 hero-* 를 그대로 쓰거나, 리메이크 시트 npc-*) */
  sprite: SpriteSheet
  portrait: string
  /** 합류 가능 조건 */
  joinYear: number
  joinFlag?: string
  /** 합류 방식 — 생략하면 invite */
  join?: JoinRule
  /** 전투 프로필 — 없으면 파티에 들어올 수 없다 */
  combat?: NpcCombatProfile
  /** 파티 화면 대사(합류 전/후) — 스토리 작업 시 교체 */
  lines: { recruit: string; idle: string }
  /** 학교 안에서 머무는 방 — 매주 이 방 또는 로비(중앙 홀·2층 회랑) 중 한 곳에 서 있다(lib/school-roster) */
  homeRoom?: MapId
  /** 스토리상 자리를 비우는 구간 — from 플래그가 켜지면 파티에서 빠지고 학교에도 없다, until 플래그가 켜지면 돌아온다 */
  away?: { from: string; until?: string }
}

export const SCHOOL_NPCS: SchoolNpc[] = [
  // ── 동료 6인(옛 플레이어블 주인공 6인 — 남/여 × 화염·빙결·대지). 학교 NPC 와 별개의 동료 캐릭터 ──
  //    외형은 원래 주인공 4등신 시트(hero-*)를 그대로 쓴다. 합류 조건은 임시(1학년부터 파티 화면에서 합류).
  {
    id: 'comp-kyle',
    join: { kind: 'invite' },
    name: '카일',
    title: '화염 동료 · 돌격 딜러',
    role: 'student',
    gender: 'male',
    personality: '열정적이고 승부욕이 강하다. 위기일수록 더 뜨겁게 타오르는 타입.',
    sprite: 'hero-fire-male',
    portrait: '/images/portraits/hero-fire-male.png',
    joinYear: 1,
    combat: {
      statMult: { atk: 1.15, matk: 1.1, def: 0.92 },
      defaultPosition: 'front',
      skills: [
        { skillId: 'fire-basic-1', level: 1 },
        { skillId: 'fire-basic-2', level: 5 },
        { skillId: 'fire-basic-3', level: 10 },
        { skillId: 'fire-adv-1', level: 18 },
        { skillId: 'fire-adv-3', level: 28 },
        { skillId: 'n-laststand', level: 36 },
        { skillId: 'fire-high-2', level: 50 },
        { skillId: 'fire-master-1', level: 76 },
      ],
    },
    lines: { recruit: '불꽃이 필요하면 불러. 앞장서는 건 내 전문이니까!', idle: '오늘은 몇 마리나 쓰러뜨릴 수 있을까.' },
    homeRoom: 'class-fire',
  },
  {
    id: 'comp-rusbel',
    join: { kind: 'story' },
    joinFlag: 'beat:EP_12_END', // 임시 — EP04 결말 뒤
    name: '루스벨',
    title: '화염 동료 · 광역 마법',
    role: 'student',
    gender: 'female',
    // v3.0: 루스벨 = 폐허된 신전 편 최종보스('로(怒)'의 숙주). 3학년 2학기 폭주(RUSPELL_ENRAGED) 후 도주 → 설원에서 찾으면(RUSPELL_FOUND) 복귀
    personality: '자신감 넘치고 화끈한 성격. 지는 걸 무엇보다 싫어한다.',
    sprite: 'hero-fire-female',
    portrait: '/images/portraits/hero-fire-female.png',
    joinYear: 1,
    combat: {
      statMult: { matk: 1.2, maxMp: 1.1, maxHp: 0.9 },
      defaultPosition: 'rear',
      skills: [
        { skillId: 'fire-basic-1', level: 1 },
        { skillId: 'fire-basic-3', level: 6 },
        { skillId: 'fire-adv-2', level: 14 },
        { skillId: 'fire-adv-4', level: 24 },
        { skillId: 'fire-high-1', level: 40 },
        { skillId: 'fire-high-2', level: 52 },
        { skillId: 'fire-master-2', level: 80 },
      ],
    },
    lines: { recruit: '내 화염 마법, 옆에서 똑똑히 봐 둬.', idle: '이번 시험도 1등은 내 거야.' },
    homeRoom: 'class-fire',
    away: { from: 'RUSPELL_ENRAGED', until: 'RUSPELL_FOUND' },
  },
  {
    id: 'comp-jade',
    join: { kind: 'favor', affinity: 4, itemId: 'crystal-mana', qty: 1, ask: '계산을 끝내려면 마력 결정이 하나 필요해. 구해 오면… 네 효율도 인정해 주지.', thanks: '정확히 하나. 좋아, 너와 같이 가는 편이 효율적이라는 결론이야.' },
    name: '제이드',
    title: '빙결 동료 · 제어형',
    role: 'student',
    gender: 'male',
    personality: '말수가 적고 냉철하다. 전황을 읽고 적의 발을 묶는 데 능하다.',
    sprite: 'hero-ice-male',
    portrait: '/images/portraits/hero-ice-male.png',
    joinYear: 1,
    combat: {
      statMult: { matk: 1.1, spd: 1.1, maxHp: 0.95 },
      defaultPosition: 'support',
      skills: [
        { skillId: 'ice-basic-1', level: 1 },
        { skillId: 'ice-basic-2', level: 5 },
        { skillId: 'ice-basic-3', level: 10 },
        { skillId: 'ice-adv-1', level: 18 },
        { skillId: 'ice-adv-3', level: 30 },
        { skillId: 'ice-high-1', level: 46 },
        { skillId: 'ice-master-1', level: 76 },
      ],
    },
    lines: { recruit: '…계산은 끝났어. 같이 가는 편이 효율적이야.', idle: '감정적으로 움직이면 진다.' },
    homeRoom: 'class-ice',
  },
  {
    id: 'comp-lucia',
    join: { kind: 'favor', affinity: 4, itemId: 'flower-dew', qty: 3, ask: '차에 넣을 이슬꽃이 떨어졌어. 3송이만 부탁해도 될까? 대신 맛있게 끓여 줄게.', thanks: '향이 좋다… 고마워. 다치면 바로 말해 줘, 이제 내가 뒤를 받칠게.' },
    name: '루시아',
    title: '빙결 동료 · 후방 지원',
    role: 'student',
    gender: 'female',
    personality: '침착하고 다정하다. 동료의 상태를 먼저 살피는 세심한 성격.',
    sprite: 'hero-ice-female',
    portrait: '/images/portraits/hero-ice-female.png',
    joinYear: 1,
    combat: {
      statMult: { mdef: 1.15, matk: 1.05, atk: 0.85 },
      defaultPosition: 'rear',
      skills: [
        { skillId: 'ice-basic-1', level: 1 },
        { skillId: 'n-firstaid', level: 4 },
        { skillId: 'ice-basic-3', level: 10 },
        { skillId: 'light-heal', level: 16 },
        { skillId: 'ice-adv-2', level: 24 },
        { skillId: 'ice-high-2', level: 48 },
        { skillId: 'ice-master-2', level: 80 },
      ],
    },
    lines: { recruit: '다치면 바로 말해 줘. 내가 뒤를 받칠게.', idle: '차 한 잔 하고 갈래?' },
    homeRoom: 'class-ice',
  },
  {
    id: 'comp-chris',
    join: { kind: 'invite' },
    name: '크리스',
    title: '대지 동료 · 방어형',
    role: 'student',
    gender: 'male',
    personality: '우직하고 듬직하다. 말보다 행동으로 동료를 지킨다.',
    sprite: 'hero-earth-male',
    portrait: '/images/portraits/hero-earth-male.png',
    joinYear: 1,
    combat: {
      statMult: { maxHp: 1.2, def: 1.2, spd: 0.9 },
      defaultPosition: 'front',
      skills: [
        { skillId: 'earth-basic-1', level: 1 },
        { skillId: 'earth-basic-2', level: 5 },
        { skillId: 'earth-basic-3', level: 12 },
        { skillId: 'earth-adv-1', level: 20 },
        { skillId: 'earth-adv-3', level: 32 },
        { skillId: 'earth-high-1', level: 50 },
        { skillId: 'earth-master-1', level: 76 },
      ],
    },
    lines: { recruit: '방패가 필요하면 나를 세워.', idle: '배고프다… 식당 들렀다 갈까?' },
    homeRoom: 'class-earth',
  },
  {
    id: 'comp-jane',
    join: { kind: 'invite' },
    name: '제인',
    title: '대지 동료 · 버퍼',
    role: 'student',
    gender: 'female',
    personality: '온화하지만 심지가 굳다. 한번 정한 목표는 끝까지 밀어붙인다.',
    sprite: 'hero-earth-female',
    portrait: '/images/portraits/hero-earth-female.png',
    joinYear: 1,
    combat: {
      statMult: { matk: 1.1, mdef: 1.1, atk: 0.9 },
      defaultPosition: 'support',
      skills: [
        { skillId: 'earth-basic-1', level: 1 },
        { skillId: 'n-firstaid', level: 3 },
        { skillId: 'earth-basic-3', level: 10 },
        { skillId: 'earth-adv-2', level: 18 },
        { skillId: 'light-bulwark', level: 30 },
        { skillId: 'earth-high-2', level: 50 },
        { skillId: 'earth-master-2', level: 80 },
      ],
    },
    lines: { recruit: '같이 가자. 흙은 언제나 우리 편이야.', idle: '약초는 뿌리째 뽑으면 안 돼.' },
    homeRoom: 'class-earth',
  },
  // ── 학교 NPC(동기·선배·조교·교수) ──
  //    전원 삼면도 기반 전용 PixelLab 도트(npc-*) — 2026-10-02
  {
    id: 'comp-rian',
    join: { kind: 'favor', affinity: 4, itemId: 'hunt-meat', qty: 3, ask: '저기… 부탁 하나만 해도 돼? 다음 실습 전에 고기 꼬치 연습을 하고 싶은데, 짐승 고기 3개만 구해다 줄래?', thanks: '진짜 구해 왔어?! 고마워! 이번엔 내가 앞장설게. 같이 다니자!' },
    name: '리안',
    title: '1학년 동기 · 돌격형',
    role: 'student',
    gender: 'male',
    personality: '앞뒤 재지 않고 먼저 뛰어드는 저돌적인 성격. 한번 불붙으면 좀처럼 물러서지 않는다.',
    sprite: 'npc-rian', // 2026-10-02 삼면도 기반 PixelLab 도트
    portrait: '/images/npc/portrait-npc-rian.png',
    joinYear: 1,
    combat: {
      statMult: { atk: 1.15, matk: 1.1, def: 0.9 },
      defaultPosition: 'front',
      skills: [
        { skillId: 'fire-basic-1', level: 1 },
        { skillId: 'earth-basic-1', level: 3 },
        { skillId: 'fire-basic-3', level: 8 },
        { skillId: 'fire-adv-1', level: 16 },
        { skillId: 'fire-adv-2', level: 26 },
        { skillId: 'n-laststand', level: 34 },
        { skillId: 'fire-high-2', level: 48 },
        { skillId: 'fire-high-1', level: 58 },
        { skillId: 'fire-master-1', level: 75 },
      ],
    },
    lines: { recruit: '같은 반이지? 숲 실습 같이 가자. 앞은 내가 맡을게!', idle: '다음엔 더 센 놈이랑 붙어 보고 싶은데.' },
    homeRoom: 'class-fire',
  },
  {
    id: 'comp-sella',
    join: { kind: 'favor', affinity: 4, itemId: 'herb-moonleaf', qty: 3, ask: '…달잎풀이 모자라. 3장이면 돼. 숲 그늘에 핀다던데, 혹시 지나가면.', thanks: '…고마워. 빚은 갚을게. 다음 원정엔 내가 적 발을 묶어 둘게.' },
    name: '셀라',
    title: '1학년 동기 · 제어형',
    role: 'student',
    gender: 'female',
    personality: '냉철하고 분석적인 완벽주의자. 스스로에게 유독 엄격한 잣대를 들이댄다.',
    sprite: 'npc-sella', // 2026-10-02 삼면도 기반 리메이크 도트(PixelLab 6215ba84)
    portrait: '/images/npc/portrait-npc-sella.png',
    joinYear: 1,
    combat: {
      statMult: { mdef: 1.15, spd: 1.1, maxHp: 0.92 },
      defaultPosition: 'support',
      skills: [
        { skillId: 'ice-basic-1', level: 1 },
        { skillId: 'n-firstaid', level: 4 },
        { skillId: 'ice-basic-3', level: 10 },
        { skillId: 'ice-adv-1', level: 18 },
        { skillId: 'ice-adv-2', level: 28 },
        { skillId: 'ice-adv-3', level: 36 },
        { skillId: 'dark-illusion', level: 46 },
        { skillId: 'ice-high-2', level: 60 },
        { skillId: 'ice-master-1', level: 78 },
      ],
    },
    lines: { recruit: '…혼자 다니면 위험해. 내가 적 발을 묶어 둘게.', idle: '노트 정리 끝나면 같이 복습할래?' },
    homeRoom: 'class-ice',
  },
  {
    id: 'comp-doran',
    join: { kind: 'favor', affinity: 4, itemId: 'ore-iron', qty: 2, ask: '방패 손잡이가 헐거워졌어. 철광석 2개만 있으면 고칠 수 있는데… 구해 줄 수 있어?', thanks: '이거면 충분해! 이제 방패는 걱정 마. 뒤는 내가 맡을게.' },
    name: '도란',
    title: '1학년 동기 · 방어형',
    role: 'student',
    gender: 'male',
    personality: '말보다 행동으로 신뢰를 쌓는 우직한 성격. 든든한 존재감으로 곁을 지킨다.',
    sprite: 'npc-doran', // 2026-10-02 삼면도 기반 PixelLab 도트
    portrait: '/images/npc/portrait-npc-doran.png',
    joinYear: 1,
    combat: {
      statMult: { maxHp: 1.2, def: 1.2, spd: 0.9 },
      defaultPosition: 'rear',
      skills: [
        { skillId: 'earth-basic-1', level: 1 },
        { skillId: 'earth-basic-2', level: 5 },
        { skillId: 'n-firstaid', level: 9 },
        { skillId: 'earth-basic-3', level: 14 },
        { skillId: 'earth-adv-2', level: 24 },
        { skillId: 'earth-adv-3', level: 34 },
        { skillId: 'light-bulwark', level: 50 },
        { skillId: 'earth-high-1', level: 58 },
        { skillId: 'earth-master-1', level: 76 },
      ],
    },
    lines: { recruit: '힘 쓰는 일이면 나한테 맡겨. 뒤는 걱정 마.', idle: '공동 식당 오늘 메뉴 봤어?' },
    homeRoom: 'class-earth',
  },
  {
    id: 'comp-yuna',
    join: { kind: 'favor', affinity: 4, itemId: 'herb-mint', qty: 5, ask: '후배야, 숲박하 5개만 모아 줄래? 약을 만들어 둬야 원정 때 안심이 되거든.', thanks: '잘 모아 왔네. 뿌리째 안 뽑았지? 좋아, 다음 원정엔 나도 같이 갈게.' },
    name: '유나',
    title: '2학년 선배 · 회복형',
    role: 'student',
    gender: 'female',
    personality: '온화하지만 심지가 굳어 한번 정한 목표는 끝까지 밀어붙이는 뚝심이 있다.',
    sprite: 'npc-yuna', // 2026-10-02 삼면도 기반 PixelLab 도트
    portrait: '/images/npc/portrait-npc-yuna.png',
    joinYear: 2,
    combat: {
      statMult: { matk: 1.1, mdef: 1.1, atk: 0.85 },
      defaultPosition: 'rear',
      skills: [
        { skillId: 'light-heal', level: 1 },
        { skillId: 'earth-basic-1', level: 1 },
        { skillId: 'light-purify', level: 12 },
        { skillId: 'light-might', level: 20 },
        { skillId: 'light-revive', level: 32 },
        { skillId: 'light-sanctuary', level: 44 },
        { skillId: 'light-ward', level: 56 },
        { skillId: 'light-rebirth', level: 80 },
      ],
    },
    lines: { recruit: '후배들끼리만 보내긴 불안하잖니. 다치면 바로 말해.', idle: '약초는 뿌리째 뽑으면 안 돼, 알지?' },
    homeRoom: 'class-light',
  },

  {
    id: 'comp-mirel',
    join: { kind: 'story' },
    name: '미르엘 교수',
    title: '화염 교수 · 일류의 마도사(게스트)',
    role: 'professor',
    gender: 'female',
    personality: '승부욕이 남다르고 지는 걸 죽기보다 싫어한다. 자신감 넘치는 태도로 학생들의 시선을 끈다.',
    sprite: 'npc-mirel', // 2026-10-02 삼면도 기반 PixelLab 도트
    portrait: '/images/npc/portrait-npc-mirel.png',
    joinYear: 1,
    joinFlag: 'COMP_MIREL_JOIN', // 대원정 등 특정 스토리 구간에서만 합류(게스트)
    combat: {
      statMult: { matk: 1.25, maxMp: 1.2 },
      defaultPosition: 'rear',
      joinLevel: 40,
      skills: [
        { skillId: 'fire-adv-2', level: 1 },
        { skillId: 'light-heal', level: 1 },
        { skillId: 'fire-high-1', level: 40 },
        { skillId: 'light-haste', level: 40 },
        { skillId: 'fire-master-1', level: 60 },
        { skillId: 'fire-master-2', level: 80 },
      ],
    },
    lines: { recruit: '이번 원정은 나도 함께 가마. 너무 기대지는 말고.', idle: '기초가 탄탄해야 극의에 닿는단다.' },
  },
  // ── 패러디 동료 2인(2026-10-08 삼면도 「패러디 캐릭터 밀포이, 해리포탈 삼면도.png」 → PixelLab 도트) ──
  {
    id: 'comp-milfoy',
    join: { kind: 'invite' },
    name: '밀포이',
    title: '뱀 문장 기숙사 · 저주형',
    role: 'student',
    gender: 'female',
    personality: '도도하고 자존심이 세다. 품위를 따지지만, 속으로는 실력으로 인정받고 싶어 한다.',
    sprite: 'npc-milfoy',
    portrait: '/images/npc/portrait-npc-milfoy.png',
    joinYear: 1,
    combat: {
      statMult: { matk: 1.15, spd: 1.1, maxHp: 0.9 },
      defaultPosition: 'rear',
      skills: [
        { skillId: 'dark-curse', level: 1 },
        { skillId: 'dark-seal', level: 6 },
        { skillId: 'dark-veil', level: 12 },
        { skillId: 'dark-miasma', level: 20 },
        { skillId: 'dark-gaze', level: 30 },
        { skillId: 'dark-illusion', level: 40 },
        { skillId: 'dark-execute', level: 55 },
        { skillId: 'dark-sentence', level: 75 },
      ],
    },
    lines: { recruit: '흥, 나랑 같은 파티라니 영광인 줄 알아.', idle: '품위 없는 마법은 마법이 아니야.' },
    homeRoom: 'class-dark',
  },
  {
    id: 'comp-harry',
    join: { kind: 'invite' },
    name: '해리포탈',
    title: '번개 흉터의 학생 · 만능형',
    role: 'student',
    gender: 'male',
    personality: '겸손하고 정의감이 강하다. 위기가 닥치면 이상할 만큼 운이 따른다.',
    sprite: 'npc-harry',
    portrait: '/images/npc/portrait-npc-harry.png',
    joinYear: 1,
    combat: {
      statMult: { luck: 1.4, spd: 1.1, matk: 1.05 },
      defaultPosition: 'front',
      skills: [
        { skillId: 'fire-basic-1', level: 1 },
        { skillId: 'n-firstaid', level: 4 },
        { skillId: 'fire-basic-3', level: 8 },
        { skillId: 'light-might', level: 14 },
        { skillId: 'fire-adv-1', level: 20 },
        { skillId: 'light-purify', level: 28 },
        { skillId: 'fire-adv-3', level: 38 },
        { skillId: 'light-revive', level: 50 },
        { skillId: 'fire-high-1', level: 62 },
      ],
    },
    lines: { recruit: '혼자 가면 위험해. 나도 같이 갈게.', idle: '이마 흉터? 신경 쓰지 마. 어릴 때 생긴 거야.' },
    homeRoom: 'class-fire',
  },
]

/** 전투 프로필이 있는 학교 NPC(파티 편성 후보) */
export const COMBAT_NPCS = SCHOOL_NPCS.filter((n) => !!n.combat)

const BY_ID = new Map(SCHOOL_NPCS.map((c) => [c.id, c]))
export function schoolNpcById(id: string): SchoolNpc | undefined {
  return BY_ID.get(id)
}

/** 동료 슬롯 수 — 주인공을 뺀 나머지 3(펫·임시 NPC 는 슬롯을 차지하지 않는다) */
export const COMPANION_SLOTS = MAX_PARTY_SIZE - 1

/** 스토리상 자리를 비운 동료인가(폭주 후 도주한 루스벨 등) */
export function isCompanionAway(state: Pick<GameState, 'storyFlags'>, def: SchoolNpc | undefined): boolean {
  if (!def?.away) return false
  return flagOn(state, def.away.from) && !(def.away.until && flagOn(state, def.away.until))
}

/** 부탁(favor) 진행 — locked: 아직 덜 친함 · ready: 부탁을 꺼낼 때 · asked: 부탁 받는 중 · done: 들어줌 */
export type FavorState = 'locked' | 'ready' | 'asked' | 'done'
export const favorFlag = (id: string) => `favor:${id}`
export function favorState(state: Pick<GameState, 'storyFlags' | 'relationships'>, def: SchoolNpc): FavorState | null {
  if (def.join?.kind !== 'favor') return null
  const f = state.storyFlags[favorFlag(def.id)]
  if (f === 2) return 'done'
  if (f === 1) return 'asked'
  return (state.relationships[def.id]?.affinity ?? 0) >= def.join.affinity ? 'ready' : 'locked'
}

/**
 * 예전 저장에서 이미 합류해 있던 동료(합류 개편 전) — 파티에서 내보내고 'legacy:<id>' = 1 로 표시해 둔다.
 * 한 번 말을 걸면(2) 원래 합류 방식과 관계없이 다시 함께할 수 있다.
 */
export const legacyFlag = (id: string) => `legacy:${id}`
export const COMPANIONS_V2 = 'COMPANIONS_V2'

export function canRecruit(state: Pick<GameState, 'calendar' | 'storyFlags' | 'settings' | 'relationships'>, def: SchoolNpc): { ok: boolean; reason?: string } {
  if (!def.combat) return { ok: false, reason: '전투에 참가하지 않는 NPC' }
  if (isCompanionAway(state, def)) return { ok: false, reason: '지금은 행방을 알 수 없다' }
  if (state.storyFlags.DEBUG_UNLOCK_ALL) return { ok: true }
  const legacy = state.storyFlags[legacyFlag(def.id)]
  if (legacy === 2) return { ok: true }
  if (legacy === 1) return { ok: false, reason: '오랜만이다 — 찾아가 말을 걸어 보자' }
  const year = calendarInfo(state.calendar.globalWeek).year
  if (year < def.joinYear) return { ok: false, reason: `${def.joinYear}학년이 되면 만날 수 있을 것 같다` }
  const rule = def.join ?? { kind: 'invite' }
  if (rule.kind === 'story' || def.joinFlag) {
    if (def.joinFlag && !flagOn(state, def.joinFlag)) return { ok: false, reason: '이야기가 더 진행되면 함께할 수 있을 것 같다' }
    if (rule.kind === 'story') return { ok: true }
  }
  if (rule.kind === 'favor') {
    const f = favorState(state, def)
    if (f === 'done') return { ok: true }
    if (f === 'asked') return { ok: false, reason: '부탁을 들어주면 함께할 수 있을 것 같다' }
    return { ok: false, reason: '자주 이야기를 나누며 친해져 보자' }
  }
  // invite — 한 번이라도 직접 이야기를 나눠야 한다
  if (!state.relationships[def.id]) return { ok: false, reason: '직접 찾아가 말을 걸어 보자' }
  return { ok: true }
}

export function companionStats(def: SchoolNpc, level: number): Stats {
  const base = computeStatsForLevel(level)
  const out = { ...base }
  const mult = def.combat?.statMult ?? {}
  for (const k of Object.keys(mult) as (keyof Stats)[]) {
    out[k] = Math.max(1, Math.round(base[k] * (mult[k] ?? 1)))
  }
  return out
}

export function companionSkills(def: SchoolNpc, level: number): string[] {
  return (def.combat?.skills ?? []).filter((s) => level >= s.level).map((s) => s.skillId)
}

export function createCompanionProgress(def: SchoolNpc, heroLevel: number): CompanionProgress {
  const level = def.combat?.joinLevel ?? Math.max(1, heroLevel)
  const stats = companionStats(def, level)
  return { level, exp: 0, hp: stats.maxHp, mp: stats.maxMp }
}

export function combatantFromCompanion(def: SchoolNpc, prog: CompanionProgress): Combatant {
  const stats = companionStats(def, prog.level)
  return {
    uid: `ally-${def.id}`,
    side: 'player',
    kind: 'ally',
    refId: def.id,
    name: def.name,
    icon: def.portrait,
    element: null,
    level: prog.level,
    stats,
    hp: Math.min(prog.hp, stats.maxHp),
    mp: Math.min(prog.mp, stats.maxMp),
    skills: companionSkills(def, prog.level),
    atb: 0,
    effects: [],
    appearance: { kind: 'hero', sheet: def.sprite },
    alive: prog.hp > 0,
  }
}

// ============================================================================
// 임시 합류 NPC — 호위 임무 대상(escort) · 임시로 같이 싸우는 NPC(guest)
//   진형 6칸 중 파티(최대 4)가 쓰고 남는 2칸을 쓴다. 조작 불가(AI 자동), 경험치 분배 제외.
//   스토리/퀘스트에서 addGuest(state, id) · removeGuest(state, id) 로 넣고 뺀다.
// ⚠ 아래 두 명은 테스트용 임시 데이터(관리자 패널에서 합류) — 스토리 작업 시 교체.
// ============================================================================
export interface GuestNpc {
  id: string
  name: string
  role: 'escort' | 'guest'
  title: string
  sprite: SpriteSheet
  portrait: string
  statMult?: Partial<Stats>
  skills: string[]
  defaultPosition: Position
  /** 고정 레벨 — 생략하면 합류 시 주인공 레벨 */
  level?: number
}

export const GUEST_NPCS: GuestNpc[] = [
  {
    id: 'guest-lost-freshman',
    name: '길 잃은 신입생',
    role: 'escort',
    title: '호위 대상 · 전투력 낮음',
    sprite: 'hero-earth-female',
    portrait: '/images/portraits/hero-earth-female.png',
    statMult: { atk: 0.5, matk: 0.5, maxHp: 0.8, def: 0.8 },
    skills: ['n-firstaid'],
    defaultPosition: 'rear',
  },
  {
    id: 'guest-patrol-knight',
    name: '순찰 마도기사',
    role: 'guest',
    title: '임시 동행 · 전위 탱커',
    sprite: 'hero-fire-male',
    portrait: '/images/portraits/hero-fire-male.png',
    statMult: { maxHp: 1.3, def: 1.3, atk: 1.1 },
    skills: ['earth-basic-1', 'earth-basic-2', 'light-bulwark'],
    defaultPosition: 'front',
  },
]

const GUEST_BY_ID = new Map(GUEST_NPCS.map((g) => [g.id, g]))
export function guestNpcById(id: string): GuestNpc | undefined {
  return GUEST_BY_ID.get(id)
}

export function guestStats(def: GuestNpc, level: number): Stats {
  const base = computeStatsForLevel(level)
  const out = { ...base }
  for (const k of Object.keys(def.statMult ?? {}) as (keyof Stats)[]) out[k] = Math.max(1, Math.round(base[k] * (def.statMult![k] ?? 1)))
  return out
}

export function createGuestMember(def: GuestNpc, heroLevel: number): GuestMember {
  const level = def.level ?? Math.max(1, heroLevel)
  const s = guestStats(def, level)
  return { id: def.id, level, hp: s.maxHp, mp: s.maxMp }
}

export function combatantFromGuest(def: GuestNpc, g: GuestMember): Combatant {
  const stats = guestStats(def, g.level)
  return {
    uid: `guest-${def.id}`,
    side: 'player',
    kind: 'ally',
    refId: def.id,
    name: def.name,
    icon: def.portrait,
    element: null,
    level: g.level,
    stats,
    hp: Math.min(g.hp, stats.maxHp),
    mp: Math.min(g.mp, stats.maxMp),
    skills: def.skills,
    atb: 0,
    effects: [],
    guest: def.role,
    appearance: { kind: 'hero', sheet: def.sprite },
    alive: g.hp > 0,
  }
}
