// Keyboard and mouse input. Held keys give a steering vector; one-shot presses
// (confirm, pause, enter car, punch, shoot, horn, radio) are queued as bit flags
// and taken once by the loop, so a press between two frames is never lost.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_SHOOT = 16;
export const ACTION_HORN = 32;
export const ACTION_RADIO = 64;
export const ACTION_MAP = 128;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE', 'KeyF']);
const PUNCH = new Set(['KeyQ']);
const SHOOT = new Set(['KeyX']);
const HORN = new Set(['KeyH']);
const RADIO = new Set(['KeyR']);
const MAP = new Set(['KeyM']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouse = { x: 0, y: 0, down: false };

  function onKey(event, down) {
    const code = event.code;
    if (down) {
      if (CONFIRM.has(code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
      else if (PAUSE.has(code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
      else if (ENTER.has(code)) { if (!event.repeat) actions |= ACTION_ENTER; }
      else if (PUNCH.has(code)) { if (!event.repeat) actions |= ACTION_PUNCH; }
      else if (SHOOT.has(code)) { if (!event.repeat) actions |= ACTION_SHOOT; }
      else if (HORN.has(code)) { if (!event.repeat) actions |= ACTION_HORN; }
      else if (RADIO.has(code)) { if (!event.repeat) actions |= ACTION_RADIO; }
      else if (MAP.has(code)) { if (!event.repeat) actions |= ACTION_MAP; }
      else if (!UP.has(code) && !DOWN.has(code) && !LEFT.has(code) && !RIGHT.has(code) && !SPRINT.has(code)) return;
    }
    if (UP.has(code) || DOWN.has(code) || LEFT.has(code) || RIGHT.has(code) || SPRINT.has(code)) {
      if (down) held.add(code); else held.delete(code);
    }
    event.preventDefault();
  }

  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  window.addEventListener('blur', () => held.clear());
  canvas.addEventListener('pointerdown', (e) => {
    mouse = { x: e.clientX, y: e.clientY, down: true };
    actions |= ACTION_CONFIRM;
  });
  canvas.addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  canvas.addEventListener('pointerup', () => { mouse.down = false; });
  // Mouse aim: click (left) punches on foot, fires the pistol while held in a car
  // is not needed — keyboard X fires; a click always counts as confirm on menus.
  return {
    vector() {
      let x = 0, y = 0;
      for (const c of held) {
        if (UP.has(c)) y -= 1; else if (DOWN.has(c)) y += 1;
        else if (LEFT.has(c)) x -= 1; else if (RIGHT.has(c)) x += 1;
      }
      const len = Math.hypot(x, y) || 1;
      return { x: x / len, y: y / len, sprint: [...held].some((c) => SPRINT.has(c)) };
    },
    mouse() { return mouse; },
    takeActions() { const taken = actions; actions = 0; return taken; },
  };
}

// Headless stand-in for tests: the same shape, driven by a script.
export function createTestInput() {
  let vec = { x: 0, y: 0, sprint: false };
  let actions = 0;
  return {
    vector: () => vec,
    mouse: () => ({ x: 0, y: 0, down: false }),
    takeActions() { const t = actions; actions = 0; return t; },
    setVector(v) { vec = v; },
    press(flag) { actions |= flag; },
  };
}
