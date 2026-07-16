import { execFile } from 'child_process';
import * as fs from 'fs';
import { requestUrl } from 'obsidian';

import { cliPathRequiresNode, findNodeExecutable } from '../../utils/env';
import { A4P_COMPAT_URL, COMPAT_CACHE_TTL_MS } from '../config';
import { compareVersionStrings } from '../version';

export type CompatLevel = 'ok' | 'untested-newer' | 'known-bad' | 'too-old' | 'unknown';

export interface ProviderCompatRule {
  min?: string;
  maxTested?: string;
  knownBad?: string[];
  messageKo?: { untested?: string; knownBad?: string; tooOld?: string };
  downgradeHintKo?: string;
  guideUrl?: string;
}

export interface CompatManifest {
  schemaVersion: number;
  updatedAt?: string;
  plugin?: { minVersion?: string; latest?: string };
  providers?: Record<string, ProviderCompatRule | undefined>;
}

export interface CompatVerdict {
  providerId: string;
  cliVersion: string;
  level: CompatLevel;
  message: string;
  downgradeHint?: string;
  guideUrl?: string;
  /** Stable key used to remember banner dismissal. */
  dismissKey: string;
}

const MANIFEST_CACHE_KEY = 'a4p-claudian:compat-manifest';
const VERSION_CACHE_KEY = 'a4p-claudian:cli-versions';
const FETCH_TIMEOUT_MS = 5000;
const EXEC_TIMEOUT_MS = 10000;

interface ManifestCache {
  fetchedAt: number;
  data: CompatManifest;
}

type VersionCache = Record<string, { size: number; mtimeMs: number; version: string }>;

function readLocalStorage<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota/serialization issues are non-fatal
  }
}

/**
 * Fetches the compat manifest from the a4p-claudian repo (main branch), with a
 * 24h localStorage cache. Editing that file updates every student without a
 * plugin release. Fail-open: any error returns the cache or null.
 */
export async function fetchCompatManifest(): Promise<CompatManifest | null> {
  const cache = readLocalStorage<ManifestCache>(MANIFEST_CACHE_KEY);
  if (cache && Date.now() - cache.fetchedAt < COMPAT_CACHE_TTL_MS) {
    return cache.data;
  }

  try {
    const response = await Promise.race([
      requestUrl({ url: A4P_COMPAT_URL, throw: false }),
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), FETCH_TIMEOUT_MS)),
    ]);
    if (response && response.status >= 200 && response.status < 300) {
      const data = response.json as CompatManifest;
      if (data && typeof data === 'object' && typeof data.schemaVersion === 'number') {
        writeLocalStorage(MANIFEST_CACHE_KEY, { fetchedAt: Date.now(), data } satisfies ManifestCache);
        return data;
      }
    }
  } catch {
    // network failure → fall through to stale cache
  }
  return cache?.data ?? null;
}

/**
 * Reads `<cli> --version` with an fs.stat-based cache so the subprocess only
 * spawns when the binary actually changed. Node-script entrypoints (.js/.cjs/
 * .mjs — the Windows npm case) are executed through node.
 */
export async function detectCliVersion(cliPath: string): Promise<string | null> {
  try {
    const stat = fs.statSync(cliPath);
    const cache = readLocalStorage<VersionCache>(VERSION_CACHE_KEY) ?? {};
    const cached = cache[cliPath];
    if (cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) {
      return cached.version;
    }

    const output = await execCliVersion(cliPath);
    const version = output ? /(\d+\.\d+\.\d+)/.exec(output)?.[1] ?? null : null;
    if (version) {
      cache[cliPath] = { size: stat.size, mtimeMs: stat.mtimeMs, version };
      writeLocalStorage(VERSION_CACHE_KEY, cache);
    }
    return version;
  } catch {
    return null;
  }
}

function execCliVersion(cliPath: string): Promise<string | null> {
  const needsNode = cliPathRequiresNode(cliPath);
  const nodePath = needsNode ? findNodeExecutable() ?? process.execPath : null;
  const command = needsNode ? nodePath! : cliPath;
  const args = needsNode ? [cliPath, '--version'] : ['--version'];

  return new Promise((resolve) => {
    try {
      execFile(
        command,
        args,
        { timeout: EXEC_TIMEOUT_MS, windowsHide: true },
        (error, stdout, stderr) => {
          resolve(error ? null : `${stdout}\n${stderr}`);
        },
      );
    } catch {
      resolve(null);
    }
  });
}

/** Compares a detected CLI version against the manifest rule. Fail-open on parse issues. */
export function evaluateCompat(
  manifest: CompatManifest | null,
  providerId: string,
  cliVersion: string | null,
): CompatVerdict | null {
  if (!manifest || !cliVersion) return null;
  const rule = manifest.providers?.[providerId];
  if (!rule) return null;

  const interpolate = (template?: string): string =>
    (template ?? '').split('{version}').join(cliVersion);

  const base = {
    providerId,
    cliVersion,
    downgradeHint: rule.downgradeHintKo,
    guideUrl: rule.guideUrl,
  };

  if (rule.knownBad?.includes(cliVersion)) {
    return {
      ...base,
      level: 'known-bad',
      message: interpolate(rule.messageKo?.knownBad),
      dismissKey: `compat:${providerId}:${cliVersion}:known-bad`,
    };
  }

  if (rule.min) {
    const cmp = compareVersionStrings(cliVersion, rule.min);
    if (cmp !== null && cmp < 0) {
      return {
        ...base,
        level: 'too-old',
        message: interpolate(rule.messageKo?.tooOld),
        dismissKey: `compat:${providerId}:${cliVersion}:too-old`,
      };
    }
  }

  if (rule.maxTested) {
    const cmp = compareVersionStrings(cliVersion, rule.maxTested);
    if (cmp !== null && cmp > 0) {
      return {
        ...base,
        level: 'untested-newer',
        message: interpolate(rule.messageKo?.untested),
        dismissKey: `compat:${providerId}:${cliVersion}:untested`,
      };
    }
  }

  return {
    ...base,
    level: 'ok',
    message: '',
    dismissKey: `compat:${providerId}:${cliVersion}:ok`,
  };
}
