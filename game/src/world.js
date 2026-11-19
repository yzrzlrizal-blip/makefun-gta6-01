// The simulation: the player (Nia Solano) on foot and in cars, car physics,
// stealing, combat, the wanted level, missions, collectibles, taxi fares,
// particles, the clock and the save. No drawing and no DOM here — render.js
// paints this state, main.js drives it. step() advances one fixed step and
// returns event flags, so the caller can react (sounds, announcements).
import { CAR, CAR_MODELS, DAY_LENGTH, MISSION_REWARDS, PLAYER, POLICE_MODEL, WANTED, WORLD } from './config.js';
import { createCity, collideBuildings, pointInBuilding } from './city.js';
import { angleDiff, clamp, dist, pick, range } from './random.js';
import { advanceStage, createMissionState, currentMission, currentStage, missionReward, startMission, SUN_COINS, TAXI_FARE_PAY } from './missions.js';
import { addHeat, createPolice, maintainPolice, setStars, stepCop, stepPoliceCar } from './police.js';
import { createPedestrian, createTrafficCar, spawnPedestrian, spawnTrafficCar, stepPedestrian, stepTrafficCar } from './traffic.js';

export const EVENT_SHOT = 1;
export const EVENT_PUNCH = 2;
export const EVENT_COIN = 4;
export const EVENT_CASH = 8;
export const EVENT_WASTED = 16;
export const EVENT_BUSTED = 32;
export const EVENT_MISSION = 64;
export const EVENT_CRASH = 128;

const ARMOR_VAN = { name: 'Harlow Armored Van', color: '#5a6b7a', speed: 0.85, accel: 0.8 };

export function createWorld(random) {
  const city = createCity(random);
  const state = {
    player: {
      x: 690, y: 760, angle: 0, vx: 0, vy: 0, health: PLAYER.health, armor: 0,
      ammo: PLAYER.startAmmo, cash: 250, inCar: null, punchT: 0, shootT: 0,
      invulnerable: 0, walkPhase: 0, dead: false,
    },
    cars: [], peds: [], cops: [], enemies: [], particles: [], tracers: [],
    coins: [], fares: [], pickups: [],
    police: createPolice(),
    missions: createMissionState(),
    time: 8 * 3600 / DAY_LENGTH, // 08:00 in day-fraction units below (see clock)
    clock: 8 * 60,               // minutes since midnight
    stats: { earned: 0, carsStolen: 0, missionsDone: 0, distance: 0, kills: 0 },
    rain: 0, rainT: 20 + random() * 40,
    noiseT: 0, noiseX: 0, noiseY: 0,
    toast: '', toastT: 0, shake: 0, flash: 0,
    over: null, // 'wasted' | 'busted' | null
    taxiMode: false, collected: 0,
    radio: '', muted: false,
    van: null, vanDead: false,
  };
  const world = {
    city, state, random,
    get player() { return state.player; },
    get cars() { return state.cars; },
    get peds() { return state.peds; },
    get cops() { return state.cops; },
    get police() { return state.police; },
    get playerCar() { return state.player.inCar; },
    get noiseT() { return state.noiseT; },
    get noiseX() { return state.noiseX; },
    get noiseY() { return state.noiseY; },
    set toast(v) { state.toast = v; },
    set toastT(v) { state.toastT = v; },
    addShake(v) { state.shake = Math.min(14, state.shake + v); },
    spawnTracer(x1, y1, x2, y2) { state.tracers.push({ x1, y1, x2, y2, t: 0.12 }); },
    damagePlayer(amount, why) {
      const p = state.player;
      if (p.invulnerable > 0 || p.dead) return;
      let left = amount;
      if (p.armor > 0) { const absorbed = Math.min(p.armor, left); p.armor -= absorbed; left -= absorbed; }
      p.health -= left;
      state.flash = 0.35;
      if (p.health <= 0) { p.health = 0; p.dead = true; state.over = 'wasted'; }
    },
    busted() {
      const p = state.player;
      if (state.over || p.invulnerable > 0) return;
      state.over = 'busted';
      state.police.stars = 0; state.police.heat = 0; state.police.bustT = 0;
      p.cash = Math.max(0, p.cash - 200);
    },
    addHeat(amount) { addHeat(state.police, amount, world); },
  };

  function scatterCoins() {
    state.coins = [];
    for (let i = 0; i < SUN_COINS; i += 1) {
      let x = 0, y = 0;
      for (let tries = 0; tries < 30; tries += 1) {
        x = range(random, 200, WORLD.width - 200); y = range(random, 200, WORLD.height - 200);
        if (!pointInBuilding(city, x, y)) break;
      }
      state.coins.push({ x, y, taken: false });
    }
  }
  function scatterCars() {
    state.cars = [];
    for (let i = 0; i < 16; i += 1) {
      const car = spawnTrafficCar(random, city, 1800, 1350);
      if (car) state.cars.push(car);
    }
    // The Nightshade GT for mission 2 waits at Bayview Garage.
    const gt = createTrafficCar(random, 2400, 990, CAR_MODELS.find((m) => m.name === 'Nightshade GT'), false);
    gt.parked = true; gt.missionCar = true; state.cars.push(gt);
    // A taxi waits near the safehouse for fare work.
    const taxi = createTrafficCar(random, 760, 690, CAR_MODELS.find((m) => m.taxi), false);
    taxi.parked = true; state.cars.push(taxi);
    for (let i = 0; i < 14; i += 1) state.peds.push(spawnPedestrian(random, 1800, 1350));
  }
  function scatterPickups() {
    state.pickups = [
      { kind: 'health', x: 1500, y: 1650, taken: false },
      { kind: 'armor', x: 1800, y: 750, taken: false },
      { kind: 'ammo', x: 900, y: 1050, taken: false },
      { kind: 'health', x: 1200, y: 2550, taken: false },
      { kind: 'ammo', x: 2700, y: 1950, taken: false },
    ];
  }

  function reset() {
    const p = state.player;
    p.x = 600; p.y = 760; p.angle = 0; p.vx = 0; p.vy = 0;
    p.health = PLAYER.health; p.armor = 0; p.ammo = PLAYER.startAmmo; p.cash = 250;
    p.inCar = null; p.dead = false; p.invulnerable = 0;
    state.police = createPolice();
    state.missions = createMissionState();
    state.stats = { earned: 0, carsStolen: 0, missionsDone: 0, distance: 0, kills: 0 };
    state.clock = 8 * 60; state.over = null; state.collected = 0; state.taxiMode = false;
    state.van = null; state.vanDead = false; state.rain = 0;
    state.particles = []; state.tracers = []; state.enemies = []; state.cops = [];
    scatterCoins(); scatterCars(); scatterPickups();
  }

  // --- driving -------------------------------------------------------------
  function nearestCar(maxD) {
    const p = state.player;
    let best = null, bestD = maxD;
    for (const car of state.cars) {
      if (car.dead) continue;
      const d = dist(p.x, p.y, car.x, car.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }
  function enterCar(car) {
    const p = state.player;
    p.inCar = car; car.driver = 'player';
    if (car.parked === false || car.stolen !== true) {
      // Stealing a car somebody drives (or any parked car that is not yours)
      // is a crime the police notice — unless it is the mission GT, which the
      // mission itself flags.
      if (!car.owned) {
        car.stolen = true; state.stats.carsStolen += 1;
        world.addHeat(14);
        state.toast = `Stole the ${car.model.name}`; state.toastT = 2.5;
      }
    }
  }
  function exitCar() {
    const p = state.player;
    const car = p.inCar;
    if (!car) return;
    car.driver = null;
    const side = car.angle + Math.PI / 2;
    p.x = car.x + Math.cos(side) * 34; p.y = car.y + Math.sin(side) * 34;
    p.angle = car.angle; p.inCar = null;
    collideBuildings(city, p, PLAYER.radius);
  }
  function stepCar(car, dt, input) {
    const p = state.player;
    const v = input.vector();
    const forward = Math.cos(car.angle), right = Math.sin(car.angle);
    const speedAlong = car.speed;
    const throttle = v.y < 0 ? 1 : v.y > 0 ? -0.6 : 0;
    const accel = throttle > 0 ? CAR.accel * car.model.accel : CAR.reverse * car.model.accel;
    car.speed += throttle * accel * dt;
    car.speed -= car.speed * CAR.drag * dt;
    // Hard steering scrubs speed, so a 90-degree turn at an intersection
    // tightens instead of swinging the car wide into a building.
    if (Math.abs(v.x) > 0.5 && Math.abs(car.speed) > 150) car.speed -= Math.sign(car.speed) * 240 * dt;
    const max = CAR.maxSpeed * car.model.speed;
    car.speed = clamp(car.speed, -max * 0.45, max);
    const steer = v.x * CAR.turn * clamp(Math.abs(car.speed) / 140, 0, 1) * (car.speed < 0 ? -1 : 1);
    car.angle += steer * dt;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(nx, 30, WORLD.width - 30);
    car.y = clamp(ny, 30, WORLD.height - 30);
    // The player rides in the car: keep their position on it, so mission,
    // coin and police checks all read the right place.
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    state.stats.distance += Math.abs(car.speed) * dt;
    // Building collision: bounce and scrape — at most once per half second.
    const before = { x: car.x, y: car.y };
    collideBuildings(city, car, 24);
    if (car.crashT > 0) car.crashT -= dt;
    if ((car.x !== before.x || car.y !== before.y) && Math.abs(car.speed) > 180 && car.crashT <= 0) {
      car.crashT = 0.5;
      car.speed *= -0.35; car.health -= 6; state.flash = 0.15;
      world.addShake(4);
      return EVENT_CRASH;
    }
    // Skid smoke at speed while turning hard.
    if (Math.abs(steer) > 1.6 && Math.abs(car.speed) > 320 && random() < 0.5) {
      state.particles.push({ x: car.x - forward * 22, y: car.y - right * 12, vx: range(random, -20, 20), vy: range(random, -20, 20), t: 0.6, max: 0.6, color: '#cfcfcf', size: 5 });
    }
    if (car.health <= 0 && !car.dead) {
      car.dead = true;
      for (let i = 0; i < 14; i += 1) state.particles.push({ x: car.x, y: car.y, vx: range(random, -160, 160), vy: range(random, -160, 160), t: 0.9, max: 0.9, color: pick(random, ['#e5534b', '#f2c94c', '#888']), size: 6 });
      if (car === state.player.inCar) { exitCar(); world.damagePlayer(25, 'car wreck'); }
    }
    return 0;
  }

  // --- on foot -------------------------------------------------------------
  function stepOnFoot(dt, input) {
    const p = state.player;
    const v = input.vector();
    const speed = v.sprint ? PLAYER.sprint : PLAYER.walk;
    const tx = v.x * speed, ty = v.y * speed;
    p.vx += clamp(tx - p.vx, -PLAYER.accel * dt, PLAYER.accel * dt);
    p.vy += clamp(ty - p.vy, -PLAYER.accel * dt, PLAYER.accel * dt);
    p.x = clamp(p.x + p.vx * dt, 20, WORLD.width - 20);
    p.y = clamp(p.y + p.vy * dt, 20, WORLD.height - 20);
    state.stats.distance += Math.hypot(p.vx, p.vy) * dt;
    if (Math.hypot(p.vx, p.vy) > 30) {
      p.angle = Math.atan2(p.vy, p.vx);
      p.walkPhase += dt * Math.hypot(p.vx, p.vy) / 22;
    }
    collideBuildings(city, p, PLAYER.radius);
  }

  // --- combat --------------------------------------------------------------
  function punch() {
    const p = state.player;
    if (p.punchT > 0 || p.inCar) return 0;
    p.punchT = 0.35;
    const rangeR = PLAYER.punchRange + PLAYER.radius;
    let events = EVENT_PUNCH;
    const hit = (t, d) => {
      if (d < rangeR && Math.abs(angleDiff(p.angle, Math.atan2(t.y - p.y, t.x - p.x))) < PLAYER.punchArc) {
        t.health = (t.health || 50) - PLAYER.punchDamage;
        if (t.health <= 0 && !t.dead) { t.dead = true; state.stats.kills += 1; world.addHeat(10); }
        return true;
      }
      return false;
    };
    for (const e of state.enemies) if (!e.dead) hit(e, dist(p.x, p.y, e.x, e.y));
    for (const c of state.cops) if (!c.dead) hit(c, dist(p.x, p.y, c.x, c.y));
    for (const ped of state.peds) {
      if (hit(ped, dist(p.x, p.y, ped.x, ped.y))) {
        ped.fleeT = 4; ped.angle = Math.atan2(ped.y - p.y, ped.x - p.x);
        world.addHeat(12);
      }
    }
    state.noiseT = 0.4; state.noiseX = p.x; state.noiseY = p.y;
    return events;
  }
  function shoot() {
    const p = state.player;
    if (p.shootT > 0 || p.ammo <= 0 || p.inCar) return 0;
    p.shootT = PLAYER.pistolCooldown; p.ammo -= 1;
    const rangeR = PLAYER.pistolRange;
    const tx = p.x + Math.cos(p.angle) * rangeR, ty = p.y + Math.sin(p.angle) * rangeR;
    state.tracers.push({ x1: p.x, y1: p.y, x2: tx, y2: ty, t: 0.09 });
    state.noiseT = 0.8; state.noiseX = p.x; state.noiseY = p.y;
    world.addHeat(8);
    const hit = (t) => {
      const d = dist(p.x, p.y, t.x, t.y);
      if (d > rangeR) return false;
      const a = Math.atan2(t.y - p.y, t.x - p.x);
      if (Math.abs(angleDiff(p.angle, a)) > 0.16) return false;
      t.health -= PLAYER.pistolDamage;
      state.tracers[state.tracers.length - 1].x2 = t.x;
      state.tracers[state.tracers.length - 1].y2 = t.y;
      if (t.health <= 0 && !t.dead) {
        t.dead = true; state.stats.kills += 1;
        if (t.kind === 'enemy') world.addHeat(6);
        if (t.kind === 'cop') world.addHeat(22);
        if (t.kind === 'van') state.vanDead = true;
      }
      return true;
    };
    for (const e of state.enemies) if (!e.dead && hit(e)) break;
    for (const c of state.cops) if (!c.dead && hit(c)) break;
    if (state.van && !state.vanDead && hit(state.van)) { /* van hit */ }
    return EVENT_SHOT;
  }

  // --- missions ------------------------------------------------------------
  function checkMission(dt) {
    const ms = state.missions;
    const m = currentMission(ms);
    if (!m) return 0;
    const p = state.player;
    if (!ms.started) {
      // Walk or drive near the mission start to get the briefing.
      const s = m.stages[0];
      if (dist(p.x, p.y, s.x, s.y) < 220) {
        startMission(ms);
        state.toast = `${m.name} — ${m.giver}`; state.toastT = 4;
        return EVENT_MISSION;
      }
      return 0;
    }
    if (ms.timer > 0) {
      ms.timer -= dt;
      if (ms.timer <= 0) { // timed stage failed: restart the mission
        ms.started = false; ms.stage = 0;
        state.toast = 'Out of time — the job fell through. Go back and try again.'; state.toastT = 4;
        return 0;
      }
    }
    const s = currentStage(ms);
    if (!s) return 0;
    const d = dist(p.x, p.y, s.x, s.y);
    const car = p.inCar;
    let done = false;
    if (s.kind === 'go' || s.kind === 'deliver' || s.kind === 'collect' || s.kind === 'talk') {
      if (s.kind === 'deliver' && s.needCar && !car) done = false;
      else done = d < s.radius;
      if (s.kind === 'collect' && done) {
        state.particles.push({ x: s.x, y: s.y, vx: 0, vy: -40, t: 0.8, max: 0.8, color: '#f2c94c', size: 8 });
      }
    } else if (s.kind === 'steal') {
      done = !!car && car.model.name === (s.model || 'Nightshade GT');
      if (done) { car.owned = true; }
    } else if (s.kind === 'fight') {
      if (s.van) {
        if (!state.van) {
          const van = createTrafficCar(random, s.x + 120, s.y, ARMOR_VAN, false);
          van.kind = 'van'; van.health = 220; van.parked = false; state.van = van; state.cars.push(van);
        }
        done = state.vanDead;
        if (!done) { // the van flees along the grid
          const van = state.van;
          van.target = { x: clamp(van.x + 300, 300, 3300), y: van.y };
          stepTrafficCar(van, dt, random, world);
        }
      } else {
        if (state.enemies.length === 0) {
          for (let i = 0; i < (s.count || 3); i += 1) {
            state.enemies.push({ kind: 'enemy', x: s.x + range(random, -160, 160), y: s.y + range(random, -160, 160), angle: random() * 6.28, health: 60, dead: false, shootT: 1 + random() * 2 });
          }
          ms.fightLeft = s.count;
        }
        ms.fightLeft = state.enemies.filter((e) => !e.dead).length;
        done = ms.fightLeft === 0;
      }
    } else if (s.kind === 'taxi') {
      if (!s.drop) {
        // Pick the fare up: drive up in any car (or on foot) and they get in.
        if (d < s.radius && car) { ms.fareInCar = true; state.toast = 'Fare aboard — drive them to the drop-off.'; state.toastT = 2.5; done = true; }
        else if (d < s.radius && !car) { state.toast = 'You need a car to take this fare.'; state.toastT = 2; }
      } else if (ms.fareInCar && d < s.radius) {
        p.cash += TAXI_FARE_PAY; state.stats.earned += TAXI_FARE_PAY;
        state.toast = `Fare paid — $${TAXI_FARE_PAY}`; state.toastT = 2.5;
        ms.fareInCar = false; done = true;
      }
    } else if (s.kind === 'escape') {
      done = d < s.radius && state.police.stars === 0;
    }
    if (!done) return 0;
    const finished = advanceStage(ms);
    if (finished) {
      const reward = missionReward({ index: ms.index - 1 });
      p.cash += reward; state.stats.earned += reward; state.stats.missionsDone += 1;
      state.toast = `Job done — $${reward} paid. ${ms.index < 6 ? 'Next job is on the map.' : 'Story complete!'}`; state.toastT = 5;
      return EVENT_CASH | EVENT_MISSION;
    }
    return EVENT_MISSION;
  }

  function stepEnemies(dt) {
    const p = state.player;
    for (const e of state.enemies) {
      if (e.dead) continue;
      const d = dist(e.x, e.y, p.x, p.y);
      const want = Math.atan2(p.y - e.y, p.x - e.x);
      e.angle += clamp(angleDiff(e.angle, want), -3 * dt, 3 * dt);
      if (d > 70) { e.x += Math.cos(e.angle) * 170 * dt; e.y += Math.sin(e.angle) * 170 * dt; }
      e.shootT -= dt;
      if (d < 360 && e.shootT <= 0) {
        e.shootT = 1.5 + random() * 1.2;
        if (random() < 0.5) { world.damagePlayer(6, 'shot by a Harlow enforcer'); world.spawnTracer(e.x, e.y, p.x, p.y); }
      }
    }
  }

  // --- main step -----------------------------------------------------------
  function step(dt, input, actions) {
    const p = state.player;
    let events = 0;
    if (state.over) return events;
    state.clock = (state.clock + dt * 2) % 1440; // 2 game-minutes per real second
    state.rainT -= dt;
    if (state.rainT <= 0) { state.rain = state.rain > 0 ? 0 : 0.5 + random() * 0.5; state.rainT = 25 + random() * 50; }
    if (state.toastT > 0) state.toastT -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);
    if (state.flash > 0) state.flash -= dt;
    if (state.noiseT > 0) state.noiseT -= dt;
    if (p.punchT > 0) p.punchT -= dt;
    if (p.shootT > 0) p.shootT -= dt;
    if (p.invulnerable > 0) p.invulnerable -= dt;
    if (state.missions.bannerT > 0) state.missions.bannerT -= dt;

    if (actions & 4) { // E — enter / exit car
      if (p.inCar) exitCar();
      else {
        const car = nearestCar(64);
        if (car) enterCar(car);
      }
    }
    if (actions & 8) events |= punch();
    if (actions & 16) events |= shoot();

    if (p.inCar) events |= stepCar(p.inCar, dt, input);
    else stepOnFoot(dt, input);

    // Traffic + pedestrians, kept near the player.
    for (const car of state.cars) {
      if (car.dead || car === p.inCar || car.police || car.kind === 'van') continue;
      if (car.parked) continue;
      stepTrafficCar(car, dt, random, world);
    }
    // Car-vs-car bumps (player car vs traffic): separate every step, but
    // damage and slowdown only once per hit (bumpT), so two cars that stay
    // touching cannot grind each other to death.
    if (p.inCar) {
      for (const car of state.cars) {
        if (car === p.inCar || car.dead) continue;
        if (car.bumpT > 0) car.bumpT -= dt;
        const dd = dist(car.x, car.y, p.inCar.x, p.inCar.y);
        if (dd < 46) {
          const push = (46 - dd) || 1;
          const ux = (car.x - p.inCar.x) / (dd || 1), uy = (car.y - p.inCar.y) / (dd || 1);
          car.x += ux * push; car.y += uy * push;
          if (car.bumpT <= 0) {
            car.bumpT = 0.8;
            p.inCar.speed *= 0.55; car.speed *= 0.5;
            car.health -= 4; p.inCar.health -= 2;
            if (car.police) world.addHeat(6);
            else if (Math.abs(p.inCar.speed) > 200) world.addHeat(3);
            events |= EVENT_CRASH;
          }
        }
      }
    }
    for (const ped of state.peds) stepPedestrian(ped, dt, random, world);
    // Running a pedestrian over is a crime.
    if (p.inCar && Math.abs(p.inCar.speed) > 120) {
      for (const ped of state.peds) {
        if (ped.dead) continue;
        if (dist(ped.x, ped.y, p.inCar.x, p.inCar.y) < 30) {
          ped.dead = true; world.addHeat(16);
          state.toast = 'You ran someone over!'; state.toastT = 2;
        }
      }
    }
    // Police.
    maintainPolice(state.police, world, random);
    for (const car of state.cars) if (car.police && !car.dead) stepPoliceCar(car, dt, world);
    for (const cop of state.cops) if (!cop.dead) stepCop(cop, dt, world, random);
    if (state.police.stars === 0) state.police.bustT = 0;
    else {
      // Wanted decays only while no cop can see the player.
      const seen = state.cops.some((c) => !c.dead && dist(c.x, c.y, p.x, p.y) < 500)
        || state.cars.some((c) => c.police && !c.dead && dist(c.x, c.y, p.x, p.y) < 600);
      if (!seen) state.police.heat = Math.max(0, state.police.heat - WANTED.decay * 10 * dt);
      const stars = state.police.heat <= 2 ? 0 : state.police.heat < 22 ? 1 : state.police.heat < 42 ? 2 : state.police.heat < 62 ? 3 : state.police.heat < 82 ? 4 : 5;
      state.police.stars = stars;
      if (state.police.sirenT !== undefined) state.police.sirenT += dt;
    }

    stepEnemies(dt);
    events |= checkMission(dt);

    // Sun-coins and pickups.
    for (const coin of state.coins) {
      if (!coin.taken && dist(p.x, p.y, coin.x, coin.y) < 34) {
        coin.taken = true; state.collected += 1; p.cash += 100; state.stats.earned += 100;
        state.toast = `Sun-coin found! ${state.collected}/${SUN_COINS} — +$100`; state.toastT = 2.5;
        events |= EVENT_COIN;
      }
    }
    for (const pk of state.pickups) {
      if (!pk.taken && dist(p.x, p.y, pk.x, pk.y) < 36) {
        pk.taken = true;
        if (pk.kind === 'health') p.health = Math.min(PLAYER.health, p.health + 50);
        if (pk.kind === 'armor') p.armor = Math.min(100, p.armor + 50);
        if (pk.kind === 'ammo') p.ammo += 36;
        state.toast = pk.kind === 'health' ? 'Health +50' : pk.kind === 'armor' ? 'Armor +50' : 'Ammo +36'; state.toastT = 2;
        events |= EVENT_COIN;
      }
    }
    // Keep traffic topped up near the player.
    if (state.cars.filter((c) => !c.police && !c.dead).length < 14) {
      const car = spawnTrafficCar(random, city, p.x, p.y);
      if (car) state.cars.push(car);
    }
    if (state.peds.filter((x) => !x.dead).length < 12) state.peds.push(spawnPedestrian(random, p.x, p.y));
    // Particles and tracers age out.
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.t -= dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      if (pt.t <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.tracers.length - 1; i >= 0; i -= 1) {
      state.tracers[i].t -= dt;
      if (state.tracers[i].t <= 0) state.tracers.splice(i, 1);
    }
    if (state.over === 'wasted') events |= EVENT_WASTED;
    if (state.over === 'busted') events |= EVENT_BUSTED;
    return events;
  }

  function respawn() {
    const p = state.player;
    p.health = PLAYER.health; p.armor = 0; p.dead = false; p.inCar = null;
    p.x = 1500; p.y = 1650; // Solmar General Hospital
    p.invulnerable = 3;
    state.over = null; state.police = createPolice(); state.cops = [];
    state.cars = state.cars.filter((c) => !c.police);
    state.toast = 'You woke up at Solmar General Hospital.'; state.toastT = 3;
  }

  function save() {
    const p = state.player;
    const data = {
      version: 1, x: p.x, y: p.y, cash: p.cash, health: p.health, armor: p.armor, ammo: p.ammo,
      missionIndex: state.missions.index, completed: state.missions.completed,
      collected: state.collected, coinsTaken: state.coins.map((c) => c.taken),
      stats: state.stats, clock: state.clock,
    };
    try { window.localStorage.setItem('solmar-bay.save.v1', JSON.stringify(data)); return true; } catch { return false; }
  }
  function load() {
    try {
      const raw = window.localStorage.getItem('solmar-bay.save.v1');
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (d.version !== 1) return false;
      const p = state.player;
      p.x = d.x; p.y = d.y; p.cash = d.cash; p.health = d.health; p.armor = d.armor; p.ammo = d.ammo;
      state.missions.index = d.missionIndex || 0; state.missions.completed = d.completed || [];
      state.collected = d.collected || 0; state.stats = d.stats || state.stats; state.clock = d.clock || 480;
      if (Array.isArray(d.coinsTaken)) d.coinsTaken.forEach((t, i) => { if (state.coins[i]) state.coins[i].taken = !!t; });
      return true;
    } catch { return false; }
  }
  function hasSave() {
    try { return !!window.localStorage.getItem('solmar-bay.save.v1'); } catch { return false; }
  }

  reset();
  return { state, city, random, reset, step, respawn, save, load, hasSave, nearestCar, enterCar, exitCar, world, damagePlayer: world.damagePlayer, busted: world.busted, addHeat: world.addHeat };
}
