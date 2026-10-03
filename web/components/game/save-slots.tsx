'use client'

import { useEffect, useState } from 'react'
import { MAPS } from '@/lib/maps'
import { calendarLabel } from '@/lib/calendar'
import { getActiveSlot, listSaves, type SaveFile } from '@/lib/save'

/** 세이브 슬롯의 진행도 요약 — 학사 캘린더(학년·학기·주차) · 레벨 · 위치 */
function progressOf(file: SaveFile) {
  const st = file.state
  return {
    name: st.player?.name ?? '이름 없는 신입생',
    level: st.player?.level ?? 1,
    when: calendarLabel(st.calendar?.globalWeek ?? 1),
    where: (st.currentMapId && MAPS[st.currentMapId]?.name) || '',
    savedAt: new Date(file.savedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
  }
}

/**
 * 세이브 슬롯 목록(4칸).
 *  - load: 빈 슬롯은 비활성. 고르면 그 세이브를 불러온다(타이틀 CONTINUE).
 *  - save: 모든 슬롯 선택 가능. 찬 슬롯은 덮어쓰기(확인은 호출 쪽에서).
 * refreshKey 를 바꾸면 localStorage 를 다시 읽는다(저장 직후 갱신용).
 */
export function SaveSlotList({
  mode,
  onPick,
  refreshKey = 0,
  tone = 'dark',
}: {
  mode: 'load' | 'save'
  onPick: (slot: number, file: SaveFile | null) => void
  refreshKey?: number
  tone?: 'dark' | 'panel'
}) {
  // localStorage 는 브라우저에만 있으므로 마운트 후에 읽는다(SSR 불일치 방지)
  const [saves, setSaves] = useState<(SaveFile | null)[] | null>(null)
  const [active, setActive] = useState<number | null>(null)
  useEffect(() => {
    setSaves(listSaves())
    setActive(getActiveSlot())
  }, [refreshKey])
  if (!saves) return null

  return (
    <div className="flex w-full flex-col gap-1.5">
      {saves.map((file, i) => {
        const slot = i + 1
        const p = file ? progressOf(file) : null
        const disabled = mode === 'load' && !file
        return (
          <button
            key={slot}
            type="button"
            disabled={disabled}
            onClick={() => onPick(slot, file)}
            className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition ${
              tone === 'dark' ? 'border-white/15 bg-black/45 backdrop-blur-sm' : 'border-border/60 bg-black/20'
            } ${disabled ? 'cursor-default' : 'hover:border-gold/70 hover:bg-gold/10'} ${active === slot ? 'ring-1 ring-gold/60' : ''}`}
          >
            <span className="font-display w-6 shrink-0 text-center text-base text-gold-soft">{slot}</span>
            {p ? (
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[13px] text-[#f3e6c4]">
                  <span className="truncate font-semibold">{p.name}</span>
                  <span className="shrink-0 opacity-80">Lv.{p.level}</span>
                  {active === slot && <span className="shrink-0 rounded bg-gold/25 px-1 text-[9px] text-gold-soft">플레이 중</span>}
                </span>
                <span className="block truncate text-[11px] text-white/65">
                  {p.when}
                  {p.where ? ` · ${p.where}` : ''}
                </span>
              </span>
            ) : (
              <span className="flex-1 text-[12px] text-white/45">빈 슬롯</span>
            )}
            {p && <span className="shrink-0 text-[10px] text-white/45">{p.savedAt}</span>}
          </button>
        )
      })}
    </div>
  )
}
