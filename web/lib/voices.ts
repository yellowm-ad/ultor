// 대사 글자 소리 목소리(2026-11-10) — 말하는 사람 이름 → 목소리(lib/sfx blip).
// NPC 데이터에 성별 칸이 없어 이름·직함으로 정한 표. 틀린 사람이 있으면 여기만 고치면 된다.
// 이름에 아래 낱말이 들어 있으면 그 목소리(앞에서부터 먼저 맞는 것). 주인공은 캐릭터 성별을 따른다.
import type { Voice } from '@/lib/sfx'

const TABLE: [Voice, string[]][] = [
  ['monster', ['골렘', '심해암초왕', '뿔의 그림자', '언데드', '마물 주민', '수하']],
  ['child', ['인어 아이', '꼬마', '아이 마족', '수습 점원', '풍선 장수', '삐약']],
  ['elder', ['촌장 헬가', '은둔수도자', '장로', '묘지기', '현자', '기록관지기']],
  [
    'female',
    ['미르엘', '테라', '노엘라', '셀린', '이졸데', '성녀', '넬리아', '종지기', '세라', '로잔', '올가', '미미', '메리', '마린', '시엘', '셀라', '유나', '리라', '모르스', '희의'],
  ],
  [
    'male',
    ['에드릭', '이그니스', '카엘', '루멘', '오웬', '반', '토비', '리코', '마르코', '핀', '그로먼', '로한', '세드릭', '하름', '카로', '이엘', '레오니스', '근위병', '보르', '룬', '그롯', '루카', '서기', '폴코', '로비', '보글', '소르', '아우렐', '녹스', '그란', '바르칸', '베른', '쿠르', '도란', '리안', '루스벨', '토마', '모렌', '지휘관', '니플', '미카', '투이'],
  ],
]

/** 말하는 사람 → 목소리. 이름이 없으면(지문) 소리 없음 */
export function voiceOf(speaker: string | undefined, opts: { isPlayer?: boolean; playerGender?: 'male' | 'female' } = {}): Voice {
  if (opts.isPlayer) return opts.playerGender === 'female' ? 'female' : 'male'
  if (!speaker) return 'none'
  for (const [v, keys] of TABLE) if (keys.some((k) => speaker.includes(k))) return v
  return 'neutral'
}
