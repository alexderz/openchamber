import React from 'react';
import { matchesFileEditorPattern, type FileEditorContribution } from '@openchamber/sdk';

import { isMobileSurfaceRuntime } from '@/lib/runtimeSurface';

import { isGuestActive } from './capabilities.ts';
import { useGuestsStore } from './store.ts';
import type { InstalledGuest } from './types.ts';

/** The extension editor a file opens in. */
type GuestFileEditorMatch = {
  guestId: string;
  editor: FileEditorContribution;
};

const fileNameOf = (filePath: string): string => filePath.slice(filePath.replace(/\\/g, '/').lastIndexOf('/') + 1);

/**
 * The first active guest's first editor whose patterns match the file's name,
 * in catalog order. `null` when none does. VS Code keeps the catalog empty, and
 * the mobile surface never uses extension editors even though it loads the
 * catalog for its drawer panels, so files there stay with the host's own views.
 */
export const findGuestFileEditor = (
  guests: readonly InstalledGuest[],
  filePath: string,
): GuestFileEditorMatch | null => {
  if (isMobileSurfaceRuntime()) return null;
  const fileName = fileNameOf(filePath);
  if (!fileName) return null;
  for (const guest of guests) {
    if (!guest.fileEditors?.length || !isGuestActive(guest)) continue;
    for (const editor of guest.fileEditors) {
      if (editor.match.some((pattern) => matchesFileEditorPattern(fileName, pattern))) {
        return { guestId: guest.id, editor };
      }
    }
  }
  return null;
};

export const useGuestFileEditor = (filePath: string | null | undefined): GuestFileEditorMatch | null => {
  const guests = useGuestsStore((state) => state.guests);
  return React.useMemo(() => (filePath ? findGuestFileEditor(guests, filePath) : null), [filePath, guests]);
};
