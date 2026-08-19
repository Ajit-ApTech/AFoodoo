/**
 * Calculate the straight-line distance between two GPS coordinates
 * using the Haversine formula (accurate for Earth's spherical surface).
 * No API key. No cost. Pure math.
 *
 * @returns Distance in kilometers (km)
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Build a Google Maps pin link from GPS coordinates (no API key needed).
 */
export function buildMapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/**
 * Build a Google Maps multi-stop directions URL for a rider route.
 * Supports up to 10 waypoints per Google Maps URL limit.
 * If more stops are needed, call this function multiple times with sliced arrays.
 *
 * @param originLat  Kitchen latitude
 * @param originLng  Kitchen longitude
 * @param stops      Array of { lat, lng } customer stops in delivery order
 * @returns Google Maps directions URL
 */
export function buildRouteUrl(
  originLat: number,
  originLng: number,
  stops: Array<{ lat: number; lng: number }>
): string {
  if (stops.length === 0) return buildMapsLink(originLat, originLng);

  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(0, -1);

  let url = `https://www.google.com/maps/dir/?api=1`;
  url += `&origin=${originLat},${originLng}`;
  url += `&destination=${destination.lat},${destination.lng}`;
  if (waypoints.length > 0) {
    url += `&waypoints=${waypoints.map(s => `${s.lat},${s.lng}`).join('|')}`;
  }
  url += `&travelmode=driving`;
  return url;
}

/**
 * Sort delivery stops from a starting point using the Nearest-Neighbor algorithm.
 * Runs in O(n²) — fine for typical tiffin delivery routes (5–20 stops).
 *
 * @param startLat   Starting latitude (kitchen)
 * @param startLng   Starting longitude (kitchen)
 * @param stops      Array of stops with lat, lng, and any other fields
 * @returns          Stops sorted in nearest-neighbor order
 */
export function nearestNeighborSort<T extends { lat: number; lng: number }>(
  startLat: number,
  startLng: number,
  stops: T[]
): T[] {
  const remaining = [...stops];
  const sorted: T[] = [];
  let currentLat = startLat;
  let currentLng = startLng;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;

    remaining.forEach((stop, idx) => {
      const dist = haversineDistance(currentLat, currentLng, stop.lat, stop.lng);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = idx;
      }
    });

    const nearest = remaining.splice(nearestIdx, 1)[0];
    sorted.push(nearest);
    currentLat = nearest.lat;
    currentLng = nearest.lng;
  }

  return sorted;
}
