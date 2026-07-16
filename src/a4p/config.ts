/**
 * A4P layer configuration constants.
 *
 * Everything a4p-specific that might need tuning lives here so the rest of
 * the layer never hardcodes URLs or provider ids.
 */

/** Providers hidden from pastors (kept registered so upstream tests stay green). */
export const A4P_HIDDEN_PROVIDER_IDS: ReadonlySet<string> = new Set(['opencode', 'pi']);

/** Public skill registry (ai4pastor/a4p-skills). */
export const A4P_SKILLS_REGISTRY_URL =
  'https://raw.githubusercontent.com/ai4pastor/a4p-skills/main/registry.json';

/** Tarball of the whole registry repo — one fetch per store session, no API rate limit. */
export const A4P_SKILLS_TARBALL_URL =
  'https://codeload.github.com/ai4pastor/a4p-skills/tar.gz/refs/heads/main';

/** CLI compatibility manifest — editable on main without a plugin release. */
export const A4P_COMPAT_URL =
  'https://raw.githubusercontent.com/ai4pastor/a4p-claudian/main/compat/a4p-compat.json';

/** Upstream plugin id, used to warn when both plugins are enabled at once. */
export const UPSTREAM_PLUGIN_ID = 'realclaudian';

/** Registry cache TTL (1 hour). */
export const REGISTRY_CACHE_TTL_MS = 60 * 60 * 1000;

/** Compat manifest cache TTL (24 hours). */
export const COMPAT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
