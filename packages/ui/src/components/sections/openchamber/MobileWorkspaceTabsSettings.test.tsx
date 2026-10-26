import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Window } from 'happy-dom';

import { I18nProvider } from '@/lib/i18n';
import { useGuestsStore } from '@/lib/guests/store';
import type { InstalledGuest } from '@/lib/guests/types';
import { getRuntimeKey } from '@/lib/runtime-switch';
import { useUIStore } from '@/stores/useUIStore';

import { MobileWorkspaceTabsSettings } from './MobileWorkspaceTabsSettings';

const guest = (over: Partial<InstalledGuest> & Pick<InstalledGuest, 'id' | 'name'>): InstalledGuest => ({
  icon: 'box',
  capabilities: { requested: [], granted: [] },
  enabled: true,
  entry: 'panel.html',
  ...over,
});

const BUILT_INS = ['status', 'changes', 'files', 'terminal', 'notes'];

describe('MobileWorkspaceTabsSettings', () => {
  let win: Window;
  let root: Root;
  let restoreGlobals: () => void;

  const rows = () => [...document.querySelectorAll<HTMLElement>('[data-settings-item^="layout.mobile-workspace-tabs."]')];
  const order = () => rows().map((row) => row.dataset.settingsItem?.replace('layout.mobile-workspace-tabs.', '') ?? '');
  // The row itself is the toggle (role=button, aria-pressed/aria-disabled).
  const checkbox = (id: string) => rows().find((row) => row.dataset.settingsItem === `layout.mobile-workspace-tabs.${id}`) ?? null;
  const handle = (index: number) => {
    const button = rows()[index]?.parentElement?.querySelector('button');
    if (!button) throw new Error('Expected a drag handle');
    return button;
  };
  const render = async () => {
    await act(async () => root.render(<I18nProvider><MobileWorkspaceTabsSettings /></I18nProvider>));
    // Supply layout for happy-dom while exercising the real dnd-kit sensors.
    rows().forEach((row, index) => {
      const rect = () => new DOMRect(0, index * 36, 400, 36);
      const parent = row.parentElement;
      if (!parent) throw new Error('Expected sortable row');
      parent.getBoundingClientRect = rect;
      handle(index).getBoundingClientRect = rect;
    });
  };
  const key = async (target: EventTarget, code: string, value = code) => {
    await act(async () => {
      target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code, key: value }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  beforeEach(async () => {
    win = new Window({ url: 'http://localhost' });
    const values = {
      window: win, document: win.document, navigator: win.navigator,
      Node: win.Node, Element: win.Element, HTMLElement: win.HTMLElement,
      HTMLButtonElement: win.HTMLButtonElement, HTMLInputElement: win.HTMLInputElement,
      SVGElement: win.SVGElement, Document: win.Document, DocumentFragment: win.DocumentFragment,
      DOMRect: win.DOMRect, Event: win.Event, CustomEvent: win.CustomEvent,
      MouseEvent: win.MouseEvent, KeyboardEvent: win.KeyboardEvent, Touch: win.Touch, TouchEvent: win.TouchEvent,
      MutationObserver: win.MutationObserver, ResizeObserver: win.ResizeObserver,
      localStorage: win.localStorage, getComputedStyle: win.getComputedStyle.bind(win),
      requestAnimationFrame: win.requestAnimationFrame.bind(win), cancelAnimationFrame: win.cancelAnimationFrame.bind(win),
      // The catalog request is refused; a ready store keeps its guests.
      fetch: async () => { throw new Error('offline'); },
      IS_REACT_ACT_ENVIRONMENT: true,
    };
    const previous = Object.keys(values).map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
    for (const [name, value] of Object.entries(values)) Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
    restoreGlobals = () => {
      for (const [name, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    useGuestsStore.setState({ status: 'idle', guests: [], unreadable: [], failure: null, runtimeKey: getRuntimeKey() });
    useUIStore.setState({ mobileWorkspaceTabOrder: [], mobileWorkspaceHiddenTabs: [] });
    await win.happyDOM.close();
    restoreGlobals();
  });

  test('lists extension panels after the built-ins, in the stored order', async () => {
    useGuestsStore.setState({
      status: 'ready',
      guests: [guest({ id: 'alpha', name: 'Alpha Panel' }), guest({ id: 'beta', name: 'Beta Panel' })],
      unreadable: [], failure: null, runtimeKey: getRuntimeKey(),
    });
    // A stored order that already placed beta after Status and does not name
    // alpha yet: the guests keep the user's place, and a panel the order misses
    // is appended.
    useUIStore.setState({ mobileWorkspaceTabOrder: ['status', 'plugin:beta', 'changes', 'files', 'terminal', 'notes'], mobileWorkspaceHiddenTabs: [] });

    await render();
    await act(async () => {});
    expect(order()).toEqual(['status', 'plugin:beta', 'changes', 'files', 'terminal', 'notes', 'plugin:alpha']);
    expect(checkbox('plugin:beta')?.getAttribute('aria-pressed')).toBe('true');
  });

  test('hiding every tab but one extension panel keeps that panel locked', async () => {
    useGuestsStore.setState({
      status: 'ready',
      guests: [guest({ id: 'alpha', name: 'Alpha Panel' }), guest({ id: 'beta', name: 'Beta Panel' })],
      unreadable: [], failure: null, runtimeKey: getRuntimeKey(),
    });
    useUIStore.setState({
      mobileWorkspaceTabOrder: [...BUILT_INS, 'plugin:alpha', 'plugin:beta'],
      mobileWorkspaceHiddenTabs: [...BUILT_INS, 'plugin:beta'],
    });

    await render();
    await act(async () => {});
    // Only plugin:alpha is shown, so its checkbox is locked.
    expect(checkbox('plugin:alpha')?.getAttribute('aria-disabled')).toBe('true');
    expect(checkbox('plugin:beta')?.getAttribute('aria-pressed')).toBe('false');
    // Its checkbox cannot change: the store still hides nothing.
    await act(async () => checkbox('plugin:alpha')?.click());
    expect(useUIStore.getState().mobileWorkspaceHiddenTabs).toEqual([...BUILT_INS, 'plugin:beta']);

    // Showing a second panel lifts the lock: only a single visible tab locks,
    // so the built-in rows are unlocked again.
    await act(async () => checkbox('status')?.click());
    expect(checkbox('status')?.getAttribute('aria-pressed')).toBe('true');
    expect(checkbox('status')?.getAttribute('aria-disabled')).toBeNull();
    expect(checkbox('plugin:alpha')?.getAttribute('aria-disabled')).toBeNull();
  });

  test('a saved panel id that is not on offer is not listed but keeps its place', async () => {
    useGuestsStore.setState({
      status: 'ready',
      guests: [guest({ id: 'alpha', name: 'Alpha Panel' })],
      unreadable: [], failure: null, runtimeKey: getRuntimeKey(),
    });
    useUIStore.setState({
      mobileWorkspaceTabOrder: ['status', 'plugin:gone', 'changes', 'files', 'terminal', 'notes', 'plugin:alpha'],
      mobileWorkspaceHiddenTabs: [],
    });

    await render();
    await act(async () => {});
    expect(order()).not.toContain('plugin:gone');
    expect(order()).toContain('plugin:alpha');

    // Reordering writes a full order back; the absent id keeps its saved place.
    handle(0).focus();
    await key(handle(0), 'Space', ' ');
    await key(handle(0), 'ArrowDown');
    await key(handle(0), 'Space', ' ');
    const stored = useUIStore.getState().mobileWorkspaceTabOrder;
    expect(stored).toContain('plugin:gone');
    // It keeps its place next to the tab that preceded it (the moved Status).
    expect(stored.indexOf('plugin:gone')).toBe(stored.indexOf('status') + 1);
    expect(stored.indexOf('plugin:gone')).toBeLessThan(stored.indexOf('files'));
  });
});
