import { COLORS, FACES } from "./geometry";

// Unfolded cube (cross layout) showing all 54 stickers, so hidden faces are visible too.
const LAYOUT: Record<string, [number, number]> = { U: [0, 1], L: [1, 0], F: [1, 1], R: [1, 2], B: [1, 3], D: [2, 1] };

export default function CubeNet({ facelets, size = 7 }: { facelets: string; size?: number }) {
  const gap = 1;
  const face = size * 3 + gap * 2;
  return (
    <svg width={face * 4 + 6} height={face * 3 + 4} role="img" aria-label="cube net">
      {FACES.map((f, fi) => {
        const [row, col] = LAYOUT[f];
        return Array.from({ length: 9 }, (_, i) => (
          <rect
            key={`${f}${i}`}
            x={col * (face + 2) + (i % 3) * (size + gap)}
            y={row * (face + 2) + Math.floor(i / 3) * (size + gap)}
            width={size}
            height={size}
            rx={1.2}
            fill={COLORS[facelets[fi * 9 + i]]}
            stroke="rgba(0,0,0,.35)"
            strokeWidth={0.6}
          />
        ));
      })}
    </svg>
  );
}
