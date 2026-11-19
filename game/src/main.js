// Solmar Bay — boot, game loop, player control, combat, HUD and save/load.
// Browser-only: imports the pure modules and wires them to the canvas + DOM.
import { createWorld, moveOnFoot, updateClock, serialize, applySave, nearestCar, makePed } from './world.js';
import { CAR_MODELS, PLAYER, SAVE_KEY, WANTED, WORLD_W, WORLD_H } from './config.js';
import { districtAt } from './city.js';
import { Input } from './input.js';
import { SoundFX } from './audio.js';
import { drawWorld, drawMinimap, timeLabel, viewSize } from './render.js';
import { updateTraffic, updatePeds, crashCheck, spawnSparks } from './traffic.js';
import { updatePolice, commitCrime, clearWanted } from './police.js';
import { startMission, updateMission, missionObjectiveText, countThugDown, failMission } from './missions.js';
import { shotFromUrl, applyShot } from './shots.js';
import { clamp, dist2, angleDiff } from './random.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const minimap = document.getElementById('minimap');
const mctx = minimap.getContext('2d');

const { shot, seed } = shotFromUrl();
const world = createWorld(seed);
const input = new Input(canvas);
input.attach();
const sfx = new SoundFX();

const $ = (id) => document.getElementById(id);
const hud = {
  cash: $('hud-cash'), health: $('hud-health'), stars: $('hud-stars'), clock: $('hud-clock'),
  district: $('hud-district'), objective: $('hud-objective'), speed: $('hud-speed'),
  ammo: $('hud-ammo'), messages: $('hud-messages'), banner: $('banner'),
  title: $('title-screen'), end: $('end-screen'), endTitle: $('end-title'),
  endText: $('end-text'), saveNote: $('save-note'),
};

let last = performance.now();
let shotMode = Boolean(shot);
let bannerTimer = 0;

function showBanner(text) {
  hud.banner.textContent = text;
  hud.banner.classList.remove('hidden');
  bannerTimer = 3;
}

function refreshHud() {
  hud.cash.textContent = `$${world.cash}`;
  hud.health.style.width = `${clamp(world.health, 0, 100)}%`;
  hud.health.style.background = world.health > 50 ? '#3fae5a' : world.health > 25 ? '#e8a13a' : '#e23a3a';
  hud.stars.textContent = '★'.repeat(world.wanted) + '☆'.repeat(5 - world.wanted);
  hud.stars.style.color = world.wanted > 0 ? '#ffd23e' : '#888';
  hud.clock.textContent = timeLabel(world);
  const d = districtAt(world.player.x, world.player.y);
  hud.district.textContent = d.name;
  hud.objective.textContent = missionObjectiveText(world);
  if (world.player.car) {
    const car = world.player.car;
    hud.speed.textContent = `${Math.round(Math.abs(car.speed) * 0.36)} km/h · ${car.name} · dmg ${Math.round(car.damage)}%`;
  } else {
    hud.speed.textContent = `On foot · Pistol ${world.ammo}/12`;
  }
  hud.ammo.textContent = world.ammo > 0 ? '●'.repeat(Math.min(world.ammo, 12)) : 'RELOAD — press R';
  // Message feed.
  hud.messages.innerHTML = '';
  for (const m of world.messages.slice(-3)) {
    const div = document.createElement('div');
    div.className = 'msg';
    div.textContent = m.text;
    hud.messages.appendChild(div);
  }
  hud.saveNote.textContent = world.rain > 0.1 ? '🌧 Rain — roads are slick' : '';
}

function saveGame(silent) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(serialize(world)));
    if (!silent) world.messages.push({ text: 'Progress saved.', t: 2 });
  } catch { /* storage unavailable — the game still plays */ }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    return applySave(world, JSON.parse(raw));
  } catch {
    return false;
  }
}

function hasSave() {
  try { return Boolean(localStorage.getItem(SAVE_KEY)); } catch { return false; }
}

// --- combat ---------------------------------------------------------------

function shootAt(tx, ty) {
  const p = world.player;
  if (p.shootCooldown > 0 || world.ammo <= 0) return;
  p.shootCooldown = 0.28;
  world.ammo -= 1;
  p.angle = Math.atan2(ty - p.y, tx - p.x);
  const bx = p.x + Math.cos(p.angle) * 18;
  const by = p.y + Math.sin(p.angle) * 18;
  world.bullets.push({ x: bx, y: by, vx: Math.cos(p.angle) * 900, vy: Math.sin(p.angle) * 900, life: 0.6, from: 'player' });
  sfx.shoot();
  commitCrime(world, 'shoot');
}

function punch() {
  const p = world.player;
  if (p.punchCooldown > 0) return;
  p.punchCooldown = 0.45;
  sfx.punch();
  commitCrime(world, 'punch');
  // Hit thugs in front of the player.
  for (const t of world.thugs) {
    if (t.down) continue;
    const d = Math.sqrt(dist2(p.x, p.y, t.x, t.y));
    const ang = Math.abs(angleDiff(p.angle, Math.atan2(t.y - p.y, t.x - p.x)));
    if (d < PLAYER.punchRange + 14 && ang < PLAYER.punchArc) {
      hurtThug(t, PLAYER.punchDamage);
    }
  }
  // Shove a nearby ped (they panic and run).
  for (const ped of world.peds) {
    if (dist2(p.x, p.y, ped.x, ped.y) < 40 * 40) ped.panic = 2;
  }
}

function hurtThug(t, dmg) {
  t.health -= dmg;
  world.particles.push({
    x: t.x, y: t.y, vx: 0, vy: -30, life: 0.3, color: '#ff5a5a', size: 6,
  });
  if (t.health <= 0 && !t.down) {
    t.down = true;
    countThugDown(world);
    commitCrime(world, 'kill');
    world.messages.push({ text: 'Harlow lookout is down.', t: 2 });
  }
}

function updateBullets(dt) {
  for (const b of world.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.from === 'player') {
      for (const t of world.thugs) {
        if (t.down) continue;
        if (dist2(b.x, b.y, t.x, t.y) < 18 * 18) {
          hurtThug(t, PLAYER.pistolDamage);
          b.life = 0;
          break;
        }
      }
    } else if (dist2(b.x, b.y, world.player.x, world.player.y) < 16 * 16 && world.player.onFoot) {
      world.health = Math.max(0, world.health - 9);
      b.life = 0;
    }
  }
  world.bullets = world.bullets.filter((b) => b.life > 0);
}

function updateThugs(dt) {
  const p = world.player;
  for (const t of world.thugs) {
    if (t.down) continue;
    const d = Math.sqrt(dist2(t.x, t.y, p.x, p.y));
    if (d < 420 && !p.dead) {
      const want = Math.atan2(p.y - t.y, p.x - t.x);
      t.angle = want;
      if (d > 60) {
        t.x += Math.cos(want) * 95 * dt;
        t.y += Math.sin(want) * 95 * dt;
      } else {
        // Point-blank: the thug swings.
        t.shootCooldown -= dt;
        if (t.shootCooldown <= 0) {
          t.shootCooldown = 1.1;
          world.health = Math.max(0, world.health - 8);
          sfx.punch();
        }
      }
      // Armed thugs shoot from range.
      if (t.armed && d > 90 && d < 340) {
        t.shootCooldown -= dt;
        if (t.shootCooldown <= 0) {
          t.shootCooldown = 1.6 + world.rng.range(0, 0.8);
          world.bullets.push({
            x: t.x, y: t.y,
            vx: Math.cos(want) * 620, vy: Math.sin(want) * 620,
            life: 0.8, from: 'thug',
          });
          sfx.shoot();
        }
      }
    }
  }
  world.thugs = world.thugs.filter((t) => !t.down || world.stats.thugsDown < 99);
  // Keep the list tidy: drop thugs long dead once the mission moves on.
  if (!world.mission) world.thugs = world.thugs.filter((t) => !t.down);
}

// --- cars -----------------------------------------------------------------

function enterCar(car) {
  const p = world.player;
  if (!car || car.damage >= 100) return;
  if (car.driver && !car.police) {
    // Steal it: the driver bails and runs.
    commitCrime(world, 'steal');
    world.stats.carsStolen += 1;
    car.driver = false;
    const flee = makePed(world.rng);
    flee.x = car.x + 30;
    flee.y = car.y + 30;
    flee.panic = 3;
    world.peds.push(flee);
    world.messages.push({ text: `Stole the ${car.name}. The PD won't like that.`, t: 3 });
  }
  p.onFoot = false;
  p.car = car;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  sfx.pickup();
}

function exitCar() {
  const p = world.player;
  if (!p.car) return;
  const car = p.car;
  car.speed = 0;
  p.onFoot = true;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
  p.car = null;
}

function driveCar(car, dt) {
  const p = world.player;
  const mv = input.moveVector();
  const forward = mv.y < 0;
  const back = mv.y > 0;
  const steer = mv.x;
  const grip = car.grip * (world.rain > 0.1 ? 0.75 : 1);
  if (forward) car.speed += car.accel * dt;
  if (back) car.speed -= car.accel * 0.7 * dt;
  if (!forward && !back) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 140 * dt);
  }
  car.speed = clamp(car.speed, -car.top * 0.45, car.top);
  // Steering bites harder at speed, and the tail steps out when pushed.
  const steerAuthority = clamp(Math.abs(car.speed) / 120, 0, 1) * grip * 0.55;
  car.angle += steer * steerAuthority * Math.sign(car.speed) * dt * 2.2;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (world.city.buildings.some((b) => nx > b.x - 6 && nx < b.x + b.w + 6 && ny > b.y - 6 && ny < b.y + b.h + 6)) {
    if (Math.abs(car.speed) > 120) {
      car.damage = Math.min(100, car.damage + 9);
      commitCrime(world, 'crash');
      spawnSparks(world, nx, ny);
      sfx.crash();
    }
    car.speed *= -0.25;
  } else if (nx < 20 || nx > WORLD_W - 20 || ny < 20 || ny > WORLD_H - 20) {
    car.speed *= 0.5;
  } else {
    car.x = nx;
    car.y = ny;
    world.stats.distanceDriven += Math.abs(car.speed) * dt;
  }
  if (crashCheck(world, car)) {
    commitCrime(world, 'crash');
    sfx.crash();
  }
  if (car.damage >= 100) {
    world.messages.push({ text: `The ${car.name} is wrecked.`, t: 3 });
    exitCar();
  }
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.speed = car.speed;
}

// --- main update -----------------------------------------------------------

function update(dt) {
  if (world.mode === 'title' || world.paused) return;
  if (world.mode === 'busted' || world.mode === 'wasted' || world.mode === 'won') return;

  updateClock(world, dt);
  const p = world.player;
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);

  // Mission start / retry.
  if (input.pressed('KeyM') && !world.mission) {
    if (world.missionIndex >= 6) {
      world.messages.push({ text: 'All jobs done — free roam!', t: 3 });
    } else {
      startMission(world);
      sfx.click();
    }
  }
  if (input.pressed('KeyU')) {
    const muted = sfx.toggleMute();
    world.messages.push({ text: muted ? 'Sound off' : 'Sound on', t: 2 });
  }
  if (input.pressed('KeyP')) {
    world.paused = !world.paused;
    showBanner(world.paused ? 'Paused — press P to resume' : '');
    if (!world.paused) hud.banner.classList.add('hidden');
  }
  if (input.pressed('KeyR') && !p.car && world.ammo < PLAYER.pistolAmmo) {
    world.ammo = PLAYER.pistolAmmo;
    world.messages.push({ text: 'Pistol reloaded.', t: 2 });
  }

  // Player control.
  if (p.car) {
    driveCar(p.car, dt);
    if (input.pressed('KeyE')) exitCar();
  } else {
    const mv = input.moveVector();
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    p.speed = mv.x !== 0 || mv.y !== 0 ? speed : 0;
    moveOnFoot(world, mv.x * speed, mv.y * speed, dt);
    if (input.down('KeyF')) punch();
    const aimX = world.camera.x + (input.mouse.x - viewSize().w / 2);
    const aimY = world.camera.y + (input.mouse.y - viewSize().h / 2);
    if (input.mouse.clicked || input.down('Space')) shootAt(aimX, aimY);
    if (input.pressed('KeyE')) {
      const car = nearestCar(world, p.x, p.y, 70);
      if (car) enterCar(car);
    }
  }

  updateTraffic(world, dt);
  updatePeds(world, dt);
  updatePolice(world, dt);
  updateThugs(world, dt);
  updateBullets(dt);
  updateMission(world, dt);

  // Particles.
  for (const pt of world.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
  }
  world.particles = world.particles.filter((pt) => pt.life > 0);

  // Messages age out.
  for (const m of world.messages) m.t -= dt;
  world.messages = world.messages.filter((m) => m.t > 0);
  if (bannerTimer > 0) {
    bannerTimer -= dt;
    if (bannerTimer <= 0) hud.banner.classList.add('hidden');
  }

  // Camera follows the player.
  const tx = p.x;
  const ty = p.y;
  world.camera.x += (tx - world.camera.x) * Math.min(1, dt * 5);
  world.camera.y += (ty - world.camera.y) * Math.min(1, dt * 5);

  // Audio follows state.
  const driving = Boolean(p.car);
  sfx.engine(driving ? p.car.speed : 0, driving ? p.car.top : 1, driving);
  const copNear = world.cops.some((c) => dist2(c.x, c.y, p.x, p.y) < 600 * 600);
  sfx.siren(dt, copNear);

  // Death / bust handling.
  if (world.health <= 0 && !p.dead) {
    p.dead = true;
    world.mode = 'wasted';
    showEnd('WASTED', 'Nia went down. The Bay keeps moving — press R to get back up ($100 hospital bill).');
    sfx.busted();
  }
  if (world.mode === 'busted') {
    showEnd('BUSTED', 'Solmar PD hauled Nia in. Press R to post bail ($150) and get back out there.');
  }
}

function showEnd(title, text) {
  hud.endTitle.textContent = title;
  hud.endText.textContent = text;
  hud.end.classList.remove('hidden');
}

function respawn() {
  const p = world.player;
  if (world.mode === 'wasted') world.cash = Math.max(0, world.cash - 100);
  if (world.mode === 'busted') world.cash = Math.max(0, world.cash - 150);
  clearWanted(world);
  world.health = PLAYER.maxHealth;
  world.ammo = PLAYER.pistolAmmo;
  p.dead = false;
  p.onFoot = true;
  p.car = null;
  p.x = 1560;
  p.y = 1140;
  world.camera.x = p.x;
  world.camera.y = p.y;
  world.mode = 'play';
  hud.end.classList.add('hidden');
  if (world.mission) failMission(world, 'you went down');
  saveGame(true);
}

// --- screens ----------------------------------------------------------------

function startGame(fresh) {
  sfx.resume();
  if (!fresh && hasSave()) loadGame();
  world.mode = 'play';
  hud.title.classList.add('hidden');
  hud.end.classList.add('hidden');
  showBanner('Solmar Bay — press M to start the next job');
  saveGame(true);
}

function wireButtons() {
  $('btn-start').addEventListener('click', () => startGame(true));
  $('btn-continue').addEventListener('click', () => startGame(false));
  $('btn-save').addEventListener('click', () => saveGame(false));
  $('btn-respawn').addEventListener('click', () => respawn());
  $('btn-title').addEventListener('click', () => {
    world.mode = 'title';
    hud.end.classList.add('hidden');
    hud.title.classList.remove('hidden');
    refreshTitle();
  });
  $('btn-mute').addEventListener('click', () => {
    const muted = sfx.toggleMute();
    $('btn-mute').textContent = muted ? '🔇 Sound' : '🔊 Sound';
  });
}

function refreshTitle() {
  $('btn-continue').style.display = hasSave() ? '' : 'none';
  $('save-state').textContent = hasSave()
    ? 'A saved game is waiting for you.'
    : 'No save yet — a new story begins.';
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (shotMode) {
    // Staged still: render the composed scene, no simulation.
    drawWorld(ctx, world, world.camera);
    drawMinimap(mctx, world, 0, 0, 200, 150);
    refreshHud();
    return;
  }
  update(dt);
  drawWorld(ctx, world, world.camera);
  drawMinimap(mctx, world, 0, 0, 200, 150);
  refreshHud();
  if ((world.mode === 'busted' || world.mode === 'wasted') && input.pressed('KeyR')) respawn();
  input.endFrame();
  requestAnimationFrame(frame);
}

// --- boot -------------------------------------------------------------------

wireButtons();
refreshTitle();
if (shotMode) {
  applyShot(world, shot);
  if (shot !== 'title') hud.title.classList.add('hidden');
  refreshHud();
  drawWorld(ctx, world, world.camera);
  drawMinimap(mctx, world, 0, 0, 200, 150);
} else {
  // Idle attract mode behind the title: slow pan over the Marina at dusk.
  world.time = 17.4 * 3600;
  world.camera.x = 2600;
  world.camera.y = 500;
  requestAnimationFrame(frame);
}
