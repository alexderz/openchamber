import { describe, expect, test } from 'bun:test';
import { GUEST_SURFACE_DOCK_DEFAULT, GUEST_SURFACE_DOCK_SIZE_DEFAULT } from '@openchamber/sdk';

import { guestPanelLayout, guestPanelUnmountsWhenHidden } from './surfaces';
import type { InstalledGuest } from './types';

const sharedSurface: InstalledGuest['service'] = { runtime: 'host', granted: true, provides: [], surface: true };

const guest = (overrides: Partial<InstalledGuest> = {}): InstalledGuest => ({
  id: 'demo',
  name: 'Demo',
  icon: 'apps',
  capabilities: { requested: [], granted: [] },
  entry: 'panel/index.html',
  ...overrides,
});

describe('guestPanelLayout', () => {
  test('an extension with a page, or missing from the catalog, is a page', () => {
    expect(guestPanelLayout(guest())).toEqual({ kind: 'page' });
    expect(guestPanelLayout(undefined)).toEqual({ kind: 'page' });
  });

  test('a shared surface without a page is a bare surface, and with a page it is docked', () => {
    expect(guestPanelLayout(guest({ entry: undefined, service: sharedSurface }))).toEqual({ kind: 'surface' });
    expect(guestPanelLayout(guest({ service: sharedSurface }))).toEqual({
      kind: 'docked',
      docking: { dock: GUEST_SURFACE_DOCK_DEFAULT, size: GUEST_SURFACE_DOCK_SIZE_DEFAULT },
    });
  });

  test('only a bare surface leaves the tree while hidden', () => {
    expect(guestPanelUnmountsWhenHidden({ kind: 'surface' })).toBe(true);
    expect(guestPanelUnmountsWhenHidden({ kind: 'page' })).toBe(false);
    expect(guestPanelUnmountsWhenHidden(guestPanelLayout(guest({ service: sharedSurface })))).toBe(false);
  });
});
