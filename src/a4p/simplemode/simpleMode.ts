import type { TabData } from '../../features/chat/tabs/types';
import type { FeatureHost } from '../../features/FeatureHost';

/**
 * Simple mode only toggles the `.a4p-simple` class — all hiding is pure CSS
 * (styles in src/style/a4p/a4p.css) and no upstream setting value is mutated.
 */
export function applySimpleModeToTab(tab: TabData, enabled: boolean): void {
  tab.dom.contentEl.closest('.claudian-container')?.classList.toggle('a4p-simple', enabled);
}

export function applySimpleModeToOpenTabs(plugin: FeatureHost, enabled: boolean): void {
  for (const view of plugin.getAllViews()) {
    for (const tab of view.getTabManager()?.getAllTabs() ?? []) {
      applySimpleModeToTab(tab, enabled);
    }
  }
}
