import type { TabData } from '../../features/chat/tabs/types';
import { getA4PStore } from '../context';
import type { CompatVerdict } from './CompatGuard';

const BANNER_CLASS = 'a4p-compat-banner';

/**
 * Mounts (or removes) the compat warning banner at the top of a tab's chat
 * container. Dismissal is remembered per (provider, cliVersion, level) in
 * a4p.json so a genuinely new situation shows a new banner.
 */
export function syncCompatBanner(tab: TabData, verdicts: CompatVerdict[]): void {
  const container = tab.dom.contentEl.closest('.claudian-container');
  if (!container) return;

  const existing = container.querySelector(`:scope > .${BANNER_CLASS}`);
  const store = getA4PStore();
  const dismissed = new Set(store?.get().dismissedBanners ?? []);
  const problem = verdicts.find(
    (verdict) => verdict.level !== 'ok' && !dismissed.has(verdict.dismissKey),
  );

  if (!problem) {
    existing?.remove();
    return;
  }
  if (existing?.getAttribute('data-a4p-dismiss-key') === problem.dismissKey) {
    return;
  }
  existing?.remove();

  const banner = createDiv({ cls: `${BANNER_CLASS} ${BANNER_CLASS}--${problem.level}` });
  banner.setAttribute('data-a4p-dismiss-key', problem.dismissKey);
  banner.createSpan({ cls: `${BANNER_CLASS}-text`, text: `⚠️ ${problem.message}` });

  if (problem.downgradeHint) {
    banner.createDiv({ cls: `${BANNER_CLASS}-hint`, text: problem.downgradeHint });
  }

  const closeButton = banner.createEl('button', { cls: `${BANNER_CLASS}-close`, text: '닫기' });
  closeButton.addEventListener('click', () => {
    banner.remove();
    void store?.update((data) => {
      if (!data.dismissedBanners.includes(problem.dismissKey)) {
        data.dismissedBanners.push(problem.dismissKey);
      }
    });
  });

  container.prepend(banner);
}
