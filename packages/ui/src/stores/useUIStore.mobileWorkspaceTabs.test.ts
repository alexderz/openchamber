import { beforeEach, describe, expect, test } from 'bun:test';

import { useUIStore } from './useUIStore';

describe('useUIStore mobile workspace tabs', () => {
  beforeEach(() => {
    useUIStore.setState({ mobileWorkspaceTabOrder: [], mobileWorkspaceHiddenTabs: [] });
  });

  test('hides and shows tabs, but never the last one shown', () => {
    const { setMobileWorkspaceTabVisible } = useUIStore.getState();
    for (const tab of ['status', 'changes', 'files', 'terminal'] as const) setMobileWorkspaceTabVisible(tab, false);
    expect(useUIStore.getState().mobileWorkspaceHiddenTabs).toEqual(['status', 'changes', 'files', 'terminal']);

    setMobileWorkspaceTabVisible('notes', false);
    expect(useUIStore.getState().mobileWorkspaceHiddenTabs).toEqual(['status', 'changes', 'files', 'terminal']);

    setMobileWorkspaceTabVisible('files', true);
    expect(useUIStore.getState().mobileWorkspaceHiddenTabs).toEqual(['status', 'changes', 'terminal']);
  });

  test('stores a full order of known tabs', () => {
    useUIStore.getState().setMobileWorkspaceTabOrder(['notes', 'unknown', 'notes', 'mcp', 'files']);
    expect(useUIStore.getState().mobileWorkspaceTabOrder).toEqual(['status', 'changes', 'terminal', 'notes', 'files']);
  });

  test('keeps panel ids, and the saved places of panels that are not on offer', () => {
    const { setMobileWorkspaceTabOrder } = useUIStore.getState();
    setMobileWorkspaceTabOrder(['plugin:alpha', 'notes', 'status', 'plugin:beta']);
    expect(useUIStore.getState().mobileWorkspaceTabOrder).toEqual(['plugin:alpha', 'changes', 'files', 'terminal', 'notes', 'status', 'plugin:beta']);

    // The settings list offers built-in tabs only: both saved panels stay put.
    setMobileWorkspaceTabOrder(['terminal', 'status', 'changes', 'files', 'notes']);
    expect(useUIStore.getState().mobileWorkspaceTabOrder).toEqual(['plugin:alpha', 'terminal', 'status', 'plugin:beta', 'changes', 'files', 'notes']);
  });

  test('the last tab shown counts panels, and a hidden absent panel stays hidden', () => {
    const { setMobileWorkspaceTabVisible } = useUIStore.getState();
    const panels = ['plugin:alpha' as const];
    for (const tab of ['status', 'changes', 'files', 'terminal', 'notes'] as const) setMobileWorkspaceTabVisible(tab, false, panels);
    expect(useUIStore.getState().mobileWorkspaceHiddenTabs).toEqual(['status', 'changes', 'files', 'terminal', 'notes']);

    setMobileWorkspaceTabVisible('plugin:alpha', false, panels);
    expect(useUIStore.getState().mobileWorkspaceHiddenTabs).toEqual(['status', 'changes', 'files', 'terminal', 'notes']);

    useUIStore.setState({ mobileWorkspaceHiddenTabs: ['plugin:gone', 'status'] });
    setMobileWorkspaceTabVisible('status', true, panels);
    expect(useUIStore.getState().mobileWorkspaceHiddenTabs).toEqual(['plugin:gone']);
  });
});
