# Mobile extension panels: design note (draft for #5619)

Status: draft in the alexderz fork, not a PR. Base: upstream `main` (3cbe575ac,
2026-10-25). Every product question below waits for a maintainer answer on
#5619 or an Ideas discussion; the code follows whatever they decide.

## What the user gets

On the mobile surface (phone, foldable front screen, tablet), an extension
that contributes a `panel` shows up as a tab in the workspace drawer, after
Status, Git, Files, Terminal and Notes. Settings › General › "Workspace panel
tabs" lists it like the built-in tabs, so the user can hide it or drag it
first. On a tablet, where the workspace sits beside the chat as a panel, an
expand button lets the panel cover the chat; close or back returns.

## Where it lives today (main)

| Spot | Source |
|---|---|
| Catalog marked `unsupported` on mobile | `packages/ui/src/lib/guests/load-catalog.ts` (`isVSCodeRuntime() \|\| isMobileSurfaceRuntime()`) |
| Fixed tab list, order and hidden helpers | `packages/ui/src/lib/mobileWorkspaceTabs.ts` (`MOBILE_WORKSPACE_TABS`, `orderMobileWorkspaceTabs`, `shownMobileWorkspaceTabs`, `stripMobileWorkspaceTabs`) |
| Stored order and hidden set | `packages/ui/src/stores/useUIStore.ts` (`mobileWorkspaceTabOrder`, `mobileWorkspaceHiddenTabs`, plain string ids, per device) |
| Drawer tabs and panes | `packages/ui/src/apps/MobileWorkspaceDrawer.tsx` (`tabDefinitions`, keep-mounted panes) |
| Drawer host, phone vs tablet panel | `packages/ui/src/apps/MobileApp.tsx` (`workspaceTab`, `variant={workspaceAsPanel ? 'panel' : 'drawer'}`) |
| Settings list | `packages/ui/src/components/sections/openchamber/MobileWorkspaceTabsSettings.tsx` (`TAB_LABEL_KEYS`) |
| Desktop guest panel | `packages/ui/src/components/layout/ContextSurfacePanes.tsx` (`PluginPane`, `GuestSurfacePane`, `DockedGuestPage`) |

Since 2.5.1 the MCP tab became a Status section and Status became the first
tab; the five ids are now `status, changes, files, terminal, notes`.

## 1. Extension tabs in the drawer

- **Tab id.** A guest tab uses the existing context panel mode,
  `plugin:<guest id>` (`pluginModeFromId`). No new id scheme, and the same id
  the desktop rail stores in `contextRailOrder`.
- **Which guests.** The ones the desktop rail lists: `enabledGuestSurfaces`
  (active, with a page or a shared surface), in catalog order. Rail and
  drawer then always agree on what a panel is.
- **Catalog.** `load-catalog.ts` stops marking the hosted mobile surface
  `unsupported`. The Capacitor app keeps `unsupported` until someone tests
  guest frames inside its WebView; that difference is one named check
  (`isCapacitorApp()`), visible in code.
- **What else the catalog would switch on.** Each consumer keeps its own
  gate, so only the drawer tabs are new:
  - pages, actions, commands, attach rows and Work Status sections already
    check `isMobileSurfaceRuntime()` in `useGuestSurfaces.ts`; unchanged;
  - guest file editors read the store directly; they get an explicit mobile
    gate, so mobile Files keeps the host's own viewers;
  - tool presentation (`contributes.tools`) reads the store directly and is
    host-drawn text; it starts applying in the mobile chat, the same as web.
    (Open question: keep it, or gate it too.)
- **Rendering.** A drawer tab mounts what the desktop zone mounts for that
  guest: `PluginPane mode=…` for an iframe panel, `GuestSurfacePane` for a
  shared surface, the docked layout for both. That branch moves out of
  `ContextSurfacePanes.tsx` into one small component both hosts render, so
  they cannot drift. `PluginPane` already takes its directory and session
  from the shared stores, which the mobile shell fills the same way.
  Iframe panes stay mounted once visited, like the other drawer panes; a
  shared surface mounts only while shown, as on desktop.
- **Labels and icons.** Name from `panel.name`, icon through the same
  resolver as the rail (`resolveGuestIconName`, `guestPackageIconSrc`).
- **Catalog changes.** A guest that is disabled, removed, or gone after a
  runtime switch drops out of the strip; if it was the open tab the drawer
  falls back to the first shown tab. Its saved place in the order is kept, the
  way the rail keeps saved ids of unavailable extensions.
- **Popovers, openSurface, openCommit.** `PluginPane` keeps answering
  `UNSUPPORTED` for these on mobile, as now. A later PR can map `openSurface`
  to "switch drawer tab".

## 2. The user picks the tabs

- `mobileWorkspaceTabs.ts` helpers take the current guest tab ids as an
  argument. Built-in ids keep their default order; guest ids follow, in
  catalog order. Stored values stay plain string ids, so nothing is migrated:
  an older build reading a new order drops the `plugin:` ids as it already
  drops unknown ids, and a newer build reading an old order appends the guests.
- Saved ids of guests that are not in the catalog right now stay in the
  stored order and hidden set (not shown, not dropped), so a guest that comes
  back after a runtime switch or a re-enable lands where the user put it.
- "The last shown tab cannot be hidden" counts guest tabs too.
- Settings lists guest tabs with the same row, label and icon as the strip.
  On the desktop surface the Settings list shows only the built-in tabs while
  the catalog there is loaded; open question whether to list guests there too
  (it is per device, so a laptop editing it is rare).
- **Default.** A newly installed panel is shown at the end. With the
  optional manifest hint (4), a panel without `panel.mobile: true` would start
  hidden instead. Maintainer call.

## 3. Full screen

- **Phone.** The drawer already covers the whole app below its 56 px header
  (fixed, inset 0), and close, the edge swipe, Escape and Android back return
  to the chat. So on a phone the panel is already full screen; the 412 px
  screenshots show it. No new control there unless the maintainer wants the
  header hidden too.
- **Tablet (panel variant).** The workspace sits beside the chat and is
  squeezed. An expand button in the drawer header, next to close, switches
  the same component to the full-cover presentation (`variant="drawer"`),
  without remounting the panes, so a guest frame keeps its state. Collapse,
  close, Escape or back return to the side panel or the chat. The expanded
  state is memory only.
- The button uses the desktop panel's expand icon and aria label, so it
  reads as the same control.

## 4. Manifest hint (optional, separate PR)

`panel.mobile?: boolean` in the SDK manifest schema (`packages/sdk`), carried
on the catalog row. `true` shows the tab by default on mobile; absent or
`false` starts it hidden but still listed in Settings. Older hosts ignore the
field (the parser accepts unknown panel keys? to verify before proposing).

## Runtimes

| Runtime | After |
|---|---|
| Web | unchanged |
| Desktop (Electron) | unchanged |
| VS Code | unchanged, catalog stays `unsupported` |
| Hosted mobile | catalog loads; guest panels as drawer tabs; tab settings include them; tablet expand |
| Capacitor mobile | unchanged, catalog stays `unsupported` (named check) |

## Tests

- `mobileWorkspaceTabs` helpers with guest ids: default order, saved order
  with unknown and missing guests, hide-last rule, strip with an active
  hidden guest tab.
- `load-catalog`: hosted mobile loads, Capacitor and VS Code stay
  `unsupported`.
- `useUIStore` setters keep guest ids and ids of absent guests.
- Drawer: a guest tab renders `PluginPane`; a removed guest drops out and the
  active tab falls back.

## Open questions for the maintainer

1. Ideas discussion first? CONTRIBUTING asks for one before a feature PR.
2. Default for a newly installed panel on mobile: shown at the end, or
   hidden until the user turns it on (or until `panel.mobile`)?
3. Tool presentation on mobile: on (as above) or gated?
4. One PR or three (catalog + tabs, settings, expand)?
5. Capacitor app: keep `unsupported`, or test it in the same PR?
