import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { extractString, parseFrontmatter } from '../../utils/frontmatter';
import { getSkillsDir, readMarker } from './InstalledSkillScanner';
import type { RegistryClient } from './RegistryClient';
import { extractTarGz } from './TarExtractor';
import type { LocalSkillInfo, RegistrySkill, SkillMarker } from './types';
import { SKILL_MARKER_FILENAME } from './types';

/**
 * Install/update/uninstall for registry skills.
 *
 * Safety rules (absolute, per the vault owner's policy):
 * - NOTHING is ever deleted with rm/rmSync. Removal = move to the OS trash
 *   (~/.Trash on macOS) or, as fallback, to ~/.claude/skills/.a4p-trash/.
 * - A symlinked skill is never followed: uninstall unlinks the LINK only,
 *   install/update onto a symlink is refused.
 * - `preserve` files (per-student personalization) survive updates.
 */

const STAGING_DIRNAME = '.a4p-staging';
const TRASH_DIRNAME = '.a4p-trash';

const inFlight = new Set<string>();

export function isSkillOperationInFlight(skillId: string): boolean {
  return inFlight.has(skillId);
}

export type UninstallOutcome =
  | { kind: 'trashed'; trashPath: string }
  | { kind: 'unlinked' };

export async function installSkill(
  client: RegistryClient,
  skill: RegistrySkill,
): Promise<void> {
  if (inFlight.has(skill.id)) throw new Error('이미 진행 중이에요.');
  inFlight.add(skill.id);
  try {
    const skillsDir = getSkillsDir();
    fs.mkdirSync(skillsDir, { recursive: true });

    const targetDir = path.join(skillsDir, skill.id);
    if (isSymlinkAt(targetDir)) {
      throw new Error('이 스킬은 개발자 연결(심볼릭 링크)이라 스토어에서 덮어쓸 수 없어요.');
    }

    const stagingDir = createStagingDir(skillsDir, skill.id);
    try {
      await extractSkillIntoStaging(client, skill, stagingDir);
      validateSkillDir(stagingDir);

      const previousMarker = readMarker(targetDir);
      if (fs.existsSync(targetDir)) {
        copyPreservedFiles(skill, targetDir, stagingDir);
        moveToTrash(targetDir, skill.id);
      }

      writeMarker(stagingDir, skill, previousMarker);
      fs.renameSync(stagingDir, targetDir);
    } catch (error) {
      moveStagingToTrashQuietly(stagingDir);
      throw error;
    }
  } finally {
    inFlight.delete(skill.id);
  }
}

export async function uninstallSkill(local: LocalSkillInfo): Promise<UninstallOutcome> {
  if (inFlight.has(local.name)) throw new Error('이미 진행 중이에요.');
  inFlight.add(local.name);
  try {
    if (isSymlinkAt(local.dir)) {
      // Remove ONLY the link — the linked original is untouched.
      fs.unlinkSync(local.dir);
      return { kind: 'unlinked' };
    }
    const trashPath = moveToTrash(local.dir, local.name);
    return { kind: 'trashed', trashPath };
  } finally {
    inFlight.delete(local.name);
  }
}

/** Marks a manually installed folder as store-managed at the registry's current version. */
export function adoptSkill(local: LocalSkillInfo, skill: RegistrySkill): void {
  if (local.isSymlink) throw new Error('개발자 연결 스킬은 관리 대상으로 전환할 수 없어요.');
  const marker: SkillMarker = {
    id: skill.id,
    version: skill.version,
    installedAt: Date.now(),
    source: 'adopted',
    preserved: skill.preserve,
  };
  fs.writeFileSync(path.join(local.dir, SKILL_MARKER_FILENAME), JSON.stringify(marker, null, 2));
}

export function getInternalTrashDir(): string {
  return path.join(getSkillsDir(), TRASH_DIRNAME);
}

// --- internals ---

async function extractSkillIntoStaging(
  client: RegistryClient,
  skill: RegistrySkill,
  stagingDir: string,
): Promise<void> {
  const download = skill.download ?? { type: 'repo-dir' as const };
  if (download.type !== 'repo-dir') {
    throw new Error('아직 지원하지 않는 배포 방식이에요. 플러그인을 업데이트해 주세요.');
  }

  const repoPath = (download.path ?? `skills/${skill.id}`).normalize('NFC').replace(/\/+$/, '');
  const tarball = await client.getTarball();
  const entries = extractTarGz(tarball);

  // codeload tarballs prefix everything with "<repo>-<branch>/".
  let extractedAnything = false;
  for (const entry of entries) {
    const firstSlash = entry.path.indexOf('/');
    if (firstSlash === -1) continue;
    const relativeToRepo = entry.path.slice(firstSlash + 1);
    if (relativeToRepo !== repoPath && !relativeToRepo.startsWith(`${repoPath}/`)) continue;

    const relativeToSkill = relativeToRepo.slice(repoPath.length).replace(/^\//, '');
    const destination = path.join(stagingDir, relativeToSkill);
    assertInside(stagingDir, destination);

    if (entry.type === 'dir') {
      fs.mkdirSync(destination, { recursive: true });
    } else {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, entry.data);
    }
    extractedAnything = true;
  }

  if (!extractedAnything) {
    throw new Error(`레지스트리에서 스킬 파일(${repoPath})을 찾지 못했어요.`);
  }
}

function validateSkillDir(dir: string): void {
  const skillMd = path.join(dir, 'SKILL.md');
  if (!fs.existsSync(skillMd)) {
    throw new Error('스킬 파일이 올바르지 않아요 (SKILL.md 없음). 강사에게 알려 주세요.');
  }
  const parsed = parseFrontmatter(fs.readFileSync(skillMd, 'utf8'));
  const frontmatter = parsed?.frontmatter;
  const name = frontmatter ? extractString(frontmatter, 'name') : undefined;
  const description = frontmatter ? extractString(frontmatter, 'description') : undefined;
  if (!name || !description) {
    throw new Error('스킬 파일이 올바르지 않아요 (name/description 누락). 강사에게 알려 주세요.');
  }
}

/**
 * Copies `preserve` matches from the previous install into staging so
 * personalization wins over freshly downloaded defaults.
 * Patterns: exact relative path, or one-level `dir/*`.
 */
function copyPreservedFiles(skill: RegistrySkill, oldDir: string, stagingDir: string): void {
  for (const pattern of skill.preserve ?? []) {
    const normalized = pattern.normalize('NFC').replace(/^\/+|\/+$/g, '');
    if (!normalized || normalized.includes('..')) continue;

    if (normalized.endsWith('/*')) {
      const subdir = normalized.slice(0, -2);
      const sourceDir = path.join(oldDir, subdir);
      if (!isRealDir(sourceDir)) continue;
      for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        copyFileInto(path.join(sourceDir, entry.name), path.join(stagingDir, subdir, entry.name), stagingDir);
      }
      continue;
    }

    const source = path.join(oldDir, normalized);
    if (fs.existsSync(source) && fs.lstatSync(source).isFile()) {
      copyFileInto(source, path.join(stagingDir, normalized), stagingDir);
    }
  }
}

function copyFileInto(source: string, destination: string, containedIn: string): void {
  assertInside(containedIn, destination);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function writeMarker(dir: string, skill: RegistrySkill, previous: SkillMarker | null): void {
  const marker: SkillMarker = {
    id: skill.id,
    version: skill.version,
    installedAt: previous?.installedAt ?? Date.now(),
    source: 'a4p-registry',
    preserved: skill.preserve,
  };
  fs.writeFileSync(path.join(dir, SKILL_MARKER_FILENAME), JSON.stringify(marker, null, 2));
}

function createStagingDir(skillsDir: string, skillId: string): string {
  const stagingRoot = path.join(skillsDir, STAGING_DIRNAME);
  const stagingDir = path.join(stagingRoot, `${skillId}-${Date.now()}`);
  fs.mkdirSync(stagingDir, { recursive: true });
  return stagingDir;
}

/**
 * Never deletes: renames into ~/.Trash (macOS, same volume as home) and falls
 * back to the internal trash inside the skills dir (always same volume).
 */
function moveToTrash(dir: string, label: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (process.platform === 'darwin') {
    try {
      const target = path.join(os.homedir(), '.Trash', `${label}-${stamp}`);
      fs.renameSync(dir, target);
      return target;
    } catch {
      // EXDEV or missing ~/.Trash → internal trash below
    }
  }
  const internalTarget = path.join(getInternalTrashDir(), `${label}-${stamp}`);
  fs.mkdirSync(path.dirname(internalTarget), { recursive: true });
  fs.renameSync(dir, internalTarget);
  return internalTarget;
}

function moveStagingToTrashQuietly(stagingDir: string): void {
  try {
    if (fs.existsSync(stagingDir)) {
      moveToTrash(stagingDir, path.basename(stagingDir));
    }
  } catch {
    // leftover staging is harmless (dot-folder, ignored by the scanner)
  }
}

function isSymlinkAt(target: string): boolean {
  try {
    return fs.lstatSync(target).isSymbolicLink();
  } catch {
    return false;
  }
}

function isRealDir(target: string): boolean {
  try {
    const stat = fs.lstatSync(target);
    return stat.isDirectory() && !stat.isSymbolicLink();
  } catch {
    return false;
  }
}

function assertInside(parent: string, child: string): void {
  const relative = path.relative(parent, child);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`unsafe destination: ${child}`);
  }
}
