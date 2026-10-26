import React from 'react';
import { SettingsSection } from '@/components/sections/shared/SettingsSection';
import { SettingsSortableVisibilityList } from '@/components/sections/shared/SettingsSortableVisibilityList';
import { GuestIcon } from '@/components/layout/GuestRailIcon';
import { useMobileGuestTabs, type MobileGuestTab } from '@/hooks/useMobileGuestTabs';
import { useI18n, type I18nKey } from '@/lib/i18n';
import { isBuiltInMobileWorkspaceTab, orderMobileWorkspaceTabs, shownMobileWorkspaceTabs, type BuiltInMobileWorkspaceTab } from '@/lib/mobileWorkspaceTabs';
import { useUIStore } from '@/stores/useUIStore';

const TAB_LABEL_KEYS = {
  status: 'chat.workStatus.ariaLabel',
  changes: 'mobile.menu.git',
  files: 'mobile.menu.files',
  terminal: 'mobile.menu.terminal',
  notes: 'contextRail.surface.notes',
} satisfies Record<BuiltInMobileWorkspaceTab, I18nKey>;

/**
 * Order and visibility of the phone's workspace panel tabs. Stored per
 * device: a phone and a laptop are set up apart. The last tab shown cannot be
 * hidden.
 *
 * Each extension panel the catalog offers is listed after/among the built-ins
 * in the stored order, with the same label and icon as the drawer strip. A
 * saved `plugin:` id whose extension is not on offer right now (paused,
 * removed, another runtime) is not listed but keeps its stored place. On VS
 * Code and the Capacitor app the catalog is unsupported, so only the built-ins
 * show.
 */
export const MobileWorkspaceTabsSettings: React.FC = () => {
  const { t } = useI18n();
  const order = useUIStore((state) => state.mobileWorkspaceTabOrder);
  const hidden = useUIStore((state) => state.mobileWorkspaceHiddenTabs);
  const setOrder = useUIStore((state) => state.setMobileWorkspaceTabOrder);
  const setVisible = useUIStore((state) => state.setMobileWorkspaceTabVisible);
  const guestTabs = useMobileGuestTabs();
  const guestTabModes = React.useMemo(() => guestTabs.map((tab) => tab.mode), [guestTabs]);
  const guestTabById = React.useMemo(
    () => new Map<string, MobileGuestTab>(guestTabs.map((tab) => [tab.mode, tab])),
    [guestTabs],
  );

  const items = React.useMemo(() => {
    const shown = shownMobileWorkspaceTabs(order, hidden, guestTabModes);
    return orderMobileWorkspaceTabs(order, guestTabModes).map((id) => {
      const guestTab = guestTabById.get(id);
      return {
        id,
        label: isBuiltInMobileWorkspaceTab(id) ? t(TAB_LABEL_KEYS[id]) : guestTab?.label ?? id,
        visible: shown.includes(id),
        locked: shown.length === 1 && shown.includes(id),
        icon: guestTab ? <GuestIcon icon={guestTab.icon} iconSrc={guestTab.iconSrc} className="h-3.5 w-3.5" /> : undefined,
      };
    });
  }, [guestTabById, guestTabModes, hidden, order, t]);

  return (
    <SettingsSection
      title={t('settings.layout.general.mobileTabs.title')}
      info={t('settings.layout.general.mobileTabs.info')}
      settingsItem="layout.mobile-workspace-tabs"
    >
      <SettingsSortableVisibilityList
        items={items}
        onVisibleChange={(id, visible) => {
          const tab = orderMobileWorkspaceTabs(order, guestTabModes).find((entry) => entry === id);
          if (tab) setVisible(tab, visible, guestTabModes);
        }}
        onReorder={setOrder}
        settingsItemPrefix="layout.mobile-workspace-tabs."
        dragInstructions={t('settings.layout.general.mobileTabs.dragInstructions')}
      />
    </SettingsSection>
  );
};
