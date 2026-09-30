// ============================================================================
// 마법학교 울토르 (원작 시스템 복원) — 도메인 타입 정의
// 설계 기준: Documents/울토르 시스템 DB.md
// 모든 화면/컴포넌트는 이 타입을 기준으로 데이터를 주고받는다.
// ============================================================================

/** 삼원 상성 순환: 화염계 > 빙결계 > 대지계 > 화염계 */
export type Element = 'fire' | 'ice' | 'earth'
export type ElementOrNeutral = Element | 'neutral'

export type Gender = 'male' | 'female'

/** 전직 5단계. 요구 레벨 1 / 10 / 20 / 30 / 40 */
export type JobTierId = 'apprentice' | 'novice' | 'adept' | 'magus' | 'archmagus'

export interface JobTier {
  id: JobTierId
  order: number // 0~4
  name: string // 견습 마법사 등
  shortName: string
  minLevel: number
  description: string
}

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

export type BuffId = 'defendGuard' | 'ironWall' | 'haste' | 'rally' | 'lastStand' | 'elemUp'

/** 전투원에 부착되는 상태이상/버프 인스턴스 */
export interface ActiveEffect {
  key: string // 인스턴스 고유 id
  kind: 'status' | 'buff'
  id: StatusId | BuffId
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
export type SkillKind = 'attack' | 'heal' | 'buff' | 'debuff' | 'utility'

export interface SkillStatusRider {
  id: StatusId
  chance: number // 0~1
  turns?: number
}

export interface Skill {
  id: string
  name: string
  element: ElementOrNeutral
  jobTier: JobTierId
  levelRequired: number
  mpCost: number
  atbCost?: number // 사용 후 추가 ATB 차감(궁극기 후딜)
  power: number // 위력 배율
  kind: SkillKind
  physical?: boolean // true면 atk/def 기반. 기본 false(마법)
  targeting: SkillTargeting
  status?: SkillStatusRider // 부여 상태이상
  buff?: { id: BuffId; magnitude: number; turns: number }
  cleanse?: boolean // 상태이상 해제
  reviveHpRatio?: number // 부활 스킬
  restoreMpRatio?: number // MP 회복 스킬(배율 * matk)
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
  requiredJobTier?: JobTierId
  /** 무기: 이 속성 스킬 위력 +8% */
  weaponElement?: Element
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
  }
  feedElement?: Element | 'neutral'
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
export type RecipeCategory = 'equipment' | 'alchemy' | 'cooking' | 'magicTool' | 'furniture' | 'costume'

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
// 펫 (원작: 최대 2마리 동반, 호감도, 스킬 훈련)
// 본 복원 1차 구현은 활성 슬롯 1마리 + 완전한 도감/호감도/훈련 데이터 모델.
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
  element: ElementOrNeutral
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

export interface Combatant {
  uid: string
  side: CombatantSide
  kind: 'hero' | 'pet' | 'ally' | 'monster'
  refId: string
  name: string
  icon: string
  element: ElementOrNeutral
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
  /** 동료(ally) 외형 — 4등신 히어로 시트를 빌려 쓰거나(학생) NPC 도트를 쓴다 */
  appearance?: { kind: 'hero'; element: Element; gender: Gender } | { kind: 'npc'; npcId: string }
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

export interface MonsterDef {
  id: string
  name: string
  level: number
  icon: string
  element: ElementOrNeutral
  family: MonsterFamily
  stats: Stats
  skills: string[]
  traits?: MonsterTrait[]
  expReward: number
  goldReward: number
  dropTable?: { itemId: string; chance: number }[]
  zoneKinds: ZoneKind[]
  /** 생략 시 'normal'. 중간보스/필드보스는 monstersForZoneKind 랜덤풀에서 제외되고 GameMap.bossSpawns로만 등장한다 */
  rank?: 'normal' | 'midBoss' | 'fieldBoss' | 'storyBoss'
  isTestMonster?: boolean
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
  /** 야생 맵: 이 셀이 길(포탈 연결로)인지 — 몬스터 배치가 길을 피하는 데 사용 */
  roadAt?: (x: number, y: number) => boolean
  /** render:'iso' 일 때: 건물·자연물 등 배치 오브젝트 */
  props?: import('./iso').PropDef[]
  /** render:'iso' 일 때: 바닥 위(오브젝트 아래)에 셀 좌표로 그리는 상감 마법진 — 마법학교 홀 등 */
  floorInlay?: { cx: number; cy: number; r: number; gold: string; blue: string }[]
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
  | 'jobTrainer'
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
export interface PlayerCharacter {
  name: string
  element: Element
  gender: Gender
  level: number
  exp: number
  jobTierId: JobTierId
  stats: Stats
  hp: number
  mp: number
  gold: number
  equipped: Partial<Record<EquipSlot, string>>
  learnedSkills: string[]
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
  element: ElementOrNeutral
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
  rewardGold?: number
  rewardDrops?: string[]
  leveledUp?: boolean
  jobChangedAvailable?: boolean
  /** 사냥 활동 해금 여부 — 승리 시 계통별 부산물(huntDrops)을 추가로 굴린다 */
  huntEnabled?: boolean
  huntDrops?: string[]
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
  | 'jobChange'
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
}

export interface GameState {
  screen: ScreenId
  previousScreen: ScreenId
  player: PlayerCharacter
  pet: Pet
  ownedPets: Pet[] // 보유 펫 도감(활성 펫 포함)
  position: { x: number; y: number }
  facing: 'up' | 'down' | 'left' | 'right'
  currentMapId: MapId
  currentZoneId: string
  inventory: InventorySlot[]
  fieldMonsters: FieldMonster[] // 현재 맵의 몬스터만 보유
  pendingEncounterUid: string | null // 접촉 시 전투 여부를 묻는 대상
  pendingPortalId: string | null // 접촉 시 이동 여부를 묻는 포탈
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
  life: LifeState
  collections: CollectionState
  /** 먹은 요리 버프(한 번에 하나) */
  mealBuff: { itemId: string; battlesLeft: number } | null
  /** 낚시 미니게임 진행 중 상태 */
  fishing: FishingSession | null
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
  status: 'active' | 'complete' | 'claimed'
}

export interface WeeklyState {
  /** 이 주간 목록이 생성된 globalWeek */
  week: number
  quests: QuestInstance[]
  /** 중복 방지(§6.1) — templateId → 마지막 등장 주 */
  lastSeen: Record<string, number>
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
  /** 합류한 동료 id → 성장 상태 */
  recruited: Record<string, CompanionProgress>
  /** 전투에 데려가는 동료(최대 MAX_PARTY_SIZE - 2) */
  party: string[]
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
}

export interface HousingState {
  editMode: boolean
  placed: PlacedFurniture[]
}
