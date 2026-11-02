'use client'

// 첫 이동 연출(lib/passages) — 어떤 지역에 처음 들어갈 때 한 번 거치는 미니게임 넷.
//   안내 화면 → 게임 → 통과(PASSAGE_DONE: 플래그를 켜고 그 포탈로 넘어감) / 실패(다시 하기 · 돌아가기).
import { useCallback, useState } from 'react'
import { useGame } from '@/lib/game-state'
import { passageById, type PassageId } from '@/lib/passages'
import { SpiralStage } from '@/components/game/passage/spiral-stage'
import { VoyageStage } from '@/components/game/passage/voyage-stage'
import { MazeStage } from '@/components/game/passage/maze-stage'
import { SurvivalStage } from '@/components/game/passage/survival-stage'

type Phase = 'intro' | 'play' | 'won' | 'lost'

export function PassageOverlay() {
  const { state, dispatch } = useGame()
  const [phase, setPhase] = useState<Phase>('intro')
  const [round, setRound] = useState(0)
  const [fish, setFish] = useState(0)
  const end = useCallback((ok: boolean, caught = 0) => {
    setFish(caught)
    setPhase(ok ? 'won' : 'lost')
  }, [])
  if (!state.passage) return null
  const def = passageById(state.passage.id)
  const Game = GAMES[def.id]
  return (
    <div className="psg-root">
      <div className="psg-frame">
        <div className="psg-title">{def.title}</div>
        {phase === 'intro' && (
          <div className="psg-card">
            <p className="psg-intro">{def.intro}</p>
            <ul className="psg-howto">
              {def.howto.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
            <div className="psg-actions">
              <button type="button" className="gw-btn is-gold is-lg" onClick={() => setPhase('play')}>
                출발
              </button>
              <button type="button" className="gw-btn is-quiet" onClick={() => dispatch({ type: 'PASSAGE_CANCEL' })}>
                돌아가기
              </button>
              {state.settings.testMode && (
                <button type="button" className="gw-btn is-quiet" onClick={() => dispatch({ type: 'PASSAGE_DONE' })}>
                  건너뛰기(테스트 모드)
                </button>
              )}
            </div>
          </div>
        )}
        {phase === 'play' && <Game key={round} onEnd={end} />}
        {phase === 'won' && (
          <div className="psg-card">
            <p className="psg-intro">
              {WON_TEXT[def.id]}
              {fish > 0 && ` 갑판에서 잡은 물고기 ${Math.min(5, fish)}마리는 가방에 챙겼다.`}
            </p>
            <div className="psg-actions">
              <button type="button" className="gw-btn is-gold is-lg" onClick={() => dispatch({ type: 'PASSAGE_DONE', fish })}>
                계속
              </button>
            </div>
          </div>
        )}
        {phase === 'lost' && (
          <div className="psg-card">
            <p className="psg-intro">{LOST_TEXT[def.id]}</p>
            <div className="psg-actions">
              <button
                type="button"
                className="gw-btn is-gold is-lg"
                onClick={() => {
                  setRound((r) => r + 1)
                  setPhase('play')
                }}
              >
                다시 도전
              </button>
              <button type="button" className="gw-btn is-quiet" onClick={() => dispatch({ type: 'PASSAGE_CANCEL' })}>
                돌아가기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const WON_TEXT: Record<PassageId, string> = {
  voyage: '안개가 걷히고, 물 위에 떠 있는 흰 돔과 산호 첨탑이 보인다. 아틀란티스다.',
  spiral: '마지막 계단을 딛자 구름이 발아래로 내려앉는다. 폭풍 위의 땅, 스톰헤이븐에 올랐다.',
  maze: '무너진 벽 틈으로 빛이 쏟아진다. 회랑을 빠져나오자 이끼 덮인 신전의 뜰이 펼쳐진다.',
  survival: '능선에 오르자 밤하늘 가득 오로라가 일렁인다. 설원을 건넜다 — 이제 길을 안다.',
}
const LOST_TEXT: Record<PassageId, string> = {
  voyage: '갑판에서 미끄러져 흠뻑 젖었다. 선장은 뱃머리를 돌려 항구로 돌아왔다.',
  spiral: '함정에 밀려 계단 아래 층계참까지 굴러떨어졌다.',
  maze: '횃불이 꺼졌다. 더듬어 온 길을 되짚어 입구로 돌아왔다.',
  survival: '더는 걸을 수 없다. 순찰대의 썰매에 실려 설원 어귀로 돌아왔다.',
}

const GAMES: Record<PassageId, (p: { onEnd: (ok: boolean, caught?: number) => void }) => React.ReactNode> = {
  voyage: VoyageStage,
  spiral: SpiralStage,
  maze: MazeStage,
  survival: SurvivalStage,
}
