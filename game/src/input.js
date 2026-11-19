// Keyboard + mouse input for Solmar Bay. No game logic here — main.js reads the
// pressed keys each frame.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this.canvas = canvas;
    this._onKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      this.keys.add(e.code);
      if (e.code === 'KeyM' || e.code === 'KeyE' || e.code === 'KeyP' || e.code === 'KeyU') {
        this._pressed.add(e.code);
      }
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._pressed = new Set();
    this._onMouseMove = (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    };
    this._onMouseDown = (e) => {
      this.mouse.down = true;
      this.mouse.clicked = true;
      this._onMouseMove(e);
    };
    this._onMouseUp = () => { this.mouse.down = false; };
    this._onBlur = () => this.keys.clear();
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    this.canvas.addEventListener('mousemove', this._onMouseMove);
    this.canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
  }

  down(code) {
    return this.keys.has(code);
  }

  // True once per physical press; consumed at the end of each frame.
  pressed(code) {
    return this._pressed.has(code);
  }

  endFrame() {
    this._pressed.clear();
    this.mouse.clicked = false;
  }

  // WASD / arrows as a -1..1 movement vector.
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      x *= Math.SQRT1_2;
      y *= Math.SQRT1_2;
    }
    return { x, y };
  }
}
