// 천공 콜로세움 API — 서버 빌드(Vercel)에서만 라우트가 된다(next.config.mjs pageExtensions 'api.ts').
// 정적 export(로컬 더블클릭 실행)에서는 이 파일이 무시되고, 게임은 연습 상대로 돌아간다.
import { handleArena } from '@/lib/arena-server'

export async function POST(req: Request) {
  return handleArena(req)
}
