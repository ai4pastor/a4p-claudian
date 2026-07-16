import * as fs from 'fs';
import * as path from 'path';

/**
 * Tripwire tests for the upstream DOM/source contracts the a4p layer relies
 * on. When an upstream merge changes one of these, this suite fails loudly
 * instead of the a4p layer degrading silently.
 */

const SRC = path.join(__dirname, '../../../src');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(SRC, relativePath), 'utf8');
}

describe('upstream contract tripwires', () => {
  it('main.ts mounts the a4p layer', () => {
    const main = read('main.ts');
    expect(main).toContain('installA4P(this)');
    expect(main).toContain('new A4PSettingTab(this.app, this)');
  });

  it('Tab.ts calls the a4p tab hook from initializeTabUI', () => {
    const tab = read('features/chat/tabs/Tab.ts');
    expect(tab).toContain('a4pOnTabUICreated(tab)');
  });

  it('ClaudianView still uses the container class the a4p layer anchors on', () => {
    expect(read('features/chat/ClaudianView.ts')).toContain('claudian-container');
  });

  it('settings tabs still render in [general, ...providers] order with known classes', () => {
    const settings = read('features/settings/ClaudianSettings.ts');
    expect(settings).toContain("['general', ...providerTabs]");
    expect(settings).toContain('claudian-settings-tabs');
    expect(settings).toContain('claudian-settings-tab-content');
  });

  it('composer/welcome DOM fields the a4p layer decorates still exist', () => {
    const tab = read('features/chat/tabs/Tab.ts');
    expect(tab).toContain('claudian-input-composer');
    expect(tab).toContain('claudian-welcome');
  });

  it('toolbar classes hidden by simple mode still exist', () => {
    const toolbar = read('features/chat/ui/InputToolbar.ts');
    for (const cls of [
      'claudian-thinking-selector',
      'claudian-mode-selector',
      'claudian-permission-toggle',
      'claudian-mcp-selector',
      'claudian-external-context-selector',
    ]) {
      expect(toolbar).toContain(cls);
    }
  });

  it('a4p CSS import is registered in the style index', () => {
    expect(read('style/index.css')).toContain('./a4p/a4p.css');
  });
});
