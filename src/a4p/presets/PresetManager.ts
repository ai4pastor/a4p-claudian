import { Notice } from 'obsidian';

import type { TabData } from '../../features/chat/tabs/types';
import { confirm } from '../../shared/modals/ConfirmModal';
import type { A4PHost } from '../context';
import { getA4PStore } from '../context';
import { scanInstalledSkills } from '../skillstore/InstalledSkillScanner';
import { RegistryClient } from '../skillstore/RegistryClient';
import { installSkill } from '../skillstore/SkillInstaller';
import type { A4PPreset } from '../types';
import { DEFAULT_PRESETS } from './defaultPresets';

type CommandRunner = {
  commands?: { executeCommandById?: (id: string) => boolean; listCommands?: () => Array<{ id: string; name: string }> };
};

/**
 * Workflow presets: Korean quick-action chips that either prefill/send a
 * prompt (with {{activeNote}}/{{selection}} placeholders) or run another
 * a4p plugin's command.
 */
export class PresetManager {
  constructor(private readonly plugin: A4PHost) {}

  /** Defaults stay virtual until the user edits — "기본값 복원" = save []. */
  getPresets(): A4PPreset[] {
    const stored = getA4PStore()?.get().presets ?? [];
    return stored.length > 0 ? stored : DEFAULT_PRESETS.map((preset) => ({ ...preset }));
  }

  async savePresets(presets: A4PPreset[]): Promise<void> {
    await getA4PStore()?.update((data) => {
      data.presets = presets;
    });
  }

  async restoreDefaults(): Promise<void> {
    await this.savePresets([]);
  }

  isSkillMissing(preset: A4PPreset): boolean {
    if (!preset.requiredSkill) return false;
    return !scanInstalledSkills().has(preset.requiredSkill.normalize('NFC'));
  }

  async run(preset: A4PPreset, tab: TabData | null): Promise<void> {
    try {
      if (preset.kind === 'command') {
        this.runCommand(preset);
        return;
      }
      if (preset.requiredSkill && this.isSkillMissing(preset)) {
        const installed = await this.offerSkillInstall(preset.requiredSkill);
        if (!installed) return;
      }
      const content = this.resolvePrompt(preset.prompt ?? '');
      if (content === null) return;
      await this.deliver(content, preset.submit, tab);
    } catch (error) {
      console.error('[a4p] preset run failed', error);
      new Notice('실행 중 문제가 생겼어요. 다시 시도해 주세요.');
    }
  }

  private runCommand(preset: A4PPreset): void {
    const commandId = preset.commandId;
    if (!commandId) return;
    const runner = this.plugin.app as unknown as CommandRunner;
    const executed = runner.commands?.executeCommandById?.(commandId) ?? false;
    if (!executed) {
      new Notice('이 기능에 필요한 플러그인이 아직 설치되지 않았거나 사용할 수 없어요.');
    }
  }

  private async offerSkillInstall(skillId: string): Promise<boolean> {
    const client = new RegistryClient();
    const result = await client.getRegistry();
    const skill = result?.registry.skills.find((entry) => entry.id === skillId);
    if (!skill) {
      new Notice(`'${skillId}' 스킬이 아직 스토어에 준비되지 않았어요. 강사에게 문의해 주세요.`);
      return false;
    }
    const approved = await confirm(
      this.plugin.app,
      `이 버튼에는 '${skill.name}' 스킬이 필요해요. 지금 설치할까요? (약 10초)`,
      '설치',
    );
    if (!approved) return false;
    try {
      await installSkill(client, skill);
      new Notice(`✅ '${skill.name}' 스킬을 설치했어요.`);
      return true;
    } catch (error) {
      console.error('[a4p] preset skill install failed', error);
      new Notice(`설치에 실패했어요: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /** Returns null (with a Korean notice) when required context is missing. */
  resolvePrompt(template: string): string | null {
    let resolved = template;

    if (resolved.includes('{{activeNote}}')) {
      const file = this.plugin.app.workspace.getActiveFile();
      if (!file) {
        new Notice('먼저 노트를 열어 주세요 📄');
        return null;
      }
      resolved = resolved.split('{{activeNote}}').join(`[[${file.path}]]`);
    }

    if (resolved.includes('{{selection}}')) {
      const selection = this.plugin.app.workspace.activeEditor?.editor?.getSelection() ?? '';
      if (!selection.trim()) {
        new Notice('먼저 텍스트를 드래그해서 선택해 주세요 ✍️');
        return null;
      }
      resolved = resolved.split('{{selection}}').join(selection);
    }

    return resolved;
  }

  private async deliver(content: string, submit: A4PPreset['submit'], tab: TabData | null): Promise<void> {
    const targetTab = tab ?? this.plugin.getView()?.getActiveTab() ?? null;
    if (!targetTab) {
      new Notice('채팅 화면을 먼저 열어 주세요.');
      return;
    }
    if (submit === 'auto' && targetTab.controllers.inputController) {
      await targetTab.controllers.inputController.sendMessage({ content });
      return;
    }
    targetTab.dom.inputEl.value = content;
    targetTab.dom.inputEl.dispatchEvent(new Event('input'));
    targetTab.dom.inputEl.focus();
  }

  listA4PCommands(): Array<{ id: string; name: string }> {
    const runner = this.plugin.app as unknown as CommandRunner;
    const all = runner.commands?.listCommands?.() ?? [];
    return all.filter((command) => command.id.startsWith('a4p-'));
  }
}
