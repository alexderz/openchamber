import React from 'react';

import type { IconName } from '@/components/icon/icons';
import { useGuestSurfaces } from '@/hooks/useGuestSurfaces';
import { useGuestsStore } from '@/lib/guests/store';
import { guestPanelLayout, type GuestPanelLayout } from '@/lib/guests/surfaces';
import { useI18n } from '@/lib/i18n';
import { isPluginContextPanelMode, pluginIdFromMode, type PluginContextPanelMode } from '@/lib/surfaces/modes';

/** An extension panel as a tab of the mobile workspace drawer. */
export type MobileGuestTab = {
  mode: PluginContextPanelMode;
  label: string;
  icon: IconName;
  iconSrc?: string;
  layout: GuestPanelLayout;
};

/**
 * The extension panels the drawer offers: exactly the desktop rail's list
 * (`useGuestSurfaces`), in catalog order, so rail and drawer agree on what a
 * panel is. Also loads the catalog, like the rail does.
 */
export const useMobileGuestTabs = (): MobileGuestTab[] => {
  const { t } = useI18n();
  const surfaces = useGuestSurfaces();
  const guests = useGuestsStore((state) => state.guests);
  return React.useMemo(() => surfaces.flatMap((surface) => {
    if (!isPluginContextPanelMode(surface.mode)) return [];
    const guestId = pluginIdFromMode(surface.mode);
    return [{
      mode: surface.mode,
      label: surface.label ?? t(surface.labelKey),
      icon: surface.icon,
      iconSrc: surface.iconSrc,
      layout: guestPanelLayout(guests.find((guest) => guest.id === guestId)),
    }];
  }), [guests, surfaces, t]);
};
