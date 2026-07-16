/** Schema of registry.json in the public ai4pastor/a4p-skills repo. */

export interface RegistryCategory {
  id: string;
  name: string;
  order?: number;
}

export interface RegistrySkillFirstRun {
  prompt: string;
  autoSubmit?: boolean;
  /** Skip the first-run prompt when this file already exists in the skill folder. */
  onlyIfMissing?: string;
}

export type RegistryDownload =
  | { type: 'repo-dir'; path?: string }
  | { type: 'zip'; url: string };

export interface RegistrySkill {
  id: string;
  /** Korean display name. */
  name: string;
  description: string;
  version: string;
  category?: string;
  download?: RegistryDownload;
  /** Files preserved across updates (personalization like word-profile.json). */
  preserve?: string[];
  firstRun?: RegistrySkillFirstRun;
  docsUrl?: string;
  minPluginVersion?: string;
}

export interface SkillRegistry {
  schemaVersion: number;
  updatedAt?: string;
  minPluginVersion?: string;
  categories?: RegistryCategory[];
  skills: RegistrySkill[];
}

/** Written to ~/.claude/skills/<id>/.a4p-skill.json on install. */
export interface SkillMarker {
  id: string;
  version: string;
  installedAt: number;
  source: 'a4p-registry' | 'adopted';
  preserved?: string[];
}

export const SKILL_MARKER_FILENAME = '.a4p-skill.json';

export type InstalledState =
  | 'not-installed'
  | 'installed'
  | 'update-available'
  | 'unmanaged'
  | 'symlink';

export interface LocalSkillInfo {
  /** NFC-normalized folder name. */
  name: string;
  dir: string;
  isSymlink: boolean;
  marker: SkillMarker | null;
}
