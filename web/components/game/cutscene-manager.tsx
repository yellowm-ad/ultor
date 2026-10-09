'use client'

// 관리자 「컷신 이미지 관리」 창 — lib/cutscenes 의 컷 슬롯마다 이미지를 직접 넣고(드래그·파일 선택),
// 게임 화면과 같은 모양으로 미리 보고, 영구 반영용 <id>.png 로 내려받는다.
// 넣은 이미지는 이 브라우저의 IndexedDB(lib/cutscene-store)에 저장되어 게임 컷신에 바로 쓰인다.

import { useCallback, useEffect, useState } from 'react'
import { ALL_CUTSCENES as CUTSCENES, cutsceneSrc, type CutsceneDef } from '@/lib/cutscenes'
import { clearCutsceneOverride, cutsceneOverrideUrl, onCutsceneStoreChange, setCutsceneOverride } from '@/lib/cutscene-store'

type SlotState = { override: string | null; hasStatic: boolean }

/** 정적 파일이 실제로 있는지 — 이미지 로드로 확인 */
function probe(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = src
  })
}

/** 어떤 형식으로 넣었든 PNG 로 바꿔 내려받는다 */
async function downloadPng(url: string, id: string) {
  const img = new Image()
  img.src = url
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  canvas.getContext('2d')!.drawImage(img, 0, 0)
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
  if (!blob) return
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${id}.png`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function CutsceneManager({ onClose }: { onClose: () => void }) {
  const [slots, setSlots] = useState<Record<string, SlotState>>({})
  const [preview, setPreview] = useState<{ def: CutsceneDef; src: string } | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  const refresh = useCallback(async (id: string) => {
    const [override, hasStatic] = await Promise.all([cutsceneOverrideUrl(id), probe(cutsceneSrc(id))])
    setSlots((s) => ({ ...s, [id]: { override, hasStatic } }))
  }, [])

  useEffect(() => {
    CUTSCENES.forEach((c) => refresh(c.id))
    return onCutsceneStoreChange(refresh)
  }, [refresh])

  const put = async (id: string, file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return
    await setCutsceneOverride(id, file)
  }

  const done = Object.values(slots).filter((s) => s.override || s.hasStatic).length
  // 막(EPxx)별로 묶기
  const groups = CUTSCENES.reduce<Record<string, CutsceneDef[]>>((g, c) => {
    const ep = c.scene.split(' ')[0]
    ;(g[ep] ??= []).push(c)
    return g
  }, {})

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-3" onClick={onClose}>
      <div
        className="flex h-full max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-gold/60 bg-[#17130e] text-white/90 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-gold/30 px-4 py-2.5">
          <div>
            <div className="font-display text-gold-soft">컷신 이미지 관리</div>
            <div className="text-[11px] text-white/55">
              {done}/{CUTSCENES.length}장 준비됨 · 카드에 이미지를 끌어다 놓거나 「이미지 넣기」 — 이 브라우저에 저장되어 게임 컷신에 바로 뜬다.
              배포본에도 넣으려면 「파일로 저장」한 PNG 를 <code>web/public/images/cutscenes/</code> 에 넣는다.
            </div>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded border border-gold/50 px-3 py-1 text-xs text-gold-soft hover:bg-gold/10">
            닫기
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3">
          {Object.entries(groups).map(([ep, list]) => (
            <section key={ep} className="mb-5">
              <h3 className="mb-2 font-display text-sm text-gold-soft">{ep}</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((c) => {
                  const st = slots[c.id]
                  const src = st?.override ?? (st?.hasStatic ? cutsceneSrc(c.id) : null)
                  return (
                    <div
                      key={c.id}
                      className={`flex flex-col rounded-md border bg-black/30 p-2 ${dragOver === c.id ? 'border-gold' : 'border-gold/25'}`}
                      onDragOver={(e) => {
                        e.preventDefault()
                        setDragOver(c.id)
                      }}
                      onDragLeave={() => setDragOver((d) => (d === c.id ? null : d))}
                      onDrop={(e) => {
                        e.preventDefault()
                        setDragOver(null)
                        put(c.id, e.dataTransfer.files[0])
                      }}
                    >
                      <button
                        type="button"
                        disabled={!src}
                        onClick={() => src && setPreview({ def: c, src })}
                        className={`relative flex items-center justify-center overflow-hidden rounded border border-white/10 bg-[#0b0907] ${c.full ? 'aspect-video' : 'aspect-[4/3]'}`}
                      >
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={src} alt={c.id} className="h-full w-full object-cover" />
                        ) : (
                          <span className="px-3 text-center text-[11px] text-white/40">이미지 없음 · 여기로 끌어다 놓기</span>
                        )}
                        <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-gold-soft">
                          {c.full ? '풀컷신 16:9' : '만화 컷 4:3'}
                        </span>
                        {st?.override && <span className="absolute right-1 top-1 rounded bg-emerald-700/80 px-1.5 py-0.5 text-[10px]">직접 넣음</span>}
                        {!st?.override && st?.hasStatic && <span className="absolute right-1 top-1 rounded bg-sky-800/80 px-1.5 py-0.5 text-[10px]">배포 파일</span>}
                      </button>
                      <div className="mt-1.5 flex items-baseline gap-1.5">
                        <code className="text-[11px] text-gold-soft">{c.id}</code>
                        <span className="truncate text-[10px] text-white/45">{c.scene.replace(/^EP\d+ /, '')}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-3 text-[11px] leading-snug text-white/70" title={c.shot}>
                        {c.shot}
                      </p>
                      {c.refs.length > 0 && <p className="mt-0.5 truncate text-[10px] text-white/40">참고: {c.refs.join(', ')}</p>}
                      <div className="mt-auto flex flex-wrap gap-1 pt-2">
                        <label className="cursor-pointer rounded border border-gold/60 bg-primary/80 px-2 py-0.5 text-[11px] text-primary-foreground">
                          이미지 넣기
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => put(c.id, e.target.files?.[0])} />
                        </label>
                        {st?.override && (
                          <>
                            <button type="button" className="rounded border border-gold/40 px-2 py-0.5 text-[11px]" onClick={() => downloadPng(st.override!, c.id)}>
                              파일로 저장
                            </button>
                            <button type="button" className="rounded border border-red-400/50 px-2 py-0.5 text-[11px] text-red-200" onClick={() => clearCutsceneOverride(c.id)}>
                              지우기
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* 게임 화면과 같은 모양으로 미리 보기 — 클릭하면 닫힘 */}
      {preview && (
        <div className="fixed inset-0 z-[95]" onClick={(e) => (e.stopPropagation(), setPreview(null))}>
          <div className={`cutscene-layer ${preview.def.full ? 'is-full' : 'is-panel'}`} style={{ pointerEvents: 'auto' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.src} alt="" className="cutscene-img" />
          </div>
          <div className="absolute bottom-3 left-1/2 z-[96] -translate-x-1/2 rounded bg-black/80 px-3 py-1 text-[11px] text-white/80">
            {preview.def.id} 미리보기 — 아무 곳이나 누르면 닫힘
          </div>
        </div>
      )}
    </div>
  )
}
