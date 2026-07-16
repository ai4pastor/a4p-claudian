import type { TabData } from '../../features/chat/tabs/types';
import type { FeatureHost } from '../../features/FeatureHost';
import { t } from '../../i18n/i18n';
import type { TranslationKey } from '../../i18n/types';

/**
 * Simple mode only toggles the `.a4p-simple` class (chat) and hides settings
 * DOM (below) — no upstream setting value is ever mutated.
 */
export function applySimpleModeToTab(tab: TabData, enabled: boolean): void {
  tab.dom.contentEl.closest('.claudian-container')?.classList.toggle('a4p-simple', enabled);
}

export function applySimpleModeToOpenTabs(plugin: FeatureHost, enabled: boolean): void {
  for (const view of plugin.getAllViews()) {
    for (const tab of view.getTabManager()?.getAllTabs() ?? []) {
      applySimpleModeToTab(tab, enabled);
    }
  }
}

/** General-tab settings a pastor actually needs — everything else hides in simple mode. */
const GENERAL_TAB_KEEP_KEYS = [
  'settings.language.name',
  'settings.chatViewPlacement.name',
  'settings.autoTitle.name',
  'settings.userName.name',
] as const;

/**
 * Hides every general-tab item that is not on the keep list (headings too).
 * Matching uses upstream's own localized strings via t(), so it follows the
 * user's locale. Display-only: values are untouched.
 */
export function pruneGeneralTabForSimpleMode(container: HTMLElement): void {
  const keep = new Set(GENERAL_TAB_KEEP_KEYS.map((key) => t(key as TranslationKey)));

  for (const child of Array.from(container.children)) {
    const el = child as HTMLElement;
    const name = el.querySelector(':scope > .setting-item-info > .setting-item-name')?.textContent ?? '';
    const isKeptSetting =
      el.classList.contains('setting-item')
      && !el.classList.contains('setting-item-heading')
      && keep.has(name);
    if (!isKeptSetting) el.addClass('claudian-hidden');
  }

  container.createDiv({
    cls: 'a4p-settings-note',
    text: '🔧 더 많은 설정은 간편 모드를 끄면 보여요. (🍞 AI4Pastor 탭)',
  });
}
