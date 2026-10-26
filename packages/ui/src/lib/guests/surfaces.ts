import { GUEST_SURFACE_DOCK_DEFAULT, GUEST_SURFACE_DOCK_SIZE_DEFAULT, hasGuestPage, type GuestSurfaceDock } from '@openchamber/sdk';

import type { ContextSurfaceDescriptor } from '@/lib/surfaces/registry';
import { pluginModeFromId } from '@/lib/surfaces/modes';

import { isGuestActive } from './capabilities.ts';

import { guestPackageIconSrc, resolveGuestIconName } from './icon.ts';
import type { InstalledGuest } from './types.ts';

/** An extension whose rail panel is a host-drawn shared surface, not an iframe. */
const guestHasSharedSurface = (guest: Pick<InstalledGuest, 'service'>): boolean => guest.service?.surface === true;

export type GuestSurfaceDocking = { dock: GuestSurfaceDock; size: number };

/**
 * Where the extension's own page sits beside its shared surface (a toolbar
 * above, a tool column beside) and how thick it is, or null when the
 * surface is the whole panel.
 */
const guestSurfaceDocking = (guest: Pick<InstalledGuest, 'service' | 'entry' | 'entryDock' | 'entrySize'>): GuestSurfaceDocking | null => {
  if (!guestHasSharedSurface(guest) || !guest.entry) return null;
  return { dock: guest.entryDock ?? GUEST_SURFACE_DOCK_DEFAULT, size: guest.entrySize ?? GUEST_SURFACE_DOCK_SIZE_DEFAULT };
};

/**
 * How a panel draws its content: the extension's own page in an iframe, a
 * host-drawn shared surface, or both (the page docked beside the surface).
 * The desktop zone and the mobile drawer both branch on this.
 */
export type GuestPanelLayout =
  | { kind: 'page' }
  | { kind: 'surface' }
  | { kind: 'docked'; docking: GuestSurfaceDocking };

/** An extension missing from the catalog is a page: its pane shows the unavailable state. */
export const guestPanelLayout = (guest: InstalledGuest | undefined): GuestPanelLayout => {
  if (!guest || !guestHasSharedSurface(guest)) return { kind: 'page' };
  const docking = guestSurfaceDocking(guest);
  return docking ? { kind: 'docked', docking } : { kind: 'surface' };
};

/**
 * Whether the host keeps a panel out of the tree while it is not shown. A
 * shared surface holds a socket and a service that can idle out, so the
 * desktop zone and the mobile drawer mount it only while it is on screen; an
 * iframe page, with or without a docked surface, stays mounted once opened.
 */
export const guestPanelUnmountsWhenHidden = (layout: GuestPanelLayout): boolean => layout.kind === 'surface';

/**
 * Rail surfaces for the enabled guests with a page or a shared surface, in
 * catalog order. The rail and the digit shortcuts must agree on this list.
 * Background-only and tools-only extensions have no visible panel and get
 * no surface.
 */
export const enabledGuestSurfaces = (
  guests: readonly InstalledGuest[],
  authenticatedAsset: (path: string) => string,
): ContextSurfaceDescriptor[] => guests
  .filter((guest) => isGuestActive(guest) && (hasGuestPage({ panel: guest }) || guestHasSharedSurface(guest)))
  .map((guest) => guestSurfaceFromInstalled(guest, authenticatedAsset));

const guestSurfaceFromInstalled = (
  guest: InstalledGuest,
  authenticatedAsset: (path: string) => string,
): ContextSurfaceDescriptor => ({
  id: pluginModeFromId(guest.id),
  mode: pluginModeFromId(guest.id),
  icon: resolveGuestIconName(guest.icon),
  iconSrc: guestPackageIconSrc(guest.id, guest.icon, authenticatedAsset),
  label: guest.name,
  labelKey: 'contextRail.surface.plugin',
  descriptionKey: 'contextRail.surface.plugin.description',
  availability: 'always',
});
