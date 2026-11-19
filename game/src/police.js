// Solmar PD wanted system: heat rises with crimes, stars follow heat,
// police cars hunt the player, and escaping cools everything down.
import { WANTED, WORLD_W, WORLD_H } from './config.js';
import { makeCopCar } from './world.js';
import { angleDiff, clamp, dist2, wrapAngle } from './random.js';
import { snapToRoad } from './city.js';

export function starsForHeat(heat) {
  let stars = 0;
  for (let i = 0; i < WANTED.thresholds.length; i++) {
    if (heat >= WANTED.thresholds[i]) stars = i + 1;
  }
  return stars;
}

export function addHeat(world, amount, kind) {
  world.heat = Math.min(120, world.heat + amount);
  world.lastCrimeAt = world.time;
  const stars = starsForHeat(world.heat);
  if (stars > world.wanted) {
    world.wanted = stars;
    world.messages.push({ text: `Wanted level ${stars} — Solmar PD is on you!`, t: 4 });
  }
  return world.wanted;
}

export function commitCrime(world, kind) {
  const heat = WANTED.crimeHeat[kind] ?? 5;
  return addHeat(world, heat, kind);
}

function spawnCop(world) {
  const p = world.player;
  // Spawn on a road just off-screen from the player.
  const angle = world.rng.range(0, Math.PI * 2);
  const dx = Math.cos(angle) * 700;
  const dy = Math.sin(angle) * 700;
  const spot = snapToRoad(
    clamp(p.x + dx, 120, WORLD_W - 120),
    clamp(p.y + dy, 120, WORLD_H - 120),
  );
  const cop = makeCopCar(spot.x, spot.y, world.rng);
  cop.speed = 200;
  world.cops.push(cop);
  world.cars.push(cop);
}

export function updatePolice(world, dt) {
  // Heat decays once the player has been clean for a while and no cop sees them.
  const quiet = world.time - world.lastCrimeAt > WANTED.decayDelaySec;
  let seen = false;
  for (const cop of world.cops) {
    if (dist2(cop.x, cop.y, world.player.x, world.player.y) < 520 * 520) seen = true;
  }
  if (quiet && !seen && world.heat > 0) {
    world.heat = Math.max(0, world.heat - WANTED.decayPerSec * dt);
    const stars = starsForHeat(world.heat);
    if (stars < world.wanted) {
      world.wanted = stars;
      if (stars === 0) world.messages.push({ text: 'You lost them. The heat is off.', t: 3 });
    }
  }

  // Keep the number of pursuit cars matched to the wanted level.
  const want = WANTED.maxCops[world.wanted] ?? 0;
  if (world.cops.length < want && world.wanted > 0) {
    spawnCop(world);
  }
  // Cops give up and despawn when the wanted level clears.
  if (world.wanted === 0 && world.cops.length > 0) {
    for (const cop of world.cops) {
      const i = world.cars.indexOf(cop);
      if (i >= 0) world.cars.splice(i, 1);
    }
    world.cops = [];
  }

  const p = world.player;
  for (const cop of world.cops) {
    const d = Math.sqrt(dist2(cop.x, cop.y, p.x, p.y));
    const wantAngle = Math.atan2(p.y - cop.y, p.x - cop.x);
    // Predict the player's motion a little so the chase feels alive.
    const turn = clamp(angleDiff(cop.angle, wantAngle), -1, 1);
    cop.angle = wrapAngle(cop.angle + turn * 2.4 * dt);
    const targetSpeed = d > 260 ? cop.top : Math.min(cop.top, 180 + d * 0.4);
    if (cop.speed < targetSpeed) cop.speed = Math.min(targetSpeed, cop.speed + cop.accel * dt);
    else cop.speed = Math.max(120, cop.speed - 200 * dt);
    cop.x = clamp(cop.x + Math.cos(cop.angle) * cop.speed * dt, 30, WORLD_W - 30);
    cop.y = clamp(cop.y + Math.sin(cop.angle) * cop.speed * dt, 30, WORLD_H - 30);

    // Ram the player: on foot it hurts, in a car it damages the car.
    if (d < 46) {
      if (p.onFoot) {
        world.health = Math.max(0, world.health - 22 * dt);
        p.x += Math.cos(cop.angle) * 60 * dt;
        p.y += Math.sin(cop.angle) * 60 * dt;
      } else if (p.car) {
        p.car.damage = Math.min(100, p.car.damage + 14 * dt);
        p.car.speed *= 0.96;
      }
    }
    // Busted: a cop reaches the player on foot while the player is nearly still.
    if (p.onFoot && d < 34 && Math.abs(p.speed) < 20 && world.wanted > 0) {
      world.mode = 'busted';
    }
  }
}

export function clearWanted(world) {
  world.wanted = 0;
  world.heat = 0;
  for (const cop of world.cops) {
    const i = world.cars.indexOf(cop);
    if (i >= 0) world.cars.splice(i, 1);
  }
  world.cops = [];
}
