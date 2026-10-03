'use client'

import { useState } from 'react'
import { useGame } from '@/lib/game-state'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { DiamondMark } from '@/components/game/ui-motifs'
import { deleteSave, exportSave, getActiveSlot, parseSaveFile, setActiveSlot, writeSave } from '@/lib/save'
import { SaveSlotList } from '@/components/game/save-slots'

export function SettingsScreen() {
  const { state, dispatch } = useGame()
  const [saveTick, setSaveTick] = useState(0)
  if (state.screen !== 'settings') return null
  const close = () => dispatch({ type: 'SET_SCREEN', screen: 'world' })

  return (
    <Modal open onClose={close} title="환경설정" widthClass="max-w-md">
      <div className="space-y-4 text-sm">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <DiamondMark size={10} />
              배경음 음량
            </span>
            <span className="text-gold-soft">{state.settings.bgmVolume}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={state.settings.bgmVolume}
            onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', settings: { bgmVolume: Number(e.target.value) } })}
            className="w-full accent-[var(--gold)]"
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <DiamondMark size={10} />
              효과음 음량
            </span>
            <span className="text-gold-soft">{state.settings.sfxVolume}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={state.settings.sfxVolume}
            onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', settings: { sfxVolume: Number(e.target.value) } })}
            className="w-full accent-[var(--gold)]"
          />
        </div>

        <div className="flex items-center justify-between border-t border-border/50 pt-3">
          <div>
            <div>전투 애니메이션 속도</div>
            <div className="text-[11px] text-muted-foreground">빠르게 하면 몬스터 처치 테스트가 편해집니다.</div>
          </div>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant={state.settings.battleAnimSpeed === 1 ? 'default' : 'outline'}
              onClick={() => dispatch({ type: 'UPDATE_SETTINGS', settings: { battleAnimSpeed: 1 } })}
            >
              x1
            </Button>
            <Button
              size="sm"
              variant={state.settings.battleAnimSpeed === 2 ? 'default' : 'outline'}
              onClick={() => dispatch({ type: 'UPDATE_SETTINGS', settings: { battleAnimSpeed: 2 } })}
            >
              x2
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border/50 pt-3">
          <div>
            <div>테스트 모드 (테스트몹 필드 배치)</div>
            <div className="text-[11px] text-muted-foreground">
              훈련용 허수아비 10마리 처치 시 정확히 1레벨이 오릅니다. (기획서 9번 항목 검증용)
            </div>
          </div>
          <Button size="sm" variant={state.settings.testMode ? 'default' : 'outline'} onClick={() => dispatch({ type: 'TOGGLE_TEST_MODE' })}>
            {state.settings.testMode ? 'ON' : 'OFF'}
          </Button>
        </div>

        {/* 저장 — 슬롯 4칸 중 골라 저장(찬 슬롯은 덮어쓰기). 저장한 슬롯이 이후 자동 저장 대상이 된다 */}
        <div className="border-t border-border/50 pt-3">
          <div className="mb-1.5 flex items-center gap-1.5">
            <DiamondMark size={10} />
            저장
          </div>
          <div className="mb-2 text-[11px] text-muted-foreground">
            저장할 슬롯을 고르세요. 지금의 진행도(학년·학기·주차·레벨·위치)가 그 슬롯에 기록되고, 이후 자동 저장도 그 슬롯에 이어집니다.
          </div>
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

        {/* 세이브 백업 — 자동 저장은 이 브라우저에만 남으므로, 기기 이동·데이터 삭제 대비 파일로 보관 */}
        <div className="border-t border-border/50 pt-3">
          <div className="mb-1.5">세이브 백업</div>
          <div className="mb-2 text-[11px] text-muted-foreground">
            슬롯 기록은 이 브라우저에만 남습니다. 브라우저 데이터를 지우거나 다른 기기로 옮길 땐 파일로 내보내 두세요.
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => exportSave(state) && dispatch({ type: 'SHOW_TOAST', message: '세이브 파일을 내보냈습니다.' })}>
              파일로 내보내기
            </Button>
            <label className="flex-1">
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
              <span className="inline-flex h-8 w-full cursor-pointer items-center justify-center rounded-md border border-input text-xs hover:bg-white/10">
                파일에서 불러오기
              </span>
            </label>
          </div>
        </div>

        <div className="border-t border-border/50 pt-3">
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => {
              const slot = getActiveSlot()
              if (confirm(`정말 처음부터 다시 시작하시겠습니까? ${slot ? `지금 플레이 중인 ${slot}번 슬롯의 기록이 삭제됩니다.` : '현재 진행이 초기화됩니다.'} (다른 슬롯은 유지)`)) {
                if (slot) deleteSave(slot)
                dispatch({ type: 'RESET_GAME' })
              }
            }}
          >
            게임 초기화
          </Button>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant="ghost" onClick={close}>
          닫기
        </Button>
      </div>
    </Modal>
  )
}
