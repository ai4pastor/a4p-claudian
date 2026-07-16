/**
 * A4P layer shared types.
 */

/** A workflow preset shown as a chip above the composer / button on the welcome screen. */
export interface A4PPreset {
  id: string;
  /** Korean label, emoji included (e.g. "📖 성경 구절 찾기"). */
  label: string;
  kind: 'prompt' | 'command';
  /** Prompt template; may contain {{activeNote}} / {{selection}} placeholders. */
  prompt?: string;
  /** insert = prefill composer, auto = send immediately. */
  submit: 'insert' | 'auto';
  /** Skill id from the a4p-skills registry required to run this preset. */
  requiredSkill?: string;
  /** Obsidian command id to execute instead of a prompt (kind: 'command'). */
  commandId?: string;
  showInWelcome: boolean;
}

export interface A4PRegistryCache {
  fetchedAt: number;
  etag?: string;
  data: unknown;
}

export interface A4POnboardingState {
  /** Timestamp of the first all-green diagnostics run. */
  diagnosticsPassedAt?: number;
  /** User checked "다시 보지 않기". */
  dismissed?: boolean;
}

/** Persisted a4p state — stored in <vault>/.claudian/a4p.json, separate from upstream settings. */
export interface A4PData {
  schemaVersion: 1;
  simpleMode: boolean;
  presets: A4PPreset[];
  registryUrl?: string;
  registryCache?: A4PRegistryCache;
  onboarding: A4POnboardingState;
  dismissedBanners: string[];
}

export function createDefaultA4PData(): A4PData {
  return {
    schemaVersion: 1,
    simpleMode: true,
    presets: [],
    onboarding: {},
    dismissedBanners: [],
  };
}
