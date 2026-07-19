/* All tunable constants in one place. */

export const HOME = { name: 'LONDON', lat: 51.5074, lng: -0.1278 };

/* Where the roam begins: I moved to London from Hong Kong in January 2024.
   The line opens with a one-way solid "move" segment from ORIGIN to HOME.
   Set MOVED to the actual moving day. The timeline (and the scroll) starts there. */
export const ORIGIN = { name: 'HONG KONG', lat: 22.3193, lng: 114.1694 };
export const MOVED = '2024-01-15';

/* Time-compression + line-shape constants (px are world pixels). */
export const WANDER = {
  DRIFT_DEG: 100, // resting heading while home
  STEP: 5, // polyline sampling step, px
  TURN: 0.05, // max turn per step, radians
  WOBBLE_AMP: 0.012, // organic wobble strength
  WOBBLE_FREQ: 0.006, // organic wobble spatial frequency
  TRIP_PX_PER_DAY: 26, // expanded time while travelling
  HOME_PX_PER_DAY: 3, // compressed time while home
  MIN_TRIP_PX: 420,
  MIN_HOME_PX: 90,
  MOVE_PX: 560, // length of the one-way relocation stroke that opens the line
  PAD: 340, // world padding around the line's bounds
};

export const LAYOUT = {
  KEYFRAME_W: 158, // cover photo display width
  KEYFRAME_GAP: 60, // line → photo edge (photo centre sits gap + h/2 away)
  LABEL_GAP: 22, // photo bottom edge → place label
  DOT_OFFSET: 12, // line → post dot
  POST_FRAC_MIN: 0.15, // posts occupy this range of their trip's arc…
  POST_FRAC_MAX: 0.85, // …positioned by date within the trip
  REVEAL_AHEAD: 120, // items fade in this many px before you reach them
};
