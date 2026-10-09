'use client'

// 관리자 「대사 편집」 창 — 스토리 장면을 골라 대사 줄마다 화자·대사·연출 동작·숨김을 고친다.
// 고친 내용은 이 브라우저에 저장되어 게임에 바로 반영(lib/dialogue-overrides). 「파일로 저장」 → web/public/dialogue-overrides.json 으로 배포.

import { useMemo, useRef, useState } from 'react'
import { STORY_BEATS, type StoryLine } from '@/lib/story'
import { STORY_ANIM_IDS } from '@/lib/story-anims'
import {
  clearLocalDialogueOverrides,
  editedCount,
  exportDialogueOverrides,
  importDialogueOverrides,
  lineOverride,
  resetLineOverride,
  setLineOverride,
  useDialogueOverridesVersion,
} from '@/lib/dialogue-overrides'

const ROUTE_LABEL: Record<string, string> = { A: 'A 루트', B: 'B 루트', C: 'C 루트', B_OR_C: 'B/C 루트' }

function download(name: string, text: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function DialogueEditor({ onClose, onPlay }: { onClose: () => void; onPlay: (beatId: string) => void }) {
  useDialogueOverridesVersion()
  const [query, setQuery] = useState('')
  const [beatId, setBeatId] = useState<string>(STORY_BEATS[0]?.id ?? '')
  const fileRef = useRef<HTMLInputElement>(null)
  const beats = useMemo(() => {
    const q = query.trim()
    return STORY_BEATS.filter((b) => b.lines.length && (!q || b.title.includes(q) || b.id.includes(q) || b.lines.some((l) => l.text.includes(q))))
  }, [query])
  const beat = STORY_BEATS.find((b) => b.id === beatId)

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-3" onClick={onClose}>
      <div className="flex h-full max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-gold/60 bg-[#17130e] text-white/90 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gold/30 px-4 py-2.5">
          <div>
            <div className="font-display text-gold-soft">대사 편집</div>
            <div className="text-[11px] text-white/55">
              고친 줄 {editedCount()}개 · 고치면 이 브라우저에 저장되어 게임에 바로 반영된다. 모두에게 반영하려면 「파일로 저장」한 <code>dialogue-overrides.json</code> 을 <code>web/public/</code> 에 넣고 배포.
            </div>
          </div>
          <div className="flex shrink-0 gap-1 text-xs">
            <button type="button" className="rounded border border-gold/50 px-2 py-1" onClick={() => download('dialogue-overrides.json', exportDialogueOverrides())}>
              파일로 저장
            </button>
            <button type="button" className="rounded border border-gold/50 px-2 py-1" onClick={() => fileRef.current?.click()}>
              불러오기
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (f) importDialogueOverrides(await f.text())
                e.target.value = ''
              }}
            />
            <button type="button" className="rounded border border-red-400/50 px-2 py-1 text-red-200" onClick={() => clearLocalDialogueOverrides()}>
              이 브라우저 수정 전부 지우기
            </button>
            <button type="button" className="rounded border border-gold/50 px-3 py-1 text-gold-soft" onClick={onClose}>
              닫기
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* 장면 목록 */}
          <div className="flex w-64 shrink-0 flex-col border-r border-gold/20">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="막·제목·대사 검색"
              className="m-2 rounded border border-gold/40 bg-black/40 px-2 py-1 text-xs text-white outline-none"
            />
            <div className="flex-1 overflow-y-auto scrollbar-thin px-1 pb-2">
              {beats.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBeatId(b.id)}
                  className={`block w-full truncate rounded px-2 py-1 text-left text-[11px] ${b.id === beatId ? 'bg-gold/20 text-gold-soft' : 'hover:bg-white/5'}`}
                  title={b.title}
                >
                  {b.title}
                </button>
              ))}
            </div>
          </div>

          {/* 대사 줄 */}
          <div className="flex min-w-0 flex-1 flex-col">
            {beat && (
              <div className="flex items-center justify-between gap-2 border-b border-gold/20 px-3 py-2 text-xs">
                <span className="truncate text-gold-soft">{beat.title}</span>
                <button type="button" className="shrink-0 rounded border border-gold bg-primary/80 px-2 py-1 text-primary-foreground" onClick={() => onPlay(beat.id)}>
                  이 장면 재생
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-2">
              {beat?.lines.map((l, i) => <LineRow key={`${beat.id}-${i}`} beatId={beat.id} line={l} index={i} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LineRow({ beatId, line, index }: { beatId: string; line: StoryLine; index: number }) {
  const o = lineOverride(beatId, line) ?? {}
  const text = o.text ?? line.text
  const speaker = o.speaker ?? (line.player ? '주인공' : line.speaker)
  const anim = o.anim !== undefined ? o.anim ?? '' : ([] as string[]).concat(line.anim ?? [])[0] ?? ''
  const edited = Object.keys(o).length > 0
  return (
    <div className={`mb-2 rounded border p-2 ${o.hidden ? 'border-white/10 opacity-50' : edited ? 'border-emerald-500/50' : 'border-gold/15'}`}>
      <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[10px] text-white/50">
        <span>#{index + 1}</span>
        {line.route && <span className="rounded bg-sky-900/70 px-1 text-sky-100">{ROUTE_LABEL[line.route]}</span>}
        {line.cut && <span className="rounded bg-black/50 px-1">컷 {line.cut}</span>}
        {line.player ? (
          <span className="rounded bg-black/40 px-1">주인공</span>
        ) : (
          <input
            value={speaker}
            onChange={(e) => setLineOverride(beatId, line, { speaker: e.target.value })}
            placeholder="(나레이션)"
            className="w-36 rounded border border-gold/30 bg-black/40 px-1.5 py-0.5 text-[11px] text-white outline-none"
          />
        )}
        <select
          value={anim}
          onChange={(e) => setLineOverride(beatId, line, { anim: e.target.value || null })}
          className="rounded border border-gold/30 bg-black/40 px-1 py-0.5 text-[11px] text-white"
        >
          <option value="">동작 없음</option>
          {STORY_ANIM_IDS.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={!!o.hidden} onChange={(e) => setLineOverride(beatId, line, { hidden: e.target.checked })} />
          숨김
        </label>
        {edited && (
          <button type="button" className="ml-auto rounded border border-white/20 px-1.5 text-white/70" onClick={() => resetLineOverride(beatId, line)}>
            원래대로
          </button>
        )}
      </div>
      <textarea
        value={text}
        onChange={(e) => setLineOverride(beatId, line, { text: e.target.value })}
        rows={Math.min(5, Math.max(1, Math.ceil(text.length / 70)))}
        className="w-full resize-y rounded border border-gold/20 bg-black/30 px-2 py-1 text-xs leading-relaxed text-white outline-none focus:border-gold/60"
      />
      {o.text !== undefined && <div className="mt-0.5 text-[10px] text-white/35">원래: {line.text}</div>}
    </div>
  )
}
