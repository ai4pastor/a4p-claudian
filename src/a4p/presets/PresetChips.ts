import type { TabData } from '../../features/chat/tabs/types';
import { getA4PStore } from '../context';
import type { PresetManager } from './PresetManager';

const CHIPS_CLASS = 'a4p-chips';

/**
 * Renders the preset chip row directly above the composer of a tab, and the
 * large welcome-screen buttons. Re-renders whenever a4p.json changes.
 */
export function attachPresetChips(manager: PresetManager, tab: TabData): void {
  if (tab.dom.inputComposerEl.querySelector(`:scope > .${CHIPS_CLASS}`)) return;

  const chipsEl = createDiv({ cls: CHIPS_CLASS });
  tab.dom.inputComposerEl.prepend(chipsEl);
  renderChips(manager, tab, chipsEl);
  renderWelcomeButtons(manager, tab);

  const unsubscribe = getA4PStore()?.onChange(() => {
    if (!chipsEl.isConnected) return;
    renderChips(manager, tab, chipsEl);
    renderWelcomeButtons(manager, tab);
  });
  if (unsubscribe) tab.dom.eventCleanups.push(unsubscribe);
}

function renderChips(manager: PresetManager, tab: TabData, chipsEl: HTMLElement): void {
  chipsEl.empty();
  for (const preset of manager.getPresets()) {
    const locked = manager.isSkillMissing(preset);
    const chip = chipsEl.createEl('button', {
      cls: `a4p-chip${locked ? ' a4p-chip--locked' : ''}`,
      text: locked ? `🔒 ${preset.label}` : preset.label,
    });
    if (locked) {
      chip.setAttribute('aria-label', '필요한 스킬을 설치하면 사용할 수 있어요');
    }
    chip.addEventListener('click', () => void manager.run(preset, tab));
  }
}

function renderWelcomeButtons(manager: PresetManager, tab: TabData): void {
  const welcomeEl = tab.dom.welcomeEl;
  if (!welcomeEl || !welcomeEl.isConnected) return;
  const actions = welcomeEl.querySelector<HTMLElement>(':scope > .a4p-welcome-actions');
  if (!actions) return;

  actions.querySelectorAll(':scope > .a4p-welcome-preset').forEach((el) => el.remove());
  for (const preset of manager.getPresets()) {
    if (!preset.showInWelcome) continue;
    const button = actions.createEl('button', {
      cls: 'a4p-welcome-button a4p-welcome-preset',
      text: preset.label,
    });
    button.addEventListener('click', () => void manager.run(preset, tab));
  }
}
