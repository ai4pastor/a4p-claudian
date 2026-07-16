/**
 * Korean dictionary for upstream's hardcoded-English notices.
 *
 * Kept as data (not upstream edits) so merges stay clean; unmatched notices
 * pass through in English (fail-open). After each upstream merge, diff
 * `grep -rn "new Notice(" src` against this file and top up.
 */

/** Exact-match translations (keyed by trimmed notice text). */
export const NOTICE_EXACT: Record<string, string> = {
  // editing / composer
  'Inserted': '삽입했어요.',
  'Edit applied': '수정을 적용했어요.',
  'Inline edit unavailable: could not access the active Markdown view.':
    '인라인 편집을 쓸 수 없어요. 노트를 먼저 열어 주세요.',
  'Inline edit unavailable: could not access the active editor. Try reopening the note.':
    '인라인 편집을 쓸 수 없어요. 노트를 다시 열어 주세요.',
  'Inline edit was not applied because the source document or selection changed.':
    '문서나 선택 영역이 바뀌어 인라인 편집을 적용하지 않았어요.',
  'Clipboard is empty': '클립보드가 비어 있어요.',
  'Failed to read clipboard': '클립보드를 읽지 못했어요.',
  'Please enter a command': '명령을 입력해 주세요.',

  // tabs / conversations
  'Failed to create tab': '새 탭을 만들지 못했어요.',
  'Failed to close tab': '탭을 닫지 못했어요.',
  'Failed to switch tab': '탭 전환에 실패했어요.',
  'Failed to save tab layout': '탭 배치를 저장하지 못했어요.',
  'Failed to create conversation': '새 대화를 만들지 못했어요.',
  'Failed to rename conversation': '대화 이름을 바꾸지 못했어요.',
  'No conversations to resume': '이어서 할 대화가 없어요.',
  'Cannot switch provider on a bound session. Start a new tab instead.':
    '진행 중인 대화에서는 AI를 바꿀 수 없어요. 새 탭에서 시작해 주세요.',

  // providers / features
  'Fork is not supported by this provider.': '이 AI에서는 대화 나누기(포크)를 지원하지 않아요.',
  'Fork not available.': '대화 나누기(포크)를 사용할 수 없어요.',
  'Image attachments are not supported by this provider.': '이 AI에서는 이미지 첨부를 지원하지 않아요.',
  'Agent service not available. Please reload the plugin.':
    'AI 연결이 준비되지 않았어요. 플러그인을 다시 켜 주세요.',
  'Failed to initialize agent service. Please try again.':
    'AI 연결을 시작하지 못했어요. 다시 시도해 주세요.',
  'Background task completed, but the result could not be rendered.':
    '백그라운드 작업은 끝났지만 결과를 표시하지 못했어요.',
  'Failed to load vault files. Vault @-mentions may be unavailable.':
    '볼트 파일 목록을 읽지 못했어요. @멘션이 잠시 안 될 수 있어요.',
  'Failed to attach file: invalid path': '파일을 첨부하지 못했어요 (잘못된 경로).',
  'External context selector not available.': '외부 폴더 선택기를 사용할 수 없어요.',
  'Setting saved but reload failed. Changes will apply on next session.':
    '설정은 저장됐지만 즉시 적용에 실패했어요. 다음 세션부터 적용돼요.',
  'Plugin toggled, but some tabs failed to restart.':
    '적용됐지만 일부 탭을 다시 시작하지 못했어요. 해당 탭에서 새 대화를 시작해 주세요.',

  // instruction / snippets / mcp (advanced but short)
  'Instruction added to custom system prompt': '지침을 시스템 프롬프트에 추가했어요.',
  'No instruction received': '받은 지침이 없어요.',
  'Prompt is required': '프롬프트를 입력해 주세요.',
  'Prompt template is required': '프롬프트 템플릿을 입력해 주세요.',
  'Description is required': '설명을 입력해 주세요.',
  'Please enter a server name': '서버 이름을 입력해 주세요.',
  'Please enter a URL': '주소(URL)를 입력해 주세요.',
  'Enter a name for the server': '서버 이름을 입력해 주세요.',
  'No valid mcp configuration found in clipboard': '클립보드에서 올바른 MCP 설정을 찾지 못했어요.',
  'No new mcp servers imported': '새로 가져온 MCP 서버가 없어요.',
  'Plugin list refreshed': '플러그인 목록을 새로고침했어요.',
};

export interface NoticePattern {
  pattern: RegExp;
  /** $1, $2… backrefs from the pattern are substituted. */
  replacement: string;
}

/** Template translations for interpolated notices. */
export const NOTICE_PATTERNS: NoticePattern[] = [
  { pattern: /^Maximum (\d+) tabs allowed$/, replacement: '탭은 최대 $1개까지 열 수 있어요.' },
  { pattern: /^Failed to open conversation: ([\s\S]+)$/, replacement: '대화를 열지 못했어요: $1' },
  { pattern: /^Failed to open file: ([\s\S]+)$/, replacement: '파일을 열지 못했어요: $1' },
  { pattern: /^Could not open file: ([\s\S]+)$/, replacement: '파일을 열지 못했어요: $1' },
  { pattern: /^Command failed: ([\s\S]+)$/, replacement: '명령 실행에 실패했어요: $1' },
  { pattern: /^Error: ([\s\S]+)$/, replacement: '오류가 생겼어요: $1' },
  { pattern: /^Failed to save ([\s\S]+)$/, replacement: '저장하지 못했어요: $1' },
  { pattern: /^Failed to delete ([\s\S]+)$/, replacement: '삭제하지 못했어요: $1' },
  {
    pattern: /^Environment changes applied, but (\d+) affected tab\(s\) failed to restart\.$/,
    replacement: '환경 변경은 적용됐지만 탭 $1개를 다시 시작하지 못했어요.',
  },
  {
    pattern: /^Removed (\d+) invalid external context path\(s\): ([\s\S]+)$/,
    replacement: '유효하지 않은 외부 폴더 $1개를 정리했어요: $2',
  },
];

export function translateNotice(text: string): string | null {
  const trimmed = text.trim();
  const exact = NOTICE_EXACT[trimmed];
  if (exact) return exact;
  for (const { pattern, replacement } of NOTICE_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match) {
      return trimmed.replace(pattern, replacement);
    }
  }
  return null;
}
