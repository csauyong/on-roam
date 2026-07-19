export interface TripMeta {
  id: string;
  place: string;
  name: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

export interface PostMeta {
  title: string;
  place: string;
  date: string; // YYYY-MM-DD
  description: string;
  cover?: boolean;
  tripId: string;
  /* "photo" (default): short description under the photo.
     "reflection": long-form caption (blank-line-separated paragraphs) with the
     short title rendered on the photo itself. */
  type?: 'photo' | 'reflection';
}

export interface Post extends PostMeta {
  slug: string;
}

export interface Trip extends TripMeta {
  bearingDeg: number; // derived: initial great-circle bearing from home
  posts: Post[]; // sorted by date asc
  cover: Post;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/* Flat arc-length table for the whole line. */
export interface ArcTable {
  px: number[];
  py: number[];
  cum: number[];
  total: number;
}

export interface SpanOut {
  type: 'home' | 'trip' | 'move';
  tripId?: string;
  place?: string;
  d0: number; // epoch ms
  d1: number;
  s0: number; // arc length range
  s1: number;
  len: number;
  d: string; // SVG path data
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
