import type { TabData } from '../features/chat/tabs/types';

/**
 * Per-tab mount hook for the A4P layer.
 *
 * Called synchronously from upstream's initializeTabUI() (the single line we
 * add to Tab.ts). Decoration is installed by installA4P(); until then — or if
 * a decorator throws — tabs behave exactly like upstream (fail-open).
 */
export interface A4PTabDecorator {
  decorateTab(tab: TabData): void;
}

let activeDecorator: A4PTabDecorator | null = null;

export function setA4PTabDecorator(decorator: A4PTabDecorator | null): void {
  activeDecorator = decorator;
}

export function a4pOnTabUICreated(tab: TabData): void {
  try {
    activeDecorator?.decorateTab(tab);
  } catch (error) {
    console.error('[a4p] tab decoration failed', error);
  }
}
