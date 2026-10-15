// ============================================================================
// 천공 콜로세움 서버 — Upstash Redis(REST) 위의 아주 작은 API. app/api/arena/route.api.ts 가 부른다.
//  · 계정 없음: 저장 기록마다 pid + 비밀 token(브라우저 저장 파일 안). 서버는 token 의 해시만 들고 pid 주인을 확인한다.
//  · 전투는 각자의 브라우저에서 돈다 — 서버는 "도전 티켓"을 한 번만 쓰게 해서 결과 보고를 묶는다(완전한 부정 방지는 아님).
//  · 환경 변수: KV_REST_API_URL/KV_REST_API_TOKEN (Vercel Marketplace Upstash) 또는 UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN
// ============================================================================
import {
  ARENA_LOBBY_TTL_MS,
  ARENA_SHOUT_MAX,
  ARENA_START_RATING,
  eloDelta,
  sanitizeTeam,
  type ArenaLobbyPlayer,
  type ArenaOpponent,
  type ArenaRankRow,
  type ArenaShout,
  type ArenaTeam,
} from '@/lib/arena-core'

const URL_ = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
const TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
const K = (s: string) => `arena:${s}`

type Cmd = (string | number)[]
async function redis(cmds: Cmd[]): Promise<unknown[]> {
  const res = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds.map((c) => c.map(String))),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`redis ${res.status}`)
  const out = (await res.json()) as { result?: unknown; error?: string }[]
  return out.map((r) => {
    if (r.error) throw new Error(r.error)
    return r.result
  })
}
const one = async (cmd: Cmd) => (await redis([cmd]))[0]

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

const PID_RE = /^[0-9a-f]{16}$/
const TOKEN_RE = /^[0-9a-f]{32}$/

/** pid 주인 확인. create=true 면 처음 보는 pid 를 이 token 으로 등록 */
async function authorize(pid: unknown, token: unknown, create = false): Promise<string> {
  if (typeof pid !== 'string' || !PID_RE.test(pid) || typeof token !== 'string' || !TOKEN_RE.test(token)) throw new HttpError(400, '잘못된 신분 정보')
  const hash = await sha256(token)
  if (create) {
    const [set, cur] = await redis([['SET', K(`auth:${pid}`), hash, 'NX'], ['GET', K(`auth:${pid}`)]])
    if (set !== 'OK' && cur !== hash) throw new HttpError(403, '다른 사람의 기록입니다')
    return pid
  }
  const cur = await one(['GET', K(`auth:${pid}`)])
  if (!cur) throw new HttpError(404, '아직 팀을 등록하지 않았습니다')
  if (cur !== hash) throw new HttpError(403, '다른 사람의 기록입니다')
  return pid
}

const n = (v: unknown, d = 0) => (v == null ? d : Number(v))
const hashToObj = (arr: unknown): Record<string, string> => {
  const a = (arr as string[] | null) ?? []
  const o: Record<string, string> = {}
  for (let i = 0; i + 1 < a.length; i += 2) o[a[i]] = a[i + 1]
  return o
}

async function myStanding(pid: string) {
  const [score, rank, stats] = await redis([['ZSCORE', K('rating'), pid], ['ZREVRANK', K('rating'), pid], ['HGETALL', K(`stats:${pid}`)]])
  const s = hashToObj(stats)
  return { rating: Math.round(n(score, ARENA_START_RATING)), rank: rank == null ? null : n(rank) + 1, wins: n(s.w), losses: n(s.l) }
}

async function lobbyPlayers(): Promise<ArenaLobbyPlayer[]> {
  const now = Date.now()
  const pids = ((await one(['ZRANGEBYSCORE', K('seen'), now - ARENA_LOBBY_TTL_MS, '+inf', 'LIMIT', 0, 24])) as string[] | null) ?? []
  if (!pids.length) return []
  const res = await redis(pids.flatMap((p) => [['HGETALL', K(`stats:${p}`)], ['ZSCORE', K('rating'), p]] as Cmd[]))
  return pids.map((pid, i) => {
    const s = hashToObj(res[i * 2])
    return { pid, name: s.name ?? '???', gender: s.gender === 'female' ? 'female' : 'male', level: n(s.level, 1), power: n(s.power), rating: Math.round(n(res[i * 2 + 1], ARENA_START_RATING)) }
  })
}

async function shouts(): Promise<ArenaShout[]> {
  const raw = ((await one(['LRANGE', K('shout'), 0, 19])) as string[] | null) ?? []
  return raw.flatMap((r) => {
    try {
      return [JSON.parse(r) as ArenaShout]
    } catch {
      return []
    }
  })
}

const clean = (t: unknown, max: number) =>
  typeof t === 'string'
    ? t
        .replace(/[\u0000-\u001f\u007f<>]/g, '')
        .trim()
        .slice(0, max)
    : ''

function rid(): string {
  const a = new Uint8Array(12)
  crypto.getRandomValues(a)
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function opponentOf(opp: string): Promise<Omit<ArenaOpponent, 'team'> & { team: ArenaTeam | null }> {
  const [teamRaw, score, stats] = await redis([['GET', K(`team:${opp}`)], ['ZSCORE', K('rating'), opp], ['HGETALL', K(`stats:${opp}`)]])
  const s = hashToObj(stats)
  let team: ArenaTeam | null = null
  try {
    team = teamRaw ? (JSON.parse(teamRaw as string) as ArenaTeam) : null
  } catch {
    team = null
  }
  return { team, rating: Math.round(n(score, ARENA_START_RATING)), wins: n(s.w), losses: n(s.l) }
}

type Body = Record<string, unknown> & { op?: string; pid?: unknown; token?: unknown }

async function handle(body: Body): Promise<unknown> {
  switch (body.op) {
    // 내 팀 올리기(처음이면 신분 등록 + 시작 점수)
    case 'register': {
      const pid = await authorize(body.pid, body.token, true)
      const team = sanitizeTeam(body.team, pid)
      if (!team) throw new HttpError(400, '팀 정보가 올바르지 않습니다')
      await redis([
        ['SET', K(`team:${pid}`), JSON.stringify(team)],
        ['ZADD', K('rating'), 'NX', ARENA_START_RATING, pid],
        ['HSET', K(`stats:${pid}`), 'name', team.name, 'level', team.level, 'gender', team.gender, 'power', team.power],
        ['ZADD', K('seen'), Date.now(), pid],
      ])
      return { ok: true, team, me: await myStanding(pid) }
    }

    // 광장 신호 — 접속자·한마디·내 점수
    case 'ping': {
      let me = null
      if (body.pid && body.token) {
        try {
          const pid = await authorize(body.pid, body.token)
          await redis([['ZADD', K('seen'), Date.now(), pid], ['ZREMRANGEBYSCORE', K('seen'), '-inf', Date.now() - 24 * 3600 * 1000]])
          me = await myStanding(pid)
        } catch (e) {
          if (!(e instanceof HttpError) || e.status !== 404) throw e
        }
      }
      const [players, list] = await Promise.all([lobbyPlayers(), shouts()])
      return { ok: true, players, shouts: list, me }
    }

    case 'shout': {
      const pid = await authorize(body.pid, body.token)
      const text = clean(body.text, ARENA_SHOUT_MAX)
      if (!text) throw new HttpError(400, '내용이 없습니다')
      if ((await one(['SET', K(`cool:shout:${pid}`), 1, 'NX', 'EX', 3])) !== 'OK') throw new HttpError(429, '조금 천천히 말해 주세요')
      const name = ((await one(['HGET', K(`stats:${pid}`), 'name'])) as string | null) ?? '???'
      const s: ArenaShout = { pid, name, text, at: Date.now() }
      await redis([['LPUSH', K('shout'), JSON.stringify(s)], ['LTRIM', K('shout'), 0, 39]])
      return { ok: true, shouts: await shouts() }
    }

    // 비슷한 점수의 상대 후보(팀 내용은 도전할 때 받는다)
    case 'opponents': {
      const pid = await authorize(body.pid, body.token)
      const me = await myStanding(pid)
      let pool: string[] = []
      for (const w of [150, 400, 100000]) {
        pool = (((await one(['ZRANGEBYSCORE', K('rating'), me.rating - w, me.rating + w, 'LIMIT', 0, 40])) as string[] | null) ?? []).filter((p) => p !== pid)
        if (pool.length >= 3) break
      }
      const picks = pool.sort(() => Math.random() - 0.5).slice(0, 3)
      const res = await redis(picks.flatMap((p) => [['HGETALL', K(`stats:${p}`)], ['ZSCORE', K('rating'), p]] as Cmd[]))
      const players: ArenaLobbyPlayer[] = picks.map((p, i) => {
        const s = hashToObj(res[i * 2])
        return { pid: p, name: s.name ?? '???', gender: s.gender === 'female' ? 'female' : 'male', level: n(s.level, 1), power: n(s.power), rating: Math.round(n(res[i * 2 + 1], ARENA_START_RATING)) }
      })
      return { ok: true, players, me }
    }

    // 도전 — 상대 팀 + 한 번만 쓸 수 있는 티켓
    case 'challenge': {
      const pid = await authorize(body.pid, body.token)
      const opp = typeof body.opp === 'string' && PID_RE.test(body.opp) ? body.opp : ''
      if (!opp || opp === pid) throw new HttpError(400, '상대를 고를 수 없습니다')
      if ((await one(['SET', K(`cool:fight:${pid}`), 1, 'NX', 'EX', 4])) !== 'OK') throw new HttpError(429, '숨 좀 고르고 다시 도전하세요')
      const o = await opponentOf(opp)
      if (!o.team) throw new HttpError(404, '상대 팀이 없습니다')
      const ticket = rid()
      await one(['SET', K(`ticket:${ticket}`), JSON.stringify({ pid, opp }), 'EX', 1800])
      return { ok: true, opponent: o, ticket }
    }

    // 결과 보고 — 티켓은 한 번만. 이긴 쪽 +Δ, 진 쪽 −Δ
    case 'report': {
      const pid = await authorize(body.pid, body.token)
      const ticket = typeof body.ticket === 'string' && /^[0-9a-f]{24}$/.test(body.ticket) ? body.ticket : ''
      const raw = ticket ? ((await one(['GETDEL', K(`ticket:${ticket}`)])) as string | null) : null
      if (!raw) throw new HttpError(410, '이미 처리됐거나 만료된 대전입니다')
      const t = JSON.parse(raw) as { pid: string; opp: string }
      if (t.pid !== pid) throw new HttpError(403, '내 대전이 아닙니다')
      const won = body.won === true
      const [a, b, nameA, nameB] = await redis([
        ['ZSCORE', K('rating'), pid],
        ['ZSCORE', K('rating'), t.opp],
        ['HGET', K(`stats:${pid}`), 'name'],
        ['HGET', K(`stats:${t.opp}`), 'name'],
      ])
      const ra = n(a, ARENA_START_RATING)
      const rb = n(b, ARENA_START_RATING)
      const delta = won ? eloDelta(ra, rb) : eloDelta(rb, ra)
      const at = Date.now()
      const hist = (who: string, vs: unknown, win: boolean, attack: boolean, d: number) =>
        [
          ['LPUSH', K(`hist:${who}`), JSON.stringify({ vs: vs ?? '???', won: win, attack, delta: d, at })],
          ['LTRIM', K(`hist:${who}`), 0, 19],
        ] as Cmd[]
      await redis([
        ['ZINCRBY', K('rating'), won ? delta : -delta, pid],
        ['ZINCRBY', K('rating'), won ? -delta : delta, t.opp],
        ['HINCRBY', K(`stats:${pid}`), won ? 'w' : 'l', 1],
        ['HINCRBY', K(`stats:${t.opp}`), won ? 'l' : 'w', 1],
        ...hist(pid, nameB, won, true, won ? delta : -delta),
        ...hist(t.opp, nameA, !won, false, won ? -delta : delta),
      ])
      return { ok: true, delta: won ? delta : -delta, me: await myStanding(pid) }
    }

    case 'ranking': {
      const raw = ((await one(['ZREVRANGE', K('rating'), 0, 49, 'WITHSCORES'])) as string[] | null) ?? []
      const pids: string[] = []
      const scores: number[] = []
      for (let i = 0; i + 1 < raw.length; i += 2) {
        pids.push(raw[i])
        scores.push(Number(raw[i + 1]))
      }
      const stats = pids.length ? await redis(pids.map((p) => ['HGETALL', K(`stats:${p}`)] as Cmd)) : []
      const rows: ArenaRankRow[] = pids.map((pid, i) => {
        const s = hashToObj(stats[i])
        return { rank: i + 1, pid, name: s.name ?? '???', level: n(s.level, 1), rating: Math.round(scores[i]), wins: n(s.w), losses: n(s.l) }
      })
      let me = null
      if (body.pid && body.token) {
        try {
          me = await myStanding(await authorize(body.pid, body.token))
        } catch {
          me = null
        }
      }
      return { ok: true, rows, me }
    }

    case 'history': {
      const pid = await authorize(body.pid, body.token)
      const raw = ((await one(['LRANGE', K(`hist:${pid}`), 0, 19])) as string[] | null) ?? []
      return { ok: true, rows: raw.map((r) => JSON.parse(r)) }
    }

    default:
      throw new HttpError(400, '알 수 없는 요청')
  }
}

export async function handleArena(req: Request): Promise<Response> {
  if (!URL_ || !TOKEN) return Response.json({ ok: false, error: '콜로세움 서버 저장소가 아직 연결되지 않았습니다' }, { status: 503 })
  let body: Body
  try {
    const text = await req.text()
    if (text.length > 64 * 1024) throw new HttpError(413, '요청이 너무 큽니다')
    body = JSON.parse(text) as Body
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof HttpError ? e.message : '잘못된 요청' }, { status: e instanceof HttpError ? e.status : 400 })
  }
  try {
    return Response.json(await handle(body), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    if (e instanceof HttpError) return Response.json({ ok: false, error: e.message }, { status: e.status })
    console.error('[arena]', e)
    return Response.json({ ok: false, error: '서버 오류' }, { status: 500 })
  }
}
