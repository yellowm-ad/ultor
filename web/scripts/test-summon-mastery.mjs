// 소환 마법 · 숙련도 · 장비 강화 · 옛 세이브 변환 점검(2026-10-31)
// 실행: node --experimental-transform-types --import ./scripts/_ts-loader.mjs scripts/test-summon-mastery.mjs
const { initBattle, resolveAction, advanceTurn, combatantFromPlayer } = await import('../lib/battle-engine.ts')
const { MONSTERS } = await import('../lib/mock-data.ts')
const { createPlayer, createInitialGameState } = await import('../lib/player-factory.ts')
const { grantMastery, masteryNeed, addMasteryXp } = await import('../lib/skill-mastery.ts')
const { enhanceOnce, enhanceSuccessRate, gearTotalBonus } = await import('../lib/gear-enhance.ts')
const { itemById, SKILLS } = await import('../lib/mock-data.ts')
const { migrateLoadedState, mergeSave } = await import('../lib/save.ts')

let fails = 0
const ok = (cond, msg) => {
  console.log(`${cond ? '✔' : '✘'} ${msg}`)
  if (!cond) fails++
}

// 1) 소환 — 등장 · 턴 감소 · 퇴장
const player = { ...createPlayer('테스트'), level: 20, mp: 200, learnedSkills: ['summon-emberling'], summonSkills: ['summon-emberling'], skillMastery: { 'summon-emberling': { lv: 7, xp: 0 } } }
const hero = combatantFromPlayer(player)
ok(hero.skills.includes('summon-emberling'), '소환 칸 마법이 전투 스킬에 들어간다')
let b = initBattle([{ combatant: hero, position: 'front' }], [MONSTERS.find((m) => !m.isTestMonster)], { x: 0, y: 0 })
b = { ...b, activeUid: 'hero' }
b = resolveAction(b, 'hero', { type: 'skill', skillId: 'summon-emberling', targetUid: 'hero' }).battle
const s = b.combatants.find((c) => c.kind === 'pet')
ok(!!s && s.summonTurns === 3, `숙련 Lv.7 소환수는 3턴 머문다 (${s?.summonTurns})`)
ok(s && s.skills.includes('pet-fire-breath') && !s.skills.includes('pet-guard'), '숙련 Lv.7: 숙련 4 기술 열림 · 8 기술 잠김')
ok(b.skillUses?.['summon-emberling'] === 1, '주인공 스킬 사용 횟수 기록')
ok(b.combatants.find((c) => c.uid === 'hero').mp === 200 - Math.round(9 * 0.88), 'MP 소모 숙련 보정(−12%)')
for (let i = 0; i < 3; i++) b = advanceTurn({ ...b, activeUid: s.uid })
ok(!b.combatants.some((c) => c.kind === 'pet'), '3턴 뒤 소환수가 돌아간다')

// 2) 숙련도 곡선
ok(masteryNeed(1, 1) === 5 && masteryNeed(4, 1) === 18, '등급별 요구치(하급 5 · 최상급 18)')
let rec = { lv: 1, xp: 0 }
rec = addMasteryXp(rec, 1, 1000).rec
ok(rec.lv === 10 && rec.xp === 0, '최대 Lv.10 에서 멈춘다')
const g = grantMastery({ ...player, learnedSkills: ['fire-basic-1'] }, { 'fire-basic-1': 5 }, (id) => SKILLS.find((x) => x.id === id))
ok(g.player.skillMastery['fire-basic-1'].lv === 2 && g.ups.length === 1, '하급 스킬 경험치 5 → Lv.2')

// 3) 장비 강화
const wand = itemById('wand-fire-t1')
const always = () => 0 // 항상 성공
let mods = { enh: 0, best: 0, pot: [] }
for (let i = 0; i < 10; i++) mods = enhanceOnce(wand, mods, always).mods
ok(mods.enh === 10 && mods.pot.length === 4, `+10 · 잠재력 4줄 (${mods.enh}, ${mods.pot.length})`)
ok(gearTotalBonus(wand, { enh: 10, best: 10, pot: [] }).matk === wand.statBonus.matk * 2, '+10 = 기본 능력치 2배')
ok(enhanceSuccessRate(itemById('wand-fire-t5'), 0) < enhanceSuccessRate(wand, 0), '등급이 높을수록 성공률 낮음')
const failDrop = (() => { let k = 0; return () => [0.99, 0][k++ % 2] })()
const dropped = enhanceOnce(wand, { enh: 6, best: 6, pot: [] }, failDrop)
ok(dropped.outcome === 'drop' && dropped.mods.enh === 5, '+6 실패 → 하락(파괴 없음)')
const kept = enhanceOnce(wand, { enh: 2, best: 2, pot: [] }, failDrop)
ok(kept.outcome === 'keep' && kept.mods.enh === 2, '+3 미만 실패 → 유지')

// 4) 옛 세이브 변환
const fresh = createInitialGameState()
const raw = {
  player: { ...fresh.player, level: 25, equipped: { weapon: 'wand-ice-t2' } },
  pet: { defId: 'pet-frostkit', nickname: '서리', level: 34, exp: 0, affection: 60, learnedSkills: [], hp: 1, mp: 1 },
  ownedPets: [{ defId: 'pet-frostkit', nickname: '서리', level: 34, exp: 0, affection: 60, learnedSkills: [], hp: 1, mp: 1 }],
  inventory: [{ itemId: 'wand-ice-t2', qty: 1 }, { itemId: 'feed-any', qty: 3 }, { itemId: 'feed-fire', qty: 2 }],
}
const m = migrateLoadedState(mergeSave(fresh, raw), raw)
ok(m.player.learnedSkills.includes('summon-frostkit') && m.player.summonSkills.includes('summon-frostkit'), '옛 펫 → 소환 마법 습득 + 소환 칸')
ok(m.player.skillMastery['summon-frostkit'].lv === 4, `펫 Lv.34 → 숙련 Lv.4 (${m.player.skillMastery['summon-frostkit'].lv})`)
ok(m.inventory.find((x) => x.itemId === 'scroll-mastery')?.qty === 5, '먹이 5개 → 숙련의 스크롤 5개')
ok(m.player.equipped.weapon === 'wand-ice-t1' && m.player.gear['wand-ice-t1'].enh === 4, '빙결 완드 +1(T2) → 빙결 완드 +4')
ok(!('pet' in m) && !('ownedPets' in m), '옛 펫 필드 제거')

console.log(fails ? `실패 ${fails}건` : '전부 통과')
process.exitCode = fails ? 1 : 0
