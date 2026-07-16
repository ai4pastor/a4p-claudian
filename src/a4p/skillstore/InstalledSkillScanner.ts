import * as fs from 'fs';
import * as path from 'path';

import { resolveClaudeConfigDir } from '../../providers/claude/config/ClaudeConfigDir';
import { compareVersionStrings } from '../version';
import type { InstalledState, LocalSkillInfo, RegistrySkill, SkillMarker } from './types';
import { SKILL_MARKER_FILENAME } from './types';

/** Personal (home-scope) skills dir — honors CLAUDE_CONFIG_DIR like the CLI does. */
export function getSkillsDir(): string {
  return path.join(resolveClaudeConfigDir(), 'skills');
}

/**
 * Scans ~/.claude/skills. Names are NFC-normalized (macOS stores Korean as NFD)
 * and dot-folders (.a4p-trash, .a4p-staging) are ignored.
 */
export function scanInstalledSkills(): Map<string, LocalSkillInfo> {
  const result = new Map<string, LocalSkillInfo>();
  const skillsDir = getSkillsDir();

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  } catch {
    return result;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const isSymlink = entry.isSymbolicLink();
    if (!isSymlink && !entry.isDirectory()) continue;

    const name = entry.name.normalize('NFC');
    const dir = path.join(skillsDir, entry.name);
    result.set(name, {
      name,
      dir,
      isSymlink,
      marker: readMarker(dir),
    });
  }

  return result;
}

export function readMarker(skillDir: string): SkillMarker | null {
  try {
    const raw = fs.readFileSync(path.join(skillDir, SKILL_MARKER_FILENAME), 'utf8');
    const parsed = JSON.parse(raw) as SkillMarker;
    return parsed && typeof parsed.version === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export function computeState(skill: RegistrySkill, local: LocalSkillInfo | undefined): InstalledState {
  if (!local) return 'not-installed';
  if (local.isSymlink) return 'symlink';
  if (!local.marker) return 'unmanaged';
  const cmp = compareVersionStrings(local.marker.version, skill.version);
  if (cmp !== null && cmp < 0) return 'update-available';
  return 'installed';
}
