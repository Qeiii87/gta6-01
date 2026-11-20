// The screenshot scenes behind ?shot=start|play|chase|mission. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by a simple autopilot (drive to the next intersection, enter the
// nearest car, keep clear of what is ahead), so the frame is what a short
// game really looks like and the same seed always gives the same frame.
import { ROAD_LINES, STEP, WORLD, angleDiff, clamp } from './config.js';
import { addHeat } from './police.js';
import { jumpToStep } from './missions.js';
import { nearestCar } from './vehicles.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 24;
const CHASE_SECONDS = 20;
const MISSION_SECONDS = 18;

function makeAutopilotInput() {
  const held = new Set();
  const pressed = new Set();
  let aimPoint = { x: 0, y: 0 };
  return {
    held,
    mouse: { x: 0, y: 0, down: false, clicked: false },
    aim() {
      return aimPoint;
    },
    setAim(p) {
      aimPoint = p;
    },
    setCamera() {},
    is(action) {
      return held.has(action);
    },
    wasPressed(action) {
      return pressed.has(action);
    },
    setHeld(keys) {
      held.clear();
      for (const k of keys) held.add(k);
    },
    press(action) {
      held.add(action);
      pressed.add(action);
    },
    endFrame() {
      pressed.clear();
    },
  };
}

/** Steer a car toward a waypoint on the road grid. */
function driveToward(state, input, car, wx, wy) {
  const dx = wx - car.x;
  const dy = wy - car.y;
  const dist = Math.hypot(dx, dy);
  const want = Math.atan2(dy, dx);
  const diff = angleDiff(car.angle, want);
  const keys = [];
  if (dist < 70) return keys;
  if (Math.abs(diff) > 0.6 && Math.abs(car.speed) > 120) keys.push('down');
  else keys.push('up');
  if (diff > 0.12) keys.push('right');
  else if (diff < -0.12) keys.push('left');
  // Brake for the car ahead.
  for (const other of state.cars) {
    if (other === car || other.dead) continue;
    const ox = other.x - car.x;
    const oy = other.y - car.y;
    const ahead = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
    const side = Math.abs(-ox * Math.sin(car.angle) + oy * Math.cos(car.angle));
    if (ahead > 0 && ahead < 80 && side < 32) {
      keys.length = 0;
      keys.push('down');
      break;
    }
  }
  return keys;
}

function pickWaypoint(state, car) {
  const x = state.rng.pick(ROAD_LINES);
  const y = state.rng.pick(ROAD_LINES);
  return { x, y };
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * `world` is the { state, step, reset } object from createWorld.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  const input = makeAutopilotInput();
  const stepOnce = () => {
    world.step(input, null, STEP);
    input.endFrame();
  };

  if (name !== 'play' && name !== 'chase' && name !== 'mission') {
    // Title scene: a busy downtown intersection, traffic rolling.
    state.player.x = 1600;
    state.player.y = 1540;
    state.player.angle = -Math.PI / 2;
    for (let i = 0; i < START_SECONDS / STEP; i += 1) stepOnce();
    return { screen: SCREEN_TITLE };
  }

  const seconds = name === 'chase' ? CHASE_SECONDS : name === 'mission' ? MISSION_SECONDS : PLAY_SECONDS;
  if (name === 'mission') {
    jumpToStep(state, 4, 2);
    addHeat(state, 120);
  } else if (name === 'chase') {
    addHeat(state, 120);
  }

  let waypoint = null;
  let stuckTimer = 0;
  let lastX = state.player.x;
  let lastY = state.player.y;
  for (let i = 0; i < seconds / STEP; i += 1) {
    const p = state.player;
    if (!p.inCar) {
      // Walk to the nearest parked car and get in.
      const car = nearestCar(state, p.x, p.y, 400);
      if (car) {
        const dx = car.x - p.x;
        const dy = car.y - p.y;
        if (Math.hypot(dx, dy) < 60) {
          input.press('enter');
          input.setHeld([]);
        } else {
          const keys = [];
          if (dx > 8) keys.push('right');
          else if (dx < -8) keys.push('left');
          if (dy > 8) keys.push('down');
          else if (dy < -8) keys.push('up');
          keys.push('run');
          input.setHeld(keys);
        }
      }
    } else {
      const car = state.cars.find((c) => c.id === p.inCar);
      if (car) {
        if (name === 'mission' && state.mission) {
          const t = state.mission.step;
          if (t && t.x !== undefined) waypoint = { x: t.x, y: t.y };
        }
        if (!waypoint || Math.hypot(waypoint.x - car.x, waypoint.y - car.y) < 80) {
          waypoint = pickWaypoint(state, car);
        }
        // Unstick: reverse briefly if we have not moved in a while.
        if (Math.hypot(car.x - lastX, car.y - lastY) < 2) stuckTimer += STEP;
        else stuckTimer = 0;
        lastX = car.x;
        lastY = car.y;
        if (stuckTimer > 1.5) {
          input.setHeld(['down']);
          if (stuckTimer > 2.5) stuckTimer = 0;
        } else {
          input.setHeld(driveToward(state, input, car, waypoint.x, waypoint.y));
        }
      }
    }
    stepOnce();
    if (!state.player.alive) break;
  }
  input.setHeld([]);
  return { screen: SCREEN_PLAY };
}
