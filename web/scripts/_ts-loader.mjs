// node 에서 lib/*.ts 를 바로 불러오기 위한 해석 훅 — '@/…' 별칭과 확장자 없는 가져오기를 .ts/.tsx 파일로 잇는다.
// usage: node --experimental-transform-types --import ./scripts/_ts-loader.mjs <script.mjs>
import { registerHooks } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const tryFile = (base) => ['', '.ts', '.tsx', '/index.ts'].map((e) => base + e).find((f) => fs.existsSync(f) && fs.statSync(f).isFile())

registerHooks({
  resolve(spec, ctx, next) {
    let base = null
    if (spec.startsWith('@/')) base = path.join(WEB, spec.slice(2))
    else if (spec.startsWith('.') && ctx.parentURL?.startsWith('file:') && !/\.(m?js|json|ts|tsx)$/.test(spec)) base = path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), spec)
    const f = base && tryFile(base)
    return f ? { url: pathToFileURL(f).href, shortCircuit: true } : next(spec, ctx)
  },
})
