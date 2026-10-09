// 관리자 오브젝트 편집 모드 상태 — 켜짐 여부 · 선택한 프롭 · 놓으려는 카탈로그 항목.
// iso-world(맵 클릭)와 admin-panel(버튼) 이 같이 쓴다.
import { useSyncExternalStore } from 'react'
import type { PropCatalogItem } from '@/lib/prop-catalog'

export interface MapEditorState {
  on: boolean
  selected: string | null
  placing: PropCatalogItem | null
  /** 새로 놓는 오브젝트를 길막(충돌)으로 할지 */
  solid: boolean
}

let st: MapEditorState = { on: false, selected: null, placing: null, solid: true }
const subs = new Set<() => void>()

export function setMapEditor(patch: Partial<MapEditorState>) {
  st = { ...st, ...patch }
  subs.forEach((f) => f())
}
export const getMapEditor = () => st

export function useMapEditor(): MapEditorState {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    () => st,
    () => st,
  )
}
