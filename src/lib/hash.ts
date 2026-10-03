/** Small deterministic hash (FNV-1a) so sample behaviour repeats exactly. */
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A number from 0 (inclusive) to 1 (exclusive) that depends only on the key. */
export function chance(key: string): number {
  return hash(key) / 4294967296;
}

/** A whole number between min and max (inclusive) that depends only on the key. */
export function pick(key: string, min: number, max: number): number {
  return min + (hash(key) % (max - min + 1));
}
