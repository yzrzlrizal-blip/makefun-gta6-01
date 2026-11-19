// Traffic cars and pedestrians: they drive the road grid, brake for obstacles,
// and pedestrians stroll the sidewalks and flee from gunfire.
import { ROADS_V, ROADS_H, WORLD_W, WORLD_H } from './config.js';
import { buildingAt, snapToRoad } from './city.js';
import { angleDiff, clamp, dist2, wrapAngle } from './random.js';

function nearestRoadLine(pos, lines) {
  let best = lines[0];
  for (const l of lines) if (Math.abs(l - pos) < Math.abs(best - pos)) best = l;
  return best;
}

// Pick the next intersection a traffic car should head for.
export function pickTrafficTarget(car, rng) {
  const vertical = rng.chance(0.5);
  if (vertical) {
    const x = rng.pick(ROADS_V);
    const y = rng.pick(ROADS_H);
    return { x, y };
  }
  const x = rng.pick(ROADS_V);
  const y = rng.pick(ROADS_H);
  return { x, y };
}

function carAhead(world, car, lookDist) {
  const cx = Math.cos(car.angle);
  const cy = Math.sin(car.angle);
  let closest = Infinity;
  for (const other of world.cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * cx + dy * cy;
    if (along < 0 || along > lookDist) continue;
    const side = Math.abs(-dx * cy + dy * cx);
    if (side < 34 && along < closest) closest = along;
  }
  // The player on foot in front of the car also makes it brake.
  const p = world.player;
  if (p.onFoot && !p.dead) {
    const dx = p.x - car.x;
    const dy = p.y - car.y;
    const along = dx * cx + dy * cy;
    if (along > 0 && along < lookDist && Math.abs(-dx * cy + dy * cx) < 30) {
      closest = Math.min(closest, along);
    }
  }
  return closest;
}

export function updateTraffic(world, dt) {
  for (const car of world.cars) {
    if (!car.driver || car.police) continue;
    if (!car.target || dist2(car.x, car.y, car.target.x, car.target.y) < 40 * 40) {
      car.target = pickTrafficTarget(car, world.rng);
    }
    const want = Math.atan2(car.target.y - car.y, car.target.x - car.x);
    const turn = clamp(angleDiff(car.angle, want), -1, 1);
    car.angle = wrapAngle(car.angle + turn * 1.6 * dt);
    const ahead = carAhead(world, car, 150);
    const cruise = 120;
    if (ahead < 90) {
      car.speed = Math.max(0, car.speed - 320 * dt);
    } else if (car.speed < cruise) {
      car.speed = Math.min(cruise, car.speed + 110 * dt);
    }
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!buildingAt(world.city, nx, ny)) {
      car.x = clamp(nx, 30, WORLD_W - 30);
      car.y = clamp(ny, 30, WORLD_H - 30);
    } else {
      car.speed = 0;
      car.target = pickTrafficTarget(car, world.rng);
    }
    // Keep traffic cars roughly on the road: if they drifted off, steer back.
    if (!onRoadNear(car.x, car.y)) {
      const snap = snapToRoad(car.x, car.y);
      car.target = { x: snap.x, y: snap.y };
    }
  }
}

export function onRoadNear(x, y) {
  for (const rx of ROADS_V) if (Math.abs(x - rx) < 90) return true;
  for (const ry of ROADS_H) if (Math.abs(y - ry) < 90) return true;
  return false;
}

export function updatePeds(world, dt) {
  const p = world.player;
  for (const ped of world.peds) {
    const dPlayer = dist2(ped.x, ped.y, p.x, p.y);
    const gunfire = world.bullets.length > 0 && dPlayer < 500 * 500;
    if (gunfire || ped.panic > 0) {
      ped.panic = Math.max(ped.panic, 1.5);
      // Flee away from the player.
      const away = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.angle = away;
      ped.speed = 150;
    } else {
      ped.speed = 40;
      if (!ped.target || dist2(ped.x, ped.y, ped.target.x, ped.target.y) < 30 * 30) {
        const snap = snapToRoad(
          clamp(ped.x + world.rng.range(-300, 300), 100, WORLD_W - 100),
          clamp(ped.y + world.rng.range(-300, 300), 100, WORLD_H - 100),
        );
        ped.target = { x: snap.x + world.rng.range(-50, 50), y: snap.y + world.rng.range(-50, 50) };
      }
      ped.angle = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
    }
    ped.panic = Math.max(0, ped.panic - dt);
    const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
    if (!buildingAt(world.city, nx, ny)) {
      ped.x = clamp(nx, 20, WORLD_W - 20);
      ped.y = clamp(ny, 20, WORLD_H - 20);
    } else {
      ped.target = null;
    }
  }
}

// A traffic car the player hits hard becomes a crash: damage + sparks + heat.
export function crashCheck(world, car) {
  if (car.damage >= 100) return;
  for (const other of world.cars) {
    if (other === car) continue;
    const d = dist2(car.x, car.y, other.x, other.y);
    const minD = (car.len + other.len) / 2 - 6;
    if (d < minD * minD && Math.abs(car.speed) > 60) {
      car.damage = Math.min(100, car.damage + 12);
      other.damage = Math.min(100, other.damage + 10);
      car.speed *= 0.35;
      other.speed *= 0.5;
      spawnSparks(world, (car.x + other.x) / 2, (car.y + other.y) / 2);
      return true;
    }
  }
  return false;
}

export function spawnSparks(world, x, y) {
  for (let i = 0; i < 8; i++) {
    world.particles.push({
      x, y,
      vx: world.rng.range(-120, 120),
      vy: world.rng.range(-120, 120),
      life: 0.4,
      color: '#ffd23e',
      size: 3,
    });
  }
}
