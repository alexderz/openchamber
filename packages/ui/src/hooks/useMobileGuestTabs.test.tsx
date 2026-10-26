import React, { act } from 'react';
import { expect, test } from 'bun:test';
import { Window } from 'happy-dom';

import { I18nProvider } from '@/lib/i18n';
import { useGuestsStore } from '@/lib/guests/store';
import type { InstalledGuest } from '@/lib/guests/types';
import { getRuntimeKey } from '@/lib/runtime-switch';

import { useMobileGuestTabs, type MobileGuestTab } from './useMobileGuestTabs';

const guest = (over: Partial<InstalledGuest> & Pick<InstalledGuest, 'id' | 'name'>): InstalledGuest => ({
  icon: 'box',
  capabilities: { requested: [], granted: [] },
  enabled: true,
  ...over,
});

test('useMobileGuestTabs maps the rail panels in catalog order and follows the catalog', async () => {
  const dom = new Window({ url: 'http://mobile-guest-tabs.test' });
  const originals = new Map<string, PropertyDescriptor | undefined>();
  for (const [name, value] of Object.entries({
    window: dom, document: dom.document, navigator: dom.navigator, localStorage: dom.localStorage,
    Element: dom.Element, HTMLElement: dom.HTMLElement, Node: dom.Node, Event: dom.Event, CustomEvent: dom.CustomEvent,
    // The catalog request is refused; a ready store keeps its guests (markFailed).
    fetch: async () => { throw new Error('offline'); },
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }

  const panel = guest({ id: 'alpha', name: 'Alpha Panel', entry: 'panel.html' });
  const surface = guest({ id: 'beta', name: 'Beta Surface', service: { runtime: 'host', granted: true, surface: true } });
  const backgroundOnly = guest({ id: 'gamma', name: 'Gamma Background', backgroundEntry: 'bg.html' });
  const paused = guest({ id: 'delta', name: 'Delta Paused', entry: 'panel.html', enabled: false });

  const previous = useGuestsStore.getState();
  const { createRoot } = await import('react-dom/client');
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const seen: MobileGuestTab[][] = [];
  function Probe() {
    const tabs = useMobileGuestTabs();
    seen.push(tabs);
    return null;
  }
  try {
    useGuestsStore.setState({
      status: 'ready',
      guests: [panel, surface, backgroundOnly, paused],
      unreadable: [],
      failure: null,
      runtimeKey: getRuntimeKey(),
    });
    await act(async () => root.render(<I18nProvider><Probe /></I18nProvider>));

    const tabs = seen.at(-1) ?? [];
    expect(tabs.map((tab) => tab.mode)).toEqual(['plugin:alpha', 'plugin:beta']);
    const [alphaTab, betaTab] = tabs;
    expect(alphaTab.label).toBe('Alpha Panel');
    expect(alphaTab.layout).toEqual({ kind: 'page' });
    expect(betaTab.layout).toEqual({ kind: 'surface' });

    // A newly installed panel enters the list; a removed one leaves it.
    const added = guest({ id: 'epsilon', name: 'Epsilon', entry: 'panel.html' });
    await act(async () => useGuestsStore.setState({ guests: [panel, added] }));
    expect((seen.at(-1) ?? []).map((tab) => tab.mode)).toEqual(['plugin:alpha', 'plugin:epsilon']);
    await act(async () => useGuestsStore.setState({ guests: [added] }));
    expect((seen.at(-1) ?? []).map((tab) => tab.mode)).toEqual(['plugin:epsilon']);
  } finally {
    await act(async () => root.unmount());
    useGuestsStore.setState(previous);
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
    await dom.happyDOM.close();
  }
});
