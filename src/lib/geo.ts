import type { LatLng } from './types';

const rad = (d: number) => (d * Math.PI) / 180;

/* Initial great-circle bearing from a to b, degrees clockwise from north. */
export function initialBearing(a: LatLng, b: LatLng): number {
  const p1 = rad(a.lat);
  const p2 = rad(b.lat);
  const dl = rad(b.lng - a.lng);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) * 180) / Math.PI >= 0
    ? (Math.atan2(y, x) * 180) / Math.PI
    : (Math.atan2(y, x) * 180) / Math.PI + 360;
}
