// Mirrors backend/app/cube/engine.py: Kociemba facelet order (U R F D L B),
// x = right, y = up, z = front. A face move turns its layer -90deg about the face normal.

export const FACES = ["U", "R", "F", "D", "L", "B"] as const;
export type Vec3 = [number, number, number];

export const NORMALS: Record<string, Vec3> = {
  U: [0, 1, 0], R: [1, 0, 0], F: [0, 0, 1],
  D: [0, -1, 0], L: [-1, 0, 0], B: [0, 0, -1],
};

export const COLORS: Record<string, string> = {
  U: "#f2f3f1", R: "#c8262f", F: "#16994a", D: "#f5c518", L: "#ef7a12", B: "#1f56c6",
};

function stickerPos(face: string, r: number, c: number): Vec3 {
  switch (face) {
    case "U": return [c - 1, 1, r - 1];
    case "R": return [1, 1 - r, 1 - c];
    case "F": return [c - 1, 1 - r, 1];
    case "D": return [c - 1, -1, 1 - r];
    case "L": return [-1, 1 - r, c - 1];
    default: return [1 - c, 1 - r, -1]; // B
  }
}

export interface Sticker { index: number; face: string; pos: Vec3; normal: Vec3 }

export const STICKERS: Sticker[] = FACES.flatMap((f, fi) =>
  Array.from({ length: 9 }, (_, i) => ({
    index: fi * 9 + i,
    face: f,
    pos: stickerPos(f, Math.floor(i / 3), i % 3),
    normal: NORMALS[f],
  })),
);

export const CUBIES: Vec3[] = [];
for (let x = -1; x <= 1; x++)
  for (let y = -1; y <= 1; y++)
    for (let z = -1; z <= 1; z++)
      if (x || y || z) CUBIES.push([x, y, z]);

export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Signed angle (radians, right-hand rule about the face normal) for a move. */
export function moveAngle(move: string): number {
  const q = move.endsWith("2") ? 2 : move.endsWith("'") ? -1 : 1;
  return (-Math.PI / 2) * q;
}

export const SOLVED = FACES.map((f) => f.repeat(9)).join("");
