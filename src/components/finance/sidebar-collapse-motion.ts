/** Timing for desktop finance sidebar width vs label fade (expand: width first, then text). */
export const SIDEBAR_COLLAPSE_MOTION = {
  widthCollapsedPx: 64,
  widthExpandedPx: 240,
  widthDuration: 0.25,
  widthEase: "easeInOut" as const,
  labelDuration: 0.15,
  /** Fade-in starts after width has mostly grown */
  labelDelayExpand: 0.2,
};
