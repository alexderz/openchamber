import React, { act } from 'react';
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
  fetch: async () => new Response('[]', { headers: { 'content-type': 'application/json' } }),
});

const alpha = {
  id: 'alpha', name: 'Alpha Panel', icon: 'apps', entry: 'panel.html', enabled: true,
  capabilities: { requested: [], granted: [] },
} satisfies InstalledGuest;

const alphaTab: MobileGuestTab = { mode: 'plugin:alpha', label: 'Alpha Panel', icon: 'apps', layout: { kind: 'page' } };

test('the drawer offers a panel as a tab and mounts the shared guest panel for it', async () => {
  const dom = new Window({ width: 412, height: 844, url: 'http://mobile-drawer-guest-tabs.test' });
  const originals = new Map<string, PropertyDescriptor | undefined>();
  for (const [name, value] of Object.entries({
    window: dom, document: dom.document, navigator: dom.navigator, localStorage: dom.localStorage, location: dom.location,
    Element: dom.Element, HTMLElement: dom.HTMLElement, HTMLInputElement: dom.HTMLInputElement, Node: dom.Node,
    Event: dom.Event, CustomEvent: dom.CustomEvent, KeyboardEvent: dom.KeyboardEvent, MouseEvent: dom.MouseEvent,
    MutationObserver: dom.MutationObserver, ResizeObserver: dom.ResizeObserver,
    getComputedStyle: dom.getComputedStyle.bind(dom), requestAnimationFrame: dom.requestAnimationFrame.bind(dom),
    cancelAnimationFrame: dom.cancelAnimationFrame.bind(dom),
    // The panel's frame grant cannot reach a server here, so the pane settles on
    // its "failed to load" state — enough to prove the pane is mounted.
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
  const noop = () => {};
  const renderDrawer = (props: { tab: Parameters<typeof MobileWorkspaceDrawer>[0]['tab']; guestTabs: MobileGuestTab[] }) => act(async () => {
    root.render(
      <SyncProvider sdk={SYNC_SDK} directory="/project">
      <ThemeSystemProvider>
      <I18nProvider>
        <MobileWorkspaceDrawer
          open
          onClose={noop}
          tab={props.tab}
          onTabChange={noop}
          pendingChangesDiff={null}
          onOpenPlan={noop}
          guestTabs={props.guestTabs}
        />
      </I18nProvider>
      </ThemeSystemProvider>
      </SyncProvider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  try {
    useGuestsStore.setState({ status: 'ready', guests: [alpha], unreadable: [], failure: null, runtimeKey: getRuntimeKey() });
    useUIStore.setState({ mobileWorkspaceTabOrder: ['status', 'changes', 'files', 'terminal', 'notes', 'plugin:gone'], mobileWorkspaceHiddenTabs: [] });

    await renderDrawer({ tab: 'plugin:alpha', guestTabs: [alphaTab] });

    // The panel is offered as a tab, with its label as the accessible name.
    const guestTabButton = document.body.querySelector('[data-sortable-tab-id="plugin:alpha"] [role="tab"]');
    expect(guestTabButton?.getAttribute('title')).toBe('Alpha Panel');
    // The placeholder saved id of a panel that is not on offer keeps no tab.
    expect(document.body.querySelector('[data-sortable-tab-id="plugin:gone"]')).toBeNull();
    // The shared guest panel is mounted for the tab.
    expect(document.body.textContent).toContain('This panel failed to load.');

    // The panel leaves the catalog: its tab goes with it, even while it is the
    // active tab.
    await renderDrawer({ tab: 'plugin:alpha', guestTabs: [] });
    expect(document.body.querySelector('[data-sortable-tab-id="plugin:alpha"]')).toBeNull();
  } finally {
    await act(async () => root.unmount());
    useGuestsStore.setState(guestsBefore);
    useUIStore.setState(uiBefore);
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
    await dom.happyDOM.close();
  }
});
