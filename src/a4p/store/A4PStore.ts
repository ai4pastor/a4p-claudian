import type { App } from 'obsidian';

import { CLAUDIAN_STORAGE_PATH } from '../../core/bootstrap/StoragePaths';
import { VaultFileAdapter } from '../../core/storage/VaultFileAdapter';
import type { A4PData } from '../types';
import { createDefaultA4PData } from '../types';

export const A4P_DATA_PATH = `${CLAUDIAN_STORAGE_PATH}/a4p.json`;

/**
 * Persistence for the A4P layer — its own file next to upstream's
 * claudian-settings.json so upstream schema migrations never see a4p keys.
 */
export class A4PStore {
  private adapter: VaultFileAdapter;
  private data: A4PData = createDefaultA4PData();
  private listeners = new Set<() => void>();

  constructor(app: App) {
    this.adapter = new VaultFileAdapter(app);
  }

  async load(): Promise<void> {
    try {
      if (!(await this.adapter.exists(A4P_DATA_PATH))) {
        return;
      }
      const raw = await this.adapter.read(A4P_DATA_PATH);
      const parsed = JSON.parse(raw) as Partial<A4PData>;
      this.data = { ...createDefaultA4PData(), ...parsed };
    } catch (error) {
      console.error('[a4p] failed to load a4p.json — using defaults', error);
      this.data = createDefaultA4PData();
    }
  }

  get(): Readonly<A4PData> {
    return this.data;
  }

  async update(mutate: (data: A4PData) => void): Promise<void> {
    mutate(this.data);
    await this.save();
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error) {
        console.error('[a4p] store listener failed', error);
      }
    }
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async save(): Promise<void> {
    try {
      await this.adapter.write(A4P_DATA_PATH, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('[a4p] failed to save a4p.json', error);
    }
  }
}
