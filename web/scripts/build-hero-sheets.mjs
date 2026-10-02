// PixelLab "Spritesheet (PNG + JSON)" export 를 게임용 통일 스프라이트 시트로 변환.
//
// 사용법:
//   1) PixelLab 캐릭터 상세 → Export → "Spritesheet (PNG + JSON)" 로 6종 다운로드
//      (또는 scripts/_pixellab/fetch-hero-spritesheets.ps1 로 자동 다운로드)
//   2) 각 zip 을 풀어서 아래 SRC 아래에 hero 이름 폴더로 배치:
//        <SRC>/fire-male/*.png, *.json
//        <SRC>/fire-female/... ice-male ... ice-female ... earth-male ... earth-female
//   3) node scripts/build-hero-sheets.mjs
//
// 출력: public/images/sprites/hero-<element>-<gender>.png
//   88px 셀 · 8열 × 4행
//   row 0 = 8방향 회전 (south, south-east, east, north-east, north, north-west, west, south-west)
//   row 1 = south(정면) 걷기 8프레임
//   row 2 = east(우) 걷기 8프레임      (west 는 pixel-hero 에서 좌우 반전)
//   row 3 = north(후면) 걷기 8프레임
//   특정 방향 걷기가 없으면 south 걷기로, 걷기 자체가 없으면 회전 대기 프레임 + 바운스로 대체.
//
// 걷기 행마다 프레임별 안정화(stabilize)를 거친다: PixelLab 이 방향별로 따로 생성한 8프레임은
// 머리 위치(bbox top)·좌우 중심(bbox cx)이 프레임마다 미묘하게 어긋나 있어(±1~4px) 그대로 쓰면
// 걷는 동안 몸통이 화면에서 떨리는 것처럼 보인다. 각 프레임을 행의 중앙값에 맞춰 상하/좌우로
// 살짝 이동시켜 이 흔들림을 없앤다(다리·팔의 실제 스텝 모션은 그대로 유지).

import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC = process.env.SRC || path.join(__dirname, '_pixellab')
const OUT = path.join(__dirname, '..', 'public', 'images', 'sprites')
const CELL = 88
const COLS = 8
const ROWS = 4
const WALK_ROWS = ['south', 'east', 'north'] // 출력 row 1,2,3
// CHARS=npc-sella 처럼 지정하면 그 폴더만 처리하고 출력 이름도 폴더명 그대로(npc-sella.png)
const CHARS = process.env.CHARS ? process.env.CHARS.split(',') : ['fire-male', 'fire-female', 'ice-male', 'ice-female', 'earth-male', 'earth-female']
const outName = (name) => (process.env.CHARS ? `${name}.png` : `hero-${name}.png`)
const STABILIZE_MAX = 6 // 안정화 보정 최대 픽셀(이상치 프레임이 과하게 튀는 것 방지)

/** 프레임의 불투명 픽셀 bbox 중 top(머리 높이)·cx(좌우 중심)를 구한다. */
async function frameAnchor(buf, w, h) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, channels } = info
  let top = h, left = w, right = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * width + x) * channels + 3] > 24) {
        if (y < top) top = y
        if (x < left) left = x
        if (x > right) right = x
      }
    }
  }
  if (right < 0) return { top: h / 2, cx: w / 2 } // 완전 투명 프레임(방어)
  return { top, cx: (left + right) / 2 }
}

/** 프레임 내용을 (dx,dy) 픽셀만큼 이동(빈 자리는 투명, 밀려난 가장자리는 잘림). */
async function shiftFrame(buf, w, h, dx, dy) {
  dx = Math.round(dx)
  dy = Math.round(dy)
  if (!dx && !dy) return buf
  // extend → extract 를 한 파이프라인에 체이닝하면 sharp 가 "bad extract area" 를 던지는
  // 경우가 있어(버전 이슈로 추정) 중간에 버퍼로 한 번 구체화한다.
  const extended = await sharp(buf)
    .extend({
      top: dy > 0 ? dy : 0,
      bottom: dy < 0 ? -dy : 0,
      left: dx > 0 ? dx : 0,
      right: dx < 0 ? -dx : 0,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()
  return sharp(extended)
    .extract({ left: dx < 0 ? -dx : 0, top: dy < 0 ? -dy : 0, width: w, height: h })
    .toBuffer()
}

const median = (nums) => {
  const s = [...nums].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/** 한 걷기 행의 프레임들을 머리높이·좌우중심 중앙값에 맞춰 안정화 */
async function stabilizeRow(frames, w, h) {
  const anchors = await Promise.all(frames.map((f) => frameAnchor(f, w, h)))
  const targetTop = median(anchors.map((a) => a.top))
  const targetCx = median(anchors.map((a) => a.cx))
  return Promise.all(
    frames.map((buf, i) => {
      const dy = Math.max(-STABILIZE_MAX, Math.min(STABILIZE_MAX, targetTop - anchors[i].top))
      const dx = Math.max(-STABILIZE_MAX, Math.min(STABILIZE_MAX, targetCx - anchors[i].cx))
      return shiftFrame(buf, w, h, dx, dy)
    }),
  )
}

for (const name of CHARS) {
  const dir = path.join(SRC, name)
  const png = fs.readdirSync(dir).find((f) => f.endsWith('.png'))
  const json = fs.readdirSync(dir).find((f) => f.endsWith('.json'))
  const meta = JSON.parse(fs.readFileSync(path.join(dir, json), 'utf8')).spritesheet
  const inCell = meta.cell_size.width
  const buf = await sharp(path.join(dir, png)).toBuffer()
  const off = Math.round((CELL - inCell) / 2)

  const rotRow = meta.rows.find((r) => r.type === 'rotations')
  if (!rotRow) throw new Error(`${name}: rotations row 없음`)

  // 걷기 애니 행: type "animation" + 이름이 정확히 "Walking" (스테일한 Walking_2 등은 제외)
  const walkRowsByDir = {}
  for (const r of meta.rows) {
    if (r.type !== 'animation') continue
    if (!/^walking$/i.test(String(r.animation || ''))) continue
    if (r.direction && !(r.direction in walkRowsByDir)) walkRowsByDir[r.direction] = r
  }
  const southWalk = walkRowsByDir['south'] || null

  // 소스 PNG 의 한 셀을 잘라 88px 셀 중앙에 얹는다.
  const grab = (srcRowIdx, srcCol) =>
    sharp(buf)
      .extract({ left: srcCol * inCell, top: srcRowIdx * inCell, width: inCell, height: inCell })
      .toBuffer()

  const layers = []

  // ── row 0: 8방향 회전 ──
  for (let c = 0; c < COLS; c++) {
    layers.push({ input: await grab(rotRow.row, c), left: c * CELL + off, top: off })
  }

  // ── row 1..3: south / east / north 걷기 ──
  const statuses = []
  for (let ri = 0; ri < WALK_ROWS.length; ri++) {
    const wantDir = WALK_ROWS[ri]
    const outRow = ri + 1
    let src = walkRowsByDir[wantDir] || southWalk
    let label = walkRowsByDir[wantDir] ? wantDir : southWalk ? `${wantDir}→south` : 'none'

    if (src) {
      const fc = src.frame_count || COLS
      const start = fc > COLS ? 1 : 0 // 9프레임(레퍼런스 포함)이면 첫 프레임 스킵
      const rawFrames = []
      for (let c = 0; c < COLS; c++) {
        const srcCol = Math.min(start + c, fc - 1)
        rawFrames.push(await grab(src.row, srcCol))
      }
      const stable = await stabilizeRow(rawFrames, inCell, inCell)
      for (let c = 0; c < COLS; c++) {
        layers.push({ input: stable[c], left: c * CELL, top: outRow * CELL })
      }
    } else {
      // 걷기 전혀 없음 → 회전 대기 프레임 + 상하 바운스
      const rotCol = rotRow.directions ? Math.max(0, rotRow.directions.indexOf(wantDir)) : 0
      for (let c = 0; c < COLS; c++) {
        layers.push({
          input: await grab(rotRow.row, rotCol),
          left: c * CELL + off,
          top: outRow * CELL + off + (c % 2 ? -2 : 0),
        })
      }
    }
    statuses.push(`${outRow}:${label}`)
  }

  await sharp({
    create: { width: COLS * CELL, height: ROWS * CELL, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(layers)
    .png()
    .toFile(path.join(OUT, outName(name)))
  console.log(`${outName(name)}  ${COLS * CELL}x${ROWS * CELL}  rows[ ${statuses.join('  ')} ]`)
}
