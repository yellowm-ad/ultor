// ============================================================================
// 스킬별 타격 횟수(2026-11-05) — 연출(lib/skill-vfx 레이어·반복·흔들림)을 보고 정한 값. 최대 10타.
//   · 엔진이 계산한 총 피해는 그대로 — 화면(battle-screen)이 첫 타격(impactMs)부터 이 횟수로 나눠
//     HP 막대와 데미지 숫자를 한 대씩 깎는다(피해 ÷ 타수, 마지막 타에서 정확히 총합).
//   · 표에 없는 스킬·기본 공격은 1타. 회복·버프는 1타(값이 바뀌는 만큼 한 번에).
// ============================================================================

export const MAX_HITS = 10

export const SKILL_HITS: Record<string, number> = {
  // 불
  'fire-basic-1': 1, // 불씨 한 발
  'fire-basic-3': 2, // 주먹 + 불꽃 폭발
  'fire-adv-1': 3, // 채찍 휘두르기
  'fire-adv-2': 3, // 고리가 조여 오며
  'fire-adv-3': 2, // 발화 + 지속 연소
  'fire-high-1': 4, // 섬광 · 파동 · 폭발 두 번
  'fire-high-2': 5, // 낙인 · 불기둥 · 불티
  'fire-master-1': 10, // 용의 빔 + 노바 + 연소(흔들림 17회)
  'fire-master-2': 8, // 불기둥 · 파동 · 연소 3겹
  // 얼음
  'ice-basic-1': 1,
  'ice-basic-3': 2, // 파동 + 타격
  'ice-adv-1': 3, // 손아귀 + 파편
  'ice-adv-2': 5, // 눈보라 소용돌이 2회전
  'ice-adv-3': 2, // 결빙 + 봉인
  'ice-high-1': 6, // 고드름 두 번씩 흩뿌림
  'ice-high-2': 4, // 고리 · 가시 · 폭발
  'ice-master-1': 8, // 빔 셋 · 감옥 · 폭풍 · 산산조각
  'ice-master-2': 7, // 빙하 · 충돌 · 눈사태 · 균열
  // 대지
  'earth-basic-1': 1,
  'earth-basic-3': 2, // 주먹 + 바위
  'earth-adv-1': 2, // 수렁 + 붙잡는 손
  'earth-high-1': 6, // 지진(흔들림 11회)
  'earth-high-2': 2, // 시선 + 석화
  'earth-master-1': 9, // 소용돌이 · 분출 · 돔 · 균열
  'earth-master-2': 6, // 운석 셋 + 충격
  // 어둠
  'dark-execute': 2, // 낫 + 파편
  'dark-seal': 2,
  'dark-miasma': 3,
  'dark-gaze': 3,
  'dark-sentence': 10, // 선고 빔(흔들림 10회)
  // 바람
  'wind-lost-gale': 4, // 돌풍 + 베기
  'wind-vacuum-blade': 5, // 베기 · 칼날 · 잔상
  'wind-dragon-breath': 6, // 흑풍의 숨결
  'wind-tempest': 10, // 회오리 둘 · 베기 넷 · 돌풍
  // 소환수 공격
  'pet-scratch': 2,
  'pet-peck': 3,
  'pet-shadow-claw': 2,
  'pet-fire-breath': 3,
  'pet-burn-fang': 2,
  'pet-frost-nip': 2,
  'pet-ice-shard': 3,
  'pet-quake-stomp': 2,
}

export function skillHitCount(skillId: string | undefined): number {
  if (!skillId) return 1
  return Math.max(1, Math.min(MAX_HITS, SKILL_HITS[skillId] ?? 1))
}
