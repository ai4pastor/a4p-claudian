import type { App } from 'obsidian';
import { Modal, Notice } from 'obsidian';

import { confirm } from '../../shared/modals/ConfirmModal';
import type { A4PHost } from '../context';
import { compareVersionStrings } from '../version';
import { runFirstRunHandoff } from './FirstRunHandoff';
import { computeState, scanInstalledSkills } from './InstalledSkillScanner';
import { RegistryClient } from './RegistryClient';
import { adoptSkill, installSkill, isSkillOperationInFlight, uninstallSkill } from './SkillInstaller';
import type { InstalledState, LocalSkillInfo, RegistrySkill, SkillRegistry } from './types';

const STATE_BADGE: Record<InstalledState, string> = {
  'not-installed': '',
  installed: '✓ 설치됨',
  'update-available': '⬆️ 업데이트 가능',
  unmanaged: '직접 설치됨',
  symlink: '🔗 개발자 연결',
};

/**
 * 스킬 스토어 — one-click install/update/uninstall of registry skills,
 * no terminal required.
 */
export class SkillStoreModal extends Modal {
  private readonly plugin: A4PHost;
  private readonly client = new RegistryClient();
  private categoryFilter: string | null = null;

  constructor(app: App, plugin: A4PHost) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    this.modalEl.addClass('a4p-store-modal');
    this.titleEl.setText('🛍️ AI4Pastor 스킬 스토어');
    void this.render();
  }

  private async render(force = false): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createDiv({ cls: 'a4p-store-loading', text: '스킬 목록을 불러오는 중이에요…' });

    const result = await this.client.getRegistry(force);
    contentEl.empty();

    if (!result) {
      const errorEl = contentEl.createDiv({ cls: 'a4p-store-error' });
      errorEl.createDiv({ text: '스킬 목록을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.' });
      const retry = errorEl.createEl('button', { text: '다시 시도' });
      retry.addEventListener('click', () => void this.render(true));
      return;
    }

    if (result.offline) {
      contentEl.createDiv({
        cls: 'a4p-store-offline',
        text: '📡 오프라인 상태예요. 저장된 목록을 보여 드려요.',
      });
    }

    this.renderCategoryChips(contentEl, result.registry);

    const listEl = contentEl.createDiv({ cls: 'a4p-store-list' });
    const installed = scanInstalledSkills();
    const skills = result.registry.skills.filter(
      (skill) => !this.categoryFilter || skill.category === this.categoryFilter,
    );

    if (skills.length === 0) {
      listEl.createDiv({ cls: 'a4p-store-empty', text: '이 분류에는 아직 스킬이 없어요.' });
    }
    for (const skill of skills) {
      this.renderCard(listEl, result.registry, skill, installed.get(skill.id.normalize('NFC')));
    }

    const footer = contentEl.createDiv({ cls: 'a4p-store-footer' });
    footer.createSpan({
      cls: 'a4p-store-footer-meta',
      text: result.registry.updatedAt ? `목록 기준: ${result.registry.updatedAt}` : '',
    });
    const refresh = footer.createEl('button', { text: '🔄 새로고침' });
    refresh.addEventListener('click', () => {
      this.client.invalidateTarball();
      void this.render(true);
    });
  }

  private renderCategoryChips(container: HTMLElement, registry: SkillRegistry): void {
    const categories = [...(registry.categories ?? [])].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );
    if (categories.length === 0) return;

    const chipRow = container.createDiv({ cls: 'a4p-store-categories' });
    const allChip = chipRow.createEl('button', {
      cls: `a4p-store-category${this.categoryFilter === null ? ' is-active' : ''}`,
      text: '전체',
    });
    allChip.addEventListener('click', () => {
      this.categoryFilter = null;
      void this.render();
    });
    for (const category of categories) {
      const chip = chipRow.createEl('button', {
        cls: `a4p-store-category${this.categoryFilter === category.id ? ' is-active' : ''}`,
        text: category.name,
      });
      chip.addEventListener('click', () => {
        this.categoryFilter = category.id;
        void this.render();
      });
    }
  }

  private renderCard(
    container: HTMLElement,
    registry: SkillRegistry,
    skill: RegistrySkill,
    local: LocalSkillInfo | undefined,
  ): void {
    const state = computeState(skill, local);
    const card = container.createDiv({ cls: 'a4p-store-card' });

    const head = card.createDiv({ cls: 'a4p-store-card-head' });
    head.createSpan({ cls: 'a4p-store-card-name', text: skill.name });
    head.createSpan({ cls: 'a4p-store-card-version', text: `v${skill.version}` });
    const badge = STATE_BADGE[state];
    if (badge) {
      head.createSpan({ cls: `a4p-store-card-badge a4p-store-card-badge--${state}`, text: badge });
    }

    card.createDiv({ cls: 'a4p-store-card-desc', text: skill.description });

    const actions = card.createDiv({ cls: 'a4p-store-card-actions' });
    const busy = isSkillOperationInFlight(skill.id);

    const requiredVersion = skill.minPluginVersion ?? registry.minPluginVersion;
    const pluginVersion = this.plugin.manifest?.version ?? '0.0.0';
    if (requiredVersion && (compareVersionStrings(pluginVersion, requiredVersion) ?? 0) < 0) {
      actions.createSpan({ cls: 'a4p-store-card-note', text: '플러그인 업데이트가 필요해요.' });
      return;
    }

    const addButton = (label: string, onClick: () => void | Promise<void>, cta = false): void => {
      const button = actions.createEl('button', {
        cls: `a4p-store-button${cta ? ' mod-cta' : ''}`,
        text: label,
      });
      button.disabled = busy;
      button.addEventListener('click', () => {
        button.disabled = true;
        button.setText('진행 중…');
        void Promise.resolve(onClick()).finally(() => void this.render());
      });
    };

    switch (state) {
      case 'not-installed':
        addButton('설치', () => this.doInstall(skill), true);
        break;
      case 'update-available':
        addButton('⬆️ 업데이트', () => this.doInstall(skill, true), true);
        addButton('제거', () => this.doUninstall(skill, local!));
        break;
      case 'installed':
        addButton('다시 설치', () => this.doInstall(skill, true));
        addButton('제거', () => this.doUninstall(skill, local!));
        break;
      case 'unmanaged':
        addButton('스토어에서 관리하기', () => this.doAdopt(skill, local!), true);
        break;
      case 'symlink':
        actions.createSpan({
          cls: 'a4p-store-card-note',
          text: '개발용 연결이라 스토어에서 수정하지 않아요.',
        });
        addButton('연결 해제', () => this.doUnlink(skill, local!));
        break;
    }

    if (skill.docsUrl) {
      addButton('강의 보기', () => {
        window.open(skill.docsUrl);
      });
    }
  }

  private async doInstall(skill: RegistrySkill, isUpdate = false): Promise<void> {
    try {
      await installSkill(this.client, skill);
      new Notice(`✅ '${skill.name}' 스킬을 ${isUpdate ? '업데이트' : '설치'}했어요.`);
      await runFirstRunHandoff(this.plugin, skill);
    } catch (error) {
      console.error('[a4p] skill install failed', error);
      new Notice(`설치에 실패했어요: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async doUninstall(skill: RegistrySkill, local: LocalSkillInfo): Promise<void> {
    const approved = await confirm(
      this.app,
      `'${skill.name}' 스킬을 제거할까요?\n\n폴더는 삭제되지 않고 휴지통으로 이동해요.\n경로: ${local.dir}`,
      '휴지통으로 이동',
    );
    if (!approved) return;
    try {
      const outcome = await uninstallSkill(local);
      new Notice(
        outcome.kind === 'trashed'
          ? `🗑️ 휴지통으로 이동했어요: ${outcome.trashPath}`
          : '연결을 해제했어요. 원본은 그대로 있어요.',
      );
    } catch (error) {
      console.error('[a4p] skill uninstall failed', error);
      new Notice(`제거에 실패했어요: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async doUnlink(skill: RegistrySkill, local: LocalSkillInfo): Promise<void> {
    const approved = await confirm(
      this.app,
      `'${skill.name}'은(는) 다른 위치의 원본에 연결된 바로가기예요.\n\n원본은 지우지 않고 연결만 해제합니다.\n연결: ${local.dir}`,
      '연결 해제',
    );
    if (!approved) return;
    try {
      await uninstallSkill(local);
      new Notice('연결을 해제했어요. 원본은 그대로 있어요.');
    } catch (error) {
      console.error('[a4p] skill unlink failed', error);
      new Notice(`해제에 실패했어요: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async doAdopt(skill: RegistrySkill, local: LocalSkillInfo): Promise<void> {
    const approved = await confirm(
      this.app,
      `직접 설치하신 '${skill.name}' 스킬을 스토어에서 관리하도록 전환할까요?\n\n이후 업데이트 알림과 원클릭 업데이트를 받을 수 있어요.`,
      '관리하기',
    );
    if (!approved) return;
    try {
      adoptSkill(local, skill);
      new Notice(`'${skill.name}' 스킬을 이제 스토어에서 관리해요.`);
    } catch (error) {
      console.error('[a4p] skill adopt failed', error);
      new Notice(`전환에 실패했어요: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
