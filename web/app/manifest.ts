import type { MetadataRoute } from 'next'

/** 설치형(홈 화면에 추가) 웹앱 — 휴대폰에서 항상 가로·전체 화면으로 열린다(2026-10-18) */
export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '마법학교 울토르',
    short_name: '울토르',
    description: '쿼터뷰 턴제 RPG — 마법학교 울토르',
    start_url: '/',
    display: 'fullscreen',
    orientation: 'landscape',
    background_color: '#0b0907',
    theme_color: '#0b0907',
    icons: [{ src: '/icon.png', sizes: 'any', type: 'image/png' }],
  }
}
