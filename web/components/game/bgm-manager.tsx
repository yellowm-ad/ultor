'use client'

// 관리자 「브금 관리」 창 — lib/bgm 의 칸(마을별·전투맵·전투 진입·스토리 파트·기타)마다 곡을 넣고, 미리 듣고,
// 배포용 파일·목록(manifest.json)으로 내려받는다. 넣은 곡은 이 브라우저(IndexedDB)에 저장되어 게임에서 바로 나온다.

import { useEffect, useRef, useState } from 'react'
import { useGame } from '@/lib/game-state'
import {
  BGM_GROUPS,
  BGM_SLOTS,
  bgmChain,
  bgmElement,
  bgmOverrideFile,
  bgmSource,
  buildBgmManifest,
  clearBgmOverride,
  initBgm,
  onBgmChange,
  resolveBgm,
  setBgmOverride,
  type BgmSlot,
} from '@/lib/bgm'
import { BeepTrack, beepEditorUrl, beepFor, exportBeepJson, parseBeepInput, setBeepEdit } from '@/lib/bgm-beepbox'

function download(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function BgmManager({ onClose }: { onClose: () => void }) {
  const { state } = useGame()
  const [, setVersion] = useState(0)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const preview = useRef<HTMLAudioElement | BeepTrack | null>(null)
  /** 빕박스 주소 붙여넣기 칸을 연 칸 · 입력값 · 오류 */
  const [paste, setPaste] = useState<{ id: string; text: string; err?: string } | null>(null)

  useEffect(() => {
    void initBgm().then(() => setVersion((v) => v + 1))
    return onBgmChange(() => setVersion((v) => v + 1))
  }, [])
  const stopEl = (el: HTMLAudioElement | BeepTrack | null) => {
    if (!el) return
    el.pause()
    if (el instanceof BeepTrack) el.dispose()
  }
  useEffect(() => () => stopEl(preview.current), [])

  const stopPreview = () => {
    stopEl(preview.current)
    preview.current = null
    setPlaying(null)
  }
  const togglePreview = (id: string) => {
    if (playing === id) return stopPreview()
    stopPreview()
    const src = bgmSource(id)
    if (!src) return
    const el = bgmElement(src, !!BGM_SLOTS.find((x) => x.id === id)?.once)
    el.volume = 0.8
    if (!(el instanceof BeepTrack)) el.onended = () => setPlaying((p) => (p === id ? null : p))
    el.play().catch(() => setPlaying(null))
    preview.current = el
    setPlaying(id)
  }
  const put = async (id: string, file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('audio/') && !/\.(mp3|ogg|wav|m4a|aac|flac|webm)$/i.test(file.name)) return
    setBusy(id)
    try {
      if (playing === id) stopPreview()
      await setBgmOverride(id, file)
    } finally {
      setBusy(null)
    }
  }

  const applyPaste = async () => {
    if (!paste) return
    const song = await parseBeepInput(paste.text)
    if (!song) return setPaste({ ...paste, err: '빕박스 주소(https://www.beepbox.co/#…)나 곡 문자열을 붙여 넣으세요.' })
    if (playing === paste.id) stopPreview()
    setBeepEdit(paste.id, song)
    setPaste(null)
  }

  const now = resolveBgm(bgmChain(state))
  const filled = BGM_SLOTS.filter((s) => bgmSource(s.id)).length

  const row = (s: BgmSlot) => {
    const src = bgmSource(s.id)
    const own = bgmOverrideFile(s.id)
    const beep = beepFor(s.id)
    const beepOwn = beep?.from === 'override'
    return (
      <div
        key={s.id}
        className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border bg-black/30 px-2 py-1.5 ${dragOver === s.id ? 'border-gold' : now?.slot === s.id ? 'border-emerald-500/70' : 'border-gold/20'}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(s.id)
        }}
        onDragLeave={() => setDragOver((d) => (d === s.id ? null : d))}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(null)
          void put(s.id, e.dataTransfer.files[0])
        }}
      >
        <button
          type="button"
          disabled={!src}
          onClick={() => togglePreview(s.id)}
          title={src ? '미리 듣기' : '곡 없음'}
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[11px] ${src ? 'border-gold/60 text-gold-soft hover:bg-gold/10' : 'border-white/10 text-white/20'}`}
        >
          {playing === s.id ? '■' : '▶'}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="truncate text-[12px] text-white/90">{s.label}</span>
            {s.once && <span className="rounded bg-white/10 px-1 text-[9px] text-white/60">한 번</span>}
            {now?.slot === s.id && <span className="rounded bg-emerald-700/80 px-1 text-[9px]">지금 재생</span>}
          </div>
          <div className="truncate text-[10px] text-white/45" title={s.hint}>
            <code className="text-gold-soft/70">{s.id}</code>
            {s.hint ? ` · ${s.hint}` : ''}
          </div>
        </div>
        <span className={`shrink-0 truncate rounded px-1.5 py-0.5 text-[10px] ${src?.from === 'override' ? 'bg-emerald-800/70' : src ? 'bg-sky-800/70' : 'bg-white/5 text-white/40'}`} style={{ maxWidth: 160 }} title={src?.name}>
          {busy === s.id ? '저장 중…' : src?.beep ? (src.from === 'override' ? '빕박스 · 고친 곡' : '빕박스 · 배포 곡') : src?.from === 'override' ? `직접 넣음 · ${src.name}` : src ? `배포 파일 · ${src.name}` : '비어 있음'}
        </span>
        <div className="flex shrink-0 flex-wrap gap-1">
          <button
            type="button"
            className="rounded border border-violet-400/50 px-2 py-0.5 text-[11px] text-violet-200"
            title="빕박스 편집기를 새 탭에 열어 고칩니다. 다 고친 뒤 주소창의 주소를 복사해 「붙여넣기」"
            onClick={() => window.open(beep ? beepEditorUrl(beep.song) : 'https://www.beepbox.co/', '_blank', 'noopener')}
          >
            빕박스에서 열기
          </button>
          <button type="button" className="rounded border border-violet-400/50 px-2 py-0.5 text-[11px] text-violet-200" onClick={() => setPaste(paste?.id === s.id ? null : { id: s.id, text: '' })}>
            붙여넣기
          </button>
          {beepOwn && (
            <button
              type="button"
              className="rounded border border-red-400/50 px-2 py-0.5 text-[11px] text-red-200"
              title="이 브라우저에서 고친 빕박스 곡을 지우고 배포 곡으로"
              onClick={() => {
                if (playing === s.id) stopPreview()
                setBeepEdit(s.id, null)
              }}
            >
              빕박스 되돌리기
            </button>
          )}
          <label className="cursor-pointer rounded border border-gold/60 bg-primary/80 px-2 py-0.5 text-[11px] text-primary-foreground">
            {src ? '바꾸기' : '곡 넣기'}
            <input type="file" accept="audio/*,.mp3,.ogg,.wav,.m4a" className="hidden" onChange={(e) => void put(s.id, e.target.files?.[0])} />
          </label>
          {own && (
            <>
              <button type="button" className="rounded border border-gold/40 px-2 py-0.5 text-[11px]" onClick={() => download(own.blob, own.name)}>
                파일로 저장
              </button>
              <button
                type="button"
                className="rounded border border-red-400/50 px-2 py-0.5 text-[11px] text-red-200"
                onClick={() => {
                  if (playing === s.id) stopPreview()
                  void clearBgmOverride(s.id)
                }}
              >
                지우기
              </button>
            </>
          )}
        </div>
        {paste?.id === s.id && (
          <div className="flex w-full flex-wrap items-center gap-1">
            <input
              autoFocus
              value={paste.text}
              onChange={(e) => setPaste({ id: s.id, text: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && void applyPaste()}
              placeholder="고친 빕박스 주소를 붙여 넣기 (https://www.beepbox.co/#…)"
              className="min-w-0 flex-1 rounded border border-violet-400/40 bg-black/40 px-2 py-1 text-[11px] text-white"
            />
            <button type="button" className="rounded border border-violet-400/60 bg-violet-900/50 px-2 py-1 text-[11px]" onClick={() => void applyPaste()}>
              적용
            </button>
            {paste.err && <div className="w-full text-[10px] text-red-300">{paste.err}</div>}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-3" onClick={onClose}>
      <div
        className="flex h-full max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-gold/60 bg-[#17130e] text-white/90 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-gold/30 px-4 py-2.5">
          <div>
            <div className="font-display text-gold-soft">브금 관리</div>
            <div className="text-[11px] leading-relaxed text-white/55">
              {filled}/{BGM_SLOTS.length}칸 채움 · 칸에 음원(mp3·ogg·wav·m4a)을 끌어다 놓거나 「곡 넣기」 — 이 브라우저에 저장되어 게임에서 바로 나온다.
              <br />
              비어 있는 칸은 위 단계(지역 → 기본)의 곡이 대신 나온다. 배포본에 넣으려면 곡마다 「파일로 저장」한 파일과 「목록 저장」한 <code>manifest.json</code> 을{' '}
              <code>web/public/bgm/</code> 에 넣는다.
            </div>
            <div className="mt-1 text-[11px] text-emerald-300/80">
              지금 상황: <code>{bgmChain(state).join(' → ')}</code> {now ? `· 재생 칸 ${now.slot}` : '· 들어 있는 곡 없음'}
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => download(new Blob([JSON.stringify(buildBgmManifest(), null, 2) + '\n'], { type: 'application/json' }), 'manifest.json')}
              className="rounded border border-gold/50 px-3 py-1 text-xs text-gold-soft hover:bg-gold/10"
            >
              목록 저장
            </button>
            <button
              type="button"
              title="배포 곡 + 이 브라우저에서 고친 빕박스 곡 → web/public/bgm/beepbox.json 에 넣고 배포"
              onClick={() => download(new Blob([exportBeepJson()], { type: 'application/json' }), 'beepbox.json')}
              className="rounded border border-violet-400/50 px-3 py-1 text-xs text-violet-200 hover:bg-violet-400/10"
            >
              빕박스 목록 저장
            </button>
            <button type="button" onClick={onClose} className="rounded border border-gold/50 px-3 py-1 text-xs text-gold-soft hover:bg-gold/10">
              닫기
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3">
          {BGM_GROUPS.map((g) => {
            const shown = open[g.id] ?? !g.collapsed
            const n = g.slots.filter((s) => bgmSource(s.id)).length
            return (
              <section key={g.id} className="mb-4">
                <button type="button" className="mb-1 flex w-full items-baseline gap-2 text-left" onClick={() => setOpen((o) => ({ ...o, [g.id]: !shown }))}>
                  <span className="text-gold-soft/70">{shown ? '▾' : '▸'}</span>
                  <h3 className="font-display text-sm text-gold-soft">{g.title}</h3>
                  <span className="text-[10px] text-white/45">
                    {n}/{g.slots.length}
                  </span>
                </button>
                <p className="mb-1.5 text-[11px] text-white/50">{g.note}</p>
                {shown && <div className="grid gap-1.5">{g.slots.map(row)}</div>}
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
