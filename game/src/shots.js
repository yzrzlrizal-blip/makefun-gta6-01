// Staged screenshot scenes behind ?shot=title|foot|drive|chase (with &seed=N).
// Each one plays the real game forward from a fresh world with a scripted
// autopilot (drive toward the mission marker, punch/shoot on cue), so the
// frame is what real play looks like and the same seed always gives the same
// frame. main.js paints the staged scene twice and sets window.__shotReady.
// Staging runs invulnerable (no wasted/busted mid-scene), then the scene is
// tidied — full health, a healthy car, the wanted level and toast set — so
// the frame shows the game at its best, still entirely its own live state.
import { STEP } from './config.js';
import { setStars } from './police.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { startMission } from './missions.js';
import { createTrafficCar } from './traffic.js';
import { CAR_MODELS } from './config.js';

function driveToward(world, tx, ty) {
  const p = world.state.player;
  const car = p.inCar;
  if (!car) return { x: 0, y: 0, sprint: false };
  const dx = tx - car.x, dy = ty - car.y;
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return { x: diff > 0.05 ? 1 : diff < -0.05 ? -1 : 0, y: -1, sprint: false };
}
function walkToward(world, tx, ty) {
  const p = world.state.player;
  const dx = tx - p.x, dy = ty - p.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len, sprint: true };
}

// A fake input object with the same shape as createInput / createTestInput.
function scriptedInput() {
  let vec = { x: 0, y: 0, sprint: false };
  let actions = 0;
  return {
    vector: () => vec,
    mouse: () => ({ x: 0, y: 0, down: false }),
    takeActions() { const t = actions; actions = 0; return t; },
    set(v) { vec = v; },
    press(f) { actions |= f; },
  };
}

function runSteps(world, input, seconds, steer) {
  const p = world.state.player;
  p.invulnerable = 999; // staging never ends wasted or busted
  for (let i = 0; i < seconds / STEP; i += 1) {
    steer(i);
    world.step(STEP, input, input.takeActions());
    if (world.state.over) break;
  }
  p.invulnerable = 0;
}

// Put the staged scene in presentation shape: alive, healthy, banner gone,
// cash and wanted level as the scene promises.
function tidy(world, stars) {
  const st = world.state;
  st.over = null;
  st.player.health = 100;
  st.player.armor = 50;
  st.player.cash = 1250;
  if (st.player.inCar) st.player.inCar.health = 100;
  st.missions.bannerT = 0;
  st.toastT = 0;
  if (stars) setStars(st.police, stars, world.world);
}

export function stageShot(name, world) {
  const input = scriptedInput();
  const p = world.state.player;
  const st = world.state;
  if (name === 'title') {
    return { screen: SCREEN_TITLE, best: 1250 };
  }
  if (name === 'foot') {
    // On foot at the Harbor Docks, mid-mission 3: Harlow enforcers to fight.
    st.missions.index = 2; startMission(st.missions);
    p.x = 2580; p.y = 1780; p.angle = Math.PI / 4;
    runSteps(world, input, 4, (i) => {
      input.set(walkToward(world, 2700, 1890));
      if (i % 45 === 0) input.press(8);  // punch
      if (i % 90 === 0) input.press(16); // shoot
    });
    // Face the nearest enforcer, so the fight reads at a glance.
    const foe = st.enemies.find((e) => !e.dead);
    if (foe) p.angle = Math.atan2(foe.y - p.y, foe.x - p.x);
    tidy(world, 2);
    st.toast = 'The Harlow crew is here — deal with them!';
    st.toastT = 4;
    return { screen: SCREEN_PLAY, best: 1250 };
  }
  if (name === 'drive') {
    // Driving the stolen Nightshade GT along Palm Beach at sunset, mission 2.
    st.missions.index = 1; startMission(st.missions);
    const gt = st.cars.find((c) => c.missionCar) || createTrafficCar(world.random, 1200, 2490, CAR_MODELS[5], false);
    p.x = gt.x; p.y = gt.y;
    world.enterCar(gt);
    gt.x = 1200; gt.y = 2490; gt.angle = 0;
    st.clock = 17 * 60 + 30; // 17:30, golden hour
    runSteps(world, input, 5, () => input.set(driveToward(world, 2400, 2400)));
    tidy(world, 1);
    return { screen: SCREEN_PLAY, best: 1250 };
  }
  // cover / chase (default): a 3-star police chase through Downtown in a
  // stolen coupe, mission 6's escape in progress, minimap + HUD + wanted.
  st.missions.index = 5; startMission(st.missions);
  st.missions.stage = 3;
  const coupe = createTrafficCar(world.random, 1800, 690, CAR_MODELS[2], false);
  st.cars.push(coupe);
  p.x = coupe.x; p.y = coupe.y;
  world.enterCar(coupe);
  coupe.x = 1740; coupe.y = 690; coupe.angle = 0;
  st.clock = 18 * 60 + 20;
  runSteps(world, input, 5, (i) => {
    input.set(driveToward(world, 600, 690));
    if (i % 120 === 0) input.press(32); // horn
  });
  tidy(world, 3);
  st.toast = 'WANTED — 3 stars! Lose the cops!';
  st.toastT = 4;
  return { screen: SCREEN_PLAY, best: 1250 };
}
