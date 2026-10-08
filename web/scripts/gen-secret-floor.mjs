// 마법학교 숨겨진 제단실 바닥 — 오망성 마법진을 "셀 좌표계" 도트로 생성(gen-academy-floor.mjs 의 모자이크와 같은 방식).
// iso-structures 윗면(top img)으로 바닥 격자에 눕는다. 꼭짓점 방향은 lib/academy-secret.ts 의 pentaPoint 와 같다
// (225° + 72°k — 화면 위쪽, 셀 -x·-y 방향).
//   public/images/map/academy/secret/pentagram.png — 한 변 2·(r+1.2) 셀 × PX px/셀, 마법진 밖 투명
// node scripts/gen-secret-floor.mjs
import sharp from 'sharp'
import path from 'node:path'

const OUT = path.resolve('public/images/map/academy/secret')
const R = 5 // PENTA.r
const HALF = R + 1.2
const PX = 16
const S = Math.round(HALF * 2 * PX)

const pts = Array.from({ length: 5 }, (_, k) => {
  const a = ((225 + 72 * k) * Math.PI) / 180
  return [Math.cos(a) * R, Math.sin(a) * R]
})
// 별 = 꼭짓점을 두 칸씩 건너 이은 다섯 선분
const segs = pts.map((p, k) => [p, pts[(k + 2) % 5]])
const segDist = (x, y, [[ax, ay], [bx, by]]) => {
  const dx = bx - ax, dy = by - ay
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(x - ax - t * dx, y - ay - t * dy)
}
const h2 = (x, y) => {
  let n = (x * 374761393 + y * 668265263) >>> 0
  n = ((n ^ (n >>> 13)) * 1274126177) >>> 0
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295
}

const CORE = [214, 240, 255]
const LINE = [110, 186, 255]
const GLOW = [40, 90, 200]
const buf = Buffer.alloc(S * S * 4)
const put = (i, c, a) => {
  // 더 밝은 쪽을 남긴다(겹친 선이 덮어써 어두워지지 않게)
  if (buf[i + 3] >= a) return
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = a
}
for (let py = 0; py < S; py++)
  for (let px = 0; px < S; px++) {
    const x = (px + 0.5) / PX - HALF
    const y = (py + 0.5) / PX - HALF
    const i = (py * S + px) * 4
    const d = Math.hypot(x, y)
    const line = Math.min(...segs.map((s) => segDist(x, y, s)))
    const ring = (rr, w) => Math.abs(d - rr) < w
    // 바깥 이중 원 + 룬 점
    if (ring(R + 0.75, 0.07) || ring(R + 0.1, 0.07)) put(i, CORE, 255)
    else if (ring(R + 0.75, 0.16) || ring(R + 0.1, 0.16)) put(i, LINE, 230)
    else if (d > R + 0.18 && d < R + 0.67) {
      // 두 원 사이 룬 띠 — 각도 칸마다 짧은 획
      const a = Math.atan2(y, x)
      const cell = Math.floor(((a + Math.PI) / (2 * Math.PI)) * 40)
      const local = (((a + Math.PI) / (2 * Math.PI)) * 40) % 1
      const rr = (d - R - 0.18) / 0.49
      const on = h2(cell, Math.floor(rr * 4)) > 0.45 && local > 0.25 && local < 0.75
      if (on && rr > 0.2 && rr < 0.8) put(i, LINE, 210)
      else put(i, GLOW, 70)
    }
    // 별 선
    if (line < 0.06) put(i, CORE, 255)
    else if (line < 0.14) put(i, LINE, 235)
    else if (line < 0.42 && d < R + 0.1) put(i, GLOW, Math.round(120 * (1 - (line - 0.14) / 0.28)))
    // 꼭짓점 촛대 자리 작은 원
    for (const [qx, qy] of pts) {
      const dq = Math.hypot(x - qx * 1.18, y - qy * 1.18)
      if (Math.abs(dq - 0.55) < 0.07) put(i, CORE, 255)
      else if (Math.abs(dq - 0.55) < 0.15) put(i, LINE, 220)
    }
    // 중앙 제단 자리 — 은은한 원판
    if (d < 1.6) put(i, GLOW, Math.round(90 * (1 - d / 1.6)) + 30)
    // 마법진 안쪽 전체에 아주 옅은 푸른 기
    if (d < R + 0.75) put(i, GLOW, 34)
  }
await sharp(buf, { raw: { width: S, height: S, channels: 4 } }).png().toFile(path.join(OUT, 'pentagram.png'))
console.log('wrote pentagram.png', S + 'x' + S)
