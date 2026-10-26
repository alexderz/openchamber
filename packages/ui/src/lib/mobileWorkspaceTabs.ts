import { isPluginContextPanelMode, type PluginContextPanelMode } from '@/lib/surfaces/modes';

/**
 * The tabs of the phone's workspace drawer (and the tablet's workspace panel),
 * in their default order. The user's order and hidden set are stored per
 * device in `useUIStore`; both hold plain ids so a tab added in a later
 * release shows up for everyone, in its default place within a saved order.
 * An id no longer listed (the old `mcp` tab, now a Status section) drops out.
 *
 * An extension panel is a tab too, under the id the desktop rail already
 * stores (`plugin:<guest id>`). The helpers take the ids of the panels the
 * catalog offers right now (`guestTabs`, in catalog order); they follow the
 * built-in tabs by default. A saved `plugin:` id whose extension is not in
 * the catalog (paused, removed, another runtime) is neither shown nor
 * dropped: it keeps its place in the stored order and hidden set, so the tab
 * returns where the user put it.
 */
const BUILT_IN_MOBILE_WORKSPACE_TABS = ['status', 'changes', 'files', 'terminal', 'notes'] as const;

export type BuiltInMobileWorkspaceTab = (typeof BUILT_IN_MOBILE_WORKSPACE_TABS)[number];
export type MobileWorkspaceTab = BuiltInMobileWorkspaceTab | PluginContextPanelMode;

export const isBuiltInMobileWorkspaceTab = (id: string): id is BuiltInMobileWorkspaceTab =>
  (BUILT_IN_MOBILE_WORKSPACE_TABS as readonly string[]).includes(id);

const isStoredTab = (id: string): id is MobileWorkspaceTab => isBuiltInMobileWorkspaceTab(id) || isPluginContextPanelMode(id);

/**
 * The saved order made complete: known ids once each, a built-in the order does
 * not name placed before every saved built-in that follows it by default (so a
 * new first tab, Status, is first for people who reordered the others too),
 * and a panel the order does not name last. Ids of panels outside `guestTabs`
 * stay in place.
 */
const completeOrder = (order: readonly string[], guestTabs: readonly PluginContextPanelMode[]): MobileWorkspaceTab[] => {
  const ordered = order.filter(isStoredTab).filter((id, index, all) => all.indexOf(id) === index);
  BUILT_IN_MOBILE_WORKSPACE_TABS.forEach((id, index) => {
    if (ordered.includes(id)) return;
    const followers = BUILT_IN_MOBILE_WORKSPACE_TABS.slice(index + 1)
      .map((next) => ordered.indexOf(next))
      .filter((position) => position >= 0);
    ordered.splice(followers.length > 0 ? Math.min(...followers) : ordered.length, 0, id);
  });
  for (const guestTab of guestTabs) {
    if (!ordered.includes(guestTab)) ordered.push(guestTab);
  }
  return ordered;
};

/** Every tab the drawer can offer, in the user's order. */
export const orderMobileWorkspaceTabs = (
  order: readonly string[],
  guestTabs: readonly PluginContextPanelMode[] = [],
): MobileWorkspaceTab[] =>
  completeOrder(order, guestTabs).filter((id) => isBuiltInMobileWorkspaceTab(id) || guestTabs.includes(id));

/**
 * The order to store after the user reordered the tabs on offer (`next`). The
 * saved places of panels that are not on offer right now are kept, each after
 * the tab that preceded it in the previous order.
 */
export const storableMobileWorkspaceTabOrder = (next: readonly string[], previous: readonly string[]): MobileWorkspaceTab[] => {
  const stored = completeOrder(next, []);
  const previousIds = previous.filter(isStoredTab).filter((id, index, all) => all.indexOf(id) === index);
  previousIds.forEach((id, index) => {
    if (stored.includes(id)) return;
    const anchor = previousIds.slice(0, index).reverse().find((earlier) => stored.includes(earlier));
    stored.splice(anchor === undefined ? 0 : stored.indexOf(anchor) + 1, 0, id);
  });
  return stored;
};

/**
 * The tabs the user keeps, in order. Never empty: a saved set that hides every
 * tab (written by hand or by an older build) shows them all.
 */
export const shownMobileWorkspaceTabs = (
  order: readonly string[],
  hidden: readonly string[],
  guestTabs: readonly PluginContextPanelMode[] = [],
): MobileWorkspaceTab[] => {
  const all = orderMobileWorkspaceTabs(order, guestTabs);
  const shown = all.filter((id) => !hidden.includes(id));
  return shown.length > 0 ? shown : all;
};

/**
 * The tabs the strip offers right now: the ones the user keeps, plus the open
 * tab while something opened it although it is hidden (a changed file tapped
 * in the chat opens Changes either way). It leaves the strip once the user
 * switches away.
 */
export const stripMobileWorkspaceTabs = (
  order: readonly string[],
  hidden: readonly string[],
  active: MobileWorkspaceTab,
  guestTabs: readonly PluginContextPanelMode[] = [],
): MobileWorkspaceTab[] => {
  const shown = shownMobileWorkspaceTabs(order, hidden, guestTabs);
  if (shown.includes(active)) return shown;
  return orderMobileWorkspaceTabs(order, guestTabs).filter((id) => id === active || shown.includes(id));
};

/**
 * The tab to show for `active`: itself, or the first shown tab when it is a
 * panel that left the catalog (paused, removed, another server).
 */
export const resolveMobileWorkspaceTab = (
  active: MobileWorkspaceTab,
  order: readonly string[],
  hidden: readonly string[],
  guestTabs: readonly PluginContextPanelMode[] = [],
): MobileWorkspaceTab => {
  if (isBuiltInMobileWorkspaceTab(active) || guestTabs.includes(active)) return active;
  return shownMobileWorkspaceTabs(order, hidden, guestTabs)[0];
};
