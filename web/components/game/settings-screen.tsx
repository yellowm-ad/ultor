'use client'

// 환경설정 — 공용 GameWindow. 왼쪽 항목(사운드·게임·저장·백업) · 오른쪽 내용.

import { useState } from 'react'
import { useGame } from '@/lib/game-state'
import { deleteSave, exportSave, getActiveSlot, parseSaveFile, setActiveSlot, writeSave } from '@/lib/save'
import { SaveSlotList } from '@/components/game/save-slots'
import { GameWindow, menuIcon, Ribbon, SideItem } from '@/components/game/game-window'

type Section = 'sound' | 'game' | 'save' | 'backup'
const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'sound', label: '사운드', icon: 'nav-sound' },
  { id: 'game', label: '게임', icon: 'nav-game' },
  { id: 'save', label: '저장', icon: 'nav-save' },
  { id: 'backup', label: '백업 · 초기화', icon: 'nav-backup' },
]

export function SettingsScreen() {
  const { state, dispatch } = useGame()
  const [section, setSection] = useState<Section>('sound')
  const [saveTick, setSaveTick] = useState(0)
  if (state.screen !== 'settings') return null
  const close = () => dispatch({ type: 'SET_SCREEN', screen: 'world' })
  const set = (settings: Partial<typeof state.settings>) => dispatch({ type: 'UPDATE_SETTINGS', settings })

  return (
    <GameWindow title="설정" subtitle="SETTINGS" size="md" width={640} onClose={close}>
      <div className="grid gap-3 md:grid-cols-[172px_1fr]">
        <nav className="gw-side" aria-label="설정 항목">
          {SECTIONS.map((s) => (
            <SideItem key={s.id} icon={menuIcon(s.icon)} label={s.label} active={section === s.id} onClick={() => setSection(s.id)} />
          ))}
        </nav>

        <section className="gw-panel is-pad min-h-[260px]">
          {section === 'sound' && (
            <>
              <Ribbon>사운드</Ribbon>
              {(
                [
                  ['bgmVolume', '배경음 음량'],
                  ['sfxVolume', '효과음 음량'],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="set-row !block">
                  <div className="mb-2 flex justify-between">
                    <span className="t">{label}</span>
                    <b className="text-[#8a6a2c]">{state.settings[key]}</b>
                  </div>
                  <input type="range" min={0} max={100} value={state.settings[key]} onChange={(e) => set({ [key]: Number(e.target.value) })} className="set-range" />
                </div>
              ))}
            </>
          )}

          {section === 'game' && (
            <>
              <Ribbon>게임</Ribbon>
              <div className="set-row">
                <div>
                  <div className="t">전투 애니메이션 속도</div>
                  <div className="d">빠르게 하면 몬스터 처치 테스트가 편해집니다.</div>
                </div>
                <div className="set-toggle">
                  {([1, 2] as const).map((v) => (
                    <button key={v} type="button" className={`gw-btn is-sm ${state.settings.battleAnimSpeed === v ? 'is-gold' : 'is-quiet'}`} onClick={() => set({ battleAnimSpeed: v })}>
                      x{v}
                    </button>
                  ))}
                </div>
              </div>
              <div className="set-row">
                <div>
                  <div className="t">테스트 모드</div>
                  <div className="d">필드에 훈련용 허수아비를 배치합니다. 10마리 처치 시 정확히 1레벨이 오릅니다.</div>
                </div>
                <button type="button" className={`gw-btn is-sm ${state.settings.testMode ? 'is-gold' : 'is-quiet'}`} onClick={() => dispatch({ type: 'TOGGLE_TEST_MODE' })}>
                  {state.settings.testMode ? 'ON' : 'OFF'}
                </button>
              </div>
            </>
          )}

          {/* 저장 — 슬롯 4칸 중 골라 저장(찬 슬롯은 덮어쓰기). 저장한 슬롯이 이후 자동 저장 대상이 된다 */}
          {section === 'save' && (
            <>
              <Ribbon>저장</Ribbon>
              <p className="mb-3 text-[12.5px] leading-relaxed text-[#6c6150]">
                저장할 슬롯을 고르세요. 지금의 진행도(학년·학기·주차·레벨·위치)가 그 슬롯에 기록되고, 이후 자동 저장도 그 슬롯에 이어집니다.
              </p>
              <div className="rounded-lg border border-[#c4a46a] bg-[#15110c] p-2">
                <SaveSlotList
                  mode="save"
                  tone="panel"
                  refreshKey={saveTick}
                  onPick={(slot, file) => {
                    if (file && !confirm(`${slot}번 슬롯의 기록을 지금 진행으로 덮어쓸까요?`)) return
                    if (!writeSave(state, slot)) {
                      dispatch({ type: 'SHOW_TOAST', message: '저장에 실패했습니다(브라우저 저장소를 쓸 수 없음).' })
                      return
                    }
                    setActiveSlot(slot)
                    setSaveTick((t) => t + 1)
                    dispatch({ type: 'SHOW_TOAST', message: `${slot}번 슬롯에 저장했습니다.` })
                  }}
                />
              </div>
            </>
          )}

          {/* 세이브 백업 — 자동 저장은 이 브라우저에만 남으므로, 기기 이동·데이터 삭제 대비 파일로 보관 */}
          {section === 'backup' && (
            <>
              <Ribbon>세이브 백업</Ribbon>
              <p className="mb-3 text-[12.5px] leading-relaxed text-[#6c6150]">
                슬롯 기록은 이 브라우저에만 남습니다. 브라우저 데이터를 지우거나 다른 기기로 옮길 땐 파일로 내보내 두세요.
              </p>
              <div className="flex gap-2">
                <button type="button" className="gw-btn flex-1" onClick={() => exportSave(state) && dispatch({ type: 'SHOW_TOAST', message: '세이브 파일을 내보냈습니다.' })}>
                  파일로 내보내기
                </button>
                <label className="gw-btn flex-1">
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0]
                      e.target.value = ''
                      if (!f) return
                      const file = parseSaveFile(await f.text())
                      if (!file) {
                        dispatch({ type: 'SHOW_TOAST', message: '올바른 울토르 세이브 파일이 아닙니다.' })
                        return
                      }
                      if (confirm('현재 진행을 불러온 세이브로 덮어쓸까요?')) dispatch({ type: 'LOAD_GAME', saved: file.state })
                    }}
                  />
                  파일에서 불러오기
                </label>
              </div>

              <div className="mt-6">
                <Ribbon>초기화</Ribbon>
                <button
                  type="button"
                  className="gw-btn w-full !border-[#a04c4a] !text-[#ffd9d4]"
                  onClick={() => {
                    const slot = getActiveSlot()
                    if (confirm(`정말 처음부터 다시 시작하시겠습니까? ${slot ? `지금 플레이 중인 ${slot}번 슬롯의 기록이 삭제됩니다.` : '현재 진행이 초기화됩니다.'} (다른 슬롯은 유지)`)) {
                      if (slot) deleteSave(slot)
                      dispatch({ type: 'RESET_GAME' })
                    }
                  }}
                >
                  게임 초기화
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </GameWindow>
  )
}
