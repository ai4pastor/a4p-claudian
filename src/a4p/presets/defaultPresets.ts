import type { A4PPreset } from '../types';

/**
 * Shipped workflow presets for pastors. Users can edit/reorder/delete these
 * in settings — the list below is only the starting point ("기본값 복원" target).
 */
export const DEFAULT_PRESETS: A4PPreset[] = [
  {
    id: 'bible-verse',
    label: '📖 성경 구절 찾기',
    kind: 'command',
    commandId: 'a4p-bible-verse:insert-bible-verse',
    submit: 'insert',
    showInWelcome: true,
  },
  {
    id: 'sermon-prep',
    label: '🎙️ 설교 준비 시작',
    kind: 'prompt',
    prompt:
      '이번 주 설교를 준비하려고 해요. 현재 노트 {{activeNote}}의 본문과 메모를 바탕으로 설교 개요(서론·본론·적용)를 만들어 주세요.',
    submit: 'insert',
    showInWelcome: true,
  },
  {
    id: 'sermon-import',
    label: '📥 설교문 가져오기',
    kind: 'prompt',
    prompt:
      '제 설교문 파일(한글/워드)을 옵시디언 노트로 가져오고 싶어요. 어떤 파일인지 물어봐 주시고, sermon-import 스킬로 진행해 주세요.',
    submit: 'insert',
    requiredSkill: 'sermon-import',
    showInWelcome: true,
  },
  {
    id: 'kids-sermon',
    label: '🧒 어린이 설교로 바꾸기',
    kind: 'prompt',
    prompt: '현재 노트 {{activeNote}}의 설교를 어린이 눈높이 설교로 바꿔 주세요.',
    submit: 'insert',
    requiredSkill: 'kids-sermon',
    showInWelcome: false,
  },
  {
    id: 'diagram',
    label: '🖼️ 도식으로 정리하기',
    kind: 'prompt',
    prompt: '현재 노트 {{activeNote}}의 내용을 한눈에 보이는 다이어그램(mermaid)으로 만들어 주세요.',
    submit: 'insert',
    showInWelcome: false,
  },
  {
    id: 'summarize',
    label: '📝 3줄 요약',
    kind: 'prompt',
    prompt: '다음 내용을 목회자가 참고하기 좋게 3줄로 요약해 주세요:\n\n{{selection}}',
    submit: 'auto',
    showInWelcome: false,
  },
  {
    id: 'note-tidy',
    label: '🗂️ 노트 다듬기',
    kind: 'prompt',
    prompt:
      '현재 노트 {{activeNote}}를 읽고 제목, 태그, 맨 위 3줄 요약을 정리해 주세요. 본문 내용은 바꾸지 말아 주세요.',
    submit: 'insert',
    showInWelcome: false,
  },
  {
    id: 'pastoral-visit',
    label: '🎧 심방 대시보드',
    kind: 'command',
    commandId: 'a4p-pastoral-visit:open-panel',
    submit: 'insert',
    showInWelcome: false,
  },
];
