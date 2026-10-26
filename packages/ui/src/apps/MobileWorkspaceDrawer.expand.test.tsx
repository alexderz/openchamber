import React, { act, useState } from 'react';
import { expect, test } from 'bun:test';
import { Window } from 'happy-dom';

import { I18nProvider } from '@/lib/i18n';
import { ThemeSystemProvider } from '@/contexts/ThemeSystemContext';
import { OpenCode } from '@opencode/client';
import { SyncProvider } from '@/sync/sync-context';
import { useGuestsStore } from '@/lib/guests/store';
import type { InstalledGuest } from '@/lib/guests/types';
import { getRuntimeKey } from '@/lib/runtime-switch';
import { useUIStore } from '@/stores/useUIStore';
import type { MobileGuestTab } from '@/hooks/useMobileGuestTabs';

import { MobileWorkspaceDrawer } from './MobileWorkspaceDrawer';

const SYNC_SDK = OpenCode.make({
  baseUrl: 'http://opencode.test',
  fetch: async (request) => {
    const path = new URL(request instanceof Request ? request.url : String(request)).pathname;
    if (path.endsWith('/event')) {
      return new Response(new ReadableStream(), { headers: { 'content-type': 'text/event-stream' } });
    }
    return new Response('[]', { headers: { 'content-type': 'application/json' } });
  },
});

const alpha = {
  id: 'alpha', name: 'Alpha Panel', icon: 'apps', entry: 'panel.html', enabled: true,
  capabilities: { requested: [], granted: [] },
} satisfies InstalledGuest;

const alphaTab: MobileGuestTab = { mode: 'plugin:alpha', label: 'Alpha Panel', icon: 'apps', layout: { kind: 'page' } };

const PANE_TEXT = 'This panel failed to load.';

const createHarness = async () => {
  const dom = new Window({ width: 1194, height: 834, url: 'http://mobile-drawer-expand.test' });
  const originals = new Map<string, PropertyDescriptor | undefined>();
  for (const [name, value] of Object.entries({
    window: dom, document: dom.document, navigator: dom.navigator, localStorage: dom.localStorage, location: dom.location,
    Element: dom.Element, HTMLElement: dom.HTMLElement, HTMLInputElement: dom.HTMLInputElement, Node: dom.Node,
    Event: dom.Event, CustomEvent: dom.CustomEvent, KeyboardEvent: dom.KeyboardEvent, MouseEvent: dom.MouseEvent,
    MutationObserver: dom.MutationObserver, ResizeObserver: dom.ResizeObserver,
    getComputedStyle: dom.getComputedStyle.bind(dom), requestAnimationFrame: dom.requestAnimationFrame.bind(dom),
    cancelAnimationFrame: dom.cancelAnimationFrame.bind(dom),
    fetch: async () => { throw new Error('offline'); },
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }

  const guestsBefore = useGuestsStore.getState();
  const uiBefore = useUIStore.getState();
  const { createRoot } = await import('react-dom/client');
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  let closeCount = 0;

  // A controlled wrapper: the host owns `expanded` (MobileApp), like the real
  // call site, so Escape and the button both flow through one setter.
  const Host: React.FC<{ variant: 'drawer' | 'panel'; open: boolean }> = ({ variant, open }) => {
    const [expanded, setExpanded] = useState(false);
    return (
      <SyncProvider sdk={SYNC_SDK} directory="/project">
      <ThemeSystemProvider>
      <I18nProvider>
        <MobileWorkspaceDrawer
          open={open}
          onClose={() => { closeCount += 1; }}
          tab="plugin:alpha"
          onTabChange={() => {}}
          pendingChangesDiff={null}
          onOpenPlan={() => {}}
          guestTabs={[alphaTab]}
          variant={variant}
          expanded={expanded}
          onExpandedChange={setExpanded}
        />
      </I18nProvider>
      </ThemeSystemProvider>
      </SyncProvider>
    );
  };

  const render = (props: { variant: 'drawer' | 'panel'; open?: boolean }) => act(async () => {
    root.render(<Host variant={props.variant} open={props.open ?? true} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  const cleanup = async () => {
    await act(async () => root.unmount());
    useGuestsStore.setState(guestsBefore);
    useUIStore.setState(uiBefore);
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
    await dom.happyDOM.close();
  };

  return { render, cleanup, closeCalls: () => closeCount };
};

const findButton = (label: string) =>
  [...document.body.querySelectorAll('button')].find((button) => button.getAttribute('aria-label') === label) ?? null;

const escape = () => act(async () => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
});

const activePane = (): HTMLElement | null => {
  const wrapper = document.body.querySelector('div.min-h-0.flex-1.overflow-hidden');
  const child = wrapper?.firstElementChild;
  return child instanceof HTMLElement ? child : null;
};

const seed = () => {
  useGuestsStore.setState({ status: 'ready', guests: [alpha], unreadable: [], failure: null, runtimeKey: getRuntimeKey() });
  useUIStore.setState({ mobileWorkspaceTabOrder: ['status', 'changes', 'files', 'terminal', 'notes', 'plugin:alpha'], mobileWorkspaceHiddenTabs: [] });
};

test('the expand toggle shows only in the panel variant', async () => {
  const { render, cleanup } = await createHarness();
  try {
    seed();
    await render({ variant: 'panel' });
    const panelToggle = findButton('Expand panel');
    expect(panelToggle?.getAttribute('aria-pressed')).toBe('false');

    await render({ variant: 'drawer' });
    expect(findButton('Expand panel')).toBeNull();
    expect(findButton('Collapse panel')).toBeNull();
    expect(panelToggle?.isConnected).toBe(false);
  } finally {
    await cleanup();
  }
});

test('expanding keeps the active pane on the same DOM node and covers the app', async () => {
  const { render, cleanup, closeCalls } = await createHarness();
  try {
    seed();
    await render({ variant: 'panel' });
    expect(document.body.textContent).toContain(PANE_TEXT);
    const pane = activePane();
    expect(pane).not.toBeNull();
    const container = pane?.parentElement?.parentElement ?? null;
    expect(container?.className).toContain('h-full');
    expect(container?.className).not.toContain('fixed');

    // Expand: the same element stays in the tree, only its presentation
    // changes — a portal swap would remount the pane and its iframe/terminal.
    await act(async () => { findButton('Expand panel')?.click(); });
    expect(findButton('Collapse panel')?.getAttribute('aria-pressed')).toBe('true');
    expect(closeCalls()).toBe(0);
    expect(activePane()).toBe(pane);
    expect(container?.isConnected).toBe(true);
    expect(container?.className).toContain('fixed');
    expect(container?.className).toContain('inset-0');
    expect(container?.className).toContain('z-50');
  } finally {
    await cleanup();
  }
});

test('Escape collapses a panel that is expanded before it closes', async () => {
  const { render, cleanup, closeCalls } = await createHarness();
  try {
    seed();
    await render({ variant: 'panel' });
    await act(async () => { findButton('Expand panel')?.click(); });
    expect(findButton('Collapse panel')).not.toBeNull();

    // First Escape: collapse, not close.
    await escape();
    expect(findButton('Collapse panel')).toBeNull();
    expect(findButton('Expand panel')?.getAttribute('aria-pressed')).toBe('false');
    expect(closeCalls()).toBe(0);

    // Second Escape: nothing expanded, closes as today.
    await escape();
    expect(closeCalls()).toBe(1);
  } finally {
    await cleanup();
  }
});
