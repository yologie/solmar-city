// Solmar City — seeded randomness. Every gameplay random draw goes through
// these functions. No unseeded randomness and no wall-clock calls anywhere
// in gameplay code.

export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return { s };
}

export function rngNext(rng) {
  // mulberry32
  let t = (rng.s += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function rngRange(rng, min, max) {
  return min + rngNext(rng) * (max - min);
}

export function rngInt(rng, min, max) {
  return Math.floor(rngRange(rng, min, max + 1));
}

export function rngPick(rng, arr) {
  return arr[Math.floor(rngNext(rng) * arr.length)];
}

export function rngChance(rng, p) {
  return rngNext(rng) < p;
}

// Deterministic 32-bit hash of a string, used to derive a seed from a label.
export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// FNV-1a over a string; used by the headless self-check to hash game state.
export function fnv1a(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// Small deterministic LCG for audio noise (never used for gameplay).
export function makeLcg(seed) {
  let s = (seed >>> 0) || 12345;
  return function next() {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
