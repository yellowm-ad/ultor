'use client'

// 천공 콜로세움 창 — 투기장장 그로먼. 대전(상대 찾기·도전) · 내 팀(등록) · 랭킹 · 광장(접속자·한마디).
// 서버(lib/arena-server)가 없는 실행이면 연습 상대와 싸운다(점수 기록 없음).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '@/lib/game-state'
import { buildArenaTeam, ARENA_SHOUT_MAX, type ArenaLobbyPlayer, type ArenaOpponent, type ArenaRankRow, type ArenaTeam } from '@/lib/arena'
import { arenaApi, ArenaOffline, pingArena, practiceOpponents, setArenaLobby, takeArenaFocus, useArenaLobby, type ArenaStanding } from '@/lib/arena-client'
import { GameWindow, HeadPill, Ribbon, menuIcon } from '@/components/game/game-window'
import { HeroSprite } from '@/components/game/pixel-hero'

type Tab = 'fight' | 'team' | 'rank' | 'plaza'
const TABS: { id: Tab; label: string }[] = [
  { id: 'fight', label: '대전' },
  { id: 'team', label: '내 팀' },
  { id: 'rank', label: '랭킹' },
  { id: 'plaza', label: '광장' },
]
const POS_LABEL = { front: '전위', support: '보조', rear: '후위' } as const

export function ArenaScreen() {
  const { state, dispatch } = useGame()
  const lobby = useArenaLobby()
  const id = state.arena
  const offline = lobby.online === 'offline'
  const [tab, setTab] = useState<Tab>('fight')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [cands, setCands] = useState<ArenaLobbyPlayer[] | null>(null)
  const [practice, setPractice] = useState<ArenaOpponent[] | null>(null)
  const [rank, setRank] = useState<{ rows: ArenaRankRow[]; me: ArenaStanding | null } | null>(null)
  const [hist, setHist] = useState<{ vs: string; won: boolean; attack: boolean; delta: number; at: number }[] | null>(null)
  const [shout, setShout] = useState('')
  const team = useMemo(() => (id ? buildArenaTeam(state, id.pid) : null), [state, id])
  const me = lobby.me

  const close = () => dispatch({ type: 'CLOSE_OVERLAY' })
  const run = async (fn: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    setMsg(null)
    try {
      await fn()
    } catch (e) {
      if (e instanceof ArenaOffline) setArenaLobby({ online: 'offline', note: e.message })
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // 창이 열리면 한 번 신호 + 광장에서 고른 상대가 있으면 대전 탭 맨 위로
  useEffect(() => {
    void pingArena(id)
    const focus = takeArenaFocus()
    if (focus) setCands([focus])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 방금 끝난 대전 결과 보고(한 번만)
  const reported = useRef<string | null>(null)
  const result = state.arenaResult
  useEffect(() => {
    if (!result || !id) return
    const key = result.match.ticket ?? `${result.match.opponentPid}-${result.won}`
    if (reported.current === key) return
    reported.current = key
    if (result.match.practice || !result.match.ticket) {
      setMsg(`연습 대전 ${result.won ? '승리' : '패배'} — ${result.match.opponentName} (점수 변동 없음)`)
      dispatch({ type: 'ARENA_RESULT_CLEAR' })
      return
    }
    const ticket = result.match.ticket
    void (async () => {
      try {
        const r = await arenaApi.report(id, ticket, result.won)
        setArenaLobby({ me: r.me })
        setMsg(`${result.match.opponentName}의 팀에게 ${result.won ? '승리' : '패배'}! 점수 ${r.delta > 0 ? '+' : ''}${r.delta} → ${r.me.rating}`)
      } catch (e) {
        setMsg(`결과 기록 실패 — ${(e as Error).message}`)
      } finally {
        dispatch({ type: 'ARENA_RESULT_CLEAR' })
      }
    })()
  }, [result, id, dispatch])

  const register = () =>
    run(async () => {
      if (!id || !team) return
      const r = await arenaApi.register(id, team)
      setArenaLobby({ me: r.me })
      setMsg('팀을 등록했습니다. 이제 다른 마법사들이 이 팀에 도전할 수 있습니다.')
      void pingArena(id)
    })

  const findOpponents = () =>
    run(async () => {
      if (!id || !team) return
      if (offline) {
        setPractice(practiceOpponents(team))
        return
      }
      try {
        const r = await arenaApi.opponents(id)
        setCands(r.players)
        setArenaLobby({ me: r.me })
        if (!r.players.length) setMsg('아직 겨룰 상대가 없습니다. 잠시 뒤 다시 찾아보세요.')
      } catch (e) {
        if (e instanceof ArenaOffline) {
          setPractice(practiceOpponents(team))
          throw new ArenaOffline('콜로세움 서버가 없어 연습 상대를 데려왔습니다')
        }
        throw e
      }
    })

  const challenge = (p: ArenaLobbyPlayer) =>
    run(async () => {
      if (!id) return
      const r = await arenaApi.challenge(id, p.pid)
      if (!r.opponent.team) throw new Error('상대 팀 정보가 없습니다')
      fight(r.opponent.team, { opponentPid: p.pid, opponentName: r.opponent.team.name, ticket: r.ticket })
    })

  const fight = (opp: ArenaTeam, match: { opponentPid: string; opponentName: string; ticket?: string; practice?: boolean }) => dispatch({ type: 'ARENA_FIGHT', opponent: opp, match })

  const loadRank = () =>
    run(async () => {
      const r = await arenaApi.ranking(id)
      setRank(r)
      if (id && r.me) setHist((await arenaApi.history(id)).rows)
    })

  const sendShout = () =>
    run(async () => {
      if (!id || !shout.trim()) return
      const r = await arenaApi.shout(id, shout)
      setArenaLobby({ shouts: r.shouts })
      setShout('')
    })

  useEffect(() => {
    if (tab === 'rank' && !rank && !offline) void loadRank()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, offline])

  const registered = !!me
  const others = lobby.players.filter((p) => p.pid !== id?.pid)

  return (
    <GameWindow
      title="천공 콜로세움"
      subtitle="SKY COLOSSEUM"
      size="md"
      width={760}
      onClose={close}
      headerExtra={
        <HeadPill icon={menuIcon('badge-main')}>
          {offline ? (
            <b>연습 모드</b>
          ) : me ? (
            <>
              점수 <b>{me.rating}</b>
              {me.rank ? ` · ${me.rank}위` : ''} · {me.wins}승 {me.losses}패
            </>
          ) : (
            <b>미등록</b>
          )}
        </HeadPill>
      }
    >
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={`gw-btn is-sm ${tab === t.id ? 'is-gold' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id === 'plaza' && others.length > 0 ? ` (${others.length})` : ''}
          </button>
        ))}
      </div>

      {offline && (
        <div className="gw-panel is-pad mb-3 text-[12.5px] text-[#6c6150]">
          이 실행에는 콜로세움 서버가 없습니다. 그로먼의 수련생들과 <b>연습 대전</b>만 할 수 있고 점수·랭킹은 기록되지 않습니다.
        </div>
      )}
      {msg && <div className="gw-panel is-pad mb-3 text-[13px] font-bold text-[#5a4210]">{msg}</div>}

      {tab === 'fight' && (
        <section className="gw-panel is-pad space-y-3">
          <Ribbon>대전 상대</Ribbon>
          {!offline && !registered && (
            <p className="text-[12.5px] text-[#6c6150]">도전하려면 먼저 「내 팀」에서 팀을 등록하세요. 등록한 팀은 다른 마법사의 도전을 받습니다(그쪽 팀은 AI 가 조종).</p>
          )}
          <button type="button" className="gw-btn is-gold" disabled={busy || (!offline && !registered)} onClick={findOpponents}>
            {offline ? '연습 상대 부르기' : '비슷한 실력의 상대 찾기'}
          </button>
          {practice && (offline || !cands?.length) && (
            <div className="space-y-2">
              {practice.map((o) => (
                <OpponentRow key={o.team.pid} name={o.team.name} gender={o.team.gender} level={o.team.level} rating={o.rating} power={o.team.power} note="연습" busy={busy} onFight={() => fight(o.team, { opponentPid: o.team.pid, opponentName: o.team.name, practice: true })} />
              ))}
            </div>
          )}
          {cands && cands.length > 0 && (
            <div className="space-y-2">
              {cands.map((p) => (
                <OpponentRow key={p.pid} name={p.name} gender={p.gender} level={p.level} rating={p.rating} power={p.power} busy={busy || !registered} onFight={() => challenge(p)} />
              ))}
            </div>
          )}
          <p className="text-[11.5px] text-[#8a7f6c]">대전은 내 파티 그대로(꽉 찬 HP·MP)로 치릅니다. 이기면 점수가 오르고 지거나 도망치면 내려갑니다. 대전으로 HP·경험치·아이템은 변하지 않습니다(쓴 아이템은 사라짐).</p>
        </section>
      )}

      {tab === 'team' && (
        <section className="gw-panel is-pad space-y-3">
          <Ribbon>내 팀 — 지금 파티</Ribbon>
          {team ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {team.units.map((u, i) => (
                <div key={i} className="gw-row !cursor-default">
                  <div className="min-w-0">
                    <div className="font-bold text-[#2c2a33]">
                      {u.name} <span className="gw-pill is-gold">Lv.{u.level}</span> {u.position && <span className="gw-pill is-soft">{POS_LABEL[u.position]}</span>}
                      {u.kind === 'pet' && <span className="gw-pill is-soft">펫</span>}
                    </div>
                    <div className="text-[11.5px] text-[#6c6150]">
                      HP {u.stats.maxHp} · 공 {u.stats.atk} · 마 {u.stats.matk} · 방 {u.stats.def} · 속 {u.stats.spd}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12.5px] text-[#6c6150]">팀 정보를 불러오는 중…</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="gw-pill is-soft">전투력 {team?.power ?? 0}</span>
            {!offline && (
              <button type="button" className="gw-btn is-gold" disabled={busy || !team} onClick={register}>
                {registered ? '지금 파티로 팀 갱신' : '이 팀으로 등록'}
              </button>
            )}
          </div>
          <p className="text-[11.5px] text-[#8a7f6c]">파티 편성·장비·스킬을 바꾼 뒤 「팀 갱신」을 눌러야 다른 사람이 상대하는 내 팀에 반영됩니다.</p>
        </section>
      )}

      {tab === 'rank' && (
        <section className="gw-panel is-pad space-y-3">
          <Ribbon>랭킹</Ribbon>
          {offline ? (
            <p className="text-[12.5px] text-[#6c6150]">서버가 없는 실행에서는 랭킹을 볼 수 없습니다.</p>
          ) : (
            <>
              <button type="button" className="gw-btn is-sm is-quiet" disabled={busy} onClick={loadRank}>
                새로고침
              </button>
              <div className="space-y-1">
                {(rank?.rows ?? []).map((r) => (
                  <div key={r.pid} className={`gw-row !cursor-default ${r.pid === id?.pid ? 'is-active' : ''}`}>
                    <b className="w-8 text-center text-[#5a4210]">{r.rank}</b>
                    <span className="min-w-0 flex-1 truncate font-bold text-[#2c2a33]">
                      {r.name} <span className="text-[11px] font-normal text-[#8a7f6c]">Lv.{r.level}</span>
                    </span>
                    <span className="text-[12px] text-[#6c6150]">
                      {r.wins}승 {r.losses}패
                    </span>
                    <span className="gw-pill is-gold">{r.rating}</span>
                  </div>
                ))}
                {rank && rank.rows.length === 0 && <p className="text-[12.5px] text-[#6c6150]">아직 등록한 팀이 없습니다. 첫 번째 이름을 새겨 보세요.</p>}
              </div>
              {hist && hist.length > 0 && (
                <>
                  <Ribbon>최근 대전</Ribbon>
                  <div className="space-y-1 text-[12.5px]">
                    {hist.map((h, i) => (
                      <div key={i} className="flex items-center gap-2 text-[#4b4458]">
                        <span className={`gw-pill ${h.won ? 'is-green' : 'is-red'}`}>{h.won ? '승' : '패'}</span>
                        <span className="flex-1 truncate">
                          {h.attack ? `${h.vs}에게 도전` : `${h.vs}의 도전을 받음`}
                        </span>
                        <b>{h.delta > 0 ? `+${h.delta}` : h.delta}</b>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </section>
      )}

      {tab === 'plaza' && (
        <section className="gw-panel is-pad space-y-3">
          <Ribbon>지금 광장에 있는 마법사</Ribbon>
          {offline ? (
            <p className="text-[12.5px] text-[#6c6150]">서버가 없는 실행에서는 다른 플레이어를 만날 수 없습니다.</p>
          ) : others.length === 0 ? (
            <p className="text-[12.5px] text-[#6c6150]">지금은 아무도 없습니다. 최근 3분 안에 콜로세움에 들른 마법사가 여기와 광장에 보입니다.</p>
          ) : (
            <div className="space-y-2">
              {others.map((p) => (
                <OpponentRow key={p.pid} name={p.name} gender={p.gender} level={p.level} rating={p.rating} power={p.power} busy={busy || !registered} onFight={() => challenge(p)} />
              ))}
            </div>
          )}
          {!offline && (
            <>
              <Ribbon>광장 한마디</Ribbon>
              <div className="flex gap-2">
                <input
                  value={shout}
                  maxLength={ARENA_SHOUT_MAX}
                  onChange={(e) => setShout(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Enter') void sendShout()
                  }}
                  placeholder={registered ? '인사나 도전장을 남겨 보세요' : '팀을 등록하면 말을 남길 수 있습니다'}
                  disabled={!registered}
                  className="min-w-0 flex-1 rounded border border-[#cbbd9e] bg-white/80 px-2 py-1 text-[13px] text-[#2c2a33]"
                />
                <button type="button" className="gw-btn is-sm is-gold" disabled={busy || !registered || !shout.trim()} onClick={sendShout}>
                  남기기
                </button>
              </div>
              <div className="space-y-1 text-[12.5px]">
                {lobby.shouts.map((s, i) => (
                  <div key={i} className="text-[#4b4458]">
                    <b className="text-[#5a4210]">{s.name}</b> {s.text}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </GameWindow>
  )
}

function OpponentRow({ name, gender, level, rating, power, note, busy, onFight }: { name: string; gender: 'male' | 'female'; level: number; rating: number; power: number; note?: string; busy: boolean; onFight: () => void }) {
  return (
    <div className="gw-row !cursor-default">
      <div className="flex h-12 w-12 shrink-0 items-end justify-center overflow-hidden">
        <HeroSprite sheet={`protag-${gender}`} dir="down" px={48} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-bold text-[#2c2a33]">
          {name} <span className="text-[11px] font-normal text-[#8a7f6c]">Lv.{level}</span> {note && <span className="gw-pill is-soft">{note}</span>}
        </div>
        <div className="text-[11.5px] text-[#6c6150]">
          점수 {rating} · 전투력 {power}
        </div>
      </div>
      <button type="button" className="gw-btn is-sm is-gold" disabled={busy} onClick={onFight}>
        도전
      </button>
    </div>
  )
}
