'use client'

// ============================================================================
// 전체 지도(2026-11-05 개편) — 소울나이트식 연결도. 미니맵을 누르면 연다.
//   왼쪽: 야외 맵 전체를 칸과 통로로(어느 포탈로 어디에 갈 수 있는지). 칸을 누르면 오른쪽에 그 맵 정보.
//   오른쪽: 이름 · 지역 · 권장 레벨 · 이어진 곳 · 가 본 곳이면 [텔레포트].
//   실내에 있으면 그 건물이 속한 야외 칸이 '지금 위치'.
// ============================================================================
import { useState } from 'react'
import { useGame } from '@/lib/game-state'
import { MAPS } from '@/lib/maps'
import type { MapId } from '@/lib/types'
import { regionById, regionOfMap } from '@/lib/regions'
import { Modal } from '@/components/ui/modal'
import { teleportBlockReason } from '@/lib/teleport'
import { GRAPH_POS, graphAnchor, REGION_COLOR } from '@/lib/map-graph'
import { MapGraph } from '@/components/game/minimap-graph'
import { guideGoal, guidePin } from '@/lib/guide'

const GW = 520
const GH = 560

export function WorldMapScreen() {
  const { state, dispatch } = useGame()
  const here = graphAnchor(state.currentMapId, MAPS) ?? 'village'
  const [viewId, setViewId] = useState<MapId>(here)

  if (state.screen !== 'worldmap') return null
  const close = () => dispatch({ type: 'SET_SCREEN', screen: 'world' })
  const goal = guideGoal(state, guidePin())
  const goalMap = goal?.mapId ? graphAnchor(goal.mapId, MAPS) : null

  const map = MAPS[viewId]
  const region = regionOfMap(viewId)
  const known = viewId === 'village' || (state.visitedMaps ?? []).includes(viewId)
  const links = [...new Set(map.portals.map((p) => p.to as MapId).filter((t) => GRAPH_POS[t] && t !== viewId))]
  const blockReason = teleportBlockReason(state, viewId)
  const isHere = viewId === here
  const inside = state.currentMapId !== here ? MAPS[state.currentMapId]?.name : null

  return (
    <Modal open onClose={close} title="전체 지도" widthClass="max-w-4xl">
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="shrink-0 overflow-hidden rounded-md border-2 border-[#c79a3e]/70 bg-[#0d0a08]" style={{ width: GW, maxWidth: '100%' }}>
          <MapGraph state={state} focus={here} guideMap={goalMap} width={GW} height={GH} unit={56} node={26} center="fit" labels selected={viewId} onPick={setViewId} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="rounded-md border border-gold/30 bg-black/30 p-3">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: REGION_COLOR[region] }} />
              <span className="text-[11px] text-gold-soft">{regionById(region).name}</span>
            </div>
            <div className="mt-1 font-display text-[18px] text-[#f3e6c4]">{known ? map.name : '아직 가 본 적 없는 곳'}</div>
            <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[#f3e6c4]">{map.kind === 'town' ? '마을 · 안전 지대' : map.bossSpawns?.length ? '보스가 사는 곳' : '야생'}</span>
              {map.recommendedLevel ? <span className="rounded bg-white/10 px-1.5 py-0.5 text-[#f3e6c4]">권장 Lv.{map.recommendedLevel}</span> : null}
              {isHere && <span className="rounded bg-emerald-700/50 px-1.5 py-0.5 text-emerald-100">● 지금 여기{inside ? ` (${inside})` : ''}</span>}
              {goalMap === viewId && <span className="rounded bg-yellow-700/50 px-1.5 py-0.5 text-yellow-100">! 길 안내 목표</span>}
            </div>
          </div>

          <div className="rounded-md border border-gold/30 bg-black/30 p-3">
            <div className="mb-1.5 text-[11px] text-gold-soft">포탈로 이어진 곳</div>
            <div className="flex flex-wrap gap-1.5">
              {links.map((t) => {
                const k = t === 'village' || (state.visitedMaps ?? []).includes(t)
                return (
                  <button key={t} type="button" onClick={() => setViewId(t)} className="flex items-center gap-1 rounded border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-[#f3e6c4] hover:bg-white/10">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: REGION_COLOR[regionOfMap(t)] }} />
                    {k ? MAPS[t].name : '???'}
                  </button>
                )
              })}
            </div>
          </div>

          {!isHere && (
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                disabled={!!blockReason}
                onClick={() => dispatch({ type: 'TELEPORT', mapId: viewId })}
                className="rounded-md border border-sky-300/70 bg-sky-900/40 px-4 py-2 text-[13px] font-display text-sky-100 shadow-[0_0_10px_rgba(125,200,255,0.25)] transition-colors hover:bg-sky-800/60 disabled:cursor-not-allowed disabled:border-white/15 disabled:bg-white/5 disabled:text-white/40 disabled:shadow-none"
              >
                ✦ {known ? map.name : '이곳'}(으)로 텔레포트
              </button>
              {blockReason && <span className="text-[11px] text-muted-foreground">{blockReason}</span>}
            </div>
          )}

          <div className="mt-auto text-[10.5px] leading-relaxed text-white/45">
            ⌂ 마을 · ☠ 보스 · ◆ 가 본 곳 · ? 아직 안 가 본 곳 · ! 길 안내 목표 — 칸을 눌러 정보를 보고, 가 본 곳은 바로 텔레포트할 수 있습니다.
          </div>
        </div>
      </div>
    </Modal>
  )
}
