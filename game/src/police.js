// The wanted system and the Solmar PD. Stars rise when the player is seen
// committing crimes (stealing a car, shooting, running someone over, ramming
// a police car); they fall when the player stays out of sight and out of
// trouble. Police cars chase and ram, foot officers chase and, at close range
// with backup, bust the player. At five stars the PD brings everything.
// Heat is a 0..100 meter; crossing thresholds adds a star.
import { POLICE_MODEL, WANTED } from './config.js';
import { clamp, dist } from './random.js';
import { createTrafficCar } from './traffic.js';
import { collideBuildings } from './city.js';

export function createPolice() {
  return { heat: 0, stars: 0, bustT: 0, seenT: 0, sirenT: 0 };
}

export function addHeat(police, amount, world) {
  police.heat = clamp(police.heat + amount, 0, 100);
  const stars = police.heat <= 2 ? 0 : police.heat < 22 ? 1 : police.heat < 42 ? 2
    : police.heat < 62 ? 3 : police.heat < 82 ? 4 : 5;
  if (stars > police.stars) {
    police.stars = stars;
    world.toast = stars >= 3 ? `WANTED — ${stars} stars! Lose the cops!` : `The police are after you — ${stars} star${stars > 1 ? 's' : ''}`;
    world.toastT = 3;
  } else police.stars = stars;
}

export function setStars(police, stars, world) {
  police.stars = stars;
  police.heat = [0, 10, 30, 50, 70, 90][stars] || 0;
  if (stars > 0) { world.toast = `WANTED — ${stars} star${stars > 1 ? 's' : ''}!`; world.toastT = 3; }
}

// Spawn the right number of police units around the player.
export function maintainPolice(police, world, random) {
  const wantCars = WANTED.copCars[police.stars] || 0;
  const wantFoot = WANTED.copFoot[police.stars] || 0;
  const cars = world.cars.filter((c) => c.police && !c.dead);
  const foot = world.cops.filter((c) => !c.dead);
  const p = world.player;
  if (cars.length < wantCars) {
    const angle = random() * Math.PI * 2;
    const car = createTrafficCar(random, p.x + Math.cos(angle) * 700, p.y + Math.sin(angle) * 700, POLICE_MODEL, true);
    car.target = { x: p.x, y: p.y };
    world.cars.push(car);
  }
  if (foot.length < wantFoot) {
    const angle = random() * Math.PI * 2;
    world.cops.push({
      kind: 'cop', x: p.x + Math.cos(angle) * 420, y: p.y + Math.sin(angle) * 420,
      angle, speed: 0, health: 60, dead: false, shootT: 1 + random(),
    });
  }
}

export function stepPoliceCar(car, dt, world) {
  const p = world.player;
  const target = world.playerCar ? { x: world.playerCar.x, y: world.playerCar.y } : { x: p.x, y: p.y };
  const d = dist(car.x, car.y, target.x, target.y);
  const want = Math.atan2(target.y - car.y, target.x - car.x);
  const turn = clamp((want - car.angle + Math.PI * 3) % (Math.PI * 2) - Math.PI, -1, 1);
  const maxSpeed = d > 260 ? 560 : 430;
  car.speed += clamp(maxSpeed - car.speed, -700 * dt, 420 * dt);
  car.angle += turn * 3.0 * dt * clamp(Math.abs(car.speed) / 80, 0.3, 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.sirenT += dt;
  if (car.ramT > 0) car.ramT -= dt;
  collideBuildings(world.city, car, 24);
  // Ramming the player hurts them (and the police car) — once per ram, not
  // every frame the cars touch.
  if (world.playerCar && d < 52 && Math.abs(car.speed) > 120 && car.ramT <= 0) {
    car.ramT = 1.2;
    car.speed = -220; // bounce back off the player car after the ram
    world.playerCar.health -= 8;
    world.damagePlayer(6, 'rammed by the police');
    world.addShake(6);
  }
}

export function stepCop(cop, dt, world, random) {
  const p = world.player;
  const d = dist(cop.x, cop.y, p.x, p.y);
  const want = Math.atan2(p.y - cop.y, p.x - cop.x);
  cop.angle += clamp((want - cop.angle + Math.PI * 3) % (Math.PI * 2) - Math.PI, -2.5 * dt, 2.5 * dt);
  if (d > 60) {
    cop.speed = 250;
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    collideBuildings(world.city, cop, 12);
  } else {
    cop.speed = 0;
    // A cop standing on the player busts them after WANTED.bustTime.
    world.police.bustT += dt;
    if (world.police.bustT > WANTED.bustTime) world.busted();
  }
  cop.shootT -= dt;
  if (d < 380 && d > 90 && cop.shootT <= 0 && world.player.health > 0) {
    cop.shootT = 1.4 + random() * 0.8;
    if (random() < 0.55) {
      world.damagePlayer(7, 'shot by the police');
      world.spawnTracer(cop.x, cop.y, p.x, p.y);
    }
  }
}
