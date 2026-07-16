import * as fs from 'fs';
import { Notice } from 'obsidian';
import * as path from 'path';

import type { TabData } from '../../features/chat/tabs/types';
import type { A4PHost } from '../context';
import { getSkillsDir } from './InstalledSkillScanner';
import type { RegistrySkill } from './types';

const TAB_WAIT_ATTEMPTS = 10;
const TAB_WAIT_INTERVAL_MS = 200;

/**
 * After installing a skill that needs per-student setup, hands the setup
 * prompt to the chat: prefill by default (the student sees what will be
 * asked), auto-submit only when the registry says so.
 */
export async function runFirstRunHandoff(plugin: A4PHost, skill: RegistrySkill): Promise<void> {
  const firstRun = skill.firstRun;
  if (!firstRun?.prompt) return;

  if (firstRun.onlyIfMissing) {
    const guardPath = path.join(getSkillsDir(), skill.id, firstRun.onlyIfMissing);
    if (fs.existsSync(guardPath)) return;
  }

  const tab = await ensureActiveTab(plugin);
  if (!tab) {
    new Notice('채팅 화면을 열지 못했어요. 채팅에서 스킬 설정을 직접 시작해 주세요.');
    return;
  }

  if (firstRun.autoSubmit && tab.controllers.inputController) {
    await tab.controllers.inputController.sendMessage({ content: firstRun.prompt });
    return;
  }

  tab.dom.inputEl.value = firstRun.prompt;
  tab.dom.inputEl.dispatchEvent(new Event('input'));
  tab.dom.inputEl.focus();
  new Notice('설치 완료! 입력창의 안내 메시지를 보내면 초기 설정이 시작돼요.');
}

async function ensureActiveTab(plugin: A4PHost): Promise<TabData | null> {
  const maybeActivate = plugin as unknown as { activateView?: () => Promise<void> };
  if (typeof maybeActivate.activateView === 'function') {
    try {
      await maybeActivate.activateView();
    } catch {
      // fall through to polling — a view may already be open
    }
  }

  for (let attempt = 0; attempt < TAB_WAIT_ATTEMPTS; attempt++) {
    const tab = plugin.getView()?.getActiveTab();
    if (tab) return tab;
    await new Promise((resolve) => window.setTimeout(resolve, TAB_WAIT_INTERVAL_MS));
  }
  return null;
}
