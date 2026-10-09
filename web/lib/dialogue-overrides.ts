// ============================================================================
// 관리자 대사 편집 — 스토리 장면(StoryBeat)의 대사 줄을 고친 기록.
//   · 키: `<beatId>::<원래 대사>` — 대본을 다시 생성해 줄 순서가 바뀌어도 같은 대사면 그대로 적용된다.
//   · 배포본 기록: public/dialogue-overrides.json / 이 브라우저 기록: localStorage 'ultor-dialogue-overrides' (줄 단위로 덮어씀)
//   · 관리자 창 「파일로 저장」 → dialogue-overrides.json 을 web/public/ 에 넣고 배포하면 모두에게 반영.
// ============================================================================

import { useSyncExternalStore } from 'react'
import type { StoryLine } from '@/lib/story'

export interface LineOverride {
  text?: string
  speaker?: string
  /** 연출 동작 id — null 이면 동작을 뺀다 */
  anim?: string | null
  /** 이 줄을 재생하지 않는다 */
  hidden?: boolean
}
export type DialogueOverrides = Record<string, LineOverride>

const LS_KEY = 'ultor-dialogue-overrides'
const EVENT = 'ultor-dialogue-overrides'
let published: DialogueOverrides = {}
let local: DialogueOverrides = {}
let version = 0
let started = false

const emit = () => {
  version++
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT))
}
function writeLocal() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(local))
  } catch {
    /* 저장소를 못 쓰면 이번 세션에만 */
  }
}

export const lineKey = (beatId: string, original: StoryLine) => `${beatId}::${original.text}`

export function initDialogueOverrides() {
  if (started || typeof window === 'undefined') return
  started = true
  try {
    local = JSON.parse(localStorage.getItem(LS_KEY) || '{}') as DialogueOverrides
  } catch {
    local = {}
  }
  emit()
  fetch('/dialogue-overrides.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : {}))
    .then((j: DialogueOverrides) => {
      published = j && typeof j === 'object' ? j : {}
      emit()
    })
    .catch(() => {})
}

export function useDialogueOverridesVersion(): number {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb)
      return () => window.removeEventListener(EVENT, cb)
    },
    () => version,
    () => 0,
  )
}

export function lineOverride(beatId: string, original: StoryLine): LineOverride | undefined {
  const k = lineKey(beatId, original)
  return local[k] ?? published[k]
}

/** 고친 내용을 적용한 줄 — 숨긴 줄은 null */
export function applyLineOverride(beatId: string, line: StoryLine): StoryLine | null {
  const o = lineOverride(beatId, line)
  if (!o) return line
  if (o.hidden) return null
  const out: StoryLine = { ...line }
  if (o.text !== undefined) out.text = o.text
  if (o.speaker !== undefined) out.speaker = o.speaker
  if (o.anim !== undefined) {
    if (o.anim) out.anim = o.anim
    else delete out.anim
  }
  return out
}

export function setLineOverride(beatId: string, original: StoryLine, patch: LineOverride) {
  const k = lineKey(beatId, original)
  const merged = { ...(local[k] ?? published[k] ?? {}), ...patch }
  // 원래와 같아진 항목은 지운다
  if (merged.text === original.text) delete merged.text
  if (merged.speaker === original.speaker) delete merged.speaker
  if (merged.anim !== undefined && (merged.anim ?? undefined) === ([] as string[]).concat(original.anim ?? [])[0]) delete merged.anim
  if (!merged.hidden) delete merged.hidden
  local = { ...local, [k]: merged }
  writeLocal()
  emit()
}

export function resetLineOverride(beatId: string, original: StoryLine) {
  const k = lineKey(beatId, original)
  // 배포본에 기록이 있으면 '원래대로' 덮는 빈 기록, 없으면 이 브라우저 기록만 지움
  if (published[k]) local = { ...local, [k]: {} }
  else {
    const { [k]: _drop, ...rest } = local
    void _drop
    local = rest
  }
  writeLocal()
  emit()
}

export function editedCount(): number {
  return Object.values({ ...published, ...local }).filter((o) => Object.keys(o).length).length
}

export function exportDialogueOverrides(): string {
  const all = { ...published, ...local }
  const clean: DialogueOverrides = {}
  for (const [k, o] of Object.entries(all)) if (Object.keys(o).length) clean[k] = o
  return JSON.stringify(clean, null, 2)
}

export function importDialogueOverrides(text: string) {
  local = { ...local, ...(JSON.parse(text) as DialogueOverrides) }
  writeLocal()
  emit()
}

export function clearLocalDialogueOverrides() {
  local = {}
  writeLocal()
  emit()
}
