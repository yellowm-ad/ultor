// 가방 화면 장식 글리프. (카테고리 아이콘은 PixelLab 이미지 — public/images/icons/menu/cat-*.png)

/** 빈 슬롯 바탕의 은은한 4방향 별 */
export function SlotSparkle({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 2c.5 5.2 1.8 8 10 10-8.2 2-9.5 4.8-10 10-.5-5.2-1.8-8-10-10 8.2-2 9.5-4.8 10-10Z" fill="currentColor" />
    </svg>
  )
}
