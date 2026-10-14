// 게임 데이터 연결 점검 — 아이템·레시피·몬스터·NPC·맵·지역·퀘스트·스토리·세계관이 서로 실제로 있는 id 를 가리키는지.
// 실행: node --experimental-transform-types --import ./scripts/_ts-loader.mjs scripts/audit-data.mjs
const { ITEMS, RECIPES, MONSTERS, NPCS, SKILLS } = await import('../lib/mock-data.ts')
const { MAPS } = await import('../lib/maps.ts')
const { REGIONS } = await import('../lib/regions.ts')
const { PET_DEFS } = await import('../lib/pets.ts')
const { SCHOOL_NPCS, GUEST_NPCS } = await import('../lib/companions.ts')
const { LIFE_ITEMS, GATHER_TABLES, FISH_TABLES, HUNT_TABLES, TAG_LABEL } = await import('../lib/life.ts')
const { STORY_EPISODES } = await import('../lib/story-episodes.ts')
const { STORY_BEATS } = await import('../lib/story.ts')
const { LORE } = await import('../lib/lore.ts')

const problems = []
const warn = (where, msg) => problems.push(`${where}: ${msg}`)

const itemIds = new Set([...ITEMS, ...LIFE_ITEMS].map((i) => i.id))
const monsterIds = new Set(MONSTERS.map((m) => m.id))
const mapIds = new Set(Object.keys(MAPS))
const npcIds = new Set(NPCS.map((n) => n.id))
const compIds = new Set([...SCHOOL_NPCS, ...GUEST_NPCS].map((c) => c.id))
const regionIds = new Set(REGIONS.map((r) => r.id))
const skillIds = new Set(SKILLS.map((s) => s.id))
const beatIds = new Set(STORY_BEATS.map((b) => b.id))

// 중복 id
const dup = (label, list) => {
  const seen = new Set()
  for (const x of list) {
    if (seen.has(x.id)) warn(label, `중복 id ${x.id}`)
    seen.add(x.id)
  }
}
dup('아이템', ITEMS)
dup('몬스터', MONSTERS)
dup('NPC', NPCS)
dup('레시피', RECIPES)
dup('펫', PET_DEFS)
dup('세계관', LORE)
dup('스토리 장면', STORY_BEATS)

// 레시피 재료·결과
for (const r of RECIPES) {
  const out = r.outputItemId
  if (out && !itemIds.has(out)) warn(`레시피 ${r.id}`, `결과 아이템 없음 ${out}`)
  for (const m of r.materials ?? r.inputs ?? r.ingredients ?? []) {
    const id = m.itemId ?? m.id
    // 'tag:wood' = 그 종류의 재료 아무거나
    if (id?.startsWith('tag:')) {
      if (!(id.slice(4) in TAG_LABEL)) warn(`레시피 ${r.id}`, `재료 종류 없음 ${id}`)
    } else if (id && !itemIds.has(id)) warn(`레시피 ${r.id}`, `재료 없음 ${id}`)
  }
}

// 몬스터 드롭·스킬
for (const m of MONSTERS) {
  for (const d of m.drops ?? []) {
    const id = d.itemId ?? d.id ?? d
    if (typeof id === 'string' && !itemIds.has(id)) warn(`몬스터 ${m.id}`, `드롭 아이템 없음 ${id}`)
  }
  for (const s of m.skills ?? []) if (typeof s === 'string' && !skillIds.has(s)) warn(`몬스터 ${m.id}`, `스킬 없음 ${s}`)
}

// 맵: 몬스터 풀·보스·포탈·NPC 위치
for (const [id, map] of Object.entries(MAPS)) {
  for (const mid of map.monsterPool ?? []) if (!monsterIds.has(mid)) warn(`맵 ${id}`, `몬스터 풀에 없는 몬스터 ${mid}`)
  for (const b of map.bossSpawns ?? []) if (!monsterIds.has(b.monsterId)) warn(`맵 ${id}`, `보스 없음 ${b.monsterId}`)
  for (const p of map.portals ?? []) {
    const to = p.to ?? p.targetMapId ?? p.toMapId
    if (to && !mapIds.has(to)) warn(`맵 ${id}`, `포탈 목적지 없음 ${to}`)
  }
}
for (const n of NPCS) {
  const mid = n.mapId ?? n.map
  if (mid && !mapIds.has(mid)) warn(`NPC ${n.id}`, `맵 없음 ${mid}`)
}

// 지역 ↔ 맵
const mapRegion = new Map()
for (const r of REGIONS)
  for (const m of r.maps) {
    if (!mapIds.has(m)) warn(`지역 ${r.id}`, `맵 없음 ${m}`)
    if (mapRegion.has(m)) warn(`지역 ${r.id}`, `맵 ${m} 이 ${mapRegion.get(m)} 에도 속함`)
    mapRegion.set(m, r.id)
  }
for (const m of mapIds) if (!mapRegion.has(m)) warn('지역', `어느 지역에도 속하지 않은 맵 ${m}`)

// 생활 테이블
for (const [r, t] of Object.entries(GATHER_TABLES)) {
  if (!regionIds.has(r)) warn('채집 테이블', `지역 없음 ${r}`)
  for (const rows of Object.values(t)) for (const row of rows) if (!itemIds.has(row.itemId)) warn(`채집 ${r}`, `아이템 없음 ${row.itemId}`)
}
for (const [r, rows] of Object.entries(FISH_TABLES)) for (const row of rows) if (!itemIds.has(row.fishId)) warn(`낚시 ${r}`, `물고기 없음 ${row.fishId}`)
for (const [f, rows] of Object.entries(HUNT_TABLES)) for (const row of rows) if (!itemIds.has(row.itemId)) warn(`사냥 ${f}`, `아이템 없음 ${row.itemId}`)

// 스토리 목표
for (const ep of STORY_EPISODES) {
  if (!regionIds.has(ep.region)) warn(`스토리 ${ep.id}`, `지역 없음 ${ep.region}`)
  for (const o of ep.objectives) {
    const t = o.targetId
    if (!t || t === 'any' || t.startsWith('family:')) continue
    if (o.type === 'visit' && !mapIds.has(t)) warn(`스토리 ${ep.id}`, `방문 목표 맵 없음 ${t}`)
    if (o.type === 'kill' && !monsterIds.has(t)) warn(`스토리 ${ep.id}`, `처치 목표 몬스터 없음 ${t}`)
    if (o.type === 'talk' && !npcIds.has(t) && !compIds.has(t)) warn(`스토리 ${ep.id}`, `대화 목표 NPC 없음 ${t}`)
    if (o.type === 'win' && !regionIds.has(t)) warn(`스토리 ${ep.id}`, `전투 목표 지역 없음 ${t}`)
  }
}

// 세계관 연결
const flagOk = (f) => !f.startsWith('beat:') || beatIds.has(f.slice(5))
for (const e of LORE) {
  const L = e.links ?? {}
  for (const x of L.regions ?? []) if (!regionIds.has(x)) warn(`세계관 ${e.id}`, `지역 없음 ${x}`)
  for (const x of L.maps ?? []) if (!mapIds.has(x)) warn(`세계관 ${e.id}`, `맵 없음 ${x}`)
  for (const x of L.npcs ?? []) if (!npcIds.has(x)) warn(`세계관 ${e.id}`, `NPC 없음 ${x}`)
  for (const x of L.monsters ?? []) if (!monsterIds.has(x)) warn(`세계관 ${e.id}`, `몬스터 없음 ${x}`)
  for (const x of L.items ?? []) if (!itemIds.has(x)) warn(`세계관 ${e.id}`, `아이템 없음 ${x}`)
  for (const x of L.companions ?? []) if (!compIds.has(x)) warn(`세계관 ${e.id}`, `동료 없음 ${x}`)
  if (e.unlock?.visit && !mapIds.has(e.unlock.visit)) warn(`세계관 ${e.id}`, `해금 맵 없음 ${e.unlock.visit}`)
  if (e.unlock?.flag && !flagOk(e.unlock.flag)) warn(`세계관 ${e.id}`, `해금 장면 없음 ${e.unlock.flag}`)
}

console.log(`아이템 ${itemIds.size} · 몬스터 ${monsterIds.size} · 맵 ${mapIds.size} · NPC ${npcIds.size} · 동료 ${compIds.size} · 펫 ${PET_DEFS.length} · 레시피 ${RECIPES.length} · 스토리 장면 ${beatIds.size} · 세계관 ${LORE.length}`)
console.log(problems.length ? `문제 ${problems.length}건\n` + problems.join('\n') : '문제 없음')
process.exitCode = problems.length ? 1 : 0
