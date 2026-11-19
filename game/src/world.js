// Runtime world state for Solmar Bay: player, cars, pedestrians, weather and clock.
// Pure state + helpers; rendering and input live in their own modules.
import {
  CAR_MODELS, PLAYER, WORLD_W, WORLD_H, DAY_LENGTH_SEC, DEFAULT_SEED,
} from './config.js';
import { buildCity, buildingAt, inSea, onRoad, snapToRoad } from './city.js';
import { makeRng, clamp } from './random.js';

let nextId = 1;
export function freshId() {
  return nextId++;
}

export function createWorld(seed = DEFAULT_SEED) {
  const rng = makeRng(seed);
  const city = buildCity(seed);
  const world = {
    seed,
    city,
    rng,
    time: 0, // seconds since midnight (game clock)
    day: 1,
    rain: 0, // 0 dry .. 1 pouring
    rainTimer: rng.range(40, 120),
    cash: 150,
    health: PLAYER.maxHealth,
    ammo: PLAYER.pistolAmmo,
    wanted: 0,
    heat: 0,
    lastCrimeAt: -999,
    missionIndex: 0,
    mission: null, // active mission runtime state
    completedMissions: [],
    player: {
      x: 1560, y: 1140, angle: -Math.PI / 2, speed: 0,
      onFoot: true, car: null, health: PLAYER.maxHealth,
      punchCooldown: 0, shootCooldown: 0, dead: false,
    },
    cars: [],
    peds: [],
    cops: [],
    thugs: [],
    bullets: [],
    particles: [],
    messages: [],
    stats: { carsStolen: 0, thugsDown: 0, missionsDone: 0, distanceDriven: 0 },
    camera: { x: 1560, y: 1140 },
    paused: false,
    mode: 'title', // title | play | busted | wasted | won
  };

  // Parked cars around the city, one per few blocks, always on a road edge.
  for (let i = 0; i < 26; i++) {
    const spot = snapToRoad(rng.range(200, WORLD_W - 400), rng.range(200, WORLD_H - 300));
    const model = rng.pick(CAR_MODELS);
    world.cars.push(makeCar(model, spot, rng));
  }
  // A few moving traffic cars to start with.
  for (let i = 0; i < 10; i++) {
    const spot = snapToRoad(rng.range(200, WORLD_W - 400), rng.range(200, WORLD_H - 300));
    const model = rng.pick(CAR_MODELS);
    const car = makeCar(model, spot, rng);
    car.driver = true;
    car.speed = rng.range(80, 160);
    world.cars.push(car);
  }
  // Pedestrians on sidewalks.
  for (let i = 0; i < 34; i++) {
    world.peds.push(makePed(rng));
  }
  return world;
}

export function makeCar(model, spot, rng) {
  const angle = spot.along === 'v'
    ? (rng ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : Math.PI / 2)
    : (rng ? (rng.chance(0.5) ? 0 : Math.PI) : 0);
  const lane = 20;
  return {
    id: freshId(),
    model: model.id,
    name: model.name,
    color: model.color,
    top: model.top,
    accel: model.accel,
    grip: model.grip,
    len: model.len,
    wid: model.wid,
    x: spot.along === 'v' ? spot.x + lane : spot.x,
    y: spot.along === 'v' ? spot.y : spot.y + lane,
    angle,
    speed: 0,
    steer: 0,
    damage: 0, // 0 fine .. 100 wrecked
    driver: false, // a traffic driver is behind the wheel
    police: false,
    target: null, // traffic waypoint
    honk: 0,
  };
}

export function makePed(rng) {
  const spot = snapToRoad(rng.range(200, WORLD_W - 400), rng.range(200, WORLD_H - 300));
  return {
    id: freshId(),
    x: spot.x + rng.range(-70, 70),
    y: spot.y + rng.range(-70, 70),
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(28, 52),
    color: rng.pick(['#d95f4b', '#4b8ad9', '#e8c84b', '#7ad94b', '#c94bd9', '#e8e8e8', '#3a3a3a']),
    panic: 0,
    target: null,
  };
}

export function makeThug(x, y, rng) {
  return {
    id: freshId(),
    x, y,
    angle: rng ? rng.range(0, Math.PI * 2) : 0,
    speed: 0,
    health: 100,
    color: '#8a2f2f',
    armed: true,
    shootCooldown: rng ? rng.range(0.5, 1.5) : 1,
    down: false,
  };
}

export function makeCopCar(x, y, rng) {
  const car = makeCar(
    { id: 'pd', name: 'Solmar PD Interceptor', color: '#20242c', top: 355, accel: 290, grip: 3.6, len: 56, wid: 27 },
    { x, y, along: 'v' }, rng,
  );
  car.police = true;
  car.driver = true;
  return car;
}

// --- movement helpers -------------------------------------------------------

export function collidesBuilding(city, x, y, radius) {
  for (const b of city.buildings) {
    const cx = clamp(x, b.x, b.x + b.w);
    const cy = clamp(y, b.y, b.y + b.h);
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < radius * radius) return b;
  }
  return null;
}

export function moveOnFoot(world, dx, dy, dt) {
  const p = world.player;
  // Sub-step so a long frame can never tunnel through a thin building.
  const totalX = dx * dt;
  const totalY = dy * dt;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(totalX), Math.abs(totalY)) / 8));
  for (let i = 0; i < steps; i++) {
    const nx = clamp(p.x + totalX / steps, 20, WORLD_W - 20);
    const ny = clamp(p.y + totalY / steps, 20, WORLD_H - 20);
    if (!collidesBuilding(world.city, nx, p.y, 12) && !inSea(nx, p.y)) p.x = nx;
    if (!collidesBuilding(world.city, p.x, ny, 12) && !inSea(p.x, ny)) p.y = ny;
  }
  if (dx !== 0 || dy !== 0) p.angle = Math.atan2(dy, dx);
}

// --- clock, weather ---------------------------------------------------------

export function clockHours(world) {
  return (world.time / 3600) % 24;
}

export function isNight(world) {
  const h = clockHours(world);
  return h < 6 || h >= 19;
}

export function isDusk(world) {
  const h = clockHours(world);
  return (h >= 17 && h < 19) || (h >= 6 && h < 7.5);
}

export function updateClock(world, dt) {
  world.time += (dt * 86400) / DAY_LENGTH_SEC;
  if (world.time >= 86400) {
    world.time -= 86400;
    world.day += 1;
  }
  world.rainTimer -= dt;
  if (world.rainTimer <= 0) {
    if (world.rain > 0.1) {
      world.rain = 0;
      world.rainTimer = world.rng.range(50, 160);
    } else {
      world.rain = world.rng.range(0.35, 0.9);
      world.rainTimer = world.rng.range(25, 70);
    }
  }
  world.rain = clamp(world.rain, 0, 1);
}

// --- save / load ------------------------------------------------------------

export function serialize(world) {
  const p = world.player;
  return {
    v: 1,
    cash: world.cash,
    health: world.health,
    ammo: world.ammo,
    missionIndex: world.missionIndex,
    completedMissions: world.completedMissions,
    time: world.time,
    day: world.day,
    player: { x: p.x, y: p.y, angle: p.angle, onFoot: p.onFoot },
    stats: world.stats,
  };
}

export function applySave(world, data) {
  if (!data || data.v !== 1) return false;
  world.cash = data.cash ?? world.cash;
  world.health = data.health ?? world.health;
  world.ammo = data.ammo ?? world.ammo;
  world.missionIndex = data.missionIndex ?? 0;
  world.completedMissions = data.completedMissions ?? [];
  world.time = data.time ?? world.time;
  world.day = data.day ?? 1;
  const p = world.player;
  p.x = data.player?.x ?? p.x;
  p.y = data.player?.y ?? p.y;
  p.angle = data.player?.angle ?? p.angle;
  p.onFoot = data.player?.onFoot ?? true;
  p.car = null;
  world.stats = { ...world.stats, ...(data.stats ?? {}) };
  return true;
}

export function nearestCar(world, x, y, maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const c of world.cars) {
    const dx = c.x - x;
    const dy = c.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

export function carsNear(world, x, y, radius) {
  const out = [];
  for (const c of world.cars) {
    const dx = c.x - x;
    const dy = c.y - y;
    if (dx * dx + dy * dy < radius * radius) out.push(c);
  }
  return out;
}
