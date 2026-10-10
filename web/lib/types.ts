// ============================================================================
// 마법학교 울토르 (원작 시스템 복원) — 도메인 타입 정의
// 설계 기준: 「울토르 마법학교 시스템 개편 PRD v2.0」(2026-10-02, 최우선) > 학사·생활·동료 PRD > 울토르 시스템 DB.md
// 모든 화면/컴포넌트는 이 타입을 기준으로 데이터를 주고받는다.
// ============================================================================

/**
 * 전투 속성(§PRD v2.0 §8~9) — 플레이어가 배우는 5속성 + 모르스 전용 유실 속성(바람).
 *   3원소 핵심 상성: 불꽃 > 얼음 > 대지 > 불꽃 · 어둠/빛은 상성 없이 역할로 차별화 · 바람은 상성표 밖.
 * 속성이 필요 없는 행동(기본 공격·일반 행동·회복 아이템 등)은 `null` 로 표현한다 — 6번째 원소가 아니다.
 */
export type Element = 'fire' | 'ice' | 'earth' | 'dark' | 'light' | 'wind'
/** 플레이어·일반 NPC·일반 몬스터가 쓸 수 있는 속성(바람 제외) */
export type PlayerElement = Exclude<Element, 'wind'>
/** 스킬/전투원 속성 — null = 속성 없음 */
export type SkillElement = Element | null

export type Gender = 'male' | 'female'

/**
 * 4등신 도트 시트 키 = public/images/sprites/<key>.png (8열×4행: 회전 + 정면/측면/후면 걷기).
 * 예: 'protag-male'(주인공), 'hero-ice-female'(예전 주인공 시트를 쓰는 학교 NPC), 'npc-sella'.
 */
export type SpriteSheet = string

/** 4대4 전투 포지션(§17~19) */
export type Position = 'front' | 'rear' | 'support'

/** 전투/성장 스탯 */
export interface Stats {
  maxHp: number
  maxMp: number
  atk: number // 물리 공격력
  def: number // 물리 방어력
  matk: number // 마법 공격력
  mdef: number // 마법 방어력
  spd: number // 속도 — ATB 충전 속도 결정
  luck: number // 치명타/회피/상태이상 저항 보정
}

export type StatKey = keyof Stats

// ─────────────────────────────────────────────────────────────────────────────
// 상태이상 (원작 9종)
// ─────────────────────────────────────────────────────────────────────────────
export type StatusId =
  | 'bleed' // 출혈
  | 'infection' // 감염
  | 'burn' // 화상
  | 'paralysis' // 마비
  | 'sleep' // 수면
  | 'silence' // 침묵
  | 'blind' // 실명
  | 'slow' // 감속
  | 'weaken' // 약화

export type BuffId =
  | 'defendGuard'
  | 'ironWall' // 방어·마방 증가
  | 'haste' // 속도 증가
  | 'rally' // 공격·마공 증가
  | 'lastStand'
  | 'atkUp' // 빛: 공격력 증가
  | 'defUp' // 빛: 방어력 증가
  | 'matkUp' // 빛: 마법 공격력 증가
  | 'mdefUp' // 빛: 마법 방어력 증가
  | 'stealth' // 어둠: 은신 — 단일 대상 공격의 표적이 되지 않는다(광역은 무시)

/** 어둠 계열 약화 효과(상태이상 9종과 별개, 정화로 함께 지워진다) */
export type DebuffId =
  | 'atkDown' // 공격력·마공 감소
  | 'defDown' // 방어력·마방 감소
  | 'accDown' // 명중률 감소
  | 'illusion' // 환술 — 공격 대상 교란 + 명중 저하

/** 전투원에 부착되는 상태이상/버프/약화 인스턴스 */
export interface ActiveEffect {
  key: string // 인스턴스 고유 id
  kind: 'status' | 'buff' | 'debuff'
  id: StatusId | BuffId | DebuffId
  name: string
  turnsLeft: number
  /** 부여 시점의 부여자 마법공격력 — 화상 등 지속피해 계산용 */
  sourceMatk?: number
  /** 버프 수치(예: def +0.4) */
  magnitude?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// 스킬
// ─────────────────────────────────────────────────────────────────────────────
export type SkillTargeting = 'singleEnemy' | 'allEnemies' | 'singleAlly' | 'allAllies' | 'self'
export type SkillKind =
  | 'attack'
  | 'heal'
  | 'buff'
  | 'debuff'
  | 'utility'
  | 'revive' // 빛: 전투불능 아군 부활
  | 'stealth' // 어둠: 아군 은신
  | 'illusion' // 어둠: 환술
  | 'execute' // 어둠: 일반 몬스터 즉사(보스 피해 0)

export interface SkillStatusRider {
  id: StatusId
  chance: number // 0~1
  turns?: number
}

/**
 * 스킬 습득 조건(§23~24) — 전부 만족하면 습득된다. 전직 단계(jobTier)는 폐지.
 *   course    : 해당 과목의 수업 진도로 배운다(lib/academics.ts teachesSkills)
 *   level     : 주인공 레벨
 *   storyFlag : 스토리 플래그
 *   item      : 아이템(교본) 보유
 */
export type LearnRequirement =
  | { type: 'course'; id: string }
  | { type: 'level'; level: number }
  | { type: 'storyFlag'; id: string }
  | { type: 'item'; id: string }

export interface Skill {
  id: string
  name: string
  /** null = 속성 없음 */
  element: SkillElement
  /** 이 레벨 미만이면 배웠어도 아직 쓸 수 없다(생략 = 제한 없음) */
  levelRequired?: number
  /** 주인공 습득 조건. 생략 = 학교 수업으로 배우지 않는 스킬(펫·몬스터·NPC 전용) */
  learnRequirements?: LearnRequirement[]
  /** 습득 주체 — 'pet' 펫 훈련 전용, 'mors' 모르스 전용(바람). 생략 = 학생/NPC/몬스터 공용 */
  owner?: 'pet' | 'mors'
  mpCost: number
  atbCost?: number // 사용 후 추가 ATB 차감(궁극기 후딜)
  power: number // 위력 배율
  kind: SkillKind
  physical?: boolean // true면 atk/def 기반. 기본 false(마법)
  targeting: SkillTargeting
  status?: SkillStatusRider // 부여 상태이상
  buff?: { id: BuffId; magnitude: number; turns: number }
  /** 어둠 약화 효과 — chance 생략 시 1 */
  debuff?: { id: DebuffId; magnitude: number; turns: number; chance?: number }
  cleanse?: boolean // 상태이상·약화 해제
  reviveHpRatio?: number // 부활 스킬
  restoreMpRatio?: number // MP 회복 스킬(배율 * matk)
  /** 즉사 판정 — 일반 몬스터만, 보스류는 면역 + 피해 0 */
  execute?: { normalOnly: true; successChance: number; bossDamage: 0 }
  icon: string
  description: string
}

// ─────────────────────────────────────────────────────────────────────────────
// 아이템
// ─────────────────────────────────────────────────────────────────────────────
export type ItemType =
  | 'weapon'
  | 'armor'
  | 'accessory'
  | 'potion'
  | 'tool'
  | 'feed'
  | 'material'
  // 생활 콘텐츠(§학사 PRD 33~38)
  | 'food' // 요리 — 먹으면 회복 + 식사 버프
  | 'fish' // 낚시 어획물 — 요리 재료 겸 도감
  | 'furniture' // 가구 제작 결과물
  | 'costume' // 코스튬 제작 결과물

/** 생활 재료 분류 태그 — 퀘스트 목표("약초 6개")·레시피·도감에서 개별 id 대신 묶음으로 참조 */
export type MaterialTag =
  | 'herb'
  | 'flower'
  | 'wood'
  | 'ore'
  | 'crystal'
  | 'mushroom'
  | 'seafood'
  | 'meat'
  | 'hide'
  | 'bone'
  | 'claw'
  | 'core'
  | 'fish'
export type EquipSlot = 'weapon' | 'armor' | 'accessory'
/** 장비 성장 등급(§장비·아이템 PRD). 티어(전직 단계)와 독립적인 별도 축 */
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'mythic' | 'unique'

export interface ItemDef {
  id: string
  name: string
  type: ItemType
  icon: string
  description: string
  price: number
  sellPrice: number
  statBonus?: Partial<Stats>
  /** 착용 요구 레벨(전직 단계 요구는 폐지) */
  requiredLevel?: number
  /** 무기: 이 속성 스킬 위력 +8% (바람 완드는 존재하지 않는다) */
  weaponElement?: PlayerElement
  /** 상태이상 저항 % (장신구) */
  statusResist?: number
  useEffect?: {
    healHp?: number
    healMp?: number
    reviveOnly?: boolean
    escapeBattle?: boolean
    cureStatus?: boolean
    atbBoost?: number // 대상 ATB 즉시 가산
    petAffection?: number // 펫 호감도 증가
    /** 마력캔디 — 먹은 캐릭터(주인공·동료)에게 경험치. 필드 전용(전투 중 사용 불가) */
    grantExp?: number
  }
  /** 먹이: 이 속성 펫이 좋아한다. 생략 = 모든 펫이 조금씩 좋아함 */
  feedElement?: PlayerElement
  stackable: boolean
  maxStack: number
  /** 장비 성장 단계(전직 5단계와 동일 축). 소모품·재료는 생략 가능 */
  tier?: 1 | 2 | 3 | 4 | 5
  /** 장비 성장 등급. 소모품·재료는 생략 가능 */
  rarity?: ItemRarity
  /** 상점 구매 가능 여부. 생략 시 true 취급(기존 상점 아이템 호환) */
  shopBuyable?: boolean
  /** 제작대 레시피로 만들 수 있는지. 생략 시 false 취급 */
  craftable?: boolean
  /** craftable=true 일 때 RecipeDef.id 참조 */
  recipeId?: string
  /** 생활 재료 분류(채집·사냥·낚시). 퀘스트 목표/도감이 태그로 묶어 센다 */
  tags?: MaterialTag[]
  /** 요리(food): 먹은 뒤 N번의 전투 동안 적용되는 식사 버프 */
  mealBuff?: MealBuffDef
}

/** 식사 버프 — 스탯 % 가산, 지정 횟수의 전투가 끝나면 소멸 */
export interface MealBuffDef {
  label: string
  statPct: Partial<Record<StatKey, number>> // 0.1 = +10%
  battles: number
}

export interface InventorySlot {
  itemId: string
  qty: number
}

// ─────────────────────────────────────────────────────────────────────────────
// 제작(크래프팅)
// ─────────────────────────────────────────────────────────────────────────────
export type CraftStationKind = 'magic_workbench' | 'alchemy_pot' | 'cooking_pot'

/** 제작 카테고리(§학사 PRD 38) — 카테고리마다 해금 시기(ActivityId)가 다르다 */
export type RecipeCategory = 'equipment' | 'alchemy' | 'cooking' | 'magicTool' | 'furniture' | 'costume' | 'candy'

export interface RecipeDef {
  id: string
  /** 어느 제작대에서 만들 수 있는지(현재는 UI에서 구분 없이 전부 노출) */
  station: CraftStationKind
  /** 생략 시 'equipment'(기존 장비 레시피 호환) */
  category?: RecipeCategory
  ingredients: { itemId: string; quantity: number }[]
  outputItemId: string
  outputQuantity: number
  /** 스토리 시스템 연결 전까지는 사용하지 않음 — 구조만 마련 */
  unlockCondition?: { type: 'regionReached' | 'bossDefeated' | 'flag' | 'course'; value: string }
}

// ─────────────────────────────────────────────────────────────────────────────
// 펫 (§20~22) — 주인공 전용 고정 펫 슬롯 1칸(포지션 무관). 동료 NPC 는 펫이 없다.
// 펫 레벨은 전투 경험치 1인 몫을 따로 받아 성장한다.
// ─────────────────────────────────────────────────────────────────────────────
export type PetRarity = 'common' | 'rare' | 'special'

export interface PetTrainableSkill {
  skillId: string
  minLevel: number
  costGold: number
  costItemId?: string
}

export interface PetDef {
  id: string
  name: string
  species: string
  /** null = 속성 없음 */
  element: SkillElement
  icon: string
  rarity: PetRarity
  baseStats: Stats
  growth: Partial<Stats>
  innateSkills: string[]
  trainableSkills: PetTrainableSkill[]
}

export interface Pet {
  defId: string
  nickname: string
  level: number
  exp: number
  affection: number // 0~100
  learnedSkills: string[]
  hp: number
  mp: number
}

export type AffectionTier = 'unfamiliar' | 'familiar' | 'close' | 'devoted'

// ─────────────────────────────────────────────────────────────────────────────
// 전투
// ─────────────────────────────────────────────────────────────────────────────
export type CombatantSide = 'player' | 'enemy'

/** 펫 ↔ 주인(전위 캐릭터) 연결(§20). 주인의 position 이 front 가 아니면 전투에 참가할 수 없다 */
export interface PetLink {
  petUid: string
  ownerCombatantUid: string
}

export interface Combatant {
  uid: string
  side: CombatantSide
  kind: 'hero' | 'pet' | 'ally' | 'monster'
  refId: string
  name: string
  icon: string
  element: SkillElement
  /** 아군 핵심 전투원의 포지션(펫·몬스터는 없음) */
  position?: Position
  /** 펫 — 주인 전투원 uid */
  ownerUid?: string
  /** 몬스터 등급 — 즉사 판정·AI 에 사용 */
  rank?: MonsterRank
  aiProfile?: AiProfile
  /** 장착 무기 속성 — 같은 속성 스킬 위력 +8% */
  weaponElement?: PlayerElement
  level: number
  stats: Stats // 장비 반영 후 기본 스탯. 상태이상/버프는 계산 시점에 적용
  hp: number
  mp: number
  skills: string[]
  atb: number // 0~100+ (이월 허용)
  effects: ActiveEffect[]
  isTestMonster?: boolean
  traits?: MonsterTrait[]
  /** 펫 호감도 보정: 치명타율 가산 */
  bonusCrit?: number
  /** 펫 호감도 '헌신' 지원 공격 확률 */
  supportChance?: number
  /** 임시 합류 NPC(호위 대상 'escort' · 임시 동행 'guest') — 조작 불가 자동 행동, 경험치 분배 제외 */
  guest?: 'escort' | 'guest'
  /** 동료(ally) 외형 — 4등신 히어로 시트를 빌려 쓰거나(학생) NPC 도트를 쓴다. 적도 히어로 시트를 쓸 수 있다(폭주한 루스벨) */
  appearance?: { kind: 'hero'; sheet: SpriteSheet } | { kind: 'npc'; npcId: string }
  /** 전투 화면 연출 — 'rage-violet' = 보랏빛 불꽃·오라·흔들림(폭주 보스) */
  aura?: 'rage-violet'
  alive: boolean
}

export type BattleAction =
  | { type: 'attack'; targetUid: string }
  | { type: 'skill'; skillId: string; targetUid: string }
  | { type: 'item'; itemId: string; targetUid?: string }
  | { type: 'flee' }
  | { type: 'defend' }

export type MonsterFamily =
  | 'beast'
  | 'plant'
  | 'aquatic'
  | 'undead'
  | 'darkmage'
  | 'construct'
  | 'test'

export type MonsterTrait = 'aggressive' | 'caster' | 'tank' | 'swift' | 'splitOnDeath'

/** 몬스터 등급(§32) — 어둠 즉사는 normal 만 가능 */
export type MonsterRank = 'normal' | 'elite' | 'miniBoss' | 'fieldBoss' | 'storyBoss'

/**
 * 전투 AI 표적 성향(§33)
 *   melee     근접형 — 전위 우선
 *   healerHunt 힐러 사냥 — 후위(회복 담당) 우선
 *   support   교란형 — 보조 우선
 *   finisher  마무리형 — 체력 낮은 대상 우선
 *   random    무작위
 * 공통: 은신 대상은 단일 대상 공격의 표적에서 제외(전원 은신이면 예외).
 */
export type AiProfile = 'melee' | 'healerHunt' | 'support' | 'finisher' | 'random'

export interface MonsterDef {
  id: string
  name: string
  level: number
  icon: string
  /** null = 속성 없음. wind 는 모르스 전용 */
  element: SkillElement
  family: MonsterFamily
  stats: Stats
  skills: string[]
  traits?: MonsterTrait[]
  expReward: number
  goldReward: number
  dropTable?: { itemId: string; chance: number }[]
  zoneKinds: ZoneKind[]
  /** 생략 시 'normal'. miniBoss/fieldBoss/storyBoss 는 monstersForZoneKind 랜덤풀에서 제외되고 GameMap.bossSpawns로만 등장한다 */
  rank?: MonsterRank
  /** 생략 시 traits 에서 유추(lib/battle-engine aiProfileOf) */
  aiProfile?: AiProfile
  isTestMonster?: boolean
  /** 크리처 도트 대신 4등신 히어로 시트로 그린다(사람 보스 — 폭주한 루스벨) */
  heroSheet?: SpriteSheet
  /** 전투 화면 연출 */
  aura?: 'rage-violet'
}

// ─────────────────────────────────────────────────────────────────────────────
// 맵 / 구역
// ─────────────────────────────────────────────────────────────────────────────
export type ZoneKind =
  | 'school'
  | 'colosseum'
  | 'shopStreet'
  | 'village'
  | 'military'
  | 'forest'
  | 'sea'
  | 'ruins'
  | 'field'
  // 재설계로 추가된 구역/맵 종류
  | 'plaza'
  | 'park'
  | 'farm'
  | 'temple'
  | 'cave'
  | 'mine'
  | 'swamp'
  | 'deepsea'
  | 'atlantis'
  | 'graveyard'
  | 'volcano'
  | 'demon'
  | 'snow'
  | 'aurora'
  | 'sky'

export interface ZoneDef {
  id: string
  kind: ZoneKind
  name: string
  cell: { x0: number; y0: number; x1: number; y1: number }
  color: string
  description: string
  hasMonsters: boolean
  monsterDensityPer200m?: number
  recommendedLevel?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// 멀티맵 / 포탈 — 메인 마을 + 야생 스테이지들을 독립된 맵으로 분리
// ─────────────────────────────────────────────────────────────────────────────
export type MapId =
  | 'village'
  | 'forest'
  | 'forest-2'
  | 'forest-3'
  | 'cave'
  | 'mine'
  | 'swamp'
  | 'sea'
  | 'sea-2'
  | 'sea-3'
  | 'sea-cave'
  | 'deepsea'
  | 'atlantis'
  | 'atlantis-crypt'
  | 'stormhaven'
  | 'stormhaven-2'
  | 'stormhaven-3'
  | 'cloud-rift'
  | 'thunder-spire'
  | 'ruins-2'
  | 'ruins-3'
  | 'catacomb'
  | 'snowfield-2'
  | 'snowfield-3'
  | 'ice-cave'
  | 'frozen-lake'
  | 'volcano-2'
  | 'volcano-3'
  | 'lava-cave'
  | 'sky-temple'
  | 'ruins'
  | 'graveyard'
  | 'temple-ruin'
  | 'snowfield'
  | 'aurora-village'
  | 'volcano'
  | 'demon-village'
  | 'demon-castle'
  | 'atlantis-temple'
  | 'demon-temple'
  | 'sky-sanctum'
  | 'ruin-sanctum'
  | 'aurora-sanctum'
  | 'school-hall'
  | 'class-fire' // 마법학교 화염 수업관
  | 'class-ice' // 마법학교 빙결 수업관
  | 'class-earth' // 마법학교 대지 수업관(온실)
  | 'grand-auditorium' // 마법학교 대강당
  | 'headmaster-office' // 마법학교 학장실
  | 'academy-library' // 마법학교 도서관
  | 'academy-2f' // 마법학교 2층 회랑(중앙 홀 위)
  | 'academy-3f' // 마법학교 3층 복도(3학년·어둠/빛·실습실·교수 연구실)
  | 'academy-4f' // 마법학교 4층 복도(4학년·고등 실습실·교수 회의실·교수 연구실)
  | 'academy-secret' // 마법학교 숨겨진 통로 + 오망성 제단실(2층 서쪽 회랑 벽 너머)
  | 'class-year2' | 'class-year3' | 'class-year4' // 학년 교실
  | 'class-dark' | 'class-light' // 어둠 · 빛 수업관
  | 'practice-lab' | 'practice-lab-adv' // 마법 실습실 · 고등 마법 실습실
  | 'council-room' // 교수 회의실
  | 'lab-fire' | 'lab-ice' | 'lab-earth' | 'lab-dark' | 'lab-light' // 교수 연구실
  | 'personal-space'
  | 'testroom'

/** 포탈: 타일에 서면(또는 군 통문에서 선택하면) 다른 맵으로 이동 */
export interface Portal {
  id: string
  cell: { x: number; y: number }
  to: MapId
  /** 목적지 도착 위치. 생략 시 목적지 맵의 spawn */
  toSpawn?: { x: number; y: number }
  label: string
  /** 안내용 권장 레벨(입장 자체는 막지 않음) */
  requiredLevel?: number
  /** gate=군 통문(메뉴형) · portal=하위 스테이지 진입 타일 · exit=상위 맵 복귀 타일 */
  kind: 'gate' | 'portal' | 'exit'
  /**
   * 이 사각형 안에 들어서면 확인 없이 바로 넘어간다(같은 좌표계의 위/아래층 — 1층 대계단 ↔ 2층 회랑).
   * 위치·방향을 그대로 유지하고 마법진도 그리지 않는다.
   */
  walkArea?: { x0: number; y0: number; x1: number; y1: number }
  /** 숨겨진 통로 — 밟아도 안 열리고, 가까이에서 E 로 상호작용. 마법진 대신 흰 반짝임 */
  secret?: boolean
  /** 반짝임을 바닥에서 띄울 높이(px) — 벽면에 걸리게 */
  sparkleLift?: number
}

export interface GameMap {
  id: MapId
  name: string
  /** town=몬스터 없는 안전지대 · field=몬스터 배회 */
  kind: 'town' | 'field'
  grid: { w: number; h: number }
  /** 바닥 배경 키 (world-screen 의 zoneBg 스위치) */
  bg: ZoneKind | string
  /**
   * 렌더 방식.
   *  'gradient'(기본) = CSS 쿼터뷰 · 'image' = bgImage 평면 · 'iso' = 아이소메트릭 도트 엔진
   */
  render?: 'gradient' | 'image' | 'iso'
  /** render:'iso' 일 때 스프라이트 소스: 'svg'(손그림, 기본) · 'raster'(PropDef.sprite PNG) */
  assets?: 'svg' | 'raster'
  /** render:'image' 일 때 배경 일러스트 경로 */
  bgImage?: string
  /** render:'iso' 일 때: 셀별 지면 타일 종류 */
  tileAt?: (x: number, y: number) => import('./iso').TileKind
  /**
   * render:'iso' 일 때: 물 지형 — 바다/수로를 칸 타일 대신 이어진 한 장의 수면(물결 애니메이션)으로 그리고,
   * 물과 땅이 맞닿는 면에 벽(수로=돌벽, 바다=바위 절벽)을 세워 수위 차이를 보여 준다. (components/game/iso-water.tsx)
   * 'bridge' = 수로 위를 지나는 다리 칸(땅 높이) — 아래 수로 벽에 아치가 뚫린다.
   */
  water?: { at: (x: number, y: number) => 'sea' | 'canal' | 'bridge' | null }
  /** false = 지면 타일을 칸마다 무작위로 뒤집지 않는다(줄눈·벽돌이 이웃 칸과 이어지게) */
  tileFlip?: boolean
  /**
   * render:'iso' 일 때: 자연 지면(야생맵) — 칸 타일 대신 지면 전체를 한 장으로 이어 그린다(components/game/iso-terrain.tsx).
   * at = 소수 좌표 지면 종류(길·얼룩 가장자리가 칸 계단 없이 곡선), pool = 칸의 물 표현(lib/terrain.ts).
   * tileAt 은 게임 로직(낚시·채집)용으로 그대로 둔다.
   */
  terrain?: {
    at: (x: number, y: number) => import('./iso').TileKind
    pool: (x: number, y: number) => import('./terrain').PoolKind | null
    /** 지면 종류별 밝기 배율(동굴 속 모래처럼 너무 튀는 바닥을 눌러 줄 때) */
    shade?: Partial<Record<import('./iso').TileKind, number>>
    /** 맵 전체 톤 — 1 초과 = 밝은 지역(화사하게), 1 미만 = 어두운 지역(지면을 누르고 화면에 어둠을 깐다) */
    tone?: number
    /** 지면 종류 → 텍스처 이름(public/images/map/terrain/*) — 지역마다 같은 타일 종류를 다른 그림으로(설원의 path = 밟힌 눈길 등) */
    tex?: Partial<Record<import('./iso').TileKind, string>>
    /** 지면 높이 순위(높은 쪽이 낮은 쪽 위로 그늘) — 생략 시 풀 계열만 높음 */
    rank?: Partial<Record<import('./iso').TileKind, number>>
    /** 고인 것의 종류 — 물(기본)·용암(가라앉은 둑 + 흐르는 용암, 못 지나감)·얼음(땅 높이의 얼어붙은 호수, 지나감) */
    liquid?: 'water' | 'lava' | 'ice'
    /** 격자 바깥 그늘 색 */
    fog?: [number, number, number]
    /** 화면 날씨 층 — 눈·불티·폭풍(빗줄기 + 번개) */
    weather?: 'snow' | 'embers' | 'storm'
  }
  /** 야생 맵: 이 셀이 길(포탈 연결로)인지 — 몬스터 배치가 길을 피하는 데 사용 */
  roadAt?: (x: number, y: number) => boolean
  /** render:'iso' 일 때: 건물·자연물 등 배치 오브젝트 */
  props?: import('./iso').PropDef[]
  /** render:'iso' 일 때: 바닥 위(오브젝트 아래)에 셀 좌표로 그리는 상감 마법진 — 마법학교 홀 등 */
  floorInlay?: { cx: number; cy: number; r: number; gold: string; blue: string }[]
  /** render:'iso' 일 때: 코드로 투영해 그리는 구조물(벽·회랑·계단·기둥·난간) */
  structures?: import('./iso').IsoStructGroup[]
  /** 화면 위 여백(px) — 높은 벽 구조물이 잘리지 않게 */
  padTop?: number
  /** 화면 아래 여백(px) — 2층에서 내려다보이는 1층 등 */
  padBottom?: number
  /** 지형 없는 실내 맵의 화면 톤(terrain.tone 과 같은 뜻) — 1 미만이면 캐릭터 주변만 남기고 어둡게 */
  ambientTone?: number
  /** 계단 영역 — 플레이어 높이·깊이정렬 보정 */
  stairs?: import('./iso').IsoStair[]
  /** 맵 내부 라벨 구역. 단순 필드 맵은 빈 배열 */
  zones: ZoneDef[]
  /** 이동 불가 사각형(셀 좌표) — 건물·분수 등. 비면 자유 이동 */
  blockers?: { x0: number; y0: number; x1: number; y1: number }[]
  /** field 맵: 명시 몬스터 id 풀 (우선) */
  monsterPool?: string[]
  /** field 맵: 풀 미지정 시 이 kind 로 몬스터 조회 */
  monsterZoneKind?: ZoneKind
  /** 셀당 몬스터 수 (기본 1) */
  monsterDensity?: number
  /** 몬스터 사이 최소 간격(셀) — 클수록 배치가 퍼진다 (기본 1.2) */
  monsterSpacing?: number
  /** 중간보스/필드보스 고정 배치 — 랜덤 풀과 별개로 항상 이 위치에 등장(맵 재입장 시 재생성=재도전) */
  bossSpawns?: { monsterId: string; cell: { x: number; y: number } }[]
  recommendedLevel?: number
  portals: Portal[]
  spawn: { x: number; y: number }
  /** 전투 패배 시 리스폰 위치 (village 전용) */
  respawn?: { x: number; y: number }
}

export type NpcRole =
  | 'professor' // 수업 담당 교수(전직 담당관 폐지)
  | 'weaponMerchant'
  | 'potionMerchant'
  | 'toolMerchant'
  | 'petTamer'
  | 'housing'
  | 'arenaMaster'
  | 'guard'
  | 'flavor'
  | 'templePriest'
  | 'saint'
  | 'farmer'
  | 'craftStation'
  | 'companion' // 학교 동료(lib/companions SCHOOL_NPCS) — 학교 안 방·로비에 매주 무작위 배치(lib/school-roster)
  | 'royal' // 국왕
  | 'royalGuard' // 왕실 근위병

export interface NpcDef {
  id: string
  name: string
  role: NpcRole
  /** role:'craftStation' 일 때 이 제작대가 여는 스테이션(생략 시 마도구 작업대) */
  station?: CraftStationKind
  icon: string
  zoneId: string
  cell: { x: number; y: number }
  greeting: string[]
  shopItemIds?: string[]
  /** 배회 반경(셀) 직접 지정 — 생략 시 role 기준(flavor 2 · 기능형 0.4) */
  roam?: number
  /** 다른 NPC 의 걷기 시트를 빌려 쓸 때(전용 에셋 전 교수진 등) — `<spriteId>-walk.png` */
  spriteId?: string
  /** 이 스토리 플래그가 켜진 뒤에만 맵에 나타난다(국왕 일행 등) */
  visibleFlag?: string
  /** 빌려 쓴 시트의 색을 돌려 다른 사람처럼 보이게(색상 회전 각도) — 전용 도트가 생기면 지운다 */
  hue?: number
  /** 순찰 — 두 점 사이를 걸어서 오간다(양 끝에서 잠깐 선다). 있으면 배회 대신 이 길을 따른다 */
  patrol?: [{ x: number; y: number }, { x: number; y: number }]
}

export interface FieldMonster {
  uid: string
  monsterId: string
  cell: { x: number; y: number }
  homeCell: { x: number; y: number }
  wanderSeed: number
}

// ─────────────────────────────────────────────────────────────────────────────
// 플레이어 / 게임 상태
// ─────────────────────────────────────────────────────────────────────────────
/**
 * 주인공 외형 — 커스터마이징은 폐기(2026-10-02). 고정 외형 2종(흑발 금안 · 울토르 교복) 중 성별만 고른다.
 * 주인공은 고정 속성이 없다.
 */
export interface PlayerAppearance {
  gender: Gender
}

export interface PlayerCharacter {
  name: string
  appearance: PlayerAppearance
  level: number
  exp: number
  stats: Stats
  hp: number
  mp: number
  gold: number
  equipped: Partial<Record<EquipSlot, string>>
  /** 학교 수업·스토리·레벨로 배운 전체 스킬 */
  learnedSkills: string[]
  /** 전투에 들고 가는 스킬(최대 SKILL_LOADOUT_SIZE) — learnedSkills 의 부분집합 */
  equippedSkills: string[]
}

export interface BattleLogEntry {
  id: string
  text: string
  kind: 'info' | 'damage' | 'heal' | 'system' | 'levelup' | 'status'
}

/** 전투 스킬/공격/아이템 연출(VFX) 트리거 — 매 행동마다 새 fxId로 갱신되어 battle-screen 이 재생한다 */
export interface BattleFx {
  fxId: string
  sourceUid: string
  targetUids: string[]
  element: SkillElement
  /** 연출 갈래 판정용 — 스킬의 kind 그대로, 기본공격은 'attack', 아이템은 useEffect 기반 별도 태그 */
  archetype: 'attack' | 'magicAttack' | 'heal' | 'buff' | 'debuff' | 'utility' | 'item'
  aoe: boolean
  power: number // 연출 스케일(파티클 양·크기) 근거
  mpCost?: number // 연출 등급(tier) 산정 근거 — 클수록 더 화려하고 광범위한 연출
}

export interface BattleState {
  round: number
  tick: number
  activeUid: string | null // 현재 행동권을 가진 전투원(없으면 ATB 계속 충전)
  combatants: Combatant[]
  log: BattleLogEntry[]
  lastFx?: BattleFx
  isOver: boolean
  victory: boolean
  originCell: { x: number; y: number }
  fieldMonsterUid?: string
  rewardExp?: number
  /** 경험치 분배 — 핵심 전투원(주인공+동료) 1인당 몫. 펫도 같은 몫을 따로 받는다 */
  rewardExpShare?: number
  rewardGold?: number
  rewardDrops?: string[]
  leveledUp?: boolean
  /** 자동 전투 — 켜면 주인공·동료 모두 AI 가 행동 */
  auto?: boolean
  /** 이번 전투의 펫 귀속(주인공 펫 고정 슬롯) */
  petLinks?: PetLink[]
  /** 사냥 활동 해금 여부 — 승리 시 계통별 부산물(huntDrops)을 추가로 굴린다 */
  huntEnabled?: boolean
  huntDrops?: string[]
  /** 스토리 장면이 연 전투 — 지거나 도망치면 그 장면을 다시 볼 수 있게 되돌린다 */
  storyBeatId?: string
}

export type ScreenId =
  | 'title'
  | 'create'
  | 'world'
  | 'battle'
  | 'inventory'
  | 'character'
  | 'party'
  | 'shop'
  | 'tamer'
  | 'settings'
  | 'dialogue'
  | 'craft'
  | 'worldmap'
  | 'journal' // 학사 수첩 — 주간 미션·학사·도감·관계

export interface GameSettings {
  testMode: boolean
  bgmVolume: number
  sfxVolume: number
  battleAnimSpeed: 1 | 2
  /** true = 동료는 AI 자동 행동, false(기본) = 동료 턴에도 직접 조작 */
  companionAuto?: boolean
}

/** 플레이어가 바라보는 '화면 기준' 8방향(쿼터뷰라 셀 축 이동은 화면에서 대각으로 보인다) */
export type Facing = 'up' | 'down' | 'left' | 'right' | 'up-left' | 'up-right' | 'down-left' | 'down-right'

export interface GameState {
  screen: ScreenId
  previousScreen: ScreenId
  player: PlayerCharacter
  pet: Pet
  ownedPets: Pet[] // 보유 펫 도감(활성 펫 포함)
  position: { x: number; y: number }
  facing: Facing
  currentMapId: MapId
  currentZoneId: string
  /** 한 번이라도 들어가 본 맵 — 전체 지도 텔레포트 대상(2026-10-07). 옛 세이브엔 없음 */
  visitedMaps?: MapId[]
  inventory: InventorySlot[]
  fieldMonsters: FieldMonster[] // 현재 맵의 몬스터만 보유
  pendingEncounterUid: string | null // 접촉 시 전투 여부를 묻는 대상
  pendingPortalId: string | null // 접촉 시 이동 여부를 묻는 포탈
  /** 진행 중인 첫 이동 연출(lib/passages) — 통과하면 이 포탈로 넘어간다. 저장하지 않는다 */
  passage?: { id: import('./passages').PassageId; portalId: string } | null
  gateOpen: boolean // 군 통문 목적지 선택 오버레이
  activeNpcId: string | null
  activeShopId: string | null
  battle: BattleState | null
  settings: GameSettings
  toast: string | null
  housing: HousingState
  // ── 4년제 학사·생활 시스템(§학사 PRD) ──────────────────────────────────────
  /** 세이브마다 고정 — 주간 퀘스트 시드 등 재현 가능한 랜덤에 쓴다 */
  playerSeed: number
  /** 마을 배치 판 번호(lib/village-layout VILLAGE_LAYOUT) — 없는 옛 세이브는 마을 위치를 북쪽 확장만큼 민다 */
  villageLayout?: number
  calendar: CalendarState
  weekly: WeeklyState
  academics: AcademicState
  /** 스토리 플래그(§62) — 값은 bool 또는 단계 숫자 */
  storyFlags: Record<string, boolean | number>
  /** 재생 대기 중인 스토리 비트 id(lib/story.ts) — StoryOverlay 가 앞에서부터 보여준다 */
  storyQueue: string[]
  /** NPC·동료 관계도(§63) */
  relationships: Record<string, RelationshipState>
  companions: CompanionRoster
  /** 4대4 전투 진형 — 파티원별 포지션(§17) */
  formation: FormationState
  life: LifeState
  collections: CollectionState
  /** 먹은 요리 버프(한 번에 하나) */
  mealBuff: { itemId: string; battlesLeft: number } | null
  /** 낚시 미니게임 진행 중 상태 */
  fishing: FishingSession | null
  /** 진행 중인 수업 장면(저장 안 함) */
  classScene?: ClassSceneState | null
}

// ─────────────────────────────────────────────────────────────────────────────
// 4년제 학사 캘린더 (§3, §65) — 1년 = 1학기·여름방학·2학기·겨울방학 × 12주
// ─────────────────────────────────────────────────────────────────────────────
export type TermType = 'semester1' | 'summer' | 'semester2' | 'winter'

export interface CalendarState {
  /** 1 ~ 192. 학년/학기/주차는 전부 여기서 파생(단일 관리, §82-7) */
  globalWeek: number
}

// ─────────────────────────────────────────────────────────────────────────────
// 주간 퀘스트 (§4~7, §45~49, §66~68)
// ─────────────────────────────────────────────────────────────────────────────
export type QuestSlot = 'MAIN' | 'CLASS' | 'COMBAT' | 'LIFE' | 'FREE'
export type QuestCategory =
  | 'MAIN'
  | 'CLASS'
  | 'COMBAT'
  | 'GATHER'
  | 'HUNT'
  | 'FISH'
  | 'ALCHEMY'
  | 'COOK'
  | 'CRAFT'
  | 'NPC'
  | 'EXPLORE'
  | 'HOUSING'

export type QuestObjectiveType =
  | 'KILL' // targetId = 몬스터 id | 'family:beast' | 'any'
  | 'WIN_BATTLE' // targetId = RegionId | 'any'
  | 'GATHER' // targetId = 아이템 id | 'tag:herb' | 'any'  (채집 노드에서 얻은 것만)
  | 'HUNT' // targetId = 'tag:meat' 등 — 사냥 부산물 획득
  | 'FISH' // targetId = 물고기 id | 'any'
  | 'CRAFT'
  | 'COOK'
  | 'ALCHEMY' // targetId = 결과 아이템 id | 'any'
  | 'TALK' // targetId = NPC id | 'any'
  | 'VISIT' // targetId = MapId
  | 'PLACE_FURNITURE'

export interface QuestObjective {
  type: QuestObjectiveType
  targetId: string
  count: number
  label: string
}

export type QuestReward =
  | { type: 'EXP'; amount: number }
  | { type: 'GOLD'; amount: number }
  | { type: 'ITEM'; itemId: string; amount: number }
  | { type: 'COURSE'; amount: number; courseId?: string } // 이번 학기 수업 점수
  | { type: 'RELATIONSHIP'; npcId: string; amount: number }
  | { type: 'FLAG'; flag: string; value?: boolean | number }

export interface QuestInstance {
  instanceId: string
  templateId: string
  slot: QuestSlot
  progress: number[] // objectives 와 같은 길이
  /** offered = 이번 주 후보(수락 전) — 통합 PRD §27: 후보 중 2개를 골라 수행 */
  status: 'offered' | 'active' | 'complete' | 'claimed'
}

export interface WeeklyState {
  /** 이 주간 목록이 생성된 globalWeek */
  week: number
  quests: QuestInstance[]
  /** 중복 방지(§6.1) — templateId → 마지막 등장 주 */
  lastSeen: Record<string, number>
  /** 주간 구조 버전 — 2 = 수업 1 + 외부활동 2(통합 PRD). 없으면 예전 구조라 다시 생성 */
  format?: number
  /** 이번 주 필수 수업을 마쳤는가 */
  classDone?: boolean
}

/** 수업 1회 결과(§37) */
export interface ClassResultRec {
  week: number
  courseId: string
  kind: 'lecture' | 'practice' | 'midterm' | 'final'
  games: { type: string; score: number }[]
  score: number
  grade: 'S' | 'A' | 'B' | 'C' | 'D'
}

/** 수업 장면(교실 착석 → 강의 → 미니게임 → 수업 종료) — 저장하지 않는 진행 상태 */
export interface ClassSceneState {
  courseId: string
  courseIds: string[]
  kind: ClassResultRec['kind']
  label: string
  professorId: string
  room: MapId
  games: string[]
  index: number
  scores: { type: string; score: number; label: string }[]
  phase: 'lecture' | 'game' | 'result'
  /** 강의 끝 — 교수 머리 위 느낌표 */
  alert?: boolean
  seed: number
  returnTo: { mapId: MapId; position: { x: number; y: number } }
  /** 결과창 표시용(정산 후 채움) */
  result?: { score: number; grade: ClassResultRec['grade']; lines: string[] }
}

// ─────────────────────────────────────────────────────────────────────────────
// 학사 (§30~32, §59~61)
// ─────────────────────────────────────────────────────────────────────────────
export interface TermRecord {
  termIndex: number // 0~15
  courses: { courseId: string; score: number; grade: string; credit: number }[]
}

export interface AcademicState {
  /** 이번 학기 과목별 누적 점수(0~100) */
  courseScore: Record<string, number>
  totalCredits: number
  history: TermRecord[]
  /** 분야 숙련도 누적치(통합 PRD §14 — 마법학/전투학/연금·생활/제작/교양) */
  mastery?: Record<string, number>
  /** 수업 결과 기록(최근 것이 뒤) */
  classLog?: ClassResultRec[]
}

// ─────────────────────────────────────────────────────────────────────────────
// 관계 / 동료 (§63, §75)
// ─────────────────────────────────────────────────────────────────────────────
export interface RelationshipState {
  affinity: number // 0~100
  /** 마지막으로 대화 보너스를 받은 globalWeek (주 1회) */
  lastTalkWeek: number
}

export interface CompanionProgress {
  level: number
  exp: number
  hp: number
  mp: number
}

export interface CompanionRoster {
  /** 파티에 합류한 학교 NPC id → 성장 상태 */
  recruited: Record<string, CompanionProgress>
  /** 전투에 데려가는 학교 NPC(주인공 제외 최대 MAX_PARTY_SIZE - 1 = 3명, 0명 = 솔로) */
  party: string[]
  /** 임시 합류 NPC(호위 임무 대상·임시 동행) — 진형의 남는 2자리를 쓴다 */
  guests?: GuestMember[]
}

export interface GuestMember {
  id: string // GUEST_NPCS id
  level: number
  hp: number
  mp: number
}

/** 진형 — key 는 'hero' 또는 학교 NPC id */
export interface FormationState {
  positions: Record<string, Position>
  /** 전위 동료에게 붙인 펫(동료 id → 보유 펫 defId). 주인공 펫은 state.pet(전위일 때만 동행) — 통합 PRD §26 */
  pets?: Record<string, string>
}

// ─────────────────────────────────────────────────────────────────────────────
// 생활 콘텐츠 상태 (§33~37)
// ─────────────────────────────────────────────────────────────────────────────
export interface LifeState {
  /** 채집 노드 키(`${mapId}:${idx}`) → 채집한 시각(ms). 리스폰 시간이 지나면 다시 활성 */
  gatheredAt: Record<string, number>
}

export interface CollectionState {
  fish: Record<string, number>
  monsters: Record<string, number>
  gathered: Record<string, number>
  crafted: Record<string, number>
}

export interface FishingSession {
  fishId: string
  /** 0~1 — 판정 구간이 좁아지는 정도 */
  difficulty: number
}

/** 내 개인 공간에 배치한 가구 한 개 */
export interface PlacedFurniture {
  id: string
  defId: string
  cell: { x: number; y: number }
  /** 좌우 반전해서 놓았는가 */
  flip?: boolean
}

export interface HousingState {
  editMode: boolean
  placed: PlacedFurniture[]
  /** 배치 모드에서 고른 가구(옮기기·뒤집기·치우기 대상) */
  selectedId?: string | null
}
