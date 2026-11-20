// The player: on foot with WASD and a run key, behind the wheel with
// acceleration and steering, in and out of cars with E, and aiming with the
// mouse. Stealing a car in sight of the law is a crime — see police.js.
import { CAR, PLAYER, TAU, WORLD, angleDiff, clamp } from './config.js';
import { resolveBuilding } from './city.js';
import { fireWeapon } from './combat.js';
import { addHeat } from './police.js';
import { nearestCar } from './vehicles.js';

export function updatePlayer(state, input, dt, audio) {
  const p = state.player;
  if (!p.alive) return;
  p.fireTimer = Math.max(0, p.fireTimer - dt);
  p.reloading = Math.max(0, p.reloading - dt);

  if (p.inCar) {
    driveCar(state, input, dt, audio);
    return;
  }

  // On foot: move, run, collide with buildings, aim with the mouse.
  const speed = input.is('run') ? PLAYER.runSpeed : PLAYER.walkSpeed;
  let mx = (input.is('right') ? 1 : 0) - (input.is('left') ? 1 : 0);
  let my = (input.is('down') ? 1 : 0) - (input.is('up') ? 1 : 0);
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len;
    my /= len;
    p.x += mx * speed * dt;
    p.y += my * speed * dt;
    p.angle = Math.atan2(my, mx);
    p.speed = speed;
  } else {
    p.speed = 0;
  }
  p.x = clamp(p.x, 16, WORLD - 16);
  p.y = clamp(p.y, 16, WORLD - 16);
  const body = { x: p.x, y: p.y, radius: PLAYER.radius };
  resolveBuilding(state.city, body);
  p.x = body.x;
  p.y = body.y;
  // Cars are solid on foot: step around them instead of through them.
  for (const car of state.cars) {
    if (car.dead) continue;
    const dx = p.x - car.x;
    const dy = p.y - car.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 30 * 30 && d2 > 0.01) {
      const d = Math.sqrt(d2);
      p.x = car.x + (dx / d) * 30;
      p.y = car.y + (dy / d) * 30;
    }
  }

  // Face the mouse while shooting; otherwise face the way we walk.
  if (input.mouse.down || input.mouse.clicked) {
    const aim = input.aim();
    p.angle = Math.atan2(aim.y - p.y, aim.x - p.x);
  }

  if (input.mouse.down && p.fireTimer <= 0 && p.reloading <= 0) {
    fireWeapon(state, p, p.angle, 'player');
  }
  if (input.wasPressed('reload') && p.mag < 12 && p.ammo > 0 && p.reloading <= 0) {
    p.reloading = 1.1;
    const take = Math.min(12 - p.mag, p.ammo);
    p.mag += take;
    p.ammo -= take;
  }

  if (input.wasPressed('enter')) {
    const car = nearestCar(state, p.x, p.y, 70);
    if (car && car.kind !== 'police') {
      enterCar(state, car, audio);
    }
  }
}

function driveCar(state, input, dt, audio) {
  const p = state.player;
  const car = state.cars.find((c) => c.id === p.inCar);
  if (!car) {
    p.inCar = null;
    return;
  }
  const forward = input.is('up') ? 1 : 0;
  const reverse = input.is('down') ? 1 : 0;
  const steer = (input.is('left') ? -1 : 0) + (input.is('right') ? 1 : 0);
  const braking = input.is('brake');

  if (forward) car.speed += CAR.accel * dt;
  else if (reverse) car.speed -= (car.speed > 5 ? CAR.brake : CAR.reverseAccel) * dt;
  else car.speed *= Math.pow(0.4, dt);
  if (braking) {
    car.speed -= Math.sign(car.speed) * CAR.brake * dt;
    if (Math.abs(car.speed) < 8) car.speed = 0;
  }
  car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
  const turn = steer * CAR.turnRate * clamp(Math.abs(car.speed) / 120, 0, 1) * Math.sign(car.speed || 1);
  car.angle += turn * dt;

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(nx, 30, WORLD - 30);
  car.y = clamp(ny, 30, WORLD - 30);
  const body = { x: car.x, y: car.y, radius: 22 };
  const hit = resolveBuilding(state.city, body);
  car.x = body.x;
  car.y = body.y;
  if (hit) {
    const impact = Math.abs(car.speed);
    car.speed *= -0.25;
    if (impact > 220 && audio) audio.crash();
    if (impact > 260) {
      car.health -= (impact - 260) * 0.12;
      damagePlayer(state, (impact - 260) * 0.05);
    }
  }
  if (Math.abs(car.speed) > 300 && state.rng.chance(dt * 6)) {
    state.particles.push({
      x: car.x - Math.cos(car.angle) * 24,
      y: car.y - Math.sin(car.angle) * 24,
      vx: -Math.cos(car.angle) * 30,
      vy: -Math.sin(car.angle) * 30,
      life: 0.5,
      maxLife: 0.5,
      size: 5,
      color: '#cfc8b8',
    });
  }

  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.speed = Math.abs(car.speed);

  if (input.wasPressed('enter')) {
    exitCar(state, car);
  }
  if (car.health <= 0) {
    explodeCar(state, car, audio);
    p.inCar = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
    damagePlayer(state, 20);
  }
}

export function enterCar(state, car, audio) {
  const p = state.player;
  p.inCar = car.id;
  car.kind = 'player';
  p.x = car.x;
  p.y = car.y;
  if (audio) audio.click();
  if (car.wasParked) {
    state.stats.carsStolen += 1;
    if (state.player.wanted < 1) addHeat(state, 30);
    state.message = 'Car stolen — the law noticed';
    state.messageUntil = state.time + 2.5;
  }
}

export function exitCar(state, car) {
  const p = state.player;
  p.inCar = null;
  car.kind = 'parked';
  const side = Math.PI / 2;
  p.x = car.x + Math.cos(car.angle + side) * 40;
  p.y = car.y + Math.sin(car.angle + side) * 40;
  p.x = clamp(p.x, 16, WORLD - 16);
  p.y = clamp(p.y, 16, WORLD - 16);
}

export function explodeCar(state, car, audio) {
  car.dead = true;
  car.health = 0;
  if (audio) audio.explosion();
  // Particles and shake are added here directly.
  state.particles.push(
    ...Array.from({ length: 26 }, () => ({
      x: car.x + state.rng.range(-14, 14),
      y: car.y + state.rng.range(-14, 14),
      vx: state.rng.range(-160, 160),
      vy: state.rng.range(-160, 160),
      life: state.rng.range(0.4, 1.1),
      maxLife: 1.1,
      size: state.rng.range(4, 11),
      color: state.rng.pick(['#ff8a2a', '#ffcf4a', '#5a5a5a', '#2a2a2a']),
    })),
  );
  state.camera.shake = Math.min(14, state.camera.shake + 10);
  // Blast hurts everyone nearby, including the player.
  const dx = state.player.x - car.x;
  const dy = state.player.y - car.y;
  if (dx * dx + dy * dy < 120 * 120) damagePlayer(state, 35);
}

export function damagePlayer(state, amount) {
  const p = state.player;
  let rest = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, rest * 0.6);
    p.armor -= absorbed;
    rest -= absorbed;
  }
  p.health -= rest;
  if (p.health < 0) p.health = 0;
}
