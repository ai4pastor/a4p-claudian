import { Setting } from 'obsidian';

import { ProviderRegistry } from '../../core/providers/ProviderRegistry';
import { ClaudianSettingTab } from '../../features/settings/ClaudianSettings';
import { A4P_HIDDEN_PROVIDER_IDS } from '../config';
import { getA4PStore } from '../index';
import { applySimpleModeToOpenTabs } from '../simplemode/simpleMode';
import { a4pT } from '../strings';

/**
 * Settings tab for the fork: renders upstream settings unchanged, then
 * (a) hides the tabs of providers pastors never use and
 * (b) appends the "🍞 AI4Pastor" tab.
 *
 * Everything is DOM-level post-processing of super.display() so upstream
 * settings code stays untouched. Fail-open: if the upstream DOM contract
 * changes, the worst case is an extra visible tab, never breakage.
 */
export class A4PSettingTab extends ClaudianSettingTab {
  display(): void {
    super.display();
    try {
      this.applyA4PChrome();
    } catch (error) {
      console.error('[a4p] settings chrome failed — falling back to upstream UI', error);
    }
  }

  private applyA4PChrome(): void {
    const { containerEl } = this;
    const tabBar = containerEl.querySelector<HTMLElement>(':scope > .claudian-settings-tabs');
    if (!tabBar) return;

    // Upstream creates buttons/contents in ['general', ...providers] order —
    // match by index, not label, so localization never breaks the mapping.
    const upstreamButtons = Array.from(
      tabBar.querySelectorAll<HTMLButtonElement>('button.claudian-settings-tab'),
    );
    const upstreamContents = Array.from(
      containerEl.querySelectorAll<HTMLElement>(':scope > .claudian-settings-tab-content'),
    );
    const tabIds = ['general', ...ProviderRegistry.getRegisteredProviderIds()];

    tabIds.forEach((id, index) => {
      if (A4P_HIDDEN_PROVIDER_IDS.has(id)) {
        upstreamButtons[index]?.addClass('claudian-hidden');
        upstreamContents[index]?.addClass('claudian-hidden');
      }
    });

    const a4pButton = tabBar.createEl('button', {
      cls: 'claudian-settings-tab',
      text: a4pT('settings.tab'),
    });
    const a4pContent = containerEl.createDiv({ cls: 'claudian-settings-tab-content' });

    a4pButton.addEventListener('click', () => {
      for (const button of upstreamButtons) button.removeClass('claudian-settings-tab--active');
      for (const content of upstreamContents) content.removeClass('claudian-settings-tab-content--active');
      a4pButton.addClass('claudian-settings-tab--active');
      a4pContent.addClass('claudian-settings-tab-content--active');
    });
    tabBar.addEventListener('click', (event) => {
      if (event.target !== a4pButton) {
        a4pButton.removeClass('claudian-settings-tab--active');
        a4pContent.removeClass('claudian-settings-tab-content--active');
      }
    });

    this.renderA4PTab(a4pContent);
  }

  private renderA4PTab(container: HTMLElement): void {
    new Setting(container).setName(a4pT('settings.heading')).setHeading();

    new Setting(container)
      .setName(a4pT('settings.simpleMode.name'))
      .setDesc(a4pT('settings.simpleMode.desc'))
      .addToggle((toggle) => {
        toggle
          .setValue(getA4PStore()?.get().simpleMode ?? true)
          .onChange(async (value) => {
            await getA4PStore()?.update((data) => {
              data.simpleMode = value;
            });
            applySimpleModeToOpenTabs(this.plugin, value);
          });
      });

    container.createDiv({ cls: 'a4p-settings-info', text: a4pT('settings.about') });
  }
}
