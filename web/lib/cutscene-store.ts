// ============================================================================
// 컷신 이미지 직접 넣기 — 관리자 페이지(/admin)의 「컷신 이미지 관리」 창에서 올린 이미지를
// 브라우저 IndexedDB 에 저장하고, 게임 컷신(story-overlay CutsceneLayer)이 정적 파일보다 먼저 쓴다.
//   · 저장 위치는 그 브라우저뿐(다른 기기·배포본에는 안 보임). 영구 반영은 관리 창의 「파일로 저장」으로
//     <id>.png 를 받아 web/public/images/cutscenes/ 에 넣고 배포한다.
//   · 저장소를 못 쓰는 환경(사생활 보호 창 등)이면 조용히 실패하고 정적 파일만 쓴다.
// ============================================================================

const DB_NAME = 'ultor-cutscenes'
const STORE = 'images'
const EVENT = 'ultor-cutscene-store'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }).finally(() => db.close())
}

const urls = new Map<string, string>()

/** 직접 넣은 이미지의 object URL — 없으면 null */
export async function cutsceneOverrideUrl(id: string): Promise<string | null> {
  try {
    const blob = await tx<Blob | undefined>('readonly', (s) => s.get(id) as IDBRequest<Blob | undefined>)
    if (!blob) return null
    const old = urls.get(id)
    if (old) URL.revokeObjectURL(old)
    const url = URL.createObjectURL(blob)
    urls.set(id, url)
    return url
  } catch {
    return null
  }
}

/** 직접 넣은 이미지가 있는 컷 id 목록 */
export async function cutsceneOverrideIds(): Promise<string[]> {
  try {
    return (await tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys())).map(String)
  } catch {
    return []
  }
}

export async function setCutsceneOverride(id: string, file: Blob): Promise<void> {
  await tx('readwrite', (s) => s.put(file, id))
  window.dispatchEvent(new CustomEvent(EVENT, { detail: id }))
}

export async function clearCutsceneOverride(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id))
  window.dispatchEvent(new CustomEvent(EVENT, { detail: id }))
}

/** 저장소가 바뀌면(이미지 넣기/지우기) 호출 — 해제 함수를 돌려준다 */
export function onCutsceneStoreChange(fn: (id: string) => void): () => void {
  const h = (e: Event) => fn(String((e as CustomEvent).detail))
  window.addEventListener(EVENT, h)
  return () => window.removeEventListener(EVENT, h)
}

/** 관리자 페이지에서 열린 게임인지 — 이미지 없는 컷의 자리 표시를 여기서만 보여 준다 */
export const isAdminPage = () => typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')
