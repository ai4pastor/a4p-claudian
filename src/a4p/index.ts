import type { Plugin } from 'obsidian';
import { Notice } from 'obsidian';

import type { TabData } from '../features/chat/tabs/types';
import type { FeatureHost } from '../features/FeatureHost';
import { A4P_HIDDEN_PROVIDER_IDS, UPSTREAM_PLUGIN_ID } from './config';
import { applySimpleModeToTab } from './simplemode/simpleMode';
import { A4PStore } from './store/A4PStore';
import { a4pT } from './strings';
import { setA4PTabDecorator } from './tabHook';

export type A4PHost = FeatureHost & Plugin;

let store: A4PStore | null = null;

export function getA4PStore(): A4PStore | null {
  return store;
}

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
    store = new A4PStore(plugin.app);
    await store.load();
    safeRegister(() => {
      store = null;
    });

    await normalizeHiddenProviders(plugin);
    warnIfUpstreamEnabled(plugin);

    setA4PTabDecorator({ decorateTab: (tab) => decorateTab(tab) });
    safeRegister(() => setA4PTabDecorator(null));

    // Tabs created before installA4P ran (e.g. restored layout) get decorated late.
    for (const view of plugin.getAllViews()) {
      for (const tab of view.getTabManager()?.getAllTabs() ?? []) {
        decorateTab(tab);
      }
    }
  } catch (error) {
    console.error('[a4p] install failed — upstream behavior unaffected', error);
  }
}

function decorateTab(tab: TabData): void {
  applySimpleModeToTab(tab, store?.get().simpleMode ?? true);
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
