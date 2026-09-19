/** A user as far as avatars/rows/pickers are concerned — real profiles flow through this shape. */
export interface Person {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

/** bg, fg, on-dark bg, on-dark fg — the 6-colour rotation from the approved design. */
const PALETTE: { bg: string; fg: string; dbg: string; dfg: string }[] = [
  { bg: '#4A2A14', fg: '#F6F3EA', dbg: '#F6F3EA', dfg: '#4A2A14' },
  { bg: '#E1E8FA', fg: '#1F3C8C', dbg: '#E1E8FA', dfg: '#1F3C8C' },
  { bg: '#F7E6D8', fg: '#8A4416', dbg: '#F7E6D8', dfg: '#8A4416' },
  { bg: '#E8E3F5', fg: '#4B3A99', dbg: '#E8E3F5', dfg: '#4B3A99' },
  { bg: '#F5E1E1', fg: '#8A2F33', dbg: '#F5E1E1', dfg: '#8A2F33' },
  { bg: '#DDF0E8', fg: '#17624B', dbg: '#DDF0E8', dfg: '#17624B' },
];

function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic colour pick so the same person always gets the same avatar colours. */
export function colorsFor(id: string) {
  return PALETTE[hash(id) % PALETTE.length];
}

/** First letter of the first two words ("Ayesha Khan" -> "AK"; "Sara" -> "SA"). */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
