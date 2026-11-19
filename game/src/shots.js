// Deterministic screenshot staging: ?shot=title|chase|fight|drive&seed=N
// puts the game into a fixed, good-looking scene so screenshots are stable.
// The game itself never depends on this module.
import { makeCopCar, makeThug } from './world.js';
import { startMission } from './missions.js';
import { addHeat } from './police.js';
import { CAR_MODELS } from './config.js';

export function shotFromUrl() {
  const q = new URLSearchParams(window.location.search);
  return {
    shot: q.get('shot') || null,
    seed: Number(q.get('seed') || 20261119),
  };
}

export function applyShot(world, shot) {
  if (!shot) return;
  const p = world.player;
  world.mode = 'play';
  if (shot === 'title') {
    world.mode = 'title';
    p.x = 2650;
    p.y = 480;
    world.camera.x = 2650;
    world.camera.y = 480;
    world.time = 17.4 * 3600; // golden hour over the Marina
    world.rain = 0;
    return;
  }
  if (shot === 'drive') {
    world.time = 17.6 * 3600;
    world.rain = 0;
    const model = CAR_MODELS.find((c) => c.id === 'palm');
    const car = world.cars.find((c) => c.model === 'palm') || world.cars[0];
    car.x = 1860;
    car.y = 760;
    car.angle = Math.PI / 2;
    car.speed = 300;
    car.driver = false;
    p.onFoot = false;
    p.car = car;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    world.camera.x = car.x;
    world.camera.y = car.y;
    return;
  }
  if (shot === 'chase') {
    world.time = 13 * 3600;
    world.rain = 0;
    const car = world.cars.find((c) => c.model === 'coral') || world.cars[0];
    car.x = 1500;
    car.y = 760;
    car.angle = 0;
    car.speed = 320;
    car.driver = false;
    p.onFoot = false;
    p.car = car;
    p.x = car.x;
    p.y = car.y;
    p.angle = 0;
    addHeat(world, 55, 'shoot');
    // Two interceptors on the player's tail.
    for (let i = 0; i < 2; i++) {
      const cop = makeCopCar(car.x - 130 - i * 90, car.y + (i === 0 ? -14 : 16), world.rng);
      cop.angle = 0;
      cop.speed = 330;
      world.cops.push(cop);
      world.cars.push(cop);
    }
    world.camera.x = car.x;
    world.camera.y = car.y;
    return;
  }
  if (shot === 'fight') {
    world.time = 10.5 * 3600;
    world.rain = 0;
    p.onFoot = true;
    p.car = null;
    p.x = 860;
    p.y = 760;
    p.angle = 0;
    world.thugs = [];
    const t1 = makeThug(920, 730, world.rng);
    const t2 = makeThug(800, 800, world.rng);
    t2.health = 55;
    world.thugs.push(t1, t2);
    world.mission = {
      def: { id: 'shakedown', title: 'Shakedown', kind: 'beat', count: 3, reward: 650 },
      stage: 'go', progress: 1, target: { x: 860, y: 760 }, timer: 0,
    };
    world.camera.x = p.x;
    world.camera.y = p.y;
    return;
  }
}
