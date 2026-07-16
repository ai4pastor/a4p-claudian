import { evaluateCompat } from '../../../src/a4p/diagnostics/CompatGuard';
import { translateNotice } from '../../../src/a4p/notices/noticeKo';
import { computeState } from '../../../src/a4p/skillstore/InstalledSkillScanner';
import type { LocalSkillInfo, RegistrySkill } from '../../../src/a4p/skillstore/types';
import { compareVersionStrings } from '../../../src/a4p/version';

describe('version compare', () => {
  it('orders semver correctly', () => {
    expect(compareVersionStrings('2.0.34', '2.1.211')).toBeLessThan(0);
    expect(compareVersionStrings('2.1.211', '2.1.211')).toBe(0);
    expect(compareVersionStrings('2.10.0', '2.9.9')).toBeGreaterThan(0);
  });

  it('reads the first semver in noisy strings', () => {
    expect(compareVersionStrings('2.1.211 (Claude Code)', '2.1.211')).toBe(0);
    expect(compareVersionStrings('nonsense', '1.0.0')).toBeNull();
  });
});

describe('compat evaluation', () => {
  const manifest = {
    schemaVersion: 1,
    providers: {
      claude: {
        min: '2.0.0',
        maxTested: '2.1.211',
        knownBad: ['2.1.5'],
        messageKo: { untested: '검증 전 {version}', knownBad: '문제 버전 {version}', tooOld: '너무 오래됨 {version}' },
      },
    },
  };

  it('flags known-bad, too-old, and untested versions', () => {
    expect(evaluateCompat(manifest, 'claude', '2.1.5')?.level).toBe('known-bad');
    expect(evaluateCompat(manifest, 'claude', '1.9.0')?.level).toBe('too-old');
    expect(evaluateCompat(manifest, 'claude', '2.2.0')?.level).toBe('untested-newer');
    expect(evaluateCompat(manifest, 'claude', '2.1.100')?.level).toBe('ok');
  });

  it('interpolates the version into Korean messages', () => {
    expect(evaluateCompat(manifest, 'claude', '2.2.0')?.message).toBe('검증 전 2.2.0');
  });

  it('fails open on missing data', () => {
    expect(evaluateCompat(null, 'claude', '2.2.0')).toBeNull();
    expect(evaluateCompat(manifest, 'claude', null)).toBeNull();
    expect(evaluateCompat(manifest, 'codex', '1.0.0')).toBeNull();
  });
});

describe('installed skill state', () => {
  const skill: RegistrySkill = { id: 's', name: 'S', description: '', version: '1.2.0' };
  const local = (overrides: Partial<LocalSkillInfo>): LocalSkillInfo => ({
    name: 's',
    dir: '/tmp/s',
    isSymlink: false,
    marker: null,
    ...overrides,
  });

  it('maps local info to states', () => {
    expect(computeState(skill, undefined)).toBe('not-installed');
    expect(computeState(skill, local({ isSymlink: true }))).toBe('symlink');
    expect(computeState(skill, local({}))).toBe('unmanaged');
    expect(
      computeState(skill, local({ marker: { id: 's', version: '1.0.0', installedAt: 0, source: 'a4p-registry' } })),
    ).toBe('update-available');
    expect(
      computeState(skill, local({ marker: { id: 's', version: '1.2.0', installedAt: 0, source: 'a4p-registry' } })),
    ).toBe('installed');
  });
});

describe('notice translation', () => {
  it('translates exact matches', () => {
    expect(translateNotice('Failed to create tab')).toBe('새 탭을 만들지 못했어요.');
  });

  it('translates interpolated templates', () => {
    expect(translateNotice('Maximum 5 tabs allowed')).toBe('탭은 최대 5개까지 열 수 있어요.');
    expect(translateNotice('Command failed: boom')).toBe('명령 실행에 실패했어요: boom');
  });

  it('passes unknown notices through (fail-open)', () => {
    expect(translateNotice('Some brand-new upstream message')).toBeNull();
  });
});
