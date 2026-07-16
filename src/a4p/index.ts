import { Notice } from 'obsidian';

import type { TabData } from '../features/chat/tabs/types';
import { A4P_HIDDEN_PROVIDER_IDS, UPSTREAM_PLUGIN_ID } from './config';
import type { A4PHost } from './context';
import { getA4PStore, setA4PStore } from './context';
import { runDiagnostics } from './diagnostics/checks';
import { syncCompatBanner } from './diagnostics/compatBanner';
import type { CompatVerdict } from './diagnostics/CompatGuard';
import { detectCliVersion, evaluateCompat, fetchCompatManifest } from './diagnostics/CompatGuard';
import { DiagnosticsModal } from './diagnostics/DiagnosticsModal';
import { applySimpleModeToTab } from './simplemode/simpleMode';
import { A4PStore } from './store/A4PStore';
import { a4pT } from './strings';
import { setA4PTabDecorator } from './tabHook';

export type { A4PHost } from './context';
export { getA4PStore } from './context';

const COMPAT_GUARD_DELAY_MS = 3000;

let compatVerdicts: CompatVerdict[] = [];

type PluginManagerInternals = {
  plugins?: { enabledPlugins?: Set<string> };
};

/**
 * Entry point of the A4P layer — the single call added to ClaudianPlugin.onload().
 * Everything a4p mounts is registered on the plugin for cleanup on unload.
 * Fail-open: an a4p install failure must never break the upstream plugin.
 */
export async function installA4P(plugin: A4PHost): Promise<void> {
  const safeRegister = (cleanup: () => void): void => {
    if (typeof plugin.register === 'function') plugin.register(cleanup);
  };

  try {
    const store = new A4PStore(plugin.app);
    await store.load();
    setA4PStore(store);
    safeRegister(() => setA4PStore(null));

    await normalizeHiddenProviders(plugin);
    warnIfUpstreamEnabled(plugin);

    setA4PTabDecorator({ decorateTab: (tab) => decorateTab(tab) });
    safeRegister(() => setA4PTabDecorator(null));

    registerCommands(plugin);

    // Tabs created before installA4P ran (e.g. restored layout) get decorated late.
    forEachOpenTab(plugin, decorateTab);

    // Off the onload critical path: CLI compat guard + first-launch onboarding.
    const compatTimer = window.setTimeout(() => void runCompatGuard(plugin), COMPAT_GUARD_DELAY_MS);
    safeRegister(() => window.clearTimeout(compatTimer));
    plugin.app.workspace.onLayoutReady(() => void maybeOpenOnboarding(plugin));
  } catch (error) {
    console.error('[a4p] install failed — upstream behavior unaffected', error);
  }
}

function decorateTab(tab: TabData): void {
  applySimpleModeToTab(tab, getA4PStore()?.get().simpleMode ?? true);
  syncCompatBanner(tab, compatVerdicts);
}

function forEachOpenTab(plugin: A4PHost, action: (tab: TabData) => void): void {
  for (const view of plugin.getAllViews()) {
    for (const tab of view.getTabManager()?.getAllTabs() ?? []) {
      action(tab);
    }
  }
}

function registerCommands(plugin: A4PHost): void {
  if (typeof plugin.addCommand !== 'function') return;
  plugin.addCommand({
    id: 'a4p-diagnostics',
    name: '🩺 환경 진단',
    callback: () => new DiagnosticsModal(plugin.app, plugin).open(),
  });
}

/** Detects installed CLI versions and shows Korean guidance when out of the tested range. */
async function runCompatGuard(plugin: A4PHost): Promise<void> {
  try {
    const manifest = await fetchCompatManifest();
    if (!manifest) return;

    const verdicts: CompatVerdict[] = [];
    for (const providerId of ['claude', 'codex']) {
      if (providerId === 'codex' && !isProviderEnabled(plugin, 'codex')) continue;
      const cliPath = plugin.providerHost.getResolvedProviderCliPath(providerId);
      if (!cliPath) continue;
      const version = await detectCliVersion(cliPath);
      const verdict = evaluateCompat(manifest, providerId, version);
      if (verdict) verdicts.push(verdict);
    }

    compatVerdicts = verdicts;
    forEachOpenTab(plugin, (tab) => syncCompatBanner(tab, compatVerdicts));

    const dismissed = new Set(getA4PStore()?.get().dismissedBanners ?? []);
    const problem = verdicts.find(
      (verdict) => verdict.level !== 'ok' && !dismissed.has(verdict.dismissKey),
    );
    if (problem) {
      new Notice(`⚠️ ${problem.message}`, 10000);
    }
  } catch (error) {
    console.error('[a4p] compat guard failed (fail-open)', error);
  }
}

/** First launch: run checks headlessly and open the modal only when something needs attention. */
async function maybeOpenOnboarding(plugin: A4PHost): Promise<void> {
  try {
    const store = getA4PStore();
    const onboarding = store?.get().onboarding;
    if (!store || onboarding?.diagnosticsPassedAt || onboarding?.dismissed) return;

    const report = await runDiagnostics(plugin);
    if (report.allGreen) {
      await store.update((data) => {
        data.onboarding.diagnosticsPassedAt = Date.now();
      });
      return;
    }
    new DiagnosticsModal(plugin.app, plugin, { onboarding: true }).open();
  } catch (error) {
    console.error('[a4p] onboarding check failed (fail-open)', error);
  }
}

function isProviderEnabled(plugin: A4PHost, providerId: string): boolean {
  const configs = plugin.settings.providerConfigs as
    | Record<string, { enabled?: boolean } | undefined>
    | undefined;
  return configs?.[providerId]?.enabled === true;
}

/** Hidden providers must stay off even if legacy/imported settings enabled them. */
async function normalizeHiddenProviders(plugin: A4PHost): Promise<void> {
  const configs = plugin.settings.providerConfigs as
    | Record<string, { enabled?: boolean } | undefined>
    | undefined;
  const needsFix = [...A4P_HIDDEN_PROVIDER_IDS].some((id) => configs?.[id]?.enabled === true);
  if (!needsFix) return;

  await plugin.mutateSettings((settings) => {
    const target = settings.providerConfigs as Record<string, { enabled?: boolean } | undefined>;
    for (const id of A4P_HIDDEN_PROVIDER_IDS) {
      const config = target[id];
      if (config) config.enabled = false;
    }
  });
}

/** Both plugins share the view type and .claudian/ storage — running both corrupts state. */
function warnIfUpstreamEnabled(plugin: A4PHost): void {
  const enabledPlugins = (plugin.app as unknown as PluginManagerInternals).plugins?.enabledPlugins;
  if (enabledPlugins?.has(UPSTREAM_PLUGIN_ID)) {
    new Notice(a4pT('warn.upstreamEnabled'), 15000);
  }
}
