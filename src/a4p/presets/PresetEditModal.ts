import type { App } from 'obsidian';
import { Modal, Notice, Setting } from 'obsidian';

import { getA4PStore } from '../context';
import type { SkillRegistry } from '../skillstore/types';
import type { A4PPreset } from '../types';
import type { PresetManager } from './PresetManager';

/** Add/edit dialog for a workflow preset. */
export class PresetEditModal extends Modal {
  private readonly manager: PresetManager;
  private readonly original: A4PPreset | null;
  private readonly onSave: (preset: A4PPreset) => void;
  private draft: A4PPreset;

  constructor(
    app: App,
    manager: PresetManager,
    preset: A4PPreset | null,
    onSave: (preset: A4PPreset) => void,
  ) {
    super(app);
    this.manager = manager;
    this.original = preset;
    this.onSave = onSave;
    this.draft = preset
      ? { ...preset }
      : {
          id: `preset-${Date.now()}`,
          label: '',
          kind: 'prompt',
          prompt: '',
          submit: 'insert',
          showInWelcome: false,
        };
  }

  onOpen(): void {
    this.titleEl.setText(this.original ? '버튼 수정' : '새 버튼 만들기');
    this.render();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    new Setting(contentEl)
      .setName('버튼 이름')
      .setDesc('이모지를 함께 쓰면 찾기 쉬워요. 예: 📖 성경 구절 찾기')
      .addText((text) => {
        text.setValue(this.draft.label).onChange((value) => {
          this.draft.label = value;
        });
        text.inputEl.style.width = '100%';
      });

    new Setting(contentEl)
      .setName('동작 방식')
      .addDropdown((dropdown) => {
        dropdown
          .addOption('prompt', '프롬프트 (AI에게 요청)')
          .addOption('command', '플러그인 명령 실행')
          .setValue(this.draft.kind)
          .onChange((value) => {
            this.draft.kind = value as A4PPreset['kind'];
            this.render();
          });
      });

    if (this.draft.kind === 'prompt') {
      new Setting(contentEl)
        .setName('프롬프트')
        .setDesc('{{activeNote}} = 현재 노트, {{selection}} = 선택한 텍스트')
        .addTextArea((textarea) => {
          textarea.setValue(this.draft.prompt ?? '').onChange((value) => {
            this.draft.prompt = value;
          });
          textarea.inputEl.rows = 5;
          textarea.inputEl.style.width = '100%';
        });

      new Setting(contentEl)
        .setName('보내기 방식')
        .addDropdown((dropdown) => {
          dropdown
            .addOption('insert', '입력창에 넣기 (내가 확인 후 전송)')
            .addOption('auto', '바로 보내기')
            .setValue(this.draft.submit)
            .onChange((value) => {
              this.draft.submit = value as A4PPreset['submit'];
            });
        });

      new Setting(contentEl)
        .setName('필요한 스킬 (선택)')
        .setDesc('스토어 스킬이 설치돼 있어야 작동하는 버튼이라면 선택해 주세요.')
        .addDropdown((dropdown) => {
          dropdown.addOption('', '없음');
          const cache = getA4PStore()?.get().registryCache?.data as SkillRegistry | undefined;
          for (const skill of cache?.skills ?? []) {
            dropdown.addOption(skill.id, `${skill.name} (${skill.id})`);
          }
          const current = this.draft.requiredSkill ?? '';
          if (current && !(cache?.skills ?? []).some((skill) => skill.id === current)) {
            dropdown.addOption(current, current);
          }
          dropdown.setValue(current).onChange((value) => {
            this.draft.requiredSkill = value || undefined;
          });
        });
    } else {
      new Setting(contentEl)
        .setName('실행할 명령')
        .setDesc('설치된 A4P 플러그인의 명령 중에서 고르거나, 아래에 명령 ID를 직접 입력하세요.')
        .addDropdown((dropdown) => {
          dropdown.addOption('', '직접 입력');
          for (const command of this.manager.listA4PCommands()) {
            dropdown.addOption(command.id, command.name);
          }
          const current = this.draft.commandId ?? '';
          const known = this.manager.listA4PCommands().some((command) => command.id === current);
          if (current && !known) dropdown.addOption(current, current);
          dropdown.setValue(current).onChange((value) => {
            if (value) this.draft.commandId = value;
            this.render();
          });
        });

      new Setting(contentEl)
        .setName('명령 ID 직접 입력')
        .addText((text) => {
          text
            .setPlaceholder('예: a4p-bible-verse:insert-bible-verse')
            .setValue(this.draft.commandId ?? '')
            .onChange((value) => {
              this.draft.commandId = value.trim() || undefined;
            });
          text.inputEl.style.width = '100%';
        });
    }

    new Setting(contentEl)
      .setName('새 채팅 화면에도 크게 보여주기')
      .addToggle((toggle) => {
        toggle.setValue(this.draft.showInWelcome).onChange((value) => {
          this.draft.showInWelcome = value;
        });
      });

    new Setting(contentEl)
      .addButton((button) => {
        button.setButtonText('취소').onClick(() => this.close());
      })
      .addButton((button) => {
        button.setButtonText('저장').setCta().onClick(() => this.save());
      });
  }

  private save(): void {
    if (!this.draft.label.trim()) {
      new Notice('버튼 이름을 입력해 주세요.');
      return;
    }
    if (this.draft.kind === 'prompt' && !(this.draft.prompt ?? '').trim()) {
      new Notice('프롬프트를 입력해 주세요.');
      return;
    }
    if (this.draft.kind === 'command' && !this.draft.commandId) {
      new Notice('실행할 명령을 선택하거나 입력해 주세요.');
      return;
    }
    this.onSave(this.draft);
    this.close();
  }
}
