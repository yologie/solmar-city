// Solmar City — keyboard + mouse input with edge-triggered presses.
// The world reads `down` for held keys and `pressed` for single taps.
// `pressed` is cleared once per simulation tick by the main loop.

export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, clicked: false };
    this.anyKey = false;
  }

  attach(canvas) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressed.add(e.code);
      this.anyKey = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.down.clear();
    });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouse.clicked = true;
        this.anyKey = true;
      }
    });
  }

  isDown(code) {
    return this.down.has(code);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  // Movement axes: returns {x, y} in -1..1, using WASD or arrows.
  moveAxes() {
    let x = 0;
    let y = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) y -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) y += 1;
    return { x, y };
  }

  endTick() {
    this.pressed.clear();
    this.mouse.clicked = false;
    this.anyKey = false;
  }
}

// Headless / scripted input for tests and the autopilot: a plain object with
// the same shape the world reads (down Set, pressed Set, mouse).
export function scriptedInput() {
  return {
    down: new Set(),
    pressed: new Set(),
    mouse: { x: 0, y: 0, clicked: false },
    anyKey: false,
    isDown(code) { return this.down.has(code); },
    wasPressed(code) { return this.pressed.has(code); },
    moveAxes() {
      let x = 0;
      let y = 0;
      if (this.isDown('KeyA')) x -= 1;
      if (this.isDown('KeyD')) x += 1;
      if (this.isDown('KeyW')) y -= 1;
      if (this.isDown('KeyS')) y += 1;
      return { x, y };
    },
    endTick() { this.pressed.clear(); this.mouse.clicked = false; this.anyKey = false; },
  };
}
