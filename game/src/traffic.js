// Traffic and pedestrians. Cars drive the road grid: each picks an
// intersection, drives to it, then turns at random and keeps going, braking
// for the car ahead. Pedestrians stroll the sidewalks, flee from gunfire and
// from a speeding car, and sometimes flag a taxi. All of it is deterministic
// from the world's random stream.
import { CAR, CAR_MODELS, ROAD, WORLD } from './config.js';
import { angleDiff, clamp, dist, pick, range } from './random.js';
import { nearestRoadPoint, onRoad } from './city.js';

export function createTrafficCar(random, x, y, model, police) {
  const angle = Math.floor(random() * 4) * (Math.PI / 2);
  return {
    kind: 'car', x, y, angle, speed: 0, model, police: !!police,
    health: CAR.health, target: null, color: model.color,
    brake: false, sirenT: random() * 2, stuckT: 0, ramT: 0, bumpT: 0, crashT: 0,
  };
}

export function spawnTrafficCar(random, city, nearX, nearY) {
  for (let tries = 0; tries < 20; tries += 1) {
    const x = clamp(nearX + range(random, -900, 900), 100, WORLD.width - 100);
    const y = clamp(nearY + range(random, -900, 900), 100, WORLD.height - 100);
    if (!onRoad(x, y)) continue;
    const p = nearestRoadPoint(x, y);
    if (dist(p.x, p.y, nearX, nearY) < 350) continue;
    return createTrafficCar(random, p.x, p.y, pick(random, CAR_MODELS), false);
  }
  return null;
}

export function createPedestrian(random, x, y) {
  return {
    kind: 'ped', x, y, angle: random() * Math.PI * 2, speed: 0,
    target: null, fleeT: 0, color: pick(random, ['#e8b48a', '#8ab8e8', '#e88a8a', '#a8e88a', '#d8d8d8', '#e8d88a']),
    shirt: pick(random, ['#c94f43', '#4f7ec9', '#7ed491', '#e8e4da', '#b87ec9', '#e08ab8']),
    panic: 0, waiting: random() < 0.12,
  };
}

export function spawnPedestrian(random, x, y) {
  const px = clamp(x + range(random, -500, 500), 60, WORLD.width - 60);
  const py = clamp(y + range(random, -500, 500), 60, WORLD.height - 60);
  return createPedestrian(random, px, py);
}

// Pick the next intersection a traffic car drives toward.
function nextTarget(car, random) {
  const gx = Math.round(car.x / ROAD.pitch) * ROAD.pitch;
  const gy = Math.round(car.y / ROAD.pitch) * ROAD.pitch;
  const dirs = [[ROAD.pitch, 0], [-ROAD.pitch, 0], [0, ROAD.pitch], [0, -ROAD.pitch]];
  const d = pick(random, dirs);
  return {
    x: clamp(gx + d[0], ROAD.pitch, WORLD.width - ROAD.pitch),
    y: clamp(gy + d[1], ROAD.pitch, WORLD.height - ROAD.pitch),
  };
}

export function stepTrafficCar(car, dt, random, world) {
  if (!car.target || dist(car.x, car.y, car.target.x, car.target.y) < 26) car.target = nextTarget(car, random);
  const want = Math.atan2(car.target.y - car.y, car.target.x - car.x);
  const turn = clamp(angleDiff(car.angle, want), -1, 1);
  const maxSpeed = 150 * car.model.speed * (car.police ? 1.35 : 1);
  // Brake for the car ahead (traffic jam behaviour) and for the player.
  let ahead = 1;
  for (const other of world.cars) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x, dy = other.y - car.y;
    const forward = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (forward > 0 && forward < 90 && side < 34) ahead = 0;
  }
  car.brake = ahead === 0;
  const targetSpeed = car.brake ? 0 : maxSpeed;
  car.speed += clamp(targetSpeed - car.speed, -500 * dt, 260 * dt);
  car.angle += turn * 2.2 * dt * clamp(Math.abs(car.speed) / 60, 0.3, 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 40, WORLD.width - 40);
  car.y = clamp(car.y, 40, WORLD.height - 40);
  car.sirenT += dt;
}

export function stepPedestrian(ped, dt, random, world) {
  if (ped.fleeT > 0) {
    ped.fleeT -= dt;
    ped.speed = 260;
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
  } else if (ped.waiting) {
    ped.speed = 0;
    if (random() < dt * 0.05) ped.waiting = false;
  } else {
    if (!ped.target || dist(ped.x, ped.y, ped.target.x, ped.target.y) < 20 || random() < dt * 0.02) {
      const gx = Math.round(ped.x / ROAD.pitch) * ROAD.pitch;
      const gy = Math.round(ped.y / ROAD.pitch) * ROAD.pitch;
      ped.target = {
        x: clamp(gx + pick(random, [-1, 0, 1]) * ROAD.pitch, 60, WORLD.width - 60),
        y: clamp(gy + pick(random, [-1, 0, 1]) * ROAD.pitch, 60, WORLD.height - 60),
      };
    }
    const want = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
    ped.angle += clamp(angleDiff(ped.angle, want), -3 * dt, 3 * dt);
    ped.speed = 62;
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
  }
  ped.x = clamp(ped.x, 30, WORLD.width - 30);
  ped.y = clamp(ped.y, 30, WORLD.height - 30);
  // A gunshot or a near miss sends pedestrians running.
  if (world.noiseT > 0 && dist(ped.x, ped.y, world.noiseX, world.noiseY) < 420 && ped.fleeT <= 0) {
    ped.fleeT = 2 + random() * 2;
    ped.angle = Math.atan2(ped.y - world.noiseY, ped.x - world.noiseX);
  }
}
