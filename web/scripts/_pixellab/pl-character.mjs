// PixelLab v2 — 8방향 캐릭터 생성(v3 모델) + 남/동/북 걷기 애니메이션까지 한 번에.
// 기존 NPC·동료 캐릭터와 같은 설정(low top-down, mannequin, 걷기 8프레임 S/E/N)으로 맞춘다.
//
// usage: node scripts/_pixellab/pl-character.mjs <name> <size> "<description>"
//        node scripts/_pixellab/pl-character.mjs --animate <characterId>   (걷기만 — 실패한 방향 이어서)
//   → 완료되면 character id 를 출력. 이후 build-npc-sheets.mjs(NPC 64셀) / build-hero-sheets.mjs(동료 88셀)로 시트 조립.
const TOKEN = process.env.PIXELLAB_TOKEN
if (!TOKEN) throw new Error('PIXELLAB_TOKEN 환경변수가 필요합니다')
const API = 'https://api.pixellab.ai/v2'
const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
const WALK_DIRS = ['south', 'east', 'north']

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function post(path, body) {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${path} ${res.status}: ${JSON.stringify(j).slice(0, 500)}`)
  return j
}
/** 백그라운드 작업 대기 — 성공 true / 실패 false */
async function waitJob(id) {
  for (let i = 0; i < 200; i++) {
    await sleep(5000)
    const st = await (await fetch(`${API}/background-jobs/${id}`, { headers })).json()
    if (st.status === 'completed') return true
    if (st.status === 'failed') {
      console.log('  job failed:', JSON.stringify(st.last_response ?? st).slice(0, 200))
      return false
    }
  }
  return false
}
const jobIds = (j) => [j.background_job_id, ...(j.background_job_ids ?? []), ...(j.jobs ?? []).map((x) => x.background_job_id ?? x.id)].filter(Boolean)

/** 이미 걷기가 있는 방향 */
async function walkedDirs(charId) {
  const c = await (await fetch(`${API}/characters/${charId}`, { headers })).json()
  // 그룹을 이어 붙이면 이름 없는 그룹이 따로 생기기도 한다 — 걷기/이름 없는 그룹의 방향을 전부 센다(시트 export 는 동작 이름 'walking' 으로 묶는다)
  const grps = (c.animations ?? []).filter((a) => !a.display_name || /walk/i.test(a.display_name))
  return { dirs: new Set(grps.flatMap((g) => g.directions ?? []).map((d) => d.direction)) }
}

async function animate(charId) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { dirs } = await walkedDirs(charId)
    const todo = WALK_DIRS.filter((d) => !dirs.has(d))
    if (!todo.length) return
    for (const dir of todo) {
      console.log(`walk ${dir} (try ${attempt + 1})`)
      const j = await post('/animate-character', {
        character_id: charId,
        animation_name: 'Walking',
        action_description: 'walking',
        frame_count: 8,
        directions: [dir],
      })
      for (const id of jobIds(j)) await waitJob(id)
    }
  }
  const { dirs } = await walkedDirs(charId)
  const missing = WALK_DIRS.filter((d) => !dirs.has(d))
  if (missing.length) throw new Error(`걷기 미완성: ${missing.join(',')}`)
}

const args = process.argv.slice(2)
if (args[0] === '--animate') {
  await animate(args[1])
  console.log('DONE', args[1])
} else {
  const [name, sizeArg, description] = args
  if (!name || !sizeArg || !description) throw new Error('usage: <name> <size> "<description>"')
  const size = Number(sizeArg)
  const created = await post('/create-character-v3', { description, image_size: { width: size, height: size }, view: 'low top-down', name, no_background: true })
  const charId = created.character_id ?? created.id
  console.log('character', charId)
  for (const id of jobIds(created)) if (!(await waitJob(id))) throw new Error('rotations 실패')
  console.log('rotations done')
  await animate(charId)
  console.log('DONE', name, charId)
}
