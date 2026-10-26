import React from 'react';

/** A shell element an expanded workspace panel covers: `inert` takes it out of
    the tab order and the accessibility tree, so Tab and assistive tech stay in
    the panel instead of reaching the chat column and the session sidebar behind
    the overlay. Renders the element unchanged — no wrapper node — so the
    shell's flex layout, refs and CSS selectors are untouched. */
export const MobileCoveredByPanel: React.FC<{
  /** True while the workspace panel covers the app (tablet panel expanded). */
  covered: boolean;
  children: React.ReactElement<{ inert?: boolean }>;
}> = ({ covered, children }) =>
  React.cloneElement(children, covered ? { inert: true } : {});
