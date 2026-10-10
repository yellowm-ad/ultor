import type { ItemDef, ItemRarity, MonsterDef, NpcDef, RecipeDef, Skill, Stats } from '@/lib/types'
import { computeStatsForLevel, toLevel100 } from '@/lib/constants'
import { legacyMonsterBaseExp, monsterBaseExp } from '@/lib/exp-table'
import { COURSES } from '@/lib/academics'
import { LIFE_ITEMS, LIFE_RECIPES } from '@/lib/life'
import { SCHOOL_NPCS } from '@/lib/companions'
import { VILLAGE_BASE_ZONE_IDS, villageShift } from '@/lib/village-layout'

const FIRE = '/images/elements/fire-crest.png'
const ICE = '/images/elements/ice-crest.png'
const EARTH = '/images/elements/earth-crest.png'
const DARK = '/images/elements/dark-crest.png'
const LIGHT = '/images/elements/light-crest.png'
const WIND = '/images/elements/wind-crest.png'
const NEUT = '/images/elements/neutral-crest.png'

// ============================================================================
// 스킬 — 설계: PRD v2.0 §4~8, §23~25
//  · 학생 스킬은 전부 학교 수업으로 배운다. 어떤 과목이 어떤 스킬을 가르치는지는 lib/academics.ts
//    COURSES[].teachesSkills 가 단일 원천이고, 아래 learnRequirements(course)는 거기서 자동으로 채운다.
//  · 전직·속성 진화 없음. 스킬 속성은 고정 태그다.
//  · 5속성 역할: 불꽃 공격/지속피해 · 얼음 제어 · 대지 방어/약화 · 어둠 디버프/환술/은신/즉사 · 빛 회복/강화/정화/부활
//  · 바람은 모르스 전용(owner 'mors') — 학생·NPC·일반 몬스터는 쓸 수 없다(전투 엔진이 런타임 검증).
//  · 속성 없음(null): 기본 행동·응급 처치·전술 계열.
// ============================================================================
const SKILL_DEFS: Skill[] = [
  // ── 불꽃 ────────────────────────────────────────────────────────────────
  { id: 'fire-basic-1', name: '불씨 던지기', element: 'fire', mpCost: 4, power: 1.0, kind: 'attack', targeting: 'singleEnemy', status: { id: 'burn', chance: 0.2 }, icon: FIRE, description: '작은 불씨를 던져 화염 피해를 입히고 낮은 확률로 화상.' },
  { id: 'fire-basic-2', name: '화염 방패', element: 'fire', mpCost: 5, power: 0, kind: 'buff', targeting: 'self', buff: { id: 'rally', magnitude: 0.15, turns: 3 }, icon: FIRE, description: '몸 주위에 불꽃 장막을 둘러 공격력·마법 공격력을 높인다.' },
  { id: 'fire-basic-3', name: '화염 강타', element: 'fire', mpCost: 8, power: 1.5, kind: 'attack', targeting: 'singleEnemy', status: { id: 'burn', chance: 0.35 }, icon: FIRE, description: '압축한 화염으로 적 하나를 강타한다.' },
  { id: 'fire-adv-1', name: '불의 채찍', element: 'fire', mpCost: 7, power: 1.2, kind: 'attack', targeting: 'singleEnemy', status: { id: 'bleed', chance: 0.3 }, icon: FIRE, description: '불의 채찍으로 적을 찢어 출혈을 유발한다.' },
  { id: 'fire-adv-2', name: '불의 고리', element: 'fire', mpCost: 12, power: 1.6, kind: 'attack', targeting: 'allEnemies', status: { id: 'burn', chance: 0.25 }, icon: FIRE, description: '불의 고리를 펼쳐 모든 적을 태운다.' },
  { id: 'fire-adv-3', name: '발화', element: 'fire', mpCost: 10, power: 0.2, kind: 'debuff', targeting: 'allEnemies', status: { id: 'burn', chance: 0.6 }, icon: FIRE, description: '적 전체에 불을 붙여 강한 화상을 남긴다.' },
  { id: 'fire-adv-4', name: '온기', element: 'fire', mpCost: 5, power: 0.8, kind: 'heal', targeting: 'self', icon: FIRE, description: '따뜻한 불기운으로 자신의 HP를 회복한다.' },
  { id: 'fire-high-1', name: '폭염 폭발', element: 'fire', mpCost: 16, power: 2.3, kind: 'attack', targeting: 'allEnemies', status: { id: 'burn', chance: 0.4 }, icon: FIRE, description: '폭발적인 열기로 전장을 휩쓴다.' },
  { id: 'fire-high-2', name: '인페르노 낙인', element: 'fire', mpCost: 15, power: 1.8, kind: 'attack', targeting: 'singleEnemy', status: { id: 'burn', chance: 0.5 }, icon: FIRE, description: '적에게 불의 낙인을 새겨 극심한 화상을 남긴다.' },
  { id: 'fire-master-1', name: '멸화의 심판', element: 'fire', levelRequired: 40, mpCost: 24, atbCost: 30, power: 3.3, kind: 'attack', targeting: 'allEnemies', status: { id: 'burn', chance: 0.5 }, icon: FIRE, description: '울토르 최상위 화염 마법으로 전장을 불태운다. 사용 후 후딜이 크다.' },
  { id: 'fire-master-2', name: '태초의 불꽃', element: 'fire', levelRequired: 50, mpCost: 28, atbCost: 35, power: 2.8, kind: 'attack', targeting: 'allEnemies', status: { id: 'bleed', chance: 0.4 }, icon: FIRE, description: '모든 불꽃의 근원을 불러내 적 전체를 꿰뚫고 깊은 상처를 남긴다.' },

  // ── 얼음 ────────────────────────────────────────────────────────────────
  { id: 'ice-basic-1', name: '서리 화살', element: 'ice', mpCost: 4, power: 1.0, kind: 'attack', targeting: 'singleEnemy', status: { id: 'slow', chance: 0.25 }, icon: ICE, description: '서리 화살을 쏘아 적을 느리게 만든다.' },
  { id: 'ice-basic-2', name: '얼음 방패', element: 'ice', mpCost: 5, power: 0, kind: 'buff', targeting: 'self', buff: { id: 'ironWall', magnitude: 0.4, turns: 3 }, icon: ICE, description: '얼음 방패로 자신의 방어력을 크게 높인다.' },
  { id: 'ice-basic-3', name: '냉기 파동', element: 'ice', mpCost: 8, power: 1.4, kind: 'attack', targeting: 'singleEnemy', status: { id: 'slow', chance: 0.4 }, icon: ICE, description: '냉기 파동으로 적을 얼려 둔화시킨다.' },
  { id: 'ice-adv-1', name: '빙결 손아귀', element: 'ice', mpCost: 8, power: 1.1, kind: 'attack', targeting: 'singleEnemy', status: { id: 'paralysis', chance: 0.3 }, icon: ICE, description: '얼음 손아귀로 적을 붙잡아 마비시킨다.' },
  { id: 'ice-adv-2', name: '눈보라', element: 'ice', mpCost: 12, power: 1.5, kind: 'attack', targeting: 'allEnemies', status: { id: 'slow', chance: 0.35 }, icon: ICE, description: '눈보라를 일으켜 모든 적을 둔화시킨다.' },
  { id: 'ice-adv-3', name: '절대영도', element: 'ice', mpCost: 12, power: 1.0, kind: 'debuff', targeting: 'singleEnemy', status: { id: 'paralysis', chance: 0.7 }, icon: ICE, description: '주변 온도를 절대영도로 떨어뜨려 적을 완전히 얼린다.' },
  { id: 'ice-high-1', name: '블리자드', element: 'ice', mpCost: 16, power: 2.2, kind: 'attack', targeting: 'allEnemies', status: { id: 'slow', chance: 0.5 }, icon: ICE, description: '거대한 눈폭풍으로 전장을 뒤덮는다.' },
  { id: 'ice-high-2', name: '빙하기', element: 'ice', mpCost: 17, power: 1.6, kind: 'attack', targeting: 'allEnemies', status: { id: 'paralysis', chance: 0.4 }, icon: ICE, description: '일대를 빙하로 만들어 적들을 얼어붙게 한다.' },
  { id: 'ice-master-1', name: '영겁의 빙옥', element: 'ice', levelRequired: 40, mpCost: 24, atbCost: 30, power: 3.0, kind: 'attack', targeting: 'allEnemies', status: { id: 'paralysis', chance: 0.5 }, icon: ICE, description: '영원히 녹지 않는 빙옥에 적 전체를 가둔다.' },
  { id: 'ice-master-2', name: '빙하 붕괴', element: 'ice', levelRequired: 50, mpCost: 28, atbCost: 35, power: 2.7, kind: 'attack', targeting: 'allEnemies', status: { id: 'slow', chance: 0.6 }, icon: ICE, description: '거대한 빙하를 전장 위로 무너뜨려 적 전체를 짓누르고 감속시킨다.' },

  // ── 대지 ────────────────────────────────────────────────────────────────
  { id: 'earth-basic-1', name: '돌팔매', element: 'earth', mpCost: 3, power: 1.0, kind: 'attack', physical: true, targeting: 'singleEnemy', icon: EARTH, description: '단단한 돌을 던져 물리 피해를 입힌다.' },
  { id: 'earth-basic-2', name: '단단한 살갗', element: 'earth', mpCost: 5, power: 0, kind: 'buff', targeting: 'self', buff: { id: 'ironWall', magnitude: 0.4, turns: 3 }, icon: EARTH, description: '피부를 돌처럼 굳혀 방어력을 높인다.' },
  { id: 'earth-basic-3', name: '대지 강타', element: 'earth', mpCost: 8, power: 1.4, kind: 'attack', targeting: 'singleEnemy', status: { id: 'weaken', chance: 0.3 }, icon: EARTH, description: '땅의 힘을 실어 내려쳐 적을 약화시킨다.' },
  { id: 'earth-adv-1', name: '모래 수렁', element: 'earth', mpCost: 7, power: 0.6, kind: 'debuff', targeting: 'singleEnemy', status: { id: 'slow', chance: 0.5 }, icon: EARTH, description: '발밑을 수렁으로 만들어 적을 붙잡는다.' },
  { id: 'earth-adv-2', name: '철벽 방어', element: 'earth', mpCost: 10, power: 0, kind: 'buff', targeting: 'allAllies', buff: { id: 'ironWall', magnitude: 0.4, turns: 3 }, icon: EARTH, description: '아군 전체를 바위 장벽으로 감싼다.' },
  { id: 'earth-adv-3', name: '최면 가루', element: 'earth', mpCost: 9, power: 0, kind: 'debuff', targeting: 'singleEnemy', status: { id: 'sleep', chance: 0.65 }, icon: EARTH, description: '최면 가루를 뿌려 적을 잠재운다.' },
  { id: 'earth-high-1', name: '지진', element: 'earth', mpCost: 16, power: 2.2, kind: 'attack', targeting: 'allEnemies', status: { id: 'weaken', chance: 0.4 }, icon: EARTH, description: '대지를 뒤흔들어 모든 적을 강타하고 약화시킨다.' },
  { id: 'earth-high-2', name: '석화의 시선', element: 'earth', mpCost: 16, power: 1.2, kind: 'attack', targeting: 'singleEnemy', status: { id: 'paralysis', chance: 0.55 }, icon: EARTH, description: '적을 돌로 굳혀 움직임을 봉인한다.' },
  { id: 'earth-master-1', name: '대지의 분노', element: 'earth', levelRequired: 40, mpCost: 24, atbCost: 30, power: 3.2, kind: 'attack', targeting: 'allEnemies', status: { id: 'weaken', chance: 0.5 }, icon: EARTH, description: '대지 그 자체의 분노를 적에게 쏟아낸다.' },
  { id: 'earth-master-2', name: '대지의 장막', element: 'earth', levelRequired: 50, mpCost: 28, atbCost: 35, power: 2.5, kind: 'attack', targeting: 'allEnemies', status: { id: 'sleep', chance: 0.4 }, icon: EARTH, description: '흙먼지 장막이 적 전체를 덮쳐 짓누르고 잠재운다.' },

  // ── 어둠 — 제어/기만 (3학년부터) ─────────────────────────────────────────
  { id: 'dark-curse', name: '쇠약의 저주', element: 'dark', mpCost: 6, power: 0, kind: 'debuff', targeting: 'singleEnemy', debuff: { id: 'atkDown', magnitude: 0.25, turns: 3, chance: 0.85 }, icon: DARK, description: '적 하나의 공격력·마법 공격력을 크게 떨어뜨린다.' },
  { id: 'dark-veil', name: '그림자 장막', element: 'dark', mpCost: 8, power: 0, kind: 'stealth', targeting: 'singleAlly', buff: { id: 'stealth', magnitude: 1, turns: 2 }, icon: DARK, description: '아군 하나를 그림자로 감춰 단일 대상 공격을 피하게 한다. 광역 공격은 막지 못한다.' },
  { id: 'dark-illusion', name: '혼란의 환술', element: 'dark', mpCost: 9, power: 0, kind: 'illusion', targeting: 'singleEnemy', debuff: { id: 'illusion', magnitude: 0.5, turns: 3, chance: 0.75 }, icon: DARK, description: '환영을 씌워 적의 공격 대상을 뒤섞고 명중률을 떨어뜨린다.' },
  { id: 'dark-execute', name: '사신의 낙인', element: 'dark', mpCost: 12, power: 0, kind: 'execute', targeting: 'singleEnemy', execute: { normalOnly: true, successChance: 0.15, bossDamage: 0 }, icon: DARK, description: '일반 몬스터를 15% 확률로 즉사시킨다. 엘리트·보스에게는 통하지 않으며 피해도 주지 않는다.' },
  { id: 'dark-seal', name: '침묵의 인장', element: 'dark', mpCost: 8, power: 0, kind: 'debuff', targeting: 'singleEnemy', status: { id: 'silence', chance: 0.6 }, icon: DARK, description: '어둠의 인장으로 적의 주문을 봉인한다.' },
  { id: 'dark-miasma', name: '저주의 안개', element: 'dark', mpCost: 14, power: 0, kind: 'debuff', targeting: 'allEnemies', debuff: { id: 'defDown', magnitude: 0.2, turns: 3, chance: 0.8 }, icon: DARK, description: '저주가 서린 안개로 적 전체의 방어력·마법 방어력을 떨어뜨린다.' },
  { id: 'dark-gaze', name: '심연의 시선', element: 'dark', mpCost: 14, power: 0, kind: 'debuff', targeting: 'allEnemies', status: { id: 'blind', chance: 0.5 }, icon: DARK, description: '심연을 들여다보게 해 적 전체의 시야를 앗아간다.' },
  { id: 'dark-sentence', name: '죽음의 선고', element: 'dark', levelRequired: 45, mpCost: 26, atbCost: 25, power: 0, kind: 'execute', targeting: 'allEnemies', execute: { normalOnly: true, successChance: 0.12, bossDamage: 0 }, icon: DARK, description: '적 전체의 일반 몬스터에게 각각 12% 즉사 판정. 엘리트·보스에게는 통하지 않는다.' },

  // ── 빛 — 회복/강화/정화/부활 (3학년부터) ─────────────────────────────────
  { id: 'light-heal', name: '치유의 빛', element: 'light', mpCost: 7, power: 1.3, kind: 'heal', targeting: 'singleAlly', icon: LIGHT, description: '따스한 빛으로 아군 하나의 HP를 회복한다.' },
  { id: 'light-might', name: '힘의 축복', element: 'light', mpCost: 7, power: 0, kind: 'buff', targeting: 'singleAlly', buff: { id: 'atkUp', magnitude: 0.25, turns: 3 }, icon: LIGHT, description: '아군 하나의 공격력을 높인다.' },
  { id: 'light-purify', name: '정화', element: 'light', mpCost: 8, power: 0, kind: 'utility', targeting: 'singleAlly', cleanse: true, icon: LIGHT, description: '아군 하나의 상태이상과 약화를 모두 씻어낸다.' },
  { id: 'light-revive', name: '소생의 빛', element: 'light', mpCost: 20, power: 0, kind: 'revive', targeting: 'singleAlly', reviveHpRatio: 0.5, icon: LIGHT, description: '전투불능 아군 하나를 HP 절반으로 되살린다.' },
  { id: 'light-sanctuary', name: '성역의 빛', element: 'light', mpCost: 18, power: 0.8, kind: 'heal', targeting: 'allAllies', icon: LIGHT, description: '성역을 펼쳐 아군 전체의 HP를 회복한다.' },
  { id: 'light-wisdom', name: '지혜의 축복', element: 'light', mpCost: 7, power: 0, kind: 'buff', targeting: 'singleAlly', buff: { id: 'matkUp', magnitude: 0.25, turns: 3 }, icon: LIGHT, description: '아군 하나의 마법 공격력을 높인다.' },
  { id: 'light-bulwark', name: '철벽의 축복', element: 'light', mpCost: 7, power: 0, kind: 'buff', targeting: 'singleAlly', buff: { id: 'defUp', magnitude: 0.3, turns: 3 }, icon: LIGHT, description: '아군 하나의 방어력을 크게 높인다.' },
  { id: 'light-ward', name: '수호의 축복', element: 'light', mpCost: 14, power: 0, kind: 'buff', targeting: 'allAllies', buff: { id: 'mdefUp', magnitude: 0.3, turns: 3 }, icon: LIGHT, description: '아군 전체의 마법 방어력을 높인다.' },
  { id: 'light-haste', name: '신속의 축복', element: 'light', mpCost: 14, power: 0, kind: 'buff', targeting: 'allAllies', buff: { id: 'haste', magnitude: 0.3, turns: 3 }, icon: LIGHT, description: '아군 전체의 속도를 높인다.' },
  { id: 'light-rebirth', name: '대부활', element: 'light', levelRequired: 50, mpCost: 40, atbCost: 35, power: 0, kind: 'revive', targeting: 'allAllies', reviveHpRatio: 0.3, icon: LIGHT, description: '쓰러진 아군 전원을 HP 30%로 되살린다. 사용 후 후딜이 크다.' },

  // ── 속성 없음 — 응급·전술 ───────────────────────────────────────────────
  { id: 'n-focus', name: '정신 집중', element: null, mpCost: 0, atbCost: 20, power: 0, kind: 'utility', targeting: 'self', restoreMpRatio: 1.0, icon: NEUT, description: '정신을 가다듬어 자신의 MP를 회복한다. (후딜 있음)' },
  { id: 'n-firstaid', name: '응급 처치', element: null, mpCost: 6, power: 1.0, kind: 'heal', targeting: 'singleAlly', icon: NEUT, description: '붕대와 약초로 아군 하나의 HP를 조금 회복한다.' },
  { id: 'n-rally', name: '전열 정비', element: null, mpCost: 12, power: 0, kind: 'buff', targeting: 'allAllies', buff: { id: 'rally', magnitude: 0.15, turns: 3 }, icon: NEUT, description: '아군 전체의 공격력·마법공격력을 높인다.' },
  { id: 'n-laststand', name: '배수의 진', element: null, mpCost: 10, power: 0, kind: 'buff', targeting: 'self', buff: { id: 'lastStand', magnitude: 0.3, turns: 3 }, icon: NEUT, description: '주는 피해가 크게 늘지만 받는 피해도 늘어난다.' },

  // ── 바람 — 모르스 전용(유실된 속성) ───────────────────────────────────
  { id: 'wind-lost-gale', name: '잊힌 돌풍', element: 'wind', owner: 'mors', mpCost: 10, power: 1.6, kind: 'attack', targeting: 'allEnemies', icon: WIND, description: '인간이 잊은 바람이 전장을 휩쓴다.' },
  { id: 'wind-vacuum-blade', name: '진공의 칼날', element: 'wind', owner: 'mors', mpCost: 14, power: 2.4, kind: 'attack', targeting: 'singleEnemy', status: { id: 'bleed', chance: 0.45 }, icon: WIND, description: '공기를 찢어 만든 진공의 칼날이 적 하나를 베어낸다.' },
  { id: 'wind-tempest', name: '종언의 폭풍', element: 'wind', owner: 'mors', mpCost: 30, atbCost: 35, power: 2.8, kind: 'attack', targeting: 'allEnemies', debuff: { id: 'accDown', magnitude: 0.3, turns: 3 }, icon: WIND, description: '모든 것을 끝내는 폭풍. 적 전체를 강타하고 눈을 가린다.' },

  // ── 펫: 고유 스킬 ──────────────────────────────────────────────────────
  { id: 'pet-scratch', name: '할퀴기', element: null, owner: 'pet', mpCost: 0, power: 0.8, kind: 'attack', physical: true, targeting: 'singleEnemy', icon: NEUT, description: '발톱으로 적을 할퀸다.' },
  { id: 'pet-bite', name: '물어뜯기', element: null, owner: 'pet', mpCost: 0, power: 0.9, kind: 'attack', physical: true, targeting: 'singleEnemy', icon: NEUT, description: '적을 세게 물어뜯는다.' },
  { id: 'pet-peck', name: '쪼기', element: null, owner: 'pet', mpCost: 0, power: 0.8, kind: 'attack', physical: true, targeting: 'singleEnemy', icon: NEUT, description: '부리로 적을 빠르게 쫀다.' },
  { id: 'pet-headbutt', name: '박치기', element: null, owner: 'pet', mpCost: 0, power: 0.9, kind: 'attack', physical: true, targeting: 'singleEnemy', icon: NEUT, description: '단단한 머리로 들이받는다.' },
  { id: 'pet-slam', name: '내려찍기', element: null, owner: 'pet', mpCost: 0, power: 1.0, kind: 'attack', physical: true, targeting: 'singleEnemy', icon: NEUT, description: '온몸으로 적을 내려찍는다.' },
  { id: 'pet-glow', name: '온빛', element: 'light', owner: 'pet', mpCost: 3, power: 0.6, kind: 'heal', targeting: 'singleAlly', icon: LIGHT, description: '부드러운 빛으로 아군을 감싸 HP를 회복한다.' },
  { id: 'pet-shadow-claw', name: '그림자 발톱', element: 'dark', owner: 'pet', mpCost: 0, power: 1.0, kind: 'attack', physical: true, targeting: 'singleEnemy', icon: DARK, description: '그림자를 두른 발톱으로 적을 벤다.' },

  // ── 펫: 훈련 스킬 ──────────────────────────────────────────────────────
  { id: 'pet-fire-breath', name: '불꽃 숨결', element: 'fire', owner: 'pet', mpCost: 6, power: 1.2, kind: 'attack', targeting: 'singleEnemy', status: { id: 'burn', chance: 0.3 }, icon: FIRE, description: '작은 불꽃을 내뿜어 적을 태운다.' },
  { id: 'pet-guard', name: '가드', element: null, owner: 'pet', mpCost: 4, power: 0, kind: 'buff', targeting: 'self', buff: { id: 'ironWall', magnitude: 0.4, turns: 3 }, icon: NEUT, description: '몸을 웅크려 방어 태세를 취한다.' },
  { id: 'pet-burn-fang', name: '작열의 송곳니', element: 'fire', owner: 'pet', mpCost: 7, power: 1.3, kind: 'attack', physical: true, targeting: 'singleEnemy', status: { id: 'burn', chance: 0.4 }, icon: FIRE, description: '달아오른 송곳니로 적을 물어 화상을 남긴다.' },
  { id: 'pet-roar-atk', name: '포효', element: null, owner: 'pet', mpCost: 8, power: 0, kind: 'buff', targeting: 'allAllies', buff: { id: 'rally', magnitude: 0.12, turns: 3 }, icon: NEUT, description: '우렁찬 포효로 아군의 사기를 끌어올린다.' },
  { id: 'pet-frost-nip', name: '서리 물기', element: 'ice', owner: 'pet', mpCost: 6, power: 1.1, kind: 'attack', targeting: 'singleEnemy', status: { id: 'slow', chance: 0.35 }, icon: ICE, description: '차가운 이빨로 적을 물어 둔화시킨다.' },
  { id: 'pet-slow-howl', name: '한기 울음', element: 'ice', owner: 'pet', mpCost: 8, power: 0, kind: 'debuff', targeting: 'allEnemies', status: { id: 'slow', chance: 0.4 }, icon: ICE, description: '차가운 울음소리로 적 전체를 느리게 만든다.' },
  { id: 'pet-ice-shard', name: '얼음 파편', element: 'ice', owner: 'pet', mpCost: 7, power: 1.3, kind: 'attack', targeting: 'singleEnemy', status: { id: 'slow', chance: 0.3 }, icon: ICE, description: '날카로운 얼음 파편을 날린다.' },
  { id: 'pet-mp-song', name: '마나의 노래', element: null, owner: 'pet', mpCost: 0, power: 0, kind: 'utility', targeting: 'self', restoreMpRatio: 0.8, icon: NEUT, description: '맑은 노래로 자신의 마나를 되찾는다.' },
  { id: 'pet-stone-skin', name: '바위 가죽', element: 'earth', owner: 'pet', mpCost: 5, power: 0, kind: 'buff', targeting: 'self', buff: { id: 'ironWall', magnitude: 0.5, turns: 3 }, icon: EARTH, description: '가죽을 바위처럼 굳혀 방어에 전념한다.' },
  { id: 'pet-taunt', name: '위협', element: null, owner: 'pet', mpCost: 6, power: 0, kind: 'debuff', targeting: 'allEnemies', status: { id: 'weaken', chance: 0.3 }, icon: NEUT, description: '적을 위협해 기세를 꺾는다.' },
  { id: 'pet-quake-stomp', name: '진동 밟기', element: 'earth', owner: 'pet', mpCost: 9, power: 1.4, kind: 'attack', physical: true, targeting: 'allEnemies', status: { id: 'weaken', chance: 0.3 }, icon: EARTH, description: '땅을 강하게 밟아 진동으로 적 전체를 흔든다.' },
  { id: 'pet-shield-ally', name: '수호의 벽', element: null, owner: 'pet', mpCost: 8, power: 0, kind: 'buff', targeting: 'allAllies', buff: { id: 'ironWall', magnitude: 0.35, turns: 3 }, icon: NEUT, description: '아군 전체를 감싸는 보호막을 만든다.' },
  { id: 'pet-heal-lite', name: '치유의 빛', element: 'light', owner: 'pet', mpCost: 6, power: 1.0, kind: 'heal', targeting: 'singleAlly', icon: LIGHT, description: '따뜻한 빛으로 아군의 상처를 아문다.' },
  { id: 'pet-cleanse', name: '정결', element: 'light', owner: 'pet', mpCost: 8, power: 0, kind: 'utility', targeting: 'singleAlly', cleanse: true, icon: LIGHT, description: '아군의 상태이상을 씻어낸다.' },
  { id: 'pet-silence-hiss', name: '침묵의 쉿', element: 'dark', owner: 'pet', mpCost: 7, power: 0, kind: 'debuff', targeting: 'singleEnemy', status: { id: 'silence', chance: 0.5 }, icon: DARK, description: '기묘한 소리로 적의 주문을 봉인한다.' },
  { id: 'pet-blind-dust', name: '눈속임 가루', element: 'dark', owner: 'pet', mpCost: 7, power: 0, kind: 'debuff', targeting: 'singleEnemy', status: { id: 'blind', chance: 0.5 }, icon: DARK, description: '가루를 뿌려 적의 시야를 흐린다.' },
]

/** 수업 → 스킬 습득 조건 자동 부착(커리큘럼 단일 원천: COURSES[].teachesSkills) */
const COURSE_OF_SKILL = new Map<string, string>()
for (const c of COURSES) for (const id of c.teachesSkills ?? []) COURSE_OF_SKILL.set(id, c.id)

export const SKILLS: Skill[] = SKILL_DEFS.map((s) => {
  const courseId = COURSE_OF_SKILL.get(s.id)
  return courseId ? { ...s, learnRequirements: [{ type: 'course' as const, id: courseId }, ...(s.learnRequirements ?? [])] } : s
})

const SKILL_MAP = new Map(SKILLS.map((s) => [s.id, s]))
export function skillById(id: string): Skill | undefined {
  return SKILL_MAP.get(id)
}
export function skillsForElement(element: string | null): Skill[] {
  return SKILLS.filter((s) => s.element === element)
}
/** 학교 수업으로 배우는 학생 스킬(펫·모르스 전용 제외) */
export function isStudentSkill(s: Skill): boolean {
  return !s.owner && !!s.learnRequirements?.length
}

// ============================================================================
// 아이템 — 설계: §10, PRD v2.0 §28~30
//  · 착용 조건은 전직 단계가 아니라 레벨(requiredLevel). 티어 T1~T5 = Lv.1/20/40/60/80
//  · 장비 스탯 보너스는 Lv.100 스탯 성장(레벨당 성장치 2배)에 맞춰 GEAR_STAT_SCALE 로 키운다.
// ============================================================================
type Tier = 1 | 2 | 3 | 4 | 5
export const TIER_REQUIRED_LEVEL: Record<Tier, number> = { 1: 1, 2: 20, 3: 40, 4: 60, 5: 80 }
const REQ_LEVEL = (t: Tier): number | undefined => (t === 1 ? undefined : TIER_REQUIRED_LEVEL[t])
/** Lv.100 확장으로 캐릭터 스탯 성장 폭이 2배가 되어 장비 수치도 같은 비율로 올린다 */
const GEAR_STAT_SCALE = 2
const WAND_PRICE: Record<Tier, number> = { 1: 300, 2: 1000, 3: 2600, 4: 5400, 5: 11000 }
const WAND_BONUS: Record<Tier, { atk: number; matk: number }> = {
  1: { atk: 3, matk: 6 },
  2: { atk: 6, matk: 12 },
  3: { atk: 10, matk: 20 },
  4: { atk: 15, matk: 30 },
  5: { atk: 22, matk: 44 },
}
const ROBE_PRICE: Record<Tier, number> = { 1: 150, 2: 800, 3: 2000, 4: 4500, 5: 9000 }
const ROBE_BONUS: Record<Tier, Partial<Stats>> = {
  1: { def: 3, mdef: 3 },
  2: { def: 6, mdef: 6, maxHp: 10 },
  3: { def: 10, mdef: 10, maxHp: 20 },
  4: { def: 16, mdef: 16, maxHp: 32 },
  5: { def: 26, mdef: 26, maxHp: 50 },
}
/** 상점/일반 장비 기본 배치(§장비·아이템 PRD §6) — T5는 기본값 mythic, unique는 필드보스 제작 전용 */
const RARITY_BY_TIER: Record<Tier, ItemRarity> = { 1: 'common', 2: 'uncommon', 3: 'rare', 4: 'mythic', 5: 'mythic' }
const ELEM_KO = { fire: '화염', ice: '빙결', earth: '대지', dark: '암흑', light: '광휘' } as const
const WAND_ICON: Record<Tier, string> = {
  1: '/images/items/wand.svg',
  2: '/images/items/wand.svg',
  3: '/images/items/wand-adv.svg',
  4: '/images/items/wand-adv.svg',
  5: '/images/items/wand-adv.svg',
}

// 5속성 × 5티어 = 25종(§29). 바람 완드는 존재하지 않는다.
const wands: ItemDef[] = (['fire', 'ice', 'earth', 'dark', 'light'] as const).flatMap((el) =>
  ([1, 2, 3, 4, 5] as Tier[]).map(
    (t): ItemDef => ({
      id: `wand-${el}-t${t}`,
      name: `${ELEM_KO[el]} 완드${t > 1 ? ' +' + (t - 1) : ''}`,
      type: 'weapon',
      icon: WAND_ICON[t],
      description: `${ELEM_KO[el]} 기운이 깃든 완드. 같은 속성 스킬 위력 +8%.`,
      price: WAND_PRICE[t],
      sellPrice: Math.round(WAND_PRICE[t] * 0.3),
      requiredLevel: REQ_LEVEL(t),
      weaponElement: el,
      statBonus: { atk: WAND_BONUS[t].atk, matk: WAND_BONUS[t].matk },
      stackable: false,
      maxStack: 1,
      tier: t,
      rarity: RARITY_BY_TIER[t],
      shopBuyable: true,
      craftable: false,
    }),
  ),
)

const robes: ItemDef[] = ([1, 2, 3, 4, 5] as Tier[]).map(
  (t): ItemDef => ({
    id: `robe-t${t}`,
    name: ['신입생', '2학년', '3학년', '4학년', '수석'][t - 1] + '의 로브',
    type: 'armor',
    icon: '/images/items/robe.svg',
    description: '울토르 마법학교 지급 로브.',
    price: ROBE_PRICE[t],
    sellPrice: Math.round(ROBE_PRICE[t] * 0.3),
    requiredLevel: REQ_LEVEL(t),
    statBonus: ROBE_BONUS[t],
    stackable: false,
    maxStack: 1,
    tier: t,
    rarity: RARITY_BY_TIER[t],
    shopBuyable: true,
    craftable: false,
  }),
)

const hats: ItemDef[] = [
  { id: 'hat-cloth', name: '천 모자', type: 'armor', icon: '/images/items/hat-cloth.png', description: '신입생 기본 지급 모자. 가볍고 수수하다.', price: 120, sellPrice: 36, statBonus: { mdef: 3, maxMp: 8 }, stackable: false, maxStack: 1, tier: 1, rarity: 'common', shopBuyable: true, craftable: false },
  { id: 'hat-pointed', name: '뾰족 모자', type: 'armor', icon: '/images/items/hat-pointed.png', description: '정통 마법사의 이미지 그 자체인 뾰족 모자.', price: 500, sellPrice: 150, requiredLevel: 20, statBonus: { mdef: 6, maxMp: 14 }, stackable: false, maxStack: 1, tier: 2, rarity: 'uncommon', shopBuyable: true, craftable: false },
  { id: 'hat-bag', name: '봉지 모자', type: 'armor', icon: '/images/items/hat-bag.png', description: '머리에 천 봉지를 뒤집어쓴 것 같은 괴상한 모자. 그런데 은근히 행운이 따른다.', price: 380, sellPrice: 114, requiredLevel: 20, statBonus: { luck: 5, mdef: 4 }, stackable: false, maxStack: 1, tier: 2, rarity: 'uncommon', shopBuyable: true, craftable: false },
  { id: 'hat-skilled', name: '숙련의 모자', type: 'armor', icon: '/images/items/hat-skilled.png', description: '마법학교 우수 학생들이 쓰는 모자. MP 운용에 능하다.', price: 1200, sellPrice: 360, requiredLevel: 40, statBonus: { mdef: 8, maxMp: 30 }, stackable: false, maxStack: 1, tier: 3, rarity: 'rare', shopBuyable: true, craftable: false },
  { id: 'hat-alchemy', name: '연금술의 모자', type: 'armor', icon: '/images/items/hat-alchemy.png', description: '작은 플라스크와 약초가 매달린 연금술사의 모자.', price: 1200, sellPrice: 360, requiredLevel: 40, statBonus: { mdef: 8, luck: 6 }, stackable: false, maxStack: 1, tier: 3, rarity: 'rare', shopBuyable: true, craftable: false },
  { id: 'hat-school', name: '어느 마법학교의 모자', type: 'armor', icon: '/images/items/hat-school.png', description: '낡고 색바랜 모자. 착용자의 재능을 판단하는 데에는 제법 쓸모가 있었다고 한다.', price: 3000, sellPrice: 900, requiredLevel: 60, statBonus: { mdef: 14, matk: 10, luck: 4 }, stackable: false, maxStack: 1, tier: 4, rarity: 'mythic', shopBuyable: true, craftable: false },
  { id: 'hat-arch', name: '현자의 관', type: 'armor', icon: '/images/items/hat-arch.png', description: '왕관과 마법사 모자를 혼합한, 최상급 마법사들이 쓰는 관.', price: 7000, sellPrice: 2100, requiredLevel: 80, statBonus: { mdef: 18, maxMp: 40 }, stackable: false, maxStack: 1, tier: 5, rarity: 'mythic', shopBuyable: true, craftable: false },
  { id: 'hat-star-sage', name: '별의 현자 모자', type: 'armor', icon: '/images/items/hat-star-sage.png', description: '천체와 별자리 마법을 연구한 옛 현자의 유물.', price: 6500, sellPrice: 1950, requiredLevel: 80, statBonus: { matk: 20, luck: 10 }, stackable: false, maxStack: 1, tier: 5, rarity: 'mythic', shopBuyable: true, craftable: false },
]

const accessories: ItemDef[] = [
  { id: 'acc-ring-luck', name: '행운의 반지', type: 'accessory', icon: '/images/items/ring.svg', description: '착용자에게 행운을 더한다.', price: 600, sellPrice: 180, statBonus: { luck: 5 }, stackable: false, maxStack: 1, tier: 2, rarity: 'uncommon', shopBuyable: true, craftable: false },
  { id: 'acc-amulet-mana', name: '마나의 목걸이', type: 'accessory', icon: '/images/items/amulet.svg', description: 'MP 최대치를 늘려준다.', price: 900, sellPrice: 270, statBonus: { maxMp: 20 }, stackable: false, maxStack: 1, tier: 2, rarity: 'uncommon', shopBuyable: true, craftable: false },
  { id: 'acc-brooch-guard', name: '수호의 브로치', type: 'accessory', icon: '/images/items/amulet.svg', description: '방어력과 마법방어력을 높인다.', price: 1100, sellPrice: 330, statBonus: { def: 4, mdef: 4 }, stackable: false, maxStack: 1, tier: 3, rarity: 'rare', shopBuyable: true, craftable: false },
  { id: 'acc-band-swift', name: '신속의 팔찌', type: 'accessory', icon: '/images/items/ring.svg', description: '속도를 높여 ATB가 빨리 찬다.', price: 1200, sellPrice: 360, statBonus: { spd: 4 }, stackable: false, maxStack: 1, tier: 3, rarity: 'rare', shopBuyable: true, craftable: false },
  { id: 'acc-charm-ward', name: '방호 부적', type: 'accessory', icon: '/images/items/scroll.svg', description: '상태이상 저항 +15%.', price: 1500, sellPrice: 450, statusResist: 15, stackable: false, maxStack: 1, tier: 3, rarity: 'rare', shopBuyable: true, craftable: false },
  { id: 'acc-pendant-vitality', name: '활력의 펜던트', type: 'accessory', icon: '/images/items/amulet.svg', description: '최대 HP를 크게 늘린다.', price: 1400, sellPrice: 420, statBonus: { maxHp: 40 }, stackable: false, maxStack: 1, tier: 3, rarity: 'rare', shopBuyable: true, craftable: false },
]

const potions: ItemDef[] = [
  { id: 'potion-hp-s', name: '체력 물약(소)', type: 'potion', icon: '/images/items/potion-hp-s.png', description: 'HP를 40 회복한다.', price: 30, sellPrice: 10, useEffect: { healHp: 40 }, stackable: true, maxStack: 99 },
  { id: 'potion-hp-m', name: '체력 물약(중)', type: 'potion', icon: '/images/items/potion-hp-m.png', description: 'HP를 240 회복한다.', price: 90, sellPrice: 30, useEffect: { healHp: 240 }, stackable: true, maxStack: 99 },
  { id: 'potion-hp-l', name: '체력 물약(대)', type: 'potion', icon: '/images/items/potion-hp-l.png', description: 'HP를 640 회복한다.', price: 240, sellPrice: 80, useEffect: { healHp: 640 }, stackable: true, maxStack: 99 },
  { id: 'potion-mp-s', name: '마나 물약(소)', type: 'potion', icon: '/images/items/potion-mp-s.png', description: 'MP를 30 회복한다.', price: 35, sellPrice: 12, useEffect: { healMp: 30 }, stackable: true, maxStack: 99 },
  { id: 'potion-mp-m', name: '마나 물약(중)', type: 'potion', icon: '/images/items/potion-mp-m.png', description: 'MP를 160 회복한다.', price: 100, sellPrice: 35, useEffect: { healMp: 160 }, stackable: true, maxStack: 99 },
  { id: 'potion-elixir', name: '엘릭서', type: 'potion', icon: '/images/items/potion-gold.png', description: 'HP와 MP를 모두 완전히 회복한다.', price: 500, sellPrice: 150, useEffect: { healHp: 9999, healMp: 9999 }, stackable: true, maxStack: 99 },
]

const tools: ItemDef[] = [
  { id: 'tool-escape', name: '탈출의 주문서', type: 'tool', icon: '/images/items/tool-escape.png', description: '전투에서 확실하게 도망친다.', price: 50, sellPrice: 15, useEffect: { escapeBattle: true }, stackable: true, maxStack: 20 },
  { id: 'tool-antidote', name: '해독제', type: 'tool', icon: '/images/items/tool-antidote.png', description: '상태이상을 모두 치료한다.', price: 40, sellPrice: 12, useEffect: { cureStatus: true }, stackable: true, maxStack: 20 },
  { id: 'tool-revive-feather', name: '부활의 깃털', type: 'tool', icon: '/images/items/tool-revive-feather.png', description: '쓰러진 아군을 HP 절반으로 되살린다.', price: 300, sellPrice: 90, useEffect: { reviveOnly: true, healHp: 9999 }, stackable: true, maxStack: 10 },
  { id: 'tool-haste-sand', name: '가속의 모래', type: 'tool', icon: '/images/items/tool-haste-sand.png', description: '대상의 ATB를 즉시 50 채운다.', price: 120, sellPrice: 36, useEffect: { atbBoost: 50 }, stackable: true, maxStack: 20 },
]

const feeds: ItemDef[] = [
  { id: 'feed-fire', name: '매콤한 먹이', type: 'feed', icon: '/images/items/vial-green.svg', description: '불꽃 속성 펫이 좋아한다. 호감도 +12.', price: 80, sellPrice: 24, feedElement: 'fire', useEffect: { petAffection: 12 }, stackable: true, maxStack: 30 },
  { id: 'feed-ice', name: '시원한 먹이', type: 'feed', icon: '/images/items/vial-green.svg', description: '얼음 속성 펫이 좋아한다. 호감도 +12.', price: 80, sellPrice: 24, feedElement: 'ice', useEffect: { petAffection: 12 }, stackable: true, maxStack: 30 },
  { id: 'feed-earth', name: '든든한 먹이', type: 'feed', icon: '/images/items/vial-green.svg', description: '대지 속성 펫이 좋아한다. 호감도 +12.', price: 80, sellPrice: 24, feedElement: 'earth', useEffect: { petAffection: 12 }, stackable: true, maxStack: 30 },
  { id: 'feed-dark', name: '그늘진 먹이', type: 'feed', icon: '/images/items/vial-green.svg', description: '어둠 속성 펫이 좋아한다. 호감도 +12.', price: 80, sellPrice: 24, feedElement: 'dark', useEffect: { petAffection: 12 }, stackable: true, maxStack: 30 },
  { id: 'feed-light', name: '반짝이는 먹이', type: 'feed', icon: '/images/items/vial-green.svg', description: '빛 속성 펫이 좋아한다. 호감도 +12.', price: 80, sellPrice: 24, feedElement: 'light', useEffect: { petAffection: 12 }, stackable: true, maxStack: 30 },
  { id: 'feed-any', name: '평범한 먹이', type: 'feed', icon: '/images/items/vial-green.svg', description: '어떤 펫이든 조금 좋아한다. 호감도 +6.', price: 40, sellPrice: 12, useEffect: { petAffection: 6 }, stackable: true, maxStack: 30 },
]

// ── 에르디아 숲 재료·제작 장비 (§장비·아이템 PRD §24, §27) ──────────────────────
const forestMaterials: ItemDef[] = [
  { id: 'mat-forest-fiber', name: '숲빛 섬유', type: 'material', icon: '/images/items/mat-forest-fiber.png', description: '숲너구리에게서 얻는 은은하게 빛나는 섬유.', price: 0, sellPrice: 8, stackable: true, maxStack: 99, shopBuyable: false, craftable: false },
  { id: 'mat-thorn-shard', name: '가시 파편', type: 'material', icon: '/images/items/mat-thorn-shard.png', description: '가시덩굴에게서 얻는 단단한 가시 조각.', price: 0, sellPrice: 10, stackable: true, maxStack: 99, shopBuyable: false, craftable: false },
  { id: 'mat-fairy-dust', name: '요정 가루', type: 'material', icon: '/images/items/mat-fairy-dust.png', description: '초록 요정에게서 얻는 반짝이는 가루.', price: 0, sellPrice: 14, stackable: true, maxStack: 99, shopBuyable: false, craftable: false },
  { id: 'mat-wolf-fang', name: '늑대 송곳니', type: 'material', icon: '/images/items/mat-wolf-fang.png', description: '회색 늑대에게서 얻는 날카로운 송곳니.', price: 0, sellPrice: 12, stackable: true, maxStack: 99, shopBuyable: false, craftable: false },
  { id: 'mat-mushroom-spore', name: '독버섯 포자', type: 'material', icon: '/images/items/mat-mushroom-spore.png', description: '독버섯 갓에게서 얻는 포자 뭉치.', price: 0, sellPrice: 10, stackable: true, maxStack: 99, shopBuyable: false, craftable: false },
  { id: 'mat-lifewood-chip', name: '생명목 조각', type: 'material', icon: '/images/items/mat-lifewood-chip.png', description: '나무 골렘에게서 얻는 마력이 깃든 나무 조각.', price: 0, sellPrice: 16, stackable: true, maxStack: 99, shopBuyable: false, craftable: false },
  { id: 'mat-thorn-core', name: '가시핵', type: 'material', icon: '/images/items/mat-thorn-core.png', description: '가시어미의 심장부에서 나온 핵. 중간보스 전용 희귀 재료.', price: 0, sellPrice: 60, stackable: true, maxStack: 30, shopBuyable: false, craftable: false },
  { id: 'mat-ancient-heartwood', name: '고대목 심재', type: 'material', icon: '/images/items/mat-ancient-heartwood.png', description: '고대목 골렘을 쓰러뜨려야만 얻을 수 있는 핵심 재료. 유일급 제작에 쓰인다.', price: 0, sellPrice: 300, stackable: true, maxStack: 10, shopBuyable: false, craftable: false },
]

const forestCraftedAccessories: ItemDef[] = [
  { id: 'acc-thorn-brooch', name: '가시의 브로치', type: 'accessory', icon: '/images/items/acc-thorn-brooch.png', description: '가시로 엮은 브로치. 공격력을 소폭 높인다.', price: 0, sellPrice: 240, statBonus: { atk: 6 }, stackable: false, maxStack: 1, tier: 2, rarity: 'uncommon', shopBuyable: false, craftable: true, recipeId: 'recipe-thorn-brooch' },
  { id: 'acc-lifewood-seed', name: '생명목 씨앗 부적', type: 'accessory', icon: '/images/items/acc-lifewood-seed.png', description: '생명목의 기운이 깃든 부적. 최대 HP를 늘려준다.', price: 0, sellPrice: 260, statBonus: { maxHp: 45 }, stackable: false, maxStack: 1, tier: 3, rarity: 'rare', shopBuyable: false, craftable: true, recipeId: 'recipe-lifewood-seed' },
]

const forestUniqueGear: ItemDef[] = [
  {
    id: 'wand-ancient-heartwood',
    name: '고대목의 완드',
    type: 'weapon',
    icon: '/images/items/wand-ancient-heartwood.png',
    description: '고대목 골렘의 심재로 벼려낸 유일급 완드. 대지 스킬을 크게 강화하고, 공격 시 낮은 확률로 HP를 회복시킨다.',
    price: 0,
    sellPrice: 3300,
    requiredLevel: 80,
    weaponElement: 'earth',
    statBonus: { atk: 20, matk: 48 },
    stackable: false,
    maxStack: 1,
    tier: 5,
    rarity: 'unique',
    shopBuyable: false,
    craftable: true,
    recipeId: 'recipe-ancient-wand',
  },
  {
    id: 'acc-guardian-seed',
    name: '수호목의 씨앗',
    type: 'accessory',
    icon: '/images/items/acc-guardian-seed.png',
    description: '고대목 골렘의 가호가 깃든 씨앗. 최대 HP와 방어력을 크게 늘려준다.',
    price: 0,
    sellPrice: 3000,
    statBonus: { maxHp: 80, def: 14, mdef: 10 },
    stackable: false,
    maxStack: 1,
    tier: 5,
    rarity: 'unique',
    shopBuyable: false,
    craftable: true,
    recipeId: 'recipe-guardian-seed',
  },
]

// ── 스톰헤이븐 해안 재료·제작 장비 (§장비·아이템 PRD §24, §28) ──────────────────
const seaMaterials: ItemDef[] = [
  { id: 'mat-water-droplet', name: '물방울 결정', type: 'material', icon: '/images/items/mat-water-droplet.png', description: '물거품 정령에게서 얻는 영롱한 물방울 결정.', price: 0, sellPrice: 8, stackable: true, maxStack: 99, shopBuyable: false, craftable: false },
  { id: 'mat-crab-shell', name: '단단한 게껍질', type: 'material', icon: '/images/items/mat-crab-shell.png', description: '게 껍질병정에게서 얻는 단단한 껍질 조각.', price: 0, sellPrice: 10, stackable: true, maxStack: 99, shopBuyable: false, craftable: false },
  { id: 'mat-eel-scale', name: '뱀장어 비늘', type: 'material', icon: '/images/items/mat-eel-scale.png', description: '얕은여울 뱀장어에게서 얻는 매끄러운 비늘.', price: 0, sellPrice: 12, stackable: true, maxStack: 99, shopBuyable: false, craftable: false },
  { id: 'mat-siren-scale', name: '세이렌 비늘', type: 'material', icon: '/images/items/mat-siren-scale.png', description: '세이렌 유충에게서 얻는 신비로운 비늘.', price: 0, sellPrice: 14, stackable: true, maxStack: 99, shopBuyable: false, craftable: false },
  { id: 'mat-reef-fragment', name: '암초 파편', type: 'material', icon: '/images/items/mat-reef-fragment.png', description: '암초 거북에게서 얻는 산호 뒤덮인 암초 조각.', price: 0, sellPrice: 10, stackable: true, maxStack: 99, shopBuyable: false, craftable: false },
  { id: 'mat-tide-essence', name: '밀물 정수', type: 'material', icon: '/images/items/mat-tide-essence.png', description: '밀물 정령에게서 얻는 응축된 조류의 정수.', price: 0, sellPrice: 16, stackable: true, maxStack: 99, shopBuyable: false, craftable: false },
  { id: 'mat-jelly-stinger', name: '여왕의 독침', type: 'material', icon: '/images/items/mat-jelly-stinger.png', description: '해파리 여왕의 촉수에서 나온 독침. 중간보스 전용 희귀 재료.', price: 0, sellPrice: 60, stackable: true, maxStack: 30, shopBuyable: false, craftable: false },
  { id: 'mat-reefking-shell', name: '암초왕의 껍질', type: 'material', icon: '/images/items/mat-reefking-shell.png', description: '심해 암초왕을 쓰러뜨려야만 얻을 수 있는 핵심 재료. 유일급 제작에 쓰인다.', price: 0, sellPrice: 300, stackable: true, maxStack: 10, shopBuyable: false, craftable: false },
]

const seaCraftedAccessories: ItemDef[] = [
  { id: 'acc-deep-pearl', name: '심해 진주 목걸이', type: 'accessory', icon: '/images/items/acc-deep-pearl.png', description: '심해의 진주로 만든 목걸이. 마법 공격력을 소폭 높인다.', price: 0, sellPrice: 240, statBonus: { matk: 8 }, stackable: false, maxStack: 1, tier: 2, rarity: 'uncommon', shopBuyable: false, craftable: true, recipeId: 'recipe-deep-pearl' },
  { id: 'acc-current-bracelet', name: '해류 팔찌', type: 'accessory', icon: '/images/items/acc-current-bracelet.png', description: '흐르는 해류를 담은 팔찌. 속도를 늘려준다.', price: 0, sellPrice: 260, statBonus: { spd: 6 }, stackable: false, maxStack: 1, tier: 3, rarity: 'rare', shopBuyable: false, craftable: true, recipeId: 'recipe-current-bracelet' },
]

const seaUniqueGear: ItemDef[] = [
  {
    id: 'wand-deep-resonance',
    name: '심해 공명 지팡이',
    type: 'weapon',
    icon: '/images/items/wand-deep-resonance.png',
    description: '심해 암초왕의 껍질로 벼려낸 유일급 지팡이. 빙결 스킬을 크게 강화하고 최대 MP를 늘려준다.',
    price: 0,
    sellPrice: 3300,
    requiredLevel: 80,
    weaponElement: 'ice',
    statBonus: { matk: 48, maxMp: 60 },
    stackable: false,
    maxStack: 1,
    tier: 5,
    rarity: 'unique',
    shopBuyable: false,
    craftable: true,
    recipeId: 'recipe-deep-resonance-wand',
  },
  {
    id: 'acc-reefking-charm',
    name: '암초왕의 껍질 부적',
    type: 'accessory',
    icon: '/images/items/acc-reefking-charm.png',
    description: '암초왕의 가호가 깃든 부적. 방어력과 상태이상 저항을 크게 늘려준다.',
    price: 0,
    sellPrice: 3000,
    statBonus: { def: 16, mdef: 14 },
    statusResist: 20,
    stackable: false,
    maxStack: 1,
    tier: 5,
    rarity: 'unique',
    shopBuyable: false,
    craftable: true,
    recipeId: 'recipe-reefking-charm',
  },
]

// ── 하늘 유적 재료·제작 장비 (§장비·아이템 PRD §24, §29) ────────────────────────
const ruinsMaterials: ItemDef[] = [
  { id: 'mat-ember-shard', name: '잿불 조각', type: 'material', icon: '/images/items/mat-ember-shard.png', description: '잉걸 임프에게서 얻는 타다 남은 잿불 조각.', price: 0, sellPrice: 10, stackable: true, maxStack: 99, shopBuyable: false, craftable: false },
  { id: 'mat-ash-fang', name: '잿빛 송곳니', type: 'material', icon: '/images/items/mat-ash-fang.png', description: '잿빛 사냥개에게서 얻는 그을린 송곳니.', price: 0, sellPrice: 12, stackable: true, maxStack: 99, shopBuyable: false, craftable: false },
  { id: 'mat-old-arrowhead', name: '낡은 화살촉', type: 'material', icon: '/images/items/mat-old-arrowhead.png', description: '해골 궁수에게서 얻는 녹슨 화살촉.', price: 0, sellPrice: 12, stackable: true, maxStack: 99, shopBuyable: false, craftable: false },
  { id: 'mat-cursed-metal', name: '저주받은 금속편', type: 'material', icon: '/images/items/mat-cursed-metal.png', description: '저주받은 갑주에게서 얻는 저주가 깃든 금속 조각.', price: 0, sellPrice: 14, stackable: true, maxStack: 99, shopBuyable: false, craftable: false },
  { id: 'mat-wraith-echo', name: '원귀의 잔향', type: 'material', icon: '/images/items/mat-wraith-echo.png', description: '원귀에게서 얻는 희미한 잔향.', price: 0, sellPrice: 14, stackable: true, maxStack: 99, shopBuyable: false, craftable: false },
  { id: 'mat-acolyte-mana-shard', name: '수련생의 마력편', type: 'material', icon: '/images/items/mat-acolyte-mana-shard.png', description: '어둠의 수련생에게서 얻는 마력 조각.', price: 0, sellPrice: 16, stackable: true, maxStack: 99, shopBuyable: false, craftable: false },
  { id: 'mat-flame-core', name: '화염핵', type: 'material', icon: '/images/items/mat-flame-core.png', description: '화염 파수꾼에게서 얻는 뜨거운 핵.', price: 0, sellPrice: 18, stackable: true, maxStack: 99, shopBuyable: false, craftable: false },
  { id: 'mat-frost-crystal', name: '서리 결정', type: 'material', icon: '/images/items/mat-frost-crystal.png', description: '서리 망령에게서 얻는 차가운 결정.', price: 0, sellPrice: 18, stackable: true, maxStack: 99, shopBuyable: false, craftable: false },
  { id: 'mat-dark-ink', name: '흑마법 잉크', type: 'material', icon: '/images/items/mat-dark-ink.png', description: '흑마법사에게서 얻는 검은 마력 잉크.', price: 0, sellPrice: 20, stackable: true, maxStack: 99, shopBuyable: false, craftable: false },
  { id: 'mat-statue-fragment', name: '석상 파편', type: 'material', icon: '/images/items/mat-statue-fragment.png', description: '석상 거인에게서 얻는 고대 석상 파편.', price: 0, sellPrice: 20, stackable: true, maxStack: 99, shopBuyable: false, craftable: false },
  { id: 'mat-mors-seal', name: '모르스의 인장', type: 'material', icon: '/images/items/mat-mors-seal.png', description: '모르스의 전령에게서 얻는 불길한 인장.', price: 0, sellPrice: 26, stackable: true, maxStack: 99, shopBuyable: false, craftable: false },
  { id: 'mat-giant-core', name: '거인의 핵', type: 'material', icon: '/images/items/mat-giant-core.png', description: '석상 거인왕을 쓰러뜨려야만 얻을 수 있는 핵심 재료. 유일급 제작에 쓰인다.', price: 0, sellPrice: 300, stackable: true, maxStack: 10, shopBuyable: false, craftable: false },
]

const ruinsCraftedAccessories: ItemDef[] = [
  { id: 'acc-curse-brooch', name: '저주의 브로치', type: 'accessory', icon: '/images/items/acc-curse-brooch.png', description: '저주가 깃든 브로치. 마법 공격력을 소폭 높인다.', price: 0, sellPrice: 260, statBonus: { matk: 9 }, stackable: false, maxStack: 1, tier: 3, rarity: 'rare', shopBuyable: false, craftable: true, recipeId: 'recipe-curse-brooch' },
  { id: 'acc-wraith-earring', name: '망령의 귀걸이', type: 'accessory', icon: '/images/items/acc-wraith-earring.png', description: '원귀의 기운이 깃든 귀걸이. 상태이상 저항을 높인다.', price: 0, sellPrice: 280, statusResist: 18, stackable: false, maxStack: 1, tier: 3, rarity: 'rare', shopBuyable: false, craftable: true, recipeId: 'recipe-wraith-earring' },
]

const ruinsUniqueGear: ItemDef[] = [
  {
    id: 'wand-cursed-sage',
    name: '저주받은 현자의 완드',
    type: 'weapon',
    icon: '/images/items/wand-cursed-sage.png',
    description: '흑마법사의 잔재로 벼려낸 유일급 완드. 강력한 저주와 상태이상을 동반한 마법 공격을 가능케 한다.',
    price: 0,
    sellPrice: 3300,
    requiredLevel: 80,
    weaponElement: 'fire',
    statBonus: { matk: 52, luck: 8 },
    stackable: false,
    maxStack: 1,
    tier: 5,
    rarity: 'unique',
    shopBuyable: false,
    craftable: true,
    recipeId: 'recipe-cursed-sage-wand',
  },
  {
    id: 'acc-giant-king-seal',
    name: '석상 거인왕의 인장',
    type: 'accessory',
    icon: '/images/items/acc-giant-king-seal.png',
    description: '석상 거인왕의 가호가 깃든 인장. 최대 HP와 방어력을 크게 늘려준다.',
    price: 0,
    sellPrice: 3000,
    statBonus: { maxHp: 70, def: 18, mdef: 8 },
    stackable: false,
    maxStack: 1,
    tier: 5,
    rarity: 'unique',
    shopBuyable: false,
    craftable: true,
    recipeId: 'recipe-giant-king-seal',
  },
]

/** 장비 스탯 보너스 스케일 적용(무기·방어구·장신구) */
function scaleGear(items: ItemDef[]): ItemDef[] {
  return items.map((it) => {
    if (!it.statBonus || !(it.type === 'weapon' || it.type === 'armor' || it.type === 'accessory')) return it
    const statBonus: Partial<Stats> = {}
    for (const [k, v] of Object.entries(it.statBonus) as [keyof Stats, number][]) statBonus[k] = Math.round(v * GEAR_STAT_SCALE)
    return { ...it, statBonus }
  })
}

const GEAR_ITEMS: ItemDef[] = scaleGear([
  ...wands,
  ...robes,
  ...hats,
  ...accessories,
  ...potions,
  ...tools,
  ...feeds,
  ...forestMaterials,
  ...forestCraftedAccessories,
  ...forestUniqueGear,
  ...seaMaterials,
  ...seaCraftedAccessories,
  ...seaUniqueGear,
  ...ruinsMaterials,
  ...ruinsCraftedAccessories,
  ...ruinsUniqueGear,
])

export const ITEMS: ItemDef[] = [
  ...GEAR_ITEMS,
  // 채집·사냥·낚시·요리·연금·마도구·가구·코스튬 (lib/life.ts)
  ...LIFE_ITEMS,
]
const ITEM_MAP = new Map(ITEMS.map((i) => [i.id, i]))
export function itemById(id: string): ItemDef | undefined {
  return ITEM_MAP.get(id)
}

// ============================================================================
// 제작 레시피 — 지역 재료/보스 드랍이 들어오는 대로 여기에 계속 추가된다.
// ============================================================================
export const RECIPES: RecipeDef[] = [
  {
    id: 'recipe-elixir',
    station: 'alchemy_pot',
    category: 'alchemy',
    ingredients: [
      { itemId: 'potion-hp-l', quantity: 2 },
      { itemId: 'potion-mp-m', quantity: 2 },
    ],
    outputItemId: 'potion-elixir',
    outputQuantity: 1,
  },
  // ── 에르디아 숲 (§장비·아이템 PRD §26~27) ──
  {
    id: 'recipe-thorn-brooch',
    station: 'magic_workbench',
    ingredients: [{ itemId: 'mat-thorn-shard', quantity: 8 }],
    outputItemId: 'acc-thorn-brooch',
    outputQuantity: 1,
  },
  {
    id: 'recipe-lifewood-seed',
    station: 'magic_workbench',
    ingredients: [
      { itemId: 'mat-lifewood-chip', quantity: 10 },
      { itemId: 'mat-forest-fiber', quantity: 5 },
    ],
    outputItemId: 'acc-lifewood-seed',
    outputQuantity: 1,
  },
  {
    id: 'recipe-ancient-wand',
    station: 'magic_workbench',
    ingredients: [
      { itemId: 'mat-lifewood-chip', quantity: 20 },
      { itemId: 'mat-thorn-shard', quantity: 15 },
      { itemId: 'mat-ancient-heartwood', quantity: 1 },
    ],
    outputItemId: 'wand-ancient-heartwood',
    outputQuantity: 1,
  },
  {
    id: 'recipe-guardian-seed',
    station: 'magic_workbench',
    ingredients: [
      { itemId: 'mat-ancient-heartwood', quantity: 1 },
      { itemId: 'mat-fairy-dust', quantity: 10 },
      { itemId: 'mat-wolf-fang', quantity: 10 },
    ],
    outputItemId: 'acc-guardian-seed',
    outputQuantity: 1,
  },
  // ── 스톰헤이븐 해안 (§장비·아이템 PRD §26~28) ──
  {
    id: 'recipe-deep-pearl',
    station: 'magic_workbench',
    ingredients: [{ itemId: 'mat-water-droplet', quantity: 8 }],
    outputItemId: 'acc-deep-pearl',
    outputQuantity: 1,
  },
  {
    id: 'recipe-current-bracelet',
    station: 'magic_workbench',
    ingredients: [
      { itemId: 'mat-eel-scale', quantity: 10 },
      { itemId: 'mat-tide-essence', quantity: 5 },
    ],
    outputItemId: 'acc-current-bracelet',
    outputQuantity: 1,
  },
  {
    id: 'recipe-deep-resonance-wand',
    station: 'magic_workbench',
    ingredients: [
      { itemId: 'mat-tide-essence', quantity: 20 },
      { itemId: 'mat-siren-scale', quantity: 15 },
      { itemId: 'mat-reefking-shell', quantity: 1 },
    ],
    outputItemId: 'wand-deep-resonance',
    outputQuantity: 1,
  },
  {
    id: 'recipe-reefking-charm',
    station: 'magic_workbench',
    ingredients: [
      { itemId: 'mat-reefking-shell', quantity: 1 },
      { itemId: 'mat-crab-shell', quantity: 10 },
      { itemId: 'mat-jelly-stinger', quantity: 10 },
    ],
    outputItemId: 'acc-reefking-charm',
    outputQuantity: 1,
  },
  // ── 하늘 유적 (§장비·아이템 PRD §26, §29) ──
  {
    id: 'recipe-curse-brooch',
    station: 'magic_workbench',
    ingredients: [
      { itemId: 'mat-cursed-metal', quantity: 8 },
      { itemId: 'mat-dark-ink', quantity: 5 },
    ],
    outputItemId: 'acc-curse-brooch',
    outputQuantity: 1,
  },
  {
    id: 'recipe-wraith-earring',
    station: 'magic_workbench',
    ingredients: [
      { itemId: 'mat-wraith-echo', quantity: 10 },
      { itemId: 'mat-frost-crystal', quantity: 5 },
    ],
    outputItemId: 'acc-wraith-earring',
    outputQuantity: 1,
  },
  {
    id: 'recipe-cursed-sage-wand',
    station: 'magic_workbench',
    ingredients: [
      { itemId: 'mat-dark-ink', quantity: 20 },
      { itemId: 'mat-acolyte-mana-shard', quantity: 15 },
      { itemId: 'mat-giant-core', quantity: 1 },
    ],
    outputItemId: 'wand-cursed-sage',
    outputQuantity: 1,
  },
  {
    id: 'recipe-giant-king-seal',
    station: 'magic_workbench',
    ingredients: [
      { itemId: 'mat-giant-core', quantity: 1 },
      { itemId: 'mat-statue-fragment', quantity: 10 },
      { itemId: 'mat-mors-seal', quantity: 10 },
    ],
    outputItemId: 'acc-giant-king-seal',
    outputQuantity: 1,
  },
  // 연금술·요리·마도구·가구·코스튬 (lib/life.ts)
  ...LIFE_RECIPES,
]
const RECIPE_MAP = new Map(RECIPES.map((r) => [r.id, r]))
export function recipeById(id: string): RecipeDef | undefined {
  return RECIPE_MAP.get(id)
}

// ============================================================================
// 몬스터 — 설계: §8
// ============================================================================
/**
 * 2026-09 밸런스 패치: 몬스터 전반 하향(기존 대비 HP/공격 채널 약 15~20% 추가 감소) +
 * 30레벨 미만 구간 한정 추가 완화(초반 몹은 순식간에 잡히도록, 레벨1 → 0.7배 ~ 레벨30 → 1.0배
 * 선형 보간). 30레벨부터는 이 완화가 사라지고 기본 하향치만 적용된다.
 * 필드보스는 레벨 자체가 40+ 라 이 완화 구간 밖이며, 개별 mult로 더 강하게 설정돼 있다.
 */
function earlyLevelEase(level: number): number {
  if (level >= 30) return 1
  return 0.7 + 0.3 * (level / 30)
}

function mstat(level: number, mult: Partial<Stats> = {}): Stats {
  // 새 100레벨 축 스탯식(PRD §15)으로 계산 — 주인공과 같은 성장률이라 레벨 대비 상대 강도가 유지된다
  const s = computeStatsForLevel(toLevel100(level))
  const ease = earlyLevelEase(level)
  const base: Stats = {
    maxHp: Math.round(s.maxHp * 0.62 * ease),
    maxMp: Math.round(s.maxMp * 0.6),
    atk: Math.round(s.atk * 0.72 * ease),
    def: Math.round(s.def * 0.58 * ease),
    matk: Math.round(s.matk * 0.58 * ease),
    mdef: Math.round(s.mdef * 0.55 * ease),
    spd: Math.round(s.spd * 0.9),
    luck: Math.round(s.luck * 0.6),
  }
  ;(Object.keys(base) as (keyof Stats)[]).forEach((k) => {
    if (mult[k] != null) base[k] = Math.max(1, Math.round(base[k] * (mult[k] as number)))
  })
  return base
}

const MONSTERS_LEGACY: MonsterDef[] = [
  // 에르디아 숲 (권장레벨 저지대 체감 난이도 완화 — 저레벨 잡몹 비중 확대 + 체력 전역 1/3 하향)
  { id: 'mon-field-mouse', name: '들쥐', level: 1, icon: '/images/monsters/mon-field-mouse.png', element: null, family: 'beast', stats: mstat(1, { maxHp: 0.34, atk: 0.8 }), skills: [], expReward: 8, goldReward: 5, zoneKinds: ['forest'], dropTable: [{ itemId: 'mat-forest-fiber', chance: 0.4 }] },
  { id: 'mon-glow-moth', name: '빛날개나방', level: 1, icon: '/images/monsters/mon-glow-moth.png', element: 'light', family: 'beast', stats: mstat(1, { maxHp: 0.34, spd: 1.2 }), traits: ['swift'], skills: [], expReward: 9, goldReward: 5, zoneKinds: ['forest'], dropTable: [{ itemId: 'mat-fairy-dust', chance: 0.3 }] },
  { id: 'mon-forest-raccoon', name: '숲너구리', level: 2, icon: '/images/monsters/mon-forest-raccoon.png', element: 'earth', family: 'beast', stats: mstat(2, { maxHp: 0.34 }), skills: [], expReward: 18, goldReward: 12, zoneKinds: ['forest'], dropTable: [{ itemId: 'potion-hp-s', chance: 0.3 }, { itemId: 'feed-any', chance: 0.15 }, { itemId: 'mat-forest-fiber', chance: 0.45 }] },
  { id: 'mon-thorn-vine', name: '가시덩굴', level: 3, icon: '/images/monsters/mon-thorn-vine.png', element: 'earth', family: 'plant', stats: mstat(3, { maxHp: 0.48, def: 1.3, spd: 0.6 }), traits: ['tank'], skills: [], expReward: 26, goldReward: 15, zoneKinds: ['forest'], dropTable: [{ itemId: 'potion-hp-s', chance: 0.25 }, { itemId: 'mat-thorn-shard', chance: 0.45 }] },
  { id: 'mon-sprite-green', name: '초록 요정', level: 4, icon: '/images/monsters/mon-sprite-green.png', element: null, family: 'beast', stats: mstat(4, { maxHp: 0.34, spd: 1.4, luck: 1.5 }), traits: ['swift'], skills: [], expReward: 30, goldReward: 22, zoneKinds: ['forest'], dropTable: [{ itemId: 'potion-mp-s', chance: 0.3 }, { itemId: 'mat-fairy-dust', chance: 0.35 }] },
  { id: 'mon-grey-wolf', name: '회색 늑대', level: 5, icon: '/images/monsters/mon-grey-wolf.png', element: 'ice', family: 'beast', stats: mstat(5, { maxHp: 0.34, atk: 1.2, spd: 1.2 }), traits: ['aggressive'], skills: [], expReward: 38, goldReward: 24, zoneKinds: ['forest'], dropTable: [{ itemId: 'mat-wolf-fang', chance: 0.4 }] },
  { id: 'mon-mush-cap', name: '독버섯 갓', level: 6, icon: '/images/monsters/mon-mush-cap.png', element: 'earth', family: 'plant', stats: mstat(6, { maxHp: 0.34, matk: 1.4, maxMp: 1.6 }), traits: ['caster'], skills: ['earth-adv-3'], expReward: 46, goldReward: 28, zoneKinds: ['forest'], dropTable: [{ itemId: 'tool-antidote', chance: 0.2 }, { itemId: 'mat-mushroom-spore', chance: 0.45 }] },
  { id: 'mon-bark-golem', name: '나무 골렘', level: 8, icon: '/images/monsters/mon-bark-golem.png', element: 'earth', family: 'construct', stats: mstat(8, { maxHp: 0.54, def: 1.5, spd: 0.6 }), traits: ['tank'], skills: [], expReward: 62, goldReward: 40, zoneKinds: ['forest'], dropTable: [{ itemId: 'robe-t1', chance: 0.1 }, { itemId: 'mat-lifewood-chip', chance: 0.4 }] },
  {
    id: 'mon-thorn-matriarch',
    name: '가시어미',
    level: 16,
    icon: '/images/monsters/mon-thorn-matriarch.png',
    element: 'earth',
    family: 'plant',
    stats: mstat(16, { maxHp: 0.71, def: 1.5, matk: 1.4, spd: 0.7 }),
    traits: ['tank', 'caster'],
    skills: ['earth-basic-3', 'earth-adv-1'],
    expReward: 210,
    goldReward: 140,
    zoneKinds: ['forest'],
    rank: 'miniBoss',
    dropTable: [{ itemId: 'mat-thorn-core', chance: 0.6 }, { itemId: 'mat-thorn-shard', chance: 0.8 }],
  },
  {
    id: 'mon-ancient-bark-golem',
    name: '고대목 골렘',
    level: 40,
    icon: '/images/monsters/mon-ancient-bark-golem.png',
    element: 'earth',
    family: 'construct',
    stats: mstat(40, { maxHp: 1.56, def: 3.0, atk: 2.0, spd: 0.4 }),
    traits: ['tank'],
    skills: ['earth-high-1'],
    expReward: 950,
    goldReward: 520,
    zoneKinds: ['forest'],
    rank: 'fieldBoss',
    dropTable: [{ itemId: 'mat-ancient-heartwood', chance: 1 }, { itemId: 'mat-lifewood-chip', chance: 0.8 }],
  },
  // 스톰헤이븐 해안 (체력 전역 2/3 하향)
  { id: 'mon-bubble-spirit', name: '물거품 정령', level: 2, icon: '/images/monsters/mon-bubble-spirit.png', element: 'ice', family: 'aquatic', stats: mstat(2, { maxHp: 0.67 }), skills: [], expReward: 17, goldReward: 11, zoneKinds: ['sea'], dropTable: [{ itemId: 'potion-mp-s', chance: 0.25 }, { itemId: 'mat-water-droplet', chance: 0.45 }] },
  { id: 'mon-crab-soldier', name: '게 껍질병정', level: 3, icon: '/images/monsters/mon-crab-soldier.png', element: 'ice', family: 'aquatic', stats: mstat(3, { def: 1.4, maxHp: 0.8 }), traits: ['tank'], skills: [], expReward: 24, goldReward: 16, zoneKinds: ['sea'], dropTable: [{ itemId: 'mat-crab-shell', chance: 0.45 }] },
  { id: 'mon-shallows-eel', name: '얕은여울 뱀장어', level: 5, icon: '/images/monsters/mon-shallows-eel.png', element: 'ice', family: 'aquatic', stats: mstat(5, { maxHp: 0.67, spd: 1.4 }), traits: ['swift'], skills: [], expReward: 42, goldReward: 26, zoneKinds: ['sea'], dropTable: [{ itemId: 'mat-eel-scale', chance: 0.4 }] },
  { id: 'mon-siren-larva', name: '세이렌 유충', level: 7, icon: '/images/monsters/mon-siren-larva.png', element: null, family: 'aquatic', stats: mstat(7, { maxHp: 0.67, matk: 1.3 }), traits: ['caster'], skills: ['pet-silence-hiss'], expReward: 54, goldReward: 34, zoneKinds: ['sea'], dropTable: [{ itemId: 'acc-amulet-mana', chance: 0.05 }, { itemId: 'mat-siren-scale', chance: 0.35 }] },
  { id: 'mon-reef-turtle', name: '암초 거북', level: 9, icon: '/images/monsters/mon-reef-turtle.png', element: 'ice', family: 'aquatic', stats: mstat(9, { maxHp: 1.14, def: 1.6, spd: 0.5 }), traits: ['tank'], skills: [], expReward: 70, goldReward: 44, zoneKinds: ['sea'], dropTable: [{ itemId: 'mat-reef-fragment', chance: 0.45 }] },
  { id: 'mon-tide-elemental', name: '밀물 정령', level: 11, icon: '/images/monsters/mon-tide-elemental.png', element: 'ice', family: 'aquatic', stats: mstat(11, { maxHp: 0.67, matk: 1.5, maxMp: 1.6 }), traits: ['caster'], skills: ['ice-basic-3'], expReward: 88, goldReward: 52, zoneKinds: ['sea'], dropTable: [{ itemId: 'wand-ice-t2', chance: 0.06 }, { itemId: 'mat-tide-essence', chance: 0.4 }] },
  {
    id: 'mon-jelly-queen',
    name: '해파리 여왕',
    level: 18,
    icon: '/images/monsters/mon-jelly-queen.png',
    element: 'ice',
    family: 'aquatic',
    stats: mstat(18, { maxHp: 1.27, matk: 1.7, maxMp: 1.8, spd: 0.9 }),
    traits: ['caster', 'aggressive'],
    skills: ['ice-basic-3', 'ice-adv-1'],
    expReward: 230,
    goldReward: 150,
    zoneKinds: ['sea'],
    rank: 'miniBoss',
    dropTable: [{ itemId: 'mat-jelly-stinger', chance: 0.6 }, { itemId: 'mat-siren-scale', chance: 0.8 }],
  },
  {
    id: 'mon-reef-king',
    name: '심해 암초왕',
    level: 42,
    icon: '/images/monsters/mon-reef-king.png',
    element: 'ice',
    family: 'aquatic',
    stats: mstat(42, { maxHp: 3.22, def: 3.1, matk: 1.6, spd: 0.4 }),
    traits: ['tank'],
    skills: ['ice-basic-3'],
    expReward: 980,
    goldReward: 540,
    zoneKinds: ['sea'],
    rank: 'fieldBoss',
    dropTable: [{ itemId: 'mat-reefking-shell', chance: 1 }, { itemId: 'mat-reef-fragment', chance: 0.8 }],
  },
  // 하늘 유적
  { id: 'mon-ember-imp', name: '잉걸 임프', level: 10, icon: '/images/monsters/mon-ember-imp.png', element: 'fire', family: 'beast', stats: mstat(10, { atk: 1.2, spd: 1.2 }), traits: ['aggressive'], skills: ['fire-basic-1'], expReward: 82, goldReward: 50, zoneKinds: ['ruins'], dropTable: [{ itemId: 'mat-ember-shard', chance: 0.4 }] },
  { id: 'mon-ash-hound', name: '잿빛 사냥개', level: 12, icon: '/images/monsters/mon-ash-hound.png', element: 'fire', family: 'beast', stats: mstat(12, { spd: 1.5, atk: 1.2 }), traits: ['swift', 'aggressive'], skills: [], expReward: 96, goldReward: 58, zoneKinds: ['ruins'], dropTable: [{ itemId: 'mat-ash-fang', chance: 0.4 }] },
  { id: 'mon-bone-archer', name: '해골 궁수', level: 13, icon: '/images/monsters/mon-bone-archer.png', element: 'dark', family: 'undead', stats: mstat(13, { atk: 1.3 }), traits: ['caster'], skills: ['fire-adv-1'], expReward: 104, goldReward: 62, zoneKinds: ['ruins'], dropTable: [{ itemId: 'potion-hp-m', chance: 0.2 }, { itemId: 'mat-old-arrowhead', chance: 0.4 }] },
  { id: 'mon-cursed-armor', name: '저주받은 갑주', level: 15, icon: '/images/monsters/mon-cursed-armor.png', element: 'earth', family: 'construct', stats: mstat(15, { maxHp: 1.8, def: 1.7, spd: 0.5 }), traits: ['tank'], skills: [], expReward: 122, goldReward: 74, zoneKinds: ['ruins'], dropTable: [{ itemId: 'robe-t3', chance: 0.08 }, { itemId: 'mat-cursed-metal', chance: 0.4 }] },
  { id: 'mon-wraith', name: '원귀', level: 17, icon: '/images/monsters/mon-wraith.png', element: 'dark', family: 'undead', stats: mstat(17, { matk: 1.5, spd: 1.2 }), traits: ['caster'], skills: ['pet-blind-dust'], expReward: 140, goldReward: 84, zoneKinds: ['ruins'], dropTable: [{ itemId: 'mat-wraith-echo', chance: 0.4 }] },
  { id: 'mon-dark-acolyte', name: '어둠의 수련생', level: 18, icon: '/images/monsters/mon-dark-acolyte.png', element: 'fire', family: 'darkmage', stats: mstat(18, { matk: 1.5, maxMp: 1.6 }), traits: ['caster'], skills: ['fire-basic-3'], expReward: 150, goldReward: 90, zoneKinds: ['ruins'], dropTable: [{ itemId: 'wand-fire-t3', chance: 0.05 }, { itemId: 'mat-acolyte-mana-shard', chance: 0.35 }] },
  { id: 'mon-flame-warden', name: '화염 파수꾼', level: 20, icon: '/images/monsters/mon-flame-warden.png', element: 'fire', family: 'construct', stats: mstat(20, { maxHp: 1.9, def: 1.6, matk: 1.3 }), traits: ['tank', 'caster'], skills: ['fire-adv-2'], expReward: 180, goldReward: 110, zoneKinds: ['ruins'], dropTable: [{ itemId: 'wand-fire-t3', chance: 0.12 }, { itemId: 'mat-flame-core', chance: 0.4 }] },
  { id: 'mon-frost-revenant', name: '서리 망령', level: 22, icon: '/images/monsters/mon-frost-revenant.png', element: 'ice', family: 'undead', stats: mstat(22, { matk: 1.6, spd: 1.1 }), traits: ['caster'], skills: ['ice-basic-3', 'ice-adv-1'], expReward: 200, goldReward: 122, zoneKinds: ['ruins'], dropTable: [{ itemId: 'mat-frost-crystal', chance: 0.4 }] },
  { id: 'mon-dark-mage', name: '흑마법사', level: 25, icon: '/images/monsters/mon-dark-mage.png', element: 'dark', family: 'darkmage', stats: mstat(25, { matk: 1.8, maxMp: 1.8 }), traits: ['caster'], skills: ['fire-adv-2', 'ice-adv-2'], expReward: 240, goldReward: 150, zoneKinds: ['ruins'], dropTable: [{ itemId: 'acc-charm-ward', chance: 0.1 }, { itemId: 'mat-dark-ink', chance: 0.35 }] },
  { id: 'mon-stone-titan', name: '석상 거인', level: 28, icon: '/images/monsters/mon-stone-titan.png', element: 'earth', family: 'construct', stats: mstat(28, { maxHp: 2.2, def: 1.9, spd: 0.5, atk: 1.3 }), traits: ['tank'], skills: ['earth-high-1'], expReward: 300, goldReward: 190, zoneKinds: ['ruins'], rank: 'miniBoss', dropTable: [{ itemId: 'robe-t4', chance: 0.1 }, { itemId: 'mat-statue-fragment', chance: 0.8 }] },
  { id: 'mon-azka-herald', name: '모르스의 전령', level: 32, icon: '/images/monsters/mon-azka-herald.png', element: 'fire', family: 'darkmage', stats: mstat(32, { maxHp: 2.4, matk: 2.0, maxMp: 2.0, atk: 1.4 }), traits: ['caster', 'aggressive'], rank: 'elite', skills: ['fire-high-1', 'fire-adv-3'], expReward: 420, goldReward: 280, zoneKinds: ['ruins'], dropTable: [{ itemId: 'wand-fire-t4', chance: 0.15 }, { itemId: 'potion-elixir', chance: 0.3 }, { itemId: 'mat-mors-seal', chance: 0.35 }] },
  {
    id: 'mon-stone-titan-king',
    name: '석상 거인왕',
    level: 48,
    icon: '/images/monsters/mon-stone-titan-king.png',
    element: 'earth',
    family: 'construct',
    stats: mstat(48, { maxHp: 5.0, def: 3.3, atk: 2.2, spd: 0.4 }),
    traits: ['tank'],
    skills: ['earth-high-1'],
    expReward: 1050,
    goldReward: 600,
    zoneKinds: ['ruins'],
    rank: 'fieldBoss',
    dropTable: [{ itemId: 'mat-giant-core', chance: 1 }, { itemId: 'mat-statue-fragment', chance: 0.8 }],
  },
  // 폐허된 신전 편 최종보스 — '노'를 주입당해 폭주한 루스벨(v3.0 EP37). 동료 루스벨의 4등신 시트 그대로 + 보랏빛 불꽃 오라.
  // 스토리 장면(EP37_RAGE)에서만 전투가 열린다 — 쓰러뜨려도 죽지 않고 도주(EP37_FLED).
  {
    id: 'mon-ruspell-rage',
    name: '마왕 루스벨',
    level: 34,
    icon: '/images/portraits/hero-fire-female.png',
    element: 'fire',
    family: 'darkmage',
    stats: mstat(34, { maxHp: 7.5, matk: 2.5, maxMp: 3.2, mdef: 1.8, def: 1.4, spd: 1.25, atk: 1.6, luck: 1.5 }),
    traits: ['caster', 'aggressive'],
    skills: ['fire-high-1', 'fire-high-2', 'fire-adv-3', 'fire-adv-2'],
    expReward: 1600,
    goldReward: 700,
    zoneKinds: [],
    rank: 'storyBoss',
    aiProfile: 'healerHunt',
    heroSheet: 'hero-fire-female',
    aura: 'rage-violet',
  },
  // 최종보스 — 모르스(유실된 바람 속성, storyBoss). 랜덤 풀·필드 배치에 나오지 않고 최종전 스토리로만 등장한다.
  // ⚠ 전용 도트 미제작 — 임시로 '모르스의 전령' 그림을 빌려 쓴다.
  {
    id: 'mon-mors',
    name: '모르스',
    level: 50,
    icon: '/images/monsters/mon-azka-herald.png',
    element: 'wind',
    family: 'darkmage',
    stats: mstat(50, { maxHp: 8, atk: 2.2, def: 2.6, matk: 2.6, mdef: 2.6, maxMp: 4, spd: 1.15, luck: 2 }),
    traits: ['caster', 'aggressive'],
    skills: ['wind-lost-gale', 'wind-vacuum-blade', 'wind-tempest'],
    expReward: 3000,
    goldReward: 0,
    zoneKinds: [],
    rank: 'storyBoss',
    aiProfile: 'finisher',
  },
  // 테스트몹
  { id: 'mon-training-dummy', name: '훈련용 허수아비', level: 1, icon: '/images/monsters/dummy.svg', element: null, family: 'test', stats: { maxHp: 30, maxMp: 0, atk: 1, def: 1, matk: 0, mdef: 1, spd: 1, luck: 0 }, skills: [], expReward: 0, goldReward: 0, zoneKinds: ['forest', 'sea', 'ruins'], isTestMonster: true },
]
// 레벨 100 확장 — 위 데이터의 level 은 옛 50레벨 축 값. 여기서 새 축(2·옛−1)으로 옮기고,
// 처치 경험치는 Lv.100 곡선(lib/exp-table monsterBaseExp)에 맞춰 다시 잡는다 — 몬스터별 상대 배율(보스는 더 많이 등)은 보존.
export const MONSTERS: MonsterDef[] = MONSTERS_LEGACY.map((m) => {
  const level = toLevel100(m.level)
  const expReward = m.isTestMonster ? 0 : Math.max(1, Math.round((m.expReward * monsterBaseExp(level)) / legacyMonsterBaseExp(m.level)))
  return { ...m, level, expReward }
})

const MONSTER_MAP = new Map(MONSTERS.map((m) => [m.id, m]))
export function monsterById(id: string): MonsterDef | undefined {
  return MONSTER_MAP.get(id)
}
/** 보스류(miniBoss·fieldBoss·storyBoss)는 고정 배치로만 나온다. normal·elite 는 랜덤 풀 */
export function isBossRank(rank: MonsterDef['rank']): boolean {
  return rank === 'miniBoss' || rank === 'fieldBoss' || rank === 'storyBoss'
}
export function monstersForZoneKind(kind: string): MonsterDef[] {
  return MONSTERS.filter((m) => !m.isTestMonster && !isBossRank(m.rank) && m.zoneKinds.includes(kind as never))
}

// ============================================================================
// NPC — 설계: §9.1
// ============================================================================
const NPCS_BASE: NpcDef[] = [
  // ── 학교 지구 (마법동) ──
  // 학사 담당 일반 교수(2026-10-02: 예전 '미르엘 교수' 도트 → 이름만 변경. 미르엘은 학장실 npc-mirel 로 분리)
  { id: 'npc-job-trainer', name: '에드릭 교수', role: 'professor', icon: '/images/npc/npc-job-trainer.png', zoneId: 'z-magic-hall', cell: { x: 7, y: 7.5 }, greeting: ['어서 오렴. 나는 학사를 맡고 있는 에드릭이란다.', '불꽃·얼음·대지는 1학년부터, 어둠과 빛은 3학년이 되면 배울 수 있지. 수업을 성실히 들으면 마법은 저절로 따라온단다.'] },
  // 미르엘 교수 — 2026-10-02 삼면도 기반 PixelLab 도트(학장실 배회). 걷기 시트 npc-mirel-walk.png
  { id: 'npc-mirel', name: '미르엘 교수', role: 'professor', roam: 2.2, icon: '/images/npc/npc-mirel.png', zoneId: 'z-headmaster-office', cell: { x: 7.5, y: 9.4 }, greeting: ['어서 오너라. 학장실까지 찾아오다니, 무슨 일이지?', '배운 것을 무엇을 위해 쓸지는… 언젠가 스스로 정해야 한다.'] },
  // ── 교수진(통합 PRD §15) — 전용 에셋 전까지 기존 NPC 도트(spriteId) 재사용, 각자 연구실에서 배회 ──
  { id: 'prof-ignis', name: '이그니스 교수', role: 'professor', roam: 1.6, spriteId: 'npc-priest', icon: '/images/npc/npc-priest.png', zoneId: 'z-lab-fire', cell: { x: 9.5, y: 8.4 }, greeting: ['불은 망설이는 자를 먼저 태운다네.', '화염 수업에서 박자를 놓치지 말게.'] },
  { id: 'prof-kael', name: '카엘 조교', role: 'professor', roam: 1.6, spriteId: 'npc-kael', icon: '/images/npc/npc-kael.png', zoneId: 'z-lab-ice', cell: { x: 9.5, y: 8.4 }, greeting: ['…무슨 일이지. 보고서라면 책상 위에.', '빙결은 정확함이 전부다.'] },
  { id: 'prof-terra', name: '테라 교수', role: 'professor', roam: 1.6, spriteId: 'npc-elder', icon: '/images/npc/npc-elder.png', zoneId: 'z-lab-earth', cell: { x: 9.5, y: 8.4 }, greeting: ['어서 오렴. 화분에 물 좀 같이 줄래?', '땅은 서두르지 않는단다.'] },
  { id: 'prof-noella', name: '노엘라 교수', role: 'professor', roam: 1.6, spriteId: 'npc-abandoned-scholar', icon: '/images/npc/npc-abandoned-scholar.png', zoneId: 'z-lab-dark', cell: { x: 9.5, y: 8.4 }, greeting: ['어둠을 무서워하는 건 당연해. 모르니까.', '3학년이 되면 내 수업에서 보자.'] },
  { id: 'prof-lumen', name: '루멘 교수', role: 'professor', roam: 1.6, spriteId: 'npc-lumen', icon: '/images/npc/npc-lumen.png', zoneId: 'z-lab-light', cell: { x: 9.5, y: 8.4 }, greeting: ['빛은 나누면 줄지 않는 마법이에요.', '다친 곳은 없나요?'] },
  // 사서 오웬은 도서관 안(2026-10-10) — 스토리 대사('도서관입니다.')·미션('도서관 도착 → 오웬과 기록 대조')과 맞춘다
  { id: 'npc-librarian', name: '사서 오웬', role: 'flavor', roam: 0.8, icon: '/images/npc/npc-librarian.png', zoneId: 'z-academy-library', cell: { x: 10, y: 5.2 }, greeting: ['마법동 도서관에는 아직 정리 중인 마법서가 많단다. 조용히 둘러보렴.', '연금술동과 마도구동도 둘러보면 좋을 게야.'] },
  // ── 별빛 상점가 ──
  { id: 'npc-weapon', name: '대장장이 반', role: 'weaponMerchant', icon: '/images/npc/npc-weapon.png', zoneId: 'z-shops', cell: { x: 39, y: 20 }, greeting: ['다섯 속성 완드, 다 갖춰놨다네. 레벨에 맞는 걸로 골라 가시게.'], shopItemIds: [...wands.map((w) => w.id), ...robes.map((r) => r.id), ...hats.map((h) => h.id), ...accessories.map((a) => a.id)] },
  { id: 'npc-potion', name: '약사 셀린', role: 'potionMerchant', icon: '/images/npc/npc-potion.png', zoneId: 'z-shops', cell: { x: 43.2, y: 19.8 }, greeting: ['신선한 물약이 방금 들어왔어요. 통문 밖으로 나가기 전엔 꼭 챙기세요!'], shopItemIds: potions.map((p) => p.id) },
  { id: 'npc-tool', name: '만물상 토비', role: 'toolMerchant', icon: '/images/npc/npc-tool.png', zoneId: 'z-shops', cell: { x: 46, y: 20.2 }, greeting: ['도구는 다 여기 있습니다. 가속의 모래, 이거 전투에서 꽤 쓸만해요.'], shopItemIds: [...tools.map((t) => t.id), 'tool-rod-basic'] },
  { id: 'npc-tamer', name: '조련사 리코', role: 'petTamer', icon: '/images/npc/npc-tamer.png', zoneId: 'z-shops', cell: { x: 48.2, y: 22.6 }, greeting: ['펫한테 새 재주를 가르쳐 볼까? 먹이도 팔고 있어.', '햇살 농가에서 펫 농장도 준비 중이라던데.'], shopItemIds: feeds.map((f) => f.id) },
  // ── 제작 장인(2026-10-08 제작대 오브젝트 → 사람 NPC, PixelLab 도트) — 말을 걸면 각자의 제작 화면이 열린다(id 는 예전 그대로) ──
  { id: 'npc-alchemy-pot', name: '연금술 장인 이졸데', role: 'craftStation', station: 'alchemy_pot', icon: '/images/npc/npc-alchemy-pot.png', zoneId: 'z-magic-hall', cell: { x: 6.4, y: 9.2 }, roam: 0.5, greeting: ['어머, 손님이네. 가마 불 조절 중이니까 너무 가까이 오진 마.', '약초랑 결정만 가져와. 물약으로 바꾸는 건 내 몫이니까.'] },
  // ── 기숙사 마을 — 공동 식당 ──
  { id: 'npc-kitchen', name: '요리 장인 마르코', role: 'craftStation', station: 'cooking_pot', icon: '/images/npc/npc-kitchen.png', zoneId: 'z-dorm', cell: { x: 14.0, y: 22.6 }, roam: 0.5, greeting: ['배고픈 얼굴이구먼! 마법도 밥심이야.', '물고기든 고기든 약초든, 재료만 가져오면 든든한 한 끼로 만들어 주지.'] },
  { id: 'npc-workbench', name: '마도구 장인 핀', role: 'craftStation', icon: '/images/npc/npc-workbench.png', zoneId: 'z-magic-hall', cell: { x: 4.0, y: 7.0 }, roam: 0.5, greeting: ['재료 가져왔어? 필드랑 보스한테서 얻은 거면 더 좋고.', '룬 망치 한 번이면 웬만한 장비는 뚝딱이야.'] },
  // ── 하우징 마을 ──
  { id: 'npc-elder', name: '촌장 헬가', role: 'housing', icon: '/images/npc/npc-elder.png', zoneId: 'z-housing', cell: { x: 42, y: 6.2 }, greeting: ['하우징 마을에 온 걸 환영하네. 집을 짓는 기능은 다음 업데이트에서 만나볼 걸세.', '지친 견습생은 여기서 쉬어 가도 좋네.'] },
  // ── 수련의 광장 ──
  { id: 'npc-arena', name: '투기장장 그로먼', role: 'arenaMaster', icon: '/images/npc/npc-arena.png', zoneId: 'z-plaza', cell: { x: 30.6, y: 24.0 }, greeting: ['콜로세움 대전은 준비 중이다! 조금만 기다려다오.'] },
  // ── 통문 주둔지 ──
  { id: 'npc-guard', name: '경비대장 로한', role: 'guard', icon: '/images/npc/npc-guard.png', zoneId: 'z-barracks', cell: { x: 43.5, y: 34 }, greeting: ['야생으로 나가려면 저 군 통문을 통해야 한다.', '숲은 견습생도 견딜 만하지만, 폐허와 화산지대는 준비가 단단히 되어 있어야 살아 돌아온다.'] },
  // ── 성역 신전 ──
  { id: 'npc-priest', name: '신관 세드릭', role: 'templePriest', icon: '/images/npc/npc-priest.png', zoneId: 'z-temple', cell: { x: 8.5, y: 30.2 }, greeting: ['성역에 온 것을 환영하네, 젊은 마법사여.', '이곳은 지친 영혼이 쉬어 가는 곳. 통문 밖에서 쓰러지면 이 신전에서 눈을 뜨게 될 걸세.'] },
  // 성녀는 EP21(75주) '성녀와 첫 대화'가 시작돼 울토르를 방문한 뒤부터 성역 신전에 머문다
  { id: 'npc-saint', name: '성녀 리아나', role: 'saint', icon: '/images/npc/npc-saint.png', zoneId: 'z-temple', visibleFlag: 'beat:EP_75_OPEN', cell: { x: 11.5, y: 32.6 }, greeting: ['빛이 그대와 함께하기를.', '언젠가 이 손으로 그대에게 축복을 내릴 날이 오겠지요. 지금은 준비 중이랍니다.'] },
  // ── 햇살 농가 ──
  { id: 'npc-farmer', name: '농부 하름', role: 'farmer', icon: '/images/npc/npc-farmer.png', zoneId: 'z-farm', cell: { x: 26, y: 29.2 }, greeting: ['어이, 견습생! 여기가 햇살 농가일세.', '밭농사에 펫 농장까지 해볼 생각인데, 아직은 삽질만 하고 있다네. 곧 열 테니 기대하게.'] },

  // ── 아틀란티스 마을 (안전지대) ──
  { id: 'npc-atlantis-elder', name: '해류사제 넬리아', role: 'flavor', icon: '/images/npc/npc-atlantis-elder.png', zoneId: 'z-atlantis', cell: { x: 18.6, y: 23.2 }, greeting: ['숨은 걱정 말게 — 이 돔 안은 뭍과 같으니.', '아틀란티스는 심해가 삼키기 전, 삼원을 가장 먼저 연구한 도시였네.'] },
  { id: 'npc-atlantis-merchant', name: '진주상인 카로', role: 'potionMerchant', icon: '/images/npc/npc-atlantis-merchant.png', zoneId: 'z-atlantis', cell: { x: 43.6, y: 23.4 }, greeting: ['해저에서 건진 물약이라네. 뭍 것보다 훨씬 잘 들어.'], shopItemIds: potions.map((p) => p.id) },
  { id: 'npc-atlantis-child', name: '인어 아이 피오', role: 'flavor', icon: '/images/npc/npc-atlantis-child.png', zoneId: 'z-atlantis', cell: { x: 32.0, y: 40.0 }, greeting: ['위쪽 세계 사람이다! 다리로 걷는 거 신기해요.'] },

  // ── 천공 신전 (안전지대) ──
  { id: 'npc-sky-priest', name: '바람사제 이엘', role: 'templePriest', icon: '/images/npc/npc-sky-priest.png', zoneId: 'z-sky-temple', cell: { x: 32.0, y: 12.8 }, greeting: ['폭풍 위에 온 걸 환영하네, 순례자여.', '바람의 결을 읽으면 삼원의 다음 장이 보인다 — 그렇게들 믿지.'] },
  { id: 'npc-sky-keeper', name: '종지기 하나', role: 'flavor', icon: '/images/npc/npc-sky-keeper.png', zoneId: 'z-sky-temple', cell: { x: 32.0, y: 21.6 }, greeting: ['신전 종은 폭풍이 방향을 바꿀 때만 울려요.', '아래를 내려다보면 스톰헤이븐 전체가 보인답니다.'] },
  // 국왕 일행(v3.0 — 왕은 가끔 언급되거나 스톰헤이븐에서 우연히 마주친다). 스톰헤이븐 장(CH3)이 열린 뒤에만 신전에 머문다
  { id: 'npc-king', name: '국왕 레오니스', role: 'royal', icon: '/images/npc/npc-king.png', zoneId: 'z-sky-temple', cell: { x: 26.5, y: 16.6 }, roam: 0.5, visibleFlag: 'CH3_STORMHAVEN_STARTED', greeting: ['바람이 거센 날엔 이곳에서 옛 기록을 떠올리곤 하지.', '울토르의 학생들이 이 나라를 어떻게 배우고 있는지, 나는 늘 궁금하다.'] },
  { id: 'npc-royal-guard', name: '왕실 근위병', role: 'royalGuard', icon: '/images/npc/npc-royal-guard.png', zoneId: 'z-sky-temple', cell: { x: 25.0, y: 18.0 }, roam: 0.3, visibleFlag: 'CH3_STORMHAVEN_STARTED', greeting: ['폐하 곁에서는 걸음을 조심하도록.'] },
  { id: 'npc-royal-guard-2', name: '왕실 근위병', role: 'royalGuard', spriteId: 'npc-royal-guard', icon: '/images/npc/npc-royal-guard.png', zoneId: 'z-sky-temple', cell: { x: 28.2, y: 18.0 }, roam: 0.3, visibleFlag: 'CH3_STORMHAVEN_STARTED', greeting: ['신전 안에서는 무기를 거두는 것이 예의다.'] },

  // ── 버려진 신전 (안전지대) ──
  { id: 'npc-abandoned-monk', name: '은둔수도자 그림', role: 'templePriest', icon: '/images/npc/npc-abandoned-monk.png', zoneId: 'z-abandoned-temple', cell: { x: 32.0, y: 12.8 }, greeting: ['폐허라 부르지만, 우리에겐 아직 집이라네.', '유물을 노리는 자는 많아도, 지키는 손은 우리뿐이지.'] },
  { id: 'npc-abandoned-scholar', name: '유물학자 세라', role: 'flavor', icon: '/images/npc/npc-abandoned-scholar.png', zoneId: 'z-abandoned-temple', cell: { x: 32.0, y: 21.6 }, greeting: ['이 벽화, 인마대전 이전 것이에요. 삼원의 원형이 그려져 있죠.'] },

  // ── 오로라 마을 (안전지대) ──
  { id: 'npc-aurora-chief', name: '설인족장 보르', role: 'housing', icon: '/images/npc/npc-aurora-chief.png', zoneId: 'z-aurora', cell: { x: 32.0, y: 13.0 }, greeting: ['얼음집 안은 따뜻하다. 불 쬐고 가라, 여행자.', '밤이 오면 하늘을 봐라 — 오로라가 설원의 길을 밝혀 준다.'] },
  { id: 'npc-aurora-trader', name: '설원상인 미카', role: 'toolMerchant', icon: '/images/npc/npc-aurora-trader.png', zoneId: 'z-aurora', cell: { x: 43.8, y: 20.0 }, greeting: ['설원에서 얼어 죽지 않으려면 장비가 생명이야. 좋은 거 있어.'], shopItemIds: tools.map((t) => t.id) },
  { id: 'npc-aurora-hunter', name: '서리사냥꾼 룬', role: 'flavor', icon: '/images/npc/npc-aurora-hunter.png', zoneId: 'z-aurora', cell: { x: 32.0, y: 21.6 }, greeting: ['설원 바깥은 서리 짐승 천지야. 마을 안에선 안심해도 돼.'] },

  // ── 마물 마을 (안전지대) ──
  { id: 'npc-demon-elder', name: '온건파 장로 카즈', role: 'flavor', icon: '/images/npc/npc-demon-elder.png', zoneId: 'z-demon-village', cell: { x: 32.0, y: 13.0 }, greeting: ['인간의 책에 적힌 마왕과 우리가 아는 모르스님은 다른 분이다.', '여기선 칼을 거둬라. 교역하러 온 거라면 환영이다.'] },
  { id: 'npc-demon-smith', name: '용암대장장이 그롯', role: 'weaponMerchant', icon: '/images/npc/npc-demon-smith.png', zoneId: 'z-demon-village', cell: { x: 18.6, y: 23.2 }, greeting: ['화산 불로 벼린 물건이다. 뭍 대장간 것과는 격이 달라.'], shopItemIds: [...wands.map((w) => w.id)] },
  { id: 'npc-demon-child', name: '꼬마 마물 삐약', role: 'flavor', icon: '/images/npc/npc-demon-child.png', zoneId: 'z-demon-village', cell: { x: 32.0, y: 21.6 }, greeting: ['인간이다! 뿔 없는 거 진짜였네…'] },
]

/**
 * 둘이 붙어 서서 티격태격하는 주민 짝(lib/npc-banter BANTER_DUOS) — 마을 꾸미기 소품(lib/town-decor) 옆에 선다.
 * 전용 도트가 아직 없어 다른 NPC 의 시트를 빌린다(spriteId). 자리는 그 맵의 지금 좌표(마을 북쪽 띠 포함).
 */
const TOWN_DUO_NPCS: NpcDef[] = [
  { id: 'npc-duo-baker', name: '제빵사 폴코', role: 'flavor', icon: '/images/npc/npc-kitchen.png', spriteId: 'npc-kitchen', zoneId: 'z-north-lot', cell: { x: 39.6, y: 7.8 }, roam: 0.25, greeting: ['마르코 형이랑 헷갈리지 마. 형은 요리, 나는 빵이야.'] },
  { id: 'npc-duo-florist', name: '꽃집 로잔', role: 'flavor', icon: '/images/npc/npc-atlantis-merchant.png', spriteId: 'npc-atlantis-merchant', zoneId: 'z-north-lot', cell: { x: 40.8, y: 8.2 }, roam: 0.25, greeting: ['오늘 들어온 꽃이 제일 예뻐요. 내일 건 내일 제일 예쁘고요.'] },
  { id: 'npc-duo-sauna', name: '사우나 지기 올가', role: 'flavor', icon: '/images/npc/npc-elder.png', spriteId: 'npc-elder', zoneId: 'z-aurora', cell: { x: 25.2, y: 42.8 }, roam: 0.25, greeting: ['몸이 얼었으면 들어와. 돈은 녹은 다음에 받는다.'] },
  { id: 'npc-duo-carver', name: '얼음 조각가 니플', role: 'flavor', icon: '/images/npc/npc-workbench.png', spriteId: 'npc-workbench', zoneId: 'z-aurora', cell: { x: 26.4, y: 43.2 }, roam: 0.25, greeting: ['만지지 마세요. 체온에 녹아요.'] },
  { id: 'npc-duo-peddler', name: '행상 로비', role: 'flavor', icon: '/images/npc/npc-tool.png', spriteId: 'npc-tool', zoneId: 'z-demon-village', cell: { x: 29.4, y: 23.4 }, roam: 0.25, greeting: ['토비 형이 사촌이야. 형은 학교 앞, 나는 화산 앞.'] },
  { id: 'npc-duo-imp', name: '수습 점원 뿔리', role: 'flavor', icon: '/images/npc/npc-demon-child.png', spriteId: 'npc-demon-child', zoneId: 'z-demon-village', cell: { x: 30.6, y: 23.8 }, roam: 0.25, greeting: ['어서 와라, 인간. 도망치지 않아도 된다.'] },
  { id: 'npc-duo-balloon', name: '풍선 장수 파랑', role: 'flavor', icon: '/images/npc/npc-farmer.png', spriteId: 'npc-farmer', zoneId: 'z-sky-temple', cell: { x: 15, y: 44.4 }, roam: 0.25, greeting: ['하늘 위에서 풍선을 팔면 뭐가 좋냐고? 놓쳐도 안 아까워.'] },
  { id: 'npc-duo-harp', name: '하프 수리공 리라', role: 'flavor', icon: '/images/npc/npc-sky-keeper.png', spriteId: 'npc-sky-keeper', zoneId: 'z-sky-temple', cell: { x: 16.2, y: 44.8 }, roam: 0.25, greeting: ['줄은 팽팽해야 하고, 사람은 느슨해야 해요.'] },
  { id: 'npc-duo-sexton', name: '묘지기 돌브', role: 'flavor', icon: '/images/npc/npc-priest.png', spriteId: 'npc-priest', zoneId: 'z-abandoned-temple', cell: { x: 25.8, y: 18.8 }, roam: 0.25, greeting: ['조용히 다녀라. 여긴 자는 사람이 많다.'] },
  { id: 'npc-duo-candle', name: '양초 장수 미미', role: 'flavor', icon: '/images/npc/npc-tamer.png', spriteId: 'npc-tamer', zoneId: 'z-abandoned-temple', cell: { x: 27, y: 19.2 }, roam: 0.25, greeting: ['초 사세요! 어두운 데서 제일 잘 팔려요. …이론상으론.'] },
  { id: 'npc-duo-diver', name: '잠수부 보글', role: 'flavor', icon: '/images/npc/npc-aurora-hunter.png', spriteId: 'npc-aurora-hunter', zoneId: 'z-atlantis', cell: { x: 23.4, y: 50.2 }, roam: 0.25, greeting: ['숨을 오래 참는 비결? 말을 줄이는 거다.'] },
  { id: 'npc-duo-ice', name: '얼음과자 장수 소르', role: 'flavor', icon: '/images/npc/npc-atlantis-child.png', spriteId: 'npc-atlantis-child', zoneId: 'z-atlantis', cell: { x: 24.6, y: 50.6 }, roam: 0.25, greeting: ['얼음과자 하나에 조개 세 닢! 외상은 장부에 적어.'] },
]

// 관리자 테스트룸 — 기존 NPC 전원(상점·대화 전부)을 zoneId만 z-testroom 으로 바꿔 한 방에 복제.
// 원본은 그대로 두고 추가만 하는 방식이라 실제 마을 NPC 배치엔 영향 없음.
function testRoomNpcs(base: NpcDef[]): NpcDef[] {
  const cols = 6
  return base.map((n, i) => ({
    ...n,
    id: `${n.id}-tr`,
    zoneId: 'z-testroom',
    cell: { x: 3 + (i % cols) * 3, y: 3 + Math.floor(i / cols) * 3 },
  }))
}

// 마을 NPC 자리는 위 목록에 옛 마을 좌표로 적혀 있다 → 북쪽 확장만큼 민다(lib/village-layout.ts)
const NPCS_PLACED: NpcDef[] = NPCS_BASE.map((n) => (VILLAGE_BASE_ZONE_IDS.has(n.zoneId) ? { ...n, cell: villageShift(n.cell) } : n))
export const NPCS: NpcDef[] = [...NPCS_PLACED, ...TOWN_DUO_NPCS, ...testRoomNpcs(NPCS_BASE)]
/**
 * 학교 동료(lib/companions SCHOOL_NPCS)의 대화용 NPC 정의 — 맵 구역에 묶이지 않고(lib/school-roster 가 매주 배치)
 * npcById 로만 찾는다. 인사말 = 평소 대사 + 합류 권유 대사.
 */
const COMPANION_NPCS: NpcDef[] = SCHOOL_NPCS.filter((c) => !!c.homeRoom).map((c) => ({
  id: c.id,
  name: c.name,
  role: 'companion' as const,
  icon: c.portrait,
  zoneId: 'school-roster',
  cell: { x: 0, y: 0 },
  greeting: [c.lines.idle, c.lines.recruit],
}))
const NPC_MAP = new Map([...NPCS, ...COMPANION_NPCS].map((n) => [n.id, n]))
export function npcById(id: string): NpcDef | undefined {
  return NPC_MAP.get(id)
}
