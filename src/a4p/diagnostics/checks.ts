import * as fs from 'fs';
import { Platform } from 'obsidian';
import * as os from 'os';
import * as path from 'path';

import { resolveClaudeConfigDir } from '../../providers/claude/config/ClaudeConfigDir';
import { cliPathRequiresNode, findNodeExecutable } from '../../utils/env';
import type { A4PHost } from '../context';
import type { CompatVerdict } from './CompatGuard';
import { detectCliVersion, evaluateCompat, fetchCompatManifest } from './CompatGuard';

export type CheckStatus = 'ok' | 'warn' | 'fail' | 'skip';

export interface FixAction {
  label: string;
  kind: 'copy' | 'link' | 'note';
  value: string;
}

export interface CheckResult {
  id: string;
  status: CheckStatus;
  title: string;
  detail: string;
  fixes: FixAction[];
}

export interface DiagnosticsReport {
  results: CheckResult[];
  compatVerdicts: CompatVerdict[];
  /** True when nothing requires the student's attention. */
  allGreen: boolean;
}

const TERMINAL_STEPS_MAC = '터미널 여는 법: ⌘+스페이스 → "터미널" 입력 → Enter → 아래 명령을 붙여넣고 Enter';
const TERMINAL_STEPS_WIN = 'PowerShell 여는 법: 시작 버튼 → "PowerShell" 검색 → 실행 → 아래 명령을 붙여넣고 Enter';

function terminalSteps(): string {
  return Platform.isMacOS ? TERMINAL_STEPS_MAC : TERMINAL_STEPS_WIN;
}

function claudeInstallCommand(): string {
  return Platform.isMacOS
    ? 'curl -fsSL https://claude.ai/install.sh | bash'
    : 'irm https://claude.ai/install.ps1 | iex';
}

/** Runs every check in parallel and folds in the CLI compat guard. */
export async function runDiagnostics(plugin: A4PHost): Promise<DiagnosticsReport> {
  const claudePath = resolveCliPath(plugin, 'claude');
  const codexPath = resolveCliPath(plugin, 'codex');
  const manifest = await fetchCompatManifest();

  const claudeVersion = claudePath ? await detectCliVersion(claudePath) : null;
  const codexVersion = codexPath ? await detectCliVersion(codexPath) : null;

  const compatVerdicts: CompatVerdict[] = [];
  const claudeVerdict = evaluateCompat(manifest, 'claude', claudeVersion);
  if (claudeVerdict) compatVerdicts.push(claudeVerdict);
  if (isCodexEnabled(plugin)) {
    const codexVerdict = evaluateCompat(manifest, 'codex', codexVersion);
    if (codexVerdict) compatVerdicts.push(codexVerdict);
  }

  const results: CheckResult[] = [
    checkOs(),
    checkClaudeCli(claudePath),
    checkClaudeVersion(claudePath, claudeVersion),
    checkNode(claudePath),
    checkLogin(plugin),
    checkCodex(codexPath, codexVersion),
    checkSkillsDirWritable(),
    checkCompat(compatVerdicts),
  ];

  const allGreen = results.every((result) => result.status === 'ok' || result.status === 'skip');
  return { results, compatVerdicts, allGreen };
}

function resolveCliPath(plugin: A4PHost, providerId: string): string | null {
  try {
    return plugin.providerHost.getResolvedProviderCliPath(providerId) ?? null;
  } catch {
    return null;
  }
}

function isCodexEnabled(plugin: A4PHost): boolean {
  const configs = plugin.settings.providerConfigs as
    | Record<string, { enabled?: boolean } | undefined>
    | undefined;
  return configs?.codex?.enabled === true;
}

function checkOs(): CheckResult {
  const label = Platform.isMacOS ? 'macOS' : process.platform === 'win32' ? 'Windows' : process.platform;
  return {
    id: 'os',
    status: 'ok',
    title: '운영체제',
    detail: `${label} (${os.release()})`,
    fixes: [],
  };
}

function checkClaudeCli(claudePath: string | null): CheckResult {
  if (claudePath) {
    return {
      id: 'claude-cli',
      status: 'ok',
      title: 'Claude 프로그램 (CLI)',
      detail: `설치 확인: ${claudePath}`,
      fixes: [],
    };
  }
  return {
    id: 'claude-cli',
    status: 'fail',
    title: 'Claude 프로그램 (CLI)',
    detail: 'Claude 프로그램을 찾지 못했어요. 아래 명령으로 설치해 주세요.',
    fixes: [
      { label: '설치 명령 복사', kind: 'copy', value: claudeInstallCommand() },
      { label: '', kind: 'note', value: terminalSteps() },
    ],
  };
}

function checkClaudeVersion(claudePath: string | null, version: string | null): CheckResult {
  if (!claudePath) {
    return { id: 'claude-version', status: 'skip', title: 'Claude 버전', detail: 'Claude 설치 후 확인할 수 있어요.', fixes: [] };
  }
  if (version) {
    return { id: 'claude-version', status: 'ok', title: 'Claude 버전', detail: `v${version}`, fixes: [] };
  }
  return {
    id: 'claude-version',
    status: 'warn',
    title: 'Claude 버전',
    detail: '버전을 확인하지 못했어요. Claude가 정상 설치됐는지 터미널에서 `claude --version`으로 확인해 주세요.',
    fixes: [{ label: '확인 명령 복사', kind: 'copy', value: 'claude --version' }],
  };
}

function checkNode(claudePath: string | null): CheckResult {
  if (!claudePath) {
    return { id: 'node', status: 'skip', title: 'Node.js', detail: 'Claude 설치 후 확인할 수 있어요.', fixes: [] };
  }
  if (!cliPathRequiresNode(claudePath)) {
    return {
      id: 'node',
      status: 'ok',
      title: 'Node.js',
      detail: 'Claude가 자체 실행 파일이라 Node.js가 없어도 돼요.',
      fixes: [],
    };
  }
  if (findNodeExecutable()) {
    return { id: 'node', status: 'ok', title: 'Node.js', detail: '설치 확인', fixes: [] };
  }
  return {
    id: 'node',
    status: 'fail',
    title: 'Node.js',
    detail: '지금 설치된 Claude는 Node.js가 필요한데 찾지 못했어요.',
    fixes: [
      { label: '다운로드 페이지 열기', kind: 'link', value: 'https://nodejs.org/ko' },
      { label: '', kind: 'note', value: 'LTS 버전을 설치한 뒤 옵시디언을 완전히 종료하고 다시 열어 주세요.' },
    ],
  };
}

function checkLogin(plugin: A4PHost): CheckResult {
  try {
    const envText = `${plugin.getActiveEnvironmentVariables('claude')}\n`;
    if (/(^|\n)\s*ANTHROPIC_API_KEY\s*=/.test(envText) || process.env.ANTHROPIC_API_KEY) {
      return { id: 'login', status: 'ok', title: '로그인 상태', detail: 'API 키를 사용 중이에요.', fixes: [] };
    }

    const configDir = resolveClaudeConfigDir();
    if (fs.existsSync(path.join(configDir, '.credentials.json'))) {
      return { id: 'login', status: 'ok', title: '로그인 상태', detail: '로그인돼 있어요.', fixes: [] };
    }

    for (const configFile of [path.join(configDir, '.claude.json'), path.join(os.homedir(), '.claude.json')]) {
      if (fs.existsSync(configFile)) {
        const content = fs.readFileSync(configFile, 'utf8');
        if (content.includes('"oauthAccount"')) {
          return { id: 'login', status: 'ok', title: '로그인 상태', detail: '로그인돼 있어요.', fixes: [] };
        }
      }
    }
  } catch {
    // heuristics only — fall through to warn
  }
  // macOS keeps OAuth in the Keychain, so absence of files is not conclusive → warn, never fail.
  return {
    id: 'login',
    status: 'warn',
    title: '로그인 상태',
    detail: '로그인이 확인되지 않아요. 터미널에서 `claude`를 한 번 실행해 로그인해 주세요. (이미 로그인하셨다면 무시해도 돼요)',
    fixes: [
      { label: '실행 명령 복사', kind: 'copy', value: 'claude' },
      { label: '', kind: 'note', value: terminalSteps() },
    ],
  };
}

function checkCodex(codexPath: string | null, version: string | null): CheckResult {
  if (!codexPath) {
    return {
      id: 'codex',
      status: 'skip',
      title: 'Codex (선택)',
      detail: '설치되어 있지 않아요. Codex는 선택 사항이에요.',
      fixes: [],
    };
  }
  return {
    id: 'codex',
    status: 'ok',
    title: 'Codex (선택)',
    detail: version ? `설치 확인 (v${version})` : `설치 확인: ${codexPath}`,
    fixes: [],
  };
}

function checkSkillsDirWritable(): CheckResult {
  try {
    const skillsDir = path.join(resolveClaudeConfigDir(), 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.accessSync(skillsDir, fs.constants.W_OK);
    return { id: 'skills-dir', status: 'ok', title: '스킬 폴더', detail: `쓰기 가능: ${skillsDir}`, fixes: [] };
  } catch {
    return {
      id: 'skills-dir',
      status: 'warn',
      title: '스킬 폴더',
      detail: '스킬 폴더에 쓸 수 없어요. 스킬 스토어 설치가 실패할 수 있어요.',
      fixes: [],
    };
  }
}

function checkCompat(verdicts: CompatVerdict[]): CheckResult {
  const problem = verdicts.find((verdict) => verdict.level !== 'ok');
  if (!problem) {
    return {
      id: 'compat',
      status: 'ok',
      title: '버전 호환성',
      detail: '검증된 버전 범위 안에 있어요.',
      fixes: [],
    };
  }
  const fixes: FixAction[] = [];
  if (problem.downgradeHint) {
    fixes.push({ label: '해결 명령 복사', kind: 'copy', value: problem.downgradeHint.replace(/^.*?:\s*/, '') });
    fixes.push({ label: '', kind: 'note', value: terminalSteps() });
  }
  if (problem.guideUrl) {
    fixes.push({ label: '안내 문서 열기', kind: 'link', value: problem.guideUrl });
  }
  return {
    id: 'compat',
    status: problem.level === 'untested-newer' ? 'warn' : 'fail',
    title: '버전 호환성',
    detail: problem.message || `검증되지 않은 버전이에요 (${problem.providerId} v${problem.cliVersion}).`,
    fixes,
  };
}
