import { describe, expect, test } from 'bun:test';

import type { PluginContextPanelMode } from '@/lib/surfaces/modes';

import { orderMobileWorkspaceTabs, resolveMobileWorkspaceTab, shownMobileWorkspaceTabs, storableMobileWorkspaceTabOrder, stripMobileWorkspaceTabs } from './mobileWorkspaceTabs';

const alpha: PluginContextPanelMode = 'plugin:alpha';
const beta: PluginContextPanelMode = 'plugin:beta';
const BUILT_IN = ['status', 'changes', 'files', 'terminal', 'notes'];

describe('mobile workspace tabs', () => {
  test('a saved order keeps its tabs and places tabs it does not name where they go by default', () => {
    expect(orderMobileWorkspaceTabs(['terminal', 'gone', 'changes', 'terminal'])).toEqual(['status', 'files', 'terminal', 'changes', 'notes']);
    expect(orderMobileWorkspaceTabs([])).toEqual(['status', 'changes', 'files', 'terminal', 'notes']);
  });

  test('an order saved before Status existed gets it first and loses the MCP tab', () => {
    expect(orderMobileWorkspaceTabs(['mcp', 'files', 'changes', 'terminal', 'notes'])).toEqual(['status', 'files', 'changes', 'terminal', 'notes']);
  });

  test('hidden tabs leave the strip, but never all of them', () => {
    expect(shownMobileWorkspaceTabs(['files'], ['changes', 'mcp'])).toEqual(['status', 'files', 'terminal', 'notes']);
    expect(shownMobileWorkspaceTabs([], ['status', 'changes', 'files', 'terminal', 'notes'])).toEqual(['status', 'changes', 'files', 'terminal', 'notes']);
  });

  test('a hidden tab something opened stays in the strip, in its place, while it is open', () => {
    expect(stripMobileWorkspaceTabs([], ['files', 'terminal'], 'files')).toEqual(['status', 'changes', 'files', 'notes']);
    expect(stripMobileWorkspaceTabs([], ['files', 'terminal'], 'notes')).toEqual(['status', 'changes', 'notes']);
  });

  describe('with extension panels', () => {
    test('panels follow the built-in tabs in catalog order by default', () => {
      expect(orderMobileWorkspaceTabs([], [alpha, beta])).toEqual([...BUILT_IN, alpha, beta]);
    });

    test('a saved order keeps the places of panels, appends the panels it does not name, and hides absent ones', () => {
      const saved = [beta, 'status', 'changes', alpha, 'files', 'terminal', 'notes'];
      expect(orderMobileWorkspaceTabs(saved, [alpha, beta])).toEqual([beta, 'status', 'changes', alpha, 'files', 'terminal', 'notes']);
      expect(orderMobileWorkspaceTabs(saved, [alpha])).toEqual(['status', 'changes', alpha, 'files', 'terminal', 'notes']);
      // An order written before the extension existed gets it appended.
      expect(orderMobileWorkspaceTabs(BUILT_IN, [alpha])).toEqual([...BUILT_IN, alpha]);
      // Ids that are neither a built-in tab nor a panel id drop out.
      expect(orderMobileWorkspaceTabs(['plugin:Bad Id', 'plugin:', alpha], [alpha])).toEqual([alpha, ...BUILT_IN]);
    });

    test('hidden panels leave the strip, and the last tab shown counts panels', () => {
      expect(shownMobileWorkspaceTabs([], [alpha, 'files'], [alpha, beta])).toEqual(['status', 'changes', 'terminal', 'notes', beta]);
      expect(shownMobileWorkspaceTabs([], [...BUILT_IN, alpha], [alpha, beta])).toEqual([beta]);
      expect(shownMobileWorkspaceTabs([], [...BUILT_IN, alpha, beta], [alpha, beta])).toEqual([...BUILT_IN, alpha, beta]);
    });

    test('a hidden saved id of an absent panel changes nothing that is shown', () => {
      expect(shownMobileWorkspaceTabs([], [beta], [alpha])).toEqual([...BUILT_IN, alpha]);
    });

    test('a hidden panel something opened stays in the strip, in its place, while it is open', () => {
      expect(stripMobileWorkspaceTabs([], [alpha], alpha, [alpha, beta])).toEqual([...BUILT_IN, alpha, beta]);
      expect(stripMobileWorkspaceTabs([], [alpha], 'notes', [alpha, beta])).toEqual([...BUILT_IN, beta]);
      // The open panel left the catalog: it is not offered.
      expect(stripMobileWorkspaceTabs([], [], alpha, [beta])).toEqual([...BUILT_IN, beta]);
    });

    test('a stored order keeps the saved places of panels that are not on offer', () => {
      const previous = ['status', alpha, 'changes', 'files', 'terminal', 'notes', beta];
      // Only built-ins were on offer and reordered: each absent panel follows the tab that preceded it.
      expect(storableMobileWorkspaceTabOrder(['notes', 'status', 'changes', 'files', 'terminal'], previous))
        .toEqual(['notes', beta, 'status', alpha, 'changes', 'files', 'terminal']);
      // A panel on offer is stored where the user put it; the absent one stays after its predecessor.
      expect(storableMobileWorkspaceTabOrder([beta, 'status', 'changes', 'files', 'terminal', 'notes'], previous))
        .toEqual([beta, 'status', alpha, 'changes', 'files', 'terminal', 'notes']);
      // A saved id at the very front stays in front.
      expect(storableMobileWorkspaceTabOrder(['notes', 'status', 'changes', 'files', 'terminal'], [alpha, ...BUILT_IN]))
        .toEqual([alpha, 'notes', 'status', 'changes', 'files', 'terminal']);
    });

    test('the open tab falls back to the first shown one when its panel leaves the catalog', () => {
      expect(resolveMobileWorkspaceTab(alpha, [], [], [alpha, beta])).toBe(alpha);
      expect(resolveMobileWorkspaceTab(alpha, [], [], [beta])).toBe('status');
      expect(resolveMobileWorkspaceTab(alpha, ['files'], ['status', 'files'], [])).toBe('changes');
      expect(resolveMobileWorkspaceTab('terminal', [], ['terminal'], [])).toBe('terminal');
    });
  });
});
