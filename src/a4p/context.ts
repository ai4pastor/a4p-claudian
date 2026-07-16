import type { Plugin } from 'obsidian';

import type { FeatureHost } from '../features/FeatureHost';
import type { A4PStore } from './store/A4PStore';

/** The upstream plugin surface the a4p layer is allowed to use. */
export type A4PHost = FeatureHost & Plugin;

let store: A4PStore | null = null;

export function setA4PStore(instance: A4PStore | null): void {
  store = instance;
}

export function getA4PStore(): A4PStore | null {
  return store;
}
