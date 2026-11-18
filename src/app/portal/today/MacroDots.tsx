const COLS = 12;
const ROWS = 6;
const PITCH = 6; // px between dot centres
const TOTAL = COLS * ROWS;

/** How many of the 72 dots light up for value / target (clamped). */
export function litDots(value: number, target: number): number {
  if (!(target > 0)) return 0;
  return Math.max(0, Math.min(TOTAL, Math.round((value / target) * TOTAL)));
}

/**
 * 12 x 6 dot grid showing progress: lit dots are white, the rest are faint.
 * Fills from the bottom row up, left to right, like the Figma.
 */
export default function MacroDots({ value, target }: { value: number; target: number }) {
  const lit = litDots(value, target);
  return (
    <svg width={68} height={32} viewBox="0 0 68 32" aria-hidden="true" className="block">
      {Array.from({ length: TOTAL }, (_, i) => {
        const row = ROWS - 1 - Math.floor(i / COLS);
        const col = i % COLS;
        return <circle key={i} cx={1 + col * PITCH} cy={1 + row * PITCH} r={0.9} fill="#fff" fillOpacity={i < lit ? 1 : 0.22} />;
      })}
    </svg>
  );
}
