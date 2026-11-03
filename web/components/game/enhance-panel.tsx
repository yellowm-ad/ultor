'use client'

// 제작대 › 장비 강화(2026-10-31) — 가운데 보유 장비 목록 · 오른쪽 강화 상세(능력치 변화 · 확률 · 잠재력 4줄 · 강화하기).
// 규칙은 lib/gear-enhance.ts(골드만 사용 · 파괴 없음 · +4부터 실패 시 하락 가능 · 최대 +10).

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { useGame } from '@/lib/game-state'
import { itemById } from '@/lib/mock-data'
import {
  ENHANCE_MAX,
  enhanceCost,
  enhanceDropRate,
  enhancedBonus,
  enhanceSuccessRate,
  gearOf,
  isEnhanceable,
  POTENTIAL_MAX,
  POTENTIAL_OPEN_AT,
  RARITY_LABEL,
  rarityOf,
  STAT_SHORT,
} from '@/lib/gear-enhance'
import type { ItemDef, ItemRarity, StatKey } from '@/lib/types'
import { Divider, Ribbon, Sparkle } from '@/components/game/game-window'
import { EnhanceBurst } from '@/components/game/result-fx'

const RARITY_PILL: Record<ItemRarity, string> = { common: 'is-soft', uncommon: 'is-green', rare: 'is-blue', mythic: 'is-purple', unique: 'is-gold' }
const STAT_LABEL: Record<StatKey, string> = { maxHp: '최대 HP', maxMp: '최대 MP', atk: '공격력', def: '방어력', matk: '마법공격력', mdef: '마법방어력', spd: '속도', luck: '행운' }
const SLOT_ORDER = { weapon: 0, armor: 1, accessory: 2 } as Record<string, number>

function EnhPips({ enh }: { enh: number }) {
  return (
    <span className="enh-pips" aria-label={`+${enh}`}>
      {Array.from({ length: ENHANCE_MAX }).map((_, i) => (
        <i key={i} className={i < enh ? 'is-on' : ''} />
      ))}
    </span>
  )
}

export function EnhanceList({ selectedId, onPick }: { selectedId: string | null; onPick: (id: string) => void }) {
  const { state } = useGame()
  const equipped = new Set(Object.values(state.player.equipped))
  const gear = state.inventory
    .map((s) => itemById(s.itemId))
    .filter(isEnhanceable)
    .sort((a, b) => Number(equipped.has(b.id)) - Number(equipped.has(a.id)) || SLOT_ORDER[a.type] - SLOT_ORDER[b.type] || (b.tier ?? 1) - (a.tier ?? 1))
  return (
    <section className="gw-panel is-flex p-3">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-bold text-[#6c6150]">보유 장비</span>
        <span className="text-[12px] text-[#8a7c62]">{gear.length}점 · 골드만 사용 · 파괴 없음</span>
      </div>
      <div className="gw-scroll is-fill flex flex-col gap-2 pr-1">
        {gear.length === 0 && (
          <div className="gw-empty">
            <Sparkle />
            강화할 장비가 없습니다.
          </div>
        )}
        {gear.map((it) => {
          const m = gearOf(state.player.gear, it.id)
          return (
            <button key={it.id} type="button" className={`gw-row ${(selectedId ?? gear[0]?.id) === it.id ? 'is-active' : ''}`} onClick={() => onPick(it.id)}>
              <span className="gw-row-icon is-tile">
                <Image src={it.icon} alt="" width={38} height={38} unoptimized />
              </span>
              <span className="gw-row-main">
                <span className="gw-row-title">
                  {it.name}
                  {m.enh > 0 && <span className="gear-enh-tag">+{m.enh}</span>}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className={`gw-pill ${RARITY_PILL[rarityOf(it)]}`}>{RARITY_LABEL[rarityOf(it)]}</span>
                  {equipped.has(it.id) && <span className="gw-pill is-gold">장착 중</span>}
                  <EnhPips enh={m.enh} />
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function EnhanceDetail({ itemId }: { itemId: string | null }) {
  const { state, dispatch } = useGame()
  const first = state.inventory.map((s) => itemById(s.itemId)).find(isEnhanceable)
  const item: ItemDef | undefined = (itemId ? itemById(itemId) : undefined) ?? first
  const mods = item ? gearOf(state.player.gear, item.id) : null
  // 결과 연출 — 단계가 바뀌면 메달이 반짝(성공) / 흔들림(하락)
  const prev = useRef<{ id?: string; enh: number }>({ enh: 0 })
  const [flash, setFlash] = useState<{ k: number; kind: 'up' | 'down' | 'keep' } | null>(null)
  const gold = state.player.gold
  // 두드리기 — 누르면 메달이 잠깐 떨리며 달아오른 뒤 결과가 나온다(결과 직전의 긴장감)
  const [forging, setForging] = useState(false)
  const forgeTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(forgeTimer.current), [])
  const forge = (id: string) => {
    if (forging) return
    setFlash(null)
    setForging(true)
    forgeTimer.current = window.setTimeout(() => {
      setForging(false)
      dispatch({ type: 'ENHANCE_GEAR', itemId: id })
    }, 620)
  }
  // 결과 판정 — 같은 장비에서 골드가 줄었을 때 한 번만: 단계 ↑ 성공 · ↓ 하락 · 그대로 실패(유지)
  //   (예전엔 단계 효과와 골드 효과가 따로 돌아 성공 직후 '유지'로 덮어쓰였다)
  const lastGold = useRef(gold)
  useEffect(() => {
    if (!item || !mods) return
    const p = prev.current
    if (p.id === item.id && gold < lastGold.current) setFlash({ k: Date.now(), kind: mods.enh > p.enh ? 'up' : mods.enh < p.enh ? 'down' : 'keep' })
    prev.current = { id: item.id, enh: mods.enh }
    lastGold.current = gold
  }, [gold, item, mods])

  if (!item || !mods) {
    return (
      <aside className="gw-panel is-flex is-pad">
        <div className="gw-empty">
          <Sparkle />
          장비를 선택하세요
        </div>
      </aside>
    )
  }
  const maxed = mods.enh >= ENHANCE_MAX
  const now = enhancedBonus(item, mods.enh)
  const next = enhancedBonus(item, Math.min(ENHANCE_MAX, mods.enh + 1))
  const rate = enhanceSuccessRate(item, mods.enh)
  const drop = enhanceDropRate(mods.enh)
  const cost = enhanceCost(item, mods.enh)
  const r = rarityOf(item)

  return (
    <aside className="gw-panel is-flex is-pad">
      <div className="gw-scroll is-fill">
        <div className="flex gap-4">
          <div key={flash?.k} className={`craft-medal enh-medal ${forging ? 'is-forging' : flash ? `is-${flash.kind}` : ''}`}>
            <Image src={item.icon} alt={item.name} width={64} height={64} unoptimized />
            {mods.enh > 0 && <span className="enh-medal-tag">+{mods.enh}</span>}
            {flash && !forging && <EnhanceBurst kind={flash.kind} enh={mods.enh} />}
          </div>
          <div className="min-w-0 pt-1">
            <h3 className="font-display text-[16px] font-bold text-[#2c2a33]">{item.name}</h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className={`gw-pill ${RARITY_PILL[r]}`}>{RARITY_LABEL[r]}</span>
              <span className="gw-pill is-soft">+{mods.enh} / +{ENHANCE_MAX}</span>
            </div>
            <div className="mt-2">
              <EnhPips enh={mods.enh} />
            </div>
          </div>
        </div>

        <Divider />
        <Ribbon>능력치 {maxed ? '' : `+${mods.enh} → +${mods.enh + 1}`}</Ribbon>
        <div className="gw-box enh-stats">
          {(Object.keys(item.statBonus ?? {}) as StatKey[]).map((k) => (
            <div key={k}>
              <span>{STAT_LABEL[k]}</span>
              <b>
                {now[k]}
                {!maxed && next[k] !== now[k] && <em> → {next[k]}</em>}
              </b>
            </div>
          ))}
          {!item.statBonus && <span className="text-[12px] text-[#8a7c62]">기본 능력치가 없는 장비 — 잠재력만 자랍니다.</span>}
        </div>

        <Ribbon>잠재력 {mods.pot.length}/{POTENTIAL_MAX}</Ribbon>
        <div className="gw-box flex flex-col gap-1">
          {Array.from({ length: POTENTIAL_MAX }).map((_, i) => {
            const p = mods.pot[i]
            return (
              <div key={i} className={`enh-pot ${p ? '' : 'is-locked'}`}>
                <span className="enh-pot-gem" />
                {p ? (
                  <>
                    <span>{STAT_LABEL[p.stat]}</span>
                    <b>+{p.value}</b>
                  </>
                ) : (
                  <span>+{POTENTIAL_OPEN_AT[i]} 첫 달성 시 열림</span>
                )}
              </div>
            )
          })}
          <p className="mt-1 text-[11px] leading-relaxed text-[#8a7c62]">처음 도달하는 단계마다 잠재력이 무작위로 자랍니다. {mods.pot.length ? `(현재 ${mods.pot.map((p) => `${STAT_SHORT[p.stat]} +${p.value}`).join(' · ')})` : ''}</p>
        </div>

        {!maxed && (
          <>
            <Ribbon>확률</Ribbon>
            <div className="gw-box enh-rates">
              <div className="enh-rate-bar">
                <i className="is-ok" style={{ width: `${rate * 100}%` }} />
                <i className="is-keep" style={{ width: `${(1 - rate) * (1 - drop) * 100}%` }} />
                <i className="is-drop" style={{ width: `${(1 - rate) * drop * 100}%` }} />
              </div>
              <div className="enh-rate-legend">
                <span className="is-ok">성공 {(rate * 100).toFixed(0)}%</span>
                <span className="is-keep">유지 {((1 - rate) * (1 - drop) * 100).toFixed(0)}%</span>
                <span className="is-drop">하락 {((1 - rate) * drop * 100).toFixed(0)}%</span>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="pt-3">
        {maxed ? (
          <div className="text-center text-[13px] font-bold text-[#8a6a2c]">최대 강화 +{ENHANCE_MAX} 달성!</div>
        ) : (
          <button type="button" className="gw-btn is-gold is-lg w-full" disabled={gold < cost || forging} onClick={() => forge(item.id)}>
            {forging ? '두드리는 중…' : `강화하기 · ${cost.toLocaleString()} G`}
          </button>
        )}
        {!maxed && gold < cost && <p className="mt-1.5 text-center text-[12px] text-[#a04c4a]">골드가 부족합니다.</p>}
      </div>
    </aside>
  )
}
