// The city of Solmar Bay: its road grid, blocks, buildings, trees, lamps,
// beaches and docks. Generated once from a seed, then read-only. Buildings are
// axis-aligned rectangles; every collision test in the game uses them.
import { ROAD, WORLD, districtAt } from './config.js';
import { pick, range } from './random.js';

const ROOF_COLORS = ['#8a6f55', '#6f7f92', '#a08a6a', '#7a6a72', '#5f7a68', '#96705a', '#4f6a7a'];
const WALL_COLORS = ['#c9b18a', '#b8c4cc', '#d8c9a8', '#c4a894', '#a8b8a0', '#d0b8b0'];

export function roadXs() {
  const xs = [];
  for (let x = ROAD.pitch; x < WORLD.width; x += ROAD.pitch) xs.push(x);
  return xs;
}
export function roadYs() {
  const ys = [];
  for (let y = ROAD.pitch; y < WORLD.height; y += ROAD.pitch) ys.push(y);
  return ys;
}
// Is this point on asphalt (within half a road width of a grid line)?
export function onRoad(x, y) {
  const half = ROAD.width / 2;
  const rx = x % ROAD.pitch, ry = y % ROAD.pitch;
  return rx < half || rx > ROAD.pitch - half || ry < half || ry > ROAD.pitch - half;
}
export function nearestRoadPoint(x, y) {
  const nx = Math.round(x / ROAD.pitch) * ROAD.pitch;
  const ny = Math.round(y / ROAD.pitch) * ROAD.pitch;
  return Math.abs(x - nx) < Math.abs(y - ny) ? { x: nx, y } : { x, y: ny };
}

export function createCity(random) {
  const buildings = [];
  const trees = [];
  const lamps = [];
  const piers = [];
  // Beach strip along the south edge, sea beyond it.
  const beach = { x: 0, y: WORLD.height - 240, w: WORLD.width, h: 240 };
  const sea = { x: 0, y: WORLD.height - 90, w: WORLD.width, h: 90 };

  for (let bx = 0; bx < 11; bx += 1) {
    for (let by = 0; by < 8; by += 1) {
      const blockX = bx * ROAD.pitch + ROAD.width / 2 + 18;
      const blockY = by * ROAD.pitch + ROAD.width / 2 + 18;
      const blockW = ROAD.pitch - ROAD.width - 36;
      const blockH = ROAD.pitch - ROAD.width - 36;
      const cx = blockX + blockW / 2, cy = blockY + blockH / 2;
      const d = districtAt(cx, cy);
      // Parks and plazas stay open; the docks hold containers, not towers.
      if (d.name === 'Sunset Park' && random() < 0.55) {
        for (let t = 0; t < 7; t += 1) trees.push({ x: range(random, blockX, blockX + blockW), y: range(random, blockY, blockY + blockH), r: 9 + random() * 7 });
        continue;
      }
      if (d.name === 'Palm Beach' || cy > WORLD.height - 300) {
        for (let t = 0; t < 3; t += 1) trees.push({ x: range(random, blockX, blockX + blockW), y: range(random, blockY, blockY + blockH), r: 8 + random() * 5 });
        continue;
      }
      const downtown = d.name === 'Downtown';
      const count = downtown ? 4 : random() < 0.4 ? 2 : 1;
      for (let i = 0; i < count; i += 1) {
        const w = downtown ? range(random, 70, 110) : range(random, 90, 170);
        const h = downtown ? range(random, 70, 110) : range(random, 70, 130);
        const x = blockX + (count === 1 ? (blockW - w) / 2 : (i % 2) * (blockW - w));
        const y = blockY + (count === 1 ? (blockH - h) / 2 : Math.floor(i / 2) * (blockH - h));
        buildings.push({
          x, y, w, h, roof: pick(random, ROOF_COLORS), wall: pick(random, WALL_COLORS),
          tall: downtown && random() < 0.6, district: d.name,
          name: downtown ? 'Tower' : d.name === 'Harbor Docks' ? 'Warehouse' : 'Block',
        });
      }
      if (random() < 0.7) trees.push({ x: blockX + range(random, 0, blockW), y: blockY + range(random, 0, blockH), r: 8 + random() * 6 });
    }
  }
  for (const x of roadXs()) for (const y of roadYs()) lamps.push({ x: x + ROAD.width / 2 + 6, y: y + ROAD.width / 2 + 6 });
  for (let i = 0; i < 4; i += 1) piers.push({ x: 2550 + i * 220, y: 300, w: 26, h: 210 });

  // Named landmarks the missions and the HUD refer to.
  const landmarks = [
    { name: 'Solmar Safehouse', x: 600, y: 690 },
    { name: 'Marina Pier', x: 2700, y: 480 },
    { name: 'The Rusty Anchor Bar', x: 900, y: 990 },
    { name: 'Solmar General Hospital', x: 1500, y: 1650 },
    { name: 'Harbor Docks Gate', x: 2700, y: 1890 },
    { name: 'Sunset Park Fountain', x: 1800, y: 1590 },
    { name: 'Downtown Plaza', x: 1800, y: 690 },
    { name: 'Palm Beach Boardwalk', x: 1200, y: 2490 },
    { name: 'Cedar Hills Lookout', x: 600, y: 1590 },
    { name: 'Bayview Garage', x: 2400, y: 990 },
  ];
  return { buildings, trees, lamps, piers, beach, sea, landmarks };
}

// Push a circle out of every building it overlaps; returns true on a hit.
// A centre inside a building is pushed out along the smallest penetration.
export function collideBuildings(city, body, radius) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - cx, dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 < 0.001) {
        const left = body.x - b.x + radius, right = b.x + b.w - body.x + radius;
        const top = body.y - b.y + radius, bottom = b.y + b.h - body.y + radius;
        const m = Math.min(left, right, top, bottom);
        if (m === left) body.x = b.x - radius;
        else if (m === right) body.x = b.x + b.w + radius;
        else if (m === top) body.y = b.y - radius;
        else body.y = b.y + b.h + radius;
        continue;
      }
      const d = Math.sqrt(d2);
      body.x = cx + (dx / d) * radius;
      body.y = cy + (dy / d) * radius;
    }
  }
  return hit;
}

export function pointInBuilding(city, x, y) {
  for (const b of city.buildings) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  return false;
}
