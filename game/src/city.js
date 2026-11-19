// Solmar Bay city layout: road grid, districts, buildings, parks, beach and sea.
// Pure generation from a seed — no DOM, no canvas — so it can be unit-tested.
import { DISTRICTS, ROADS_V, ROADS_H, ROAD_W, WORLD_W, WORLD_H } from './config.js';
import { makeRng } from './random.js';

export const SEA_X = 2980; // water begins here, along the east edge
export const BEACH_X = 2900; // sand strip just west of the sea
export const SOUTH_BEACH_Y = 2260; // sand along the south edge
export const SOUTH_SEA_Y = 2330;

const PALETTE = {
  Downtown: ['#4d5f7d', '#5d6b8a', '#6b5d7d', '#3f5870', '#7d6b4d'],
  'Old Town': ['#8a6a44', '#7a5c3e', '#96714f', '#6b4f33', '#a07a52'],
  'The Marina': ['#4a7d8a', '#5d8a96', '#3e6b78', '#6b8a7d'],
  'Palm Beach': ['#c9a06a', '#b98f5c', '#d4af7a', '#a8845a'],
  'Harbor Docks': ['#6b6558', '#5c564a', '#7a7264', '#4f4a3e'],
  'Cedar Hills': ['#5d7a52', '#4f6b46', '#6b8a5c', '#59704a'],
  'Sunset Park': ['#5c7a4e', '#6b8a5c', '#4f6b46'],
};

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[0];
}

export function onRoad(x, y) {
  for (const rx of ROADS_V) {
    if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  }
  for (const ry of ROADS_H) {
    if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  }
  return false;
}

export function inSea(x, y) {
  return x >= SEA_X || y >= SOUTH_SEA_Y;
}

export function onBeach(x, y) {
  return (x >= BEACH_X && x < SEA_X && y < SOUTH_SEA_Y) || (y >= SOUTH_BEACH_Y && y < SOUTH_SEA_Y);
}

function nearestRoadX(x) {
  let best = ROADS_V[0];
  for (const rx of ROADS_V) if (Math.abs(rx - x) < Math.abs(best - x)) best = rx;
  return best;
}

function nearestRoadY(y) {
  let best = ROADS_H[0];
  for (const ry of ROADS_H) if (Math.abs(ry - y) < Math.abs(best - y)) best = ry;
  return best;
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const parks = [];
  const palms = [];
  const landmarks = [];

  // Buildings fill the blocks between roads.
  const xs = [40, ...ROADS_V, WORLD_W - 40];
  const ys = [40, ...ROADS_H, WORLD_H - 40];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const bx0 = xs[i] + ROAD_W / 2 + 12;
      const bx1 = xs[i + 1] - ROAD_W / 2 - 12;
      const by0 = ys[j] + ROAD_W / 2 + 12;
      const by1 = ys[j + 1] - ROAD_W / 2 - 12;
      const bw = bx1 - bx0;
      const bh = by1 - by0;
      if (bw < 60 || bh < 60) continue;
      if (bx0 > BEACH_X - 40 || by0 > SOUTH_BEACH_Y - 40) continue; // keep the beach clear
      const cx = (bx0 + bx1) / 2;
      const cy = (by0 + by1) / 2;
      const district = districtAt(cx, cy);
      // Sunset Park district is mostly green, with one pavilion.
      if (district.name === 'Sunset Park') {
        if (rng.chance(0.75)) {
          parks.push({ x: bx0, y: by0, w: bw, h: bh, trees: rng.int(6, 14) });
          continue;
        }
      } else if (rng.chance(0.16)) {
        parks.push({ x: bx0, y: by0, w: bw, h: bh, trees: rng.int(3, 9) });
        continue;
      }
      const n = rng.int(2, 4);
      for (let k = 0; k < n; k++) {
        const w = rng.range(60, Math.min(150, bw * 0.55));
        const h = rng.range(55, Math.min(130, bh * 0.55));
        const x = rng.range(bx0, bx1 - w);
        const y = rng.range(by0, by1 - h);
        const colors = PALETTE[district.name] || PALETTE.Downtown;
        buildings.push({
          x, y, w, h,
          color: rng.pick(colors),
          roof: rng.pick(['#2c2f36', '#3a3f47', '#54452f', '#26313a']),
          tall: district.name === 'Downtown' && rng.chance(0.45),
          district: district.name,
          seed: rng.int(0, 999999),
        });
      }
    }
  }

  // Palm trees line the beach and the Marina promenade.
  for (let y = 120; y < SOUTH_BEACH_Y; y += 90) {
    palms.push({ x: BEACH_X + 22 + rng.range(-8, 8), y: y + rng.range(-20, 20) });
  }
  for (let x = 2440; x < 2920; x += 110) {
    palms.push({ x: x + rng.range(-15, 15), y: 250 + rng.range(-10, 10) });
  }

  landmarks.push(
    { name: 'Solmar Tower', x: 1560, y: 500, kind: 'tower' },
    { name: 'Old Town Market', x: 500, y: 500, kind: 'market' },
    { name: 'Marina Pier', x: 2940, y: 480, kind: 'pier' },
    { name: 'Cedar Hills Garage', x: 1500, y: 1780, kind: 'garage' },
    { name: 'Harbor Crane', x: 420, y: 1780, kind: 'crane' },
    { name: 'Palm Beach Boardwalk', x: 2700, y: 1800, kind: 'boardwalk' },
  );

  return {
    roadsV: [...ROADS_V],
    roadsH: [...ROADS_H],
    buildings,
    parks,
    palms,
    landmarks,
    roadWidth: ROAD_W,
    worldW: WORLD_W,
    worldH: WORLD_H,
  };
}

// Point-in-building test used by movement and traffic collision.
export function buildingAt(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return b;
  }
  return null;
}

// Snap a point onto the nearest road centre line (used for car spawns).
export function snapToRoad(x, y) {
  const rx = nearestRoadX(x);
  const ry = nearestRoadY(y);
  if (Math.abs(x - rx) < Math.abs(y - ry)) return { x: rx, y, along: 'v' };
  return { x, y: ry, along: 'h' };
}
