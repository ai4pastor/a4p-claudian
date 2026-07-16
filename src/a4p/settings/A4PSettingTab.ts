import { Setting } from 'obsidian';

import { ProviderRegistry } from '../../core/providers/ProviderRegistry';
import { ClaudianSettingTab } from '../../features/settings/ClaudianSettings';
import { A4P_HIDDEN_PROVIDER_IDS } from '../config';
import type { A4PHost } from '../context';
import { getA4PStore } from '../context';
import { DiagnosticsModal } from '../diagnostics/DiagnosticsModal';
import { PresetEditModal } from '../presets/PresetEditModal';
import { PresetManager } from '../presets/PresetManager';
import { applySimpleModeToOpenTabs, pruneGeneralTabForSimpleMode } from '../simplemode/simpleMode';
import { SkillStoreModal } from '../skillstore/SkillStoreModal';
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
  /** Keeps the AI4Pastor tab selected across display() re-renders. */
  private a4pTabActive = false;

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
    const simpleMode = getA4PStore()?.get().simpleMode ?? true;

    tabIds.forEach((id, index) => {
      const hideAlways = A4P_HIDDEN_PROVIDER_IDS.has(id);
      const hideInSimpleMode = simpleMode && id !== 'general';
      if (hideAlways || hideInSimpleMode) {
        upstreamButtons[index]?.addClass('claudian-hidden');
        upstreamContents[index]?.addClass('claudian-hidden');
      }
    });

    if (simpleMode && upstreamContents[0]) {
      pruneGeneralTabForSimpleMode(upstreamContents[0]);
    }

    const a4pButton = tabBar.createEl('button', {
      cls: 'claudian-settings-tab',
      text: a4pT('settings.tab'),
    });
    const a4pContent = containerEl.createDiv({ cls: 'claudian-settings-tab-content' });

    const activateA4PTab = (): void => {
      for (const button of upstreamButtons) button.removeClass('claudian-settings-tab--active');
      for (const content of upstreamContents) content.removeClass('claudian-settings-tab-content--active');
      a4pButton.addClass('claudian-settings-tab--active');
      a4pContent.addClass('claudian-settings-tab-content--active');
      this.a4pTabActive = true;
    };
    a4pButton.addEventListener('click', activateA4PTab);
    tabBar.addEventListener('click', (event) => {
      if (event.target !== a4pButton) {
        a4pButton.removeClass('claudian-settings-tab--active');
        a4pContent.removeClass('claudian-settings-tab-content--active');
        this.a4pTabActive = false;
      }
    });

    this.renderA4PTab(a4pContent);
    if (this.a4pTabActive) activateA4PTab();
  }

  private renderA4PTab(container: HTMLElement): void {
    new Setting(container).setName(a4pT('settings.heading')).setHeading();

    new Setting(container)
      .setName('🛍️ 스킬 스토어')
      .setDesc('터미널 없이 스킬을 설치·업데이트·제거할 수 있어요.')
      .addButton((button) => {
        button.setButtonText('스토어 열기').setCta().onClick(() => {
          new SkillStoreModal(this.app, this.plugin as A4PHost).open();
        });
      });

    new Setting(container)
      .setName('🩺 환경 진단')
      .setDesc('Claude 설치·로그인·버전 호환성을 점검하고 해결 방법을 안내해 드려요.')
      .addButton((button) => {
        button.setButtonText('진단 열기').onClick(() => {
          new DiagnosticsModal(this.app, this.plugin as A4PHost, {}).open();
        });
      });

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
            this.display();
          });
      });

    this.renderPresetSection(container);

    container.createDiv({ cls: 'a4p-settings-info', text: a4pT('settings.about') });
  }

  private renderPresetSection(container: HTMLElement): void {
    new Setting(container).setName('⚡ 빠른 실행 버튼').setHeading();
    container.createDiv({
      cls: 'a4p-settings-note',
      text: '채팅 입력창 위에 표시되는 버튼이에요. 순서를 바꾸거나 나만의 버튼을 만들 수 있어요.',
    });

    const manager = new PresetManager(this.plugin as A4PHost);
    const listEl = container.createDiv({ cls: 'a4p-preset-list' });

    const rerender = (): void => {
      listEl.empty();
      const presets = manager.getPresets();

      presets.forEach((preset, index) => {
        const row = new Setting(listEl).setName(preset.label);
        row.setDesc(preset.kind === 'command' ? `명령: ${preset.commandId ?? ''}` : '프롬프트');
        row.addExtraButton((button) => {
          button.setIcon('arrow-up').setTooltip('위로').setDisabled(index === 0);
          button.onClick(async () => {
            const next = [...presets];
            [next[index - 1], next[index]] = [next[index], next[index - 1]];
            await manager.savePresets(next);
            rerender();
          });
        });
        row.addExtraButton((button) => {
          button.setIcon('arrow-down').setTooltip('아래로').setDisabled(index === presets.length - 1);
          button.onClick(async () => {
            const next = [...presets];
            [next[index], next[index + 1]] = [next[index + 1], next[index]];
            await manager.savePresets(next);
            rerender();
          });
        });
        row.addExtraButton((button) => {
          button.setIcon('pencil').setTooltip('수정');
          button.onClick(() => {
            new PresetEditModal(this.app, manager, preset, (updated) => {
              void (async () => {
                const next = presets.map((entry) => (entry.id === updated.id ? updated : entry));
                await manager.savePresets(next);
                rerender();
              })();
            }).open();
          });
        });
        row.addExtraButton((button) => {
          button.setIcon('trash').setTooltip('삭제');
          button.onClick(async () => {
            await manager.savePresets(presets.filter((entry) => entry.id !== preset.id));
            rerender();
          });
        });
      });

      new Setting(listEl)
        .addButton((button) => {
          button.setButtonText('＋ 새 버튼').setCta().onClick(() => {
            new PresetEditModal(this.app, manager, null, (created) => {
              void (async () => {
                await manager.savePresets([...manager.getPresets(), created]);
                rerender();
              })();
            }).open();
          });
        })
        .addButton((button) => {
          button.setButtonText('기본값 복원').onClick(async () => {
            await manager.restoreDefaults();
            rerender();
          });
        });
    };

    rerender();
  }
}
