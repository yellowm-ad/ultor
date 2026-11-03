'use client'

// 거점 분수대 — 평판 의뢰판(lib/reputation). 왼쪽: 이 마을 평판(Lv·진행 막대·다른 거점 요약) · 오른쪽: 이번 주 의뢰 3건 + 최종 의뢰.

import Image from 'next/image'
import { useGame } from '@/lib/game-state'
import { itemById } from '@/lib/mock-data'
import { ownedFor, ingredientLabel } from '@/lib/inventory'
import { REPUTATION_HUBS } from '@/lib/story'
import { REP_FINAL_WEEK, finalOpen, hubById, repFinal, repLevel, repLevelName, repProgress, reqDoneKey, requestBlocker, weeklyRequests, type RepRequest } from '@/lib/reputation'
import { GameWindow, menuIcon, Ribbon } from '@/components/game/game-window'

function ReqIcon({ req }: { req: RepRequest }) {
  const icon = req.kind === 'donate' ? menuIcon('icon-coin') : req.itemId.startsWith('tag:') ? menuIcon('cat-material') : itemById(req.itemId)?.icon
  return (
    <span className="gw-row-icon is-tile">
      {icon && <Image src={icon} alt="" width={38} height={38} unoptimized />}
    </span>
  )
}

export function FountainScreen() {
  const { state, dispatch } = useGame()
  const hub = hubById(state.fountainHubId ?? '')
  if (state.screen !== 'fountain' || !hub) return null
  const close = () => dispatch({ type: 'CLOSE_OVERLAY' })
  const week = state.calendar.globalWeek
  const lv = repLevel(state, hub)
  const prog = repProgress(state, hub)
  const reqs = weeklyRequests(hub.id, week)
  const fin = repFinal(hub.id)
  const canFinal = finalOpen(state, hub)

  return (
    <GameWindow title={`${hub.name} 분수대`} subtitle="REPUTATION" size="md" width={720} onClose={close}>
      <div className="grid gap-3 md:grid-cols-[220px_1fr]">
        <section className="gw-panel is-pad">
          <Ribbon>마을 평판</Ribbon>
          <div className="rep-level">
            <span className="rep-level-num">Lv.{lv}</span>
            <span className="rep-level-name">{repLevelName(lv)}</span>
          </div>
          {prog ? (
            <div className="rep-bar" title={`${prog[0]} / ${prog[1]}`}>
              <i style={{ width: `${(prog[0] / prog[1]) * 100}%` }} />
              <span>
                다음 단계까지 {prog[1] - prog[0]}
              </span>
            </div>
          ) : lv === 4 ? (
            <p className="rep-note">{week >= REP_FINAL_WEEK ? '마지막 부탁이 기다리고 있습니다.' : '마을 사람들이 당신을 믿고 있습니다. 언젠가 마지막 부탁을 하러 올 거예요.'}</p>
          ) : (
            <p className="rep-note is-gold">마을의 상징 「{fin.emblem}」을(를) 받았습니다.</p>
          )}
          <Ribbon>여섯 거점</Ribbon>
          <ul className="rep-hubs">
            {REPUTATION_HUBS.map((h) => {
              const l = repLevel(state, h)
              return (
                <li key={h.id} className={h.id === hub.id ? 'is-here' : ''}>
                  <span>{h.name}</span>
                  <b className={l >= 5 ? 'is-emblem' : ''}>{l >= 5 ? '상징' : `Lv.${l}`}</b>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="gw-panel is-pad">
          <Ribbon>이번 주 의뢰</Ribbon>
          <p className="rep-note">의뢰는 매주 바뀝니다. 들어줄 때마다 평판이 오릅니다.</p>
          <div className="flex flex-col gap-2">
            {reqs.map((req, slot) => {
              const done = !!state.storyFlags[reqDoneKey(hub.id, week, slot)]
              const block = done ? null : requestBlocker(state, req)
              return (
                <div key={slot} className={`rep-req ${done ? 'is-done' : ''}`}>
                  <ReqIcon req={req} />
                  <div className="min-w-0 flex-1">
                    <div className="rep-req-who">{req.who}</div>
                    <div className="rep-req-text">“{req.text}”</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {req.kind === 'deliver' ? (
                        <span className="gw-pill is-soft">
                          {ingredientLabel(req.itemId)} {Math.min(ownedFor(state.inventory, req.itemId), req.qty)}/{req.qty}
                        </span>
                      ) : (
                        <span className="gw-pill is-soft">기부 {req.gold}G</span>
                      )}
                      <span className="gw-pill is-gold">평판 +{req.pts}</span>
                      {req.kind === 'deliver' && <span className="gw-pill is-soft">사례 {req.gold}G</span>}
                    </div>
                  </div>
                  <button type="button" className="gw-btn is-gold" disabled={done || !!block} title={block ?? undefined} onClick={() => dispatch({ type: 'REP_FULFILL', hubId: hub.id, slot })}>
                    {done ? '완료' : req.kind === 'donate' ? '기부' : '납품'}
                  </button>
                </div>
              )
            })}
          </div>

          {lv === 4 && (
            <>
              <Ribbon>마지막 부탁</Ribbon>
              <div className={`rep-req is-final ${canFinal ? '' : 'is-locked'}`}>
                <div className="min-w-0 flex-1">
                  <div className="rep-req-who">{fin.who}</div>
                  <div className="rep-req-text">{canFinal ? `“${fin.text}”` : '아직 때가 아닙니다. (4학년 2학기에 열립니다)'}</div>
                  {canFinal && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {fin.items.map((it) => (
                        <span key={it.itemId} className="gw-pill is-soft">
                          {ingredientLabel(it.itemId)} {Math.min(ownedFor(state.inventory, it.itemId), it.qty)}/{it.qty}
                        </span>
                      ))}
                      <span className="gw-pill is-gold">상징 「{fin.emblem}」</span>
                      <span className="gw-pill is-soft">{fin.gold.toLocaleString()}G</span>
                    </div>
                  )}
                </div>
                {canFinal && (
                  <button
                    type="button"
                    className="gw-btn is-gold"
                    disabled={fin.items.some((it) => ownedFor(state.inventory, it.itemId) < it.qty)}
                    onClick={() => dispatch({ type: 'REP_FINAL', hubId: hub.id })}
                  >
                    전하기
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </GameWindow>
  )
}
