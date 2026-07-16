/**
 * A4P layer strings — Korean only by product decision.
 *
 * Deliberately NOT wired into upstream i18n: TranslationKey is type-derived
 * from en.json, so adding keys there would touch all 10 locale files and
 * create a permanent merge hazard.
 */

const STRINGS = {
  'settings.tab': '🍞 AI4Pastor',
  'settings.heading': '🍞 AI4Pastor 설정',
  'settings.simpleMode.name': '🌱 간편 모드',
  'settings.simpleMode.desc': '목회에 필요한 것만 보여 드려요. 끄면 모든 고급 설정이 표시됩니다.',
  'settings.about': 'A4P Claudian은 yishentu/claudian의 포크로, AI4Pastor 수강생을 위해 관리됩니다. 문의: ai4pastor.com',
  'warn.upstreamEnabled':
    '⚠️ 원본 Claudian 플러그인이 함께 켜져 있어요. 충돌을 막으려면 커뮤니티 플러그인 설정에서 Claudian을 꺼 주세요.',
} as const;

export type A4PStringKey = keyof typeof STRINGS;

/** Returns the Korean string for a key, interpolating {name} params. */
export function a4pT(key: A4PStringKey, params?: Record<string, string | number>): string {
  let text: string = STRINGS[key];
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}
