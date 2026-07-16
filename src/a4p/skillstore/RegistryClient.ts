import { requestUrl } from 'obsidian';

import { A4P_SKILLS_REGISTRY_URL, A4P_SKILLS_TARBALL_URL, REGISTRY_CACHE_TTL_MS } from '../config';
import { getA4PStore } from '../context';
import type { SkillRegistry } from './types';

const FETCH_TIMEOUT_MS = 8000;

export interface RegistryResult {
  registry: SkillRegistry;
  /** True when served from cache because the network was unavailable. */
  offline: boolean;
}

/**
 * Fetches registry.json (1h TTL cache in a4p.json; offline falls back to the
 * cache). The skill payload itself comes as one repo tarball, cached for the
 * lifetime of this client (one store session) — no GitHub API rate limits.
 */
export class RegistryClient {
  private tarball: Promise<ArrayBuffer> | null = null;

  async getRegistry(force = false): Promise<RegistryResult | null> {
    const store = getA4PStore();
    const cache = store?.get().registryCache;
    const fresh = cache && Date.now() - cache.fetchedAt < REGISTRY_CACHE_TTL_MS;
    if (cache && fresh && !force) {
      return { registry: cache.data as SkillRegistry, offline: false };
    }

    const fetched = await this.fetchRegistry();
    if (fetched) {
      await store?.update((data) => {
        data.registryCache = { fetchedAt: Date.now(), data: fetched };
      });
      return { registry: fetched, offline: false };
    }
    if (cache) {
      return { registry: cache.data as SkillRegistry, offline: true };
    }
    return null;
  }

  registryUrl(): string {
    return getA4PStore()?.get().registryUrl ?? A4P_SKILLS_REGISTRY_URL;
  }

  private tarballUrl(): string {
    // Derive the tarball URL from a custom registry URL when one is set
    // (raw.githubusercontent.com/<owner>/<repo>/<branch>/registry.json).
    const registryUrl = this.registryUrl();
    const match = /raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\//.exec(registryUrl);
    if (match) {
      return `https://codeload.github.com/${match[1]}/${match[2]}/tar.gz/refs/heads/${match[3]}`;
    }
    return A4P_SKILLS_TARBALL_URL;
  }

  /** One tarball per store session; concurrent installs share the same fetch. */
  getTarball(): Promise<ArrayBuffer> {
    if (!this.tarball) {
      this.tarball = this.fetchTarball().catch((error) => {
        this.tarball = null;
        throw error;
      });
    }
    return this.tarball;
  }

  invalidateTarball(): void {
    this.tarball = null;
  }

  private async fetchRegistry(): Promise<SkillRegistry | null> {
    try {
      const response = await Promise.race([
        requestUrl({ url: this.registryUrl(), throw: false }),
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), FETCH_TIMEOUT_MS)),
      ]);
      if (!response || response.status < 200 || response.status >= 300) return null;
      const data = response.json as SkillRegistry;
      if (!data || typeof data.schemaVersion !== 'number' || !Array.isArray(data.skills)) {
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  private async fetchTarball(): Promise<ArrayBuffer> {
    const response = await requestUrl({ url: this.tarballUrl(), throw: false });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`tarball fetch failed: HTTP ${response.status}`);
    }
    return response.arrayBuffer;
  }
}
