// SOLMAR BAY — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// Screens: title, play, paused, help, game over (wasted / busted).
// ?seed=N fixes the city and traffic. ?shot=title|foot|drive|chase (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_CASH, EVENT_COIN, EVENT_CRASH, EVENT_MISSION, EVENT_PUNCH, EVENT_SHOT, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_HORN, ACTION_PAUSE, ACTION_RADIO, createInput } from './input.js';
import { createRenderer, SCREEN_HELP, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();
const state = world.state;

function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; } catch { return 0; }
}
function saveBest(value) {
  try { window.localStorage.setItem(BEST_KEY, String(value)); } catch { /* storage can be off */ }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, scene.best, world);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let sirenT = 0;

  function announce(message) { status.textContent = message; }

  function startGame(fresh) {
    if (fresh) world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.start(); audio.resume();
    announce('Playing Solmar Bay. Follow the gold marker to your first job.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (state.stats.earned > best) { best = state.stats.earned; saveBest(best); }
    announce(state.over === 'wasted' ? 'Wasted. Press Space to wake up at the hospital.' : 'Busted. Press Space to wake up at the hospital.');
  }

  // `actions` is the frame's one-shot presses, taken once in frame() and
  // shared with step(): menus take confirm/pause here, play takes the rest.
  function handleActions(actions) {
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame(true);
      return;
    }
    if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) { world.respawn(); startGame(false); }
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
      else if (screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; announce('Playing.'); }
      else if (screen === SCREEN_HELP) screen = SCREEN_PAUSED;
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & ACTION_CONFIRM) { screen = SCREEN_PLAY; announce('Playing.'); }
      return;
    }
    if (screen === SCREEN_HELP) return;
    // In play: radio (R) and horn (H) are one-shot actions; M is handled by
    // the key listener below so it toggles exactly once.
    if (actions & ACTION_RADIO) state.radio = audio.nextStation();
    if (actions & ACTION_HORN && state.player.inCar) audio.horn();
  }

  // Extra keys main.js listens for directly (save / load / help), since the
  // input module only queues the gameplay actions.
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyS' && screen === SCREEN_PAUSED) {
      const ok = world.save();
      state.toast = ok ? 'Game saved.' : 'Save failed — storage is off in this browser.';
      state.toastT = 2.5;
    } else if (event.code === 'KeyL' && screen === SCREEN_PAUSED) {
      if (world.load()) { state.toast = 'Save loaded.'; state.toastT = 2.5; }
    } else if (event.code === 'KeyH' && (screen === SCREEN_PAUSED || screen === SCREEN_PLAY)) {
      screen = screen === SCREEN_HELP ? SCREEN_PAUSED : SCREEN_HELP;
    } else if (event.code === 'KeyM' && screen === SCREEN_PLAY) {
      state.muted = audio.toggleMute();
      state.toast = state.muted ? 'Sound muted.' : 'Sound on.';
      state.toastT = 2;
    } else if (event.code === 'KeyL' && screen === SCREEN_TITLE) {
      if (world.hasSave() && world.load()) startGame(false);
    }
  });

  function step(actions) {
    if (screen === SCREEN_TITLE) return;
    const events = world.step(STEP, input, actions);
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_COIN) audio.pickup();
    if (events & EVENT_CASH) audio.cash();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_MISSION && state.missions.bannerT > 0) audio.pickup();
    if (events & EVENT_WASTED || events & EVENT_BUSTED) { audio.busted(); endGame(); }
    if (state.police.stars > 0) {
      sirenT -= STEP;
      if (sirenT <= 0) { audio.siren(true); sirenT = 1.6; }
    }
    audio.setEngine(state.player.inCar ? Math.abs(state.player.inCar.speed) / 640 : 0, !!state.player.inCar);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_PLAY || screen === SCREEN_HELP) {
      let first = true;
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step(first ? actions : 0);
        first = false;
        accumulator -= STEP;
      }
      if (screen === SCREEN_HELP) accumulator = 0;
    } else accumulator = 0;
    renderer.draw(state, screen, best, world);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
  });

  announce('Solmar Bay. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
