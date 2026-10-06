'use client'

// 화면 날씨 층(야생맵, 2026-10-07) — GameMap.terrain.weather
//  · snow   = 잔잔한 눈: 먼 눈(작은 송이, 느리게) + 가까운 눈(큰 송이, 조금 빠르게), 좌우로 살랑
//  · embers = 화산 불티: 아래에서 위로 천천히 떠오른다
//  · storm  = 옅은 빗줄기 + 이따금 번개 빛
// 256px 타일 이미지를 한 주기만큼 transform 으로 옮겨 되풀이한다(screens.css .weather) — 프레임마다 다시 그리는 것 없이 합성 단계에서만 움직여 렉이 없다.
import { memo } from 'react'

const W = '/images/map/weather/'
const tile = (f: string) => ({ backgroundImage: `url(${W}${f})` })

export const WeatherLayer = memo(function WeatherLayer({ kind }: { kind: 'snow' | 'embers' | 'storm' }) {
  return (
    <div className="weather z-10" aria-hidden>
      {kind === 'snow' && (
        <>
          <div className="wx-sway-slow">
            <div className="wx-tile wx-snow-far" style={tile('snow-a.png')} />
          </div>
          <div className="wx-sway">
            <div className="wx-tile wx-snow-near" style={tile('snow-b.png')} />
          </div>
        </>
      )}
      {kind === 'embers' && (
        <>
          <div className="wx-sway">
            <div className="wx-tile wx-ember" style={tile('ember.png')} />
          </div>
          <div className="wx-sway-slow">
            <div className="wx-tile wx-ember-b" style={{ ...tile('ember.png'), backgroundPosition: '97px 151px' }} />
          </div>
        </>
      )}
      {kind === 'storm' && (
        <>
          <div className="wx-tile wx-rain" style={tile('rain.png')} />
          <div className="wx-flash" />
        </>
      )}
    </div>
  )
})
