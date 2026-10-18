import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '마법학교 울토르 · Magic School Ultor (초안)',
  description:
    '쿼터뷰 턴제 RPG 웹게임 초안 — 마법학교를 배경으로 한 파티 기반 턴제 전투 게임',
  generator: 'claude-cowork-draft',
  // 홈 화면에 추가(설치)하면 가로·전체 화면 앱으로 — app/manifest.ts
  appleWebApp: { capable: true, title: '울토르', statusBarStyle: 'black-translucent' },
}

/** 첫 그림 전에 터치 기기 표시(html.touch-ui) — 폰 레이아웃이 깜빡이지 않게. ?touch=1 이면 PC 에서도 폰처럼(점검용) */
const TOUCH_BOOT = `try{var q=new URLSearchParams(location.search);if(q.get('touch')==='1'||(matchMedia('(pointer: coarse)').matches&&q.get('touch')!=='0'))document.documentElement.classList.add('touch-ui')}catch(e){}`

export const viewport: Viewport = {
  themeColor: '#0b0907',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" className="bg-background">
      <head>
        <script dangerouslySetInnerHTML={{ __html: TOUCH_BOOT }} />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap"
        />
      </head>
      <body className="antialiased overflow-hidden">{children}</body>
    </html>
  )
}
