/** Minimal semver helpers — enough for CLI version comparison, no dependency. */

export type Semver = [number, number, number];

export function parseSemver(text: string): Semver | null {
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(text);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Returns <0 when a<b, 0 when equal, >0 when a>b. */
export function compareSemver(a: Semver, b: Semver): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

export function compareVersionStrings(a: string, b: string): number | null {
  const parsedA = parseSemver(a);
  const parsedB = parseSemver(b);
  if (!parsedA || !parsedB) return null;
  return compareSemver(parsedA, parsedB);
}
