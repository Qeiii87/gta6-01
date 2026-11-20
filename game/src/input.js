// Keyboard and mouse input, read once per frame. Keys are tracked by their
// physical code so WASD and arrows both drive, and the mouse aims in world
// space through the camera the renderer hands over.
export const ACTION = {
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
  RUN: 'run',
  ENTER: 'enter',
  BRAKE: 'brake',
  SHOOT: 'shoot',
  RELOAD: 'reload',
  PAUSE: 'pause',
  CONFIRM: 'confirm',
  MUTE: 'mute',
};

const KEY_MAP = {
  KeyW: ACTION.UP,
  ArrowUp: ACTION.UP,
  KeyS: ACTION.DOWN,
  ArrowDown: ACTION.DOWN,
  KeyA: ACTION.LEFT,
  ArrowLeft: ACTION.LEFT,
  KeyD: ACTION.RIGHT,
  ArrowRight: ACTION.RIGHT,
  ShiftLeft: ACTION.RUN,
  ShiftRight: ACTION.RUN,
  KeyE: ACTION.ENTER,
  Space: ACTION.BRAKE,
  KeyR: ACTION.RELOAD,
  Escape: ACTION.PAUSE,
  KeyP: ACTION.PAUSE,
  Enter: ACTION.CONFIRM,
  KeyM: ACTION.MUTE,
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  let camera = { x: 0, y: 0, scale: 1 };

  function onKeyDown(event) {
    const action = KEY_MAP[event.code];
    if (!action) return;
    if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
    if (!held.has(action)) pressed.add(action);
    held.add(action);
  }
  function onKeyUp(event) {
    const action = KEY_MAP[event.code];
    if (action) held.delete(action);
  }
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }
  function onMouseDown(event) {
    if (event.button !== 0) return;
    onMouseMove(event);
    mouse.down = true;
    mouse.clicked = true;
  }
  function onMouseUp(event) {
    if (event.button === 0) mouse.down = false;
  }
  function onBlur() {
    held.clear();
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('blur', onBlur);

  return {
    held,
    mouse,
    /** World-space aim point for the current camera. */
    aim() {
      return {
        x: camera.x + (mouse.x - canvas.width / 2) / camera.scale,
        y: camera.y + (mouse.y - canvas.height / 2) / camera.scale,
      };
    },
    setCamera(next) {
      camera = next;
    },
    is(action) {
      return held.has(action);
    },
    /** True only on the frame the key went down; consumed at frame end. */
    wasPressed(action) {
      return pressed.has(action);
    },
    endFrame() {
      pressed.clear();
      mouse.clicked = false;
    },
    detach() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('blur', onBlur);
    },
  };
}
