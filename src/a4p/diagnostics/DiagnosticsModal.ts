import type { App } from 'obsidian';
import { Modal, Notice, Setting } from 'obsidian';

import type { A4PHost } from '../context';
import { getA4PStore } from '../context';
import type { CheckResult } from './checks';
import { runDiagnostics } from './checks';

const STATUS_ICON: Record<CheckResult['status'], string> = {
  ok: '✅',
  warn: '⚠️',
  fail: '❌',
  skip: '➖',
};

/**
 * 환경 진단 modal — every row gets a Korean explanation and, when something
 * is wrong, a concrete fix action (copy command / open guide / step note).
 */
export class DiagnosticsModal extends Modal {
  private readonly plugin: A4PHost;
  private readonly onboarding: boolean;
  private running = false;

  constructor(app: App, plugin: A4PHost, options?: { onboarding?: boolean }) {
    super(app);
    this.plugin = plugin;
    this.onboarding = options?.onboarding ?? false;
  }

  onOpen(): void {
    this.modalEl.addClass('a4p-diag-modal');
    this.titleEl.setText('🩺 환경 진단');
    void this.runAndRender();
  }

  private async runAndRender(): Promise<void> {
    if (this.running) return;
    this.running = true;

    const { contentEl } = this;
    contentEl.empty();
    contentEl.createDiv({ cls: 'a4p-diag-loading', text: '점검하는 중이에요…' });

    try {
      const report = await runDiagnostics(this.plugin);
      contentEl.empty();

      for (const result of report.results) {
        this.renderRow(contentEl, result);
      }

      const footer = contentEl.createDiv({ cls: 'a4p-diag-footer' });
      if (report.allGreen) {
        footer.createDiv({ cls: 'a4p-diag-summary a4p-diag-summary--ok', text: '모두 정상이에요! 🎉' });
        await getA4PStore()?.update((data) => {
          if (!data.onboarding.diagnosticsPassedAt) {
            data.onboarding.diagnosticsPassedAt = Date.now();
          }
        });
      } else {
        footer.createDiv({
          cls: 'a4p-diag-summary',
          text: '표시된 항목을 해결한 뒤 "다시 검사"를 눌러 주세요.',
        });
      }

      const buttonRow = new Setting(footer);
      buttonRow.addButton((button) => {
        button.setButtonText('다시 검사').setCta().onClick(() => void this.runAndRender());
      });

      if (this.onboarding && !report.allGreen) {
        buttonRow.addExtraButton((button) => {
          button.setIcon('eye-off').setTooltip('다시 보지 않기 (진단은 명령어로 언제든 열 수 있어요)');
          button.onClick(async () => {
            await getA4PStore()?.update((data) => {
              data.onboarding.dismissed = true;
            });
            new Notice('알겠어요. 필요할 때 명령어 팔레트에서 "환경 진단"을 열어 주세요.');
            this.close();
          });
        });
      }
    } catch (error) {
      console.error('[a4p] diagnostics failed', error);
      contentEl.empty();
      contentEl.createDiv({ cls: 'a4p-diag-loading', text: '진단 중 문제가 생겼어요. 다시 시도해 주세요.' });
    } finally {
      this.running = false;
    }
  }

  private renderRow(container: HTMLElement, result: CheckResult): void {
    const row = container.createDiv({ cls: `a4p-diag-row a4p-diag-row--${result.status}` });
    const head = row.createDiv({ cls: 'a4p-diag-row-head' });
    head.createSpan({ cls: 'a4p-diag-icon', text: STATUS_ICON[result.status] });
    head.createSpan({ cls: 'a4p-diag-title', text: result.title });
    row.createDiv({ cls: 'a4p-diag-detail', text: result.detail });

    if (result.fixes.length === 0) return;
    const fixRow = row.createDiv({ cls: 'a4p-diag-fixes' });
    for (const fix of result.fixes) {
      if (fix.kind === 'note') {
        fixRow.createDiv({ cls: 'a4p-diag-note', text: fix.value });
        continue;
      }
      const button = fixRow.createEl('button', { cls: 'a4p-diag-fix-button', text: fix.label });
      button.addEventListener('click', () => {
        if (fix.kind === 'copy') {
          void navigator.clipboard.writeText(fix.value).then(
            () => new Notice('복사했어요. 터미널에 붙여넣어 주세요.'),
            () => new Notice('복사에 실패했어요.'),
          );
        } else {
          window.open(fix.value);
        }
      });
    }
  }
}
