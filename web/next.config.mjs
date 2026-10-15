// 서버 빌드 = Vercel(또는 ARENA_SERVER=1) — 천공 콜로세움 API(app/api/**/route.api.ts)가 살아 있는 일반 Next 빌드.
// 그 밖(로컬)은 더블클릭 실행/정적 호스팅이 되도록 정적 export — 이때 *.api.ts 는 라우트로 보지 않는다.
const server = !!process.env.VERCEL || process.env.ARENA_SERVER === '1'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 초안(draft) 단계: 타입 경고로 빌드가 막히지 않도록 함
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  output: server ? undefined : 'export',
  pageExtensions: server ? ['tsx', 'ts', 'jsx', 'js', 'api.ts'] : ['tsx', 'ts', 'jsx', 'js'],
  trailingSlash: true,
}

export default nextConfig
