// 삼면도의 '대화창 초상화' 칸을 잘라 대화창 초상화로 넣는다(2026-10-14)
//   원본: 게임 개발 파일/전투 NPC … 삼면도.png · NPC … 삼면도.png · NPC … 초상화.png (1536×1024)
//   출력: public/images/npc/portrait-<id>.png — 가로 512px(대화창 2배 해상도까지 선명하게), 칸 테두리 선은 안쪽으로 잘라 뺀다
// 실행: node scripts/import-portraits.mjs
import sharp from 'sharp'
import path from 'node:path'

const SRC = path.resolve('../..')
const OUT = path.resolve('public/images/npc')
const INSET = 5 // 칸 테두리 선을 피해 안쪽으로
const JOBS = [
  ['전투 NPC 리안, 도란 삼면도.png', ['portrait-npc-rian.png'], [815, 288, 982, 448]],
  ['전투 NPC 리안, 도란 삼면도.png', ['portrait-npc-doran.png'], [815, 790, 982, 952]],
  ['전투 NPC 유나, 셀라 삼면도.png', ['portrait-npc-yuna.png'], [1252, 334, 1508, 495]],
  ['전투 NPC 유나, 셀라 삼면도.png', ['portrait-npc-sella.png'], [1252, 838, 1508, 1002]],
  ['전투 NPC 미르엘, 카엘 삼면도.png', ['portrait-npc-mirel.png'], [1252, 338, 1508, 500]],
  // 카엘 = 학교 동료(comp-kael)·수업 조교(prof-kael) 같은 사람
  ['전투 NPC 미르엘, 카엘 삼면도.png', ['portrait-npc-kael.png', 'portrait-prof-kael.png'], [1252, 852, 1508, 1002]],
  ['NPC 오웬, 이그니스 삼면도.png', ['portrait-npc-librarian.png'], [1222, 312, 1355, 462]],
  ['NPC 오웬, 이그니스 삼면도.png', ['portrait-prof-ignis.png'], [1222, 828, 1355, 976]],
  ['NPC 테라, 노엘라 삼면도.png', ['portrait-prof-terra.png'], [1240, 336, 1508, 490]],
  ['NPC 테라, 노엘라 삼면도.png', ['portrait-prof-noella.png'], [1240, 843, 1508, 1000]],
  ['NPC 루멘, 에드릭 삼면도.png', ['portrait-prof-lumen.png'], [1240, 327, 1508, 490]],
  // 에드릭 = 학사 담당 교수(npc-job-trainer)
  ['NPC 루멘, 에드릭 삼면도.png', ['portrait-npc-job-trainer.png'], [1240, 829, 1508, 1000]],
  // 초상화 전용 시트(2026-10-15) — 칸 전체가 흉상
  ['NPC 핀, 이졸데, 마르코, 세드릭, 하름 초상화.png', ['portrait-npc-workbench.png'], [82, 17, 491, 489]],
  ['NPC 핀, 이졸데, 마르코, 세드릭, 하름 초상화.png', ['portrait-npc-alchemy-pot.png'], [547, 17, 987, 489]],
  ['NPC 핀, 이졸데, 마르코, 세드릭, 하름 초상화.png', ['portrait-npc-kitchen.png'], [1045, 17, 1455, 489]],
  ['NPC 핀, 이졸데, 마르코, 세드릭, 하름 초상화.png', ['portrait-npc-priest.png'], [311, 526, 734, 999]],
  ['NPC 핀, 이졸데, 마르코, 세드릭, 하름 초상화.png', ['portrait-npc-farmer.png'], [800, 526, 1224, 999]],
  ['NPC 로잔, 폴고 초상화.png', ['portrait-npc-duo-florist.png'], [48, 63, 486, 621]],
  // 폴코(시트 이름 폴고) — 칸 오른쪽 아래 반짝이 표식은 빼고
  ['NPC 로잔, 폴고 초상화.png', ['portrait-npc-duo-baker.png'], [538, 63, 976, 575]],
]
for (const [file, outs, [x0, y0, x1, y1]] of JOBS) {
  const buf = await sharp(path.join(SRC, file))
    .extract({ left: x0 + INSET, top: y0 + INSET, width: x1 - x0 - INSET * 2, height: y1 - y0 - INSET * 2 })
    .resize({ width: 512, kernel: 'lanczos3' })
    .png()
    .toBuffer()
  for (const o of outs) {
    await sharp(buf).toFile(path.join(OUT, o))
    console.log('wrote', o)
  }
}
