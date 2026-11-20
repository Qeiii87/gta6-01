// Vehicles: how cars move, how traffic flows, and how to find the nearest
// car to steal. Traffic drives on the right, follows the road grid, and
// brakes for whatever is ahead; police cars are driven from police.js.
import { CAR, ROAD_LINES, TRAFFIC_SPEED, WORLD, angleDiff, clamp } from './config.js';
import { resolveBuilding, snapToRoad } from './city.js';
import { damagePlayer, explodeCar } from './player.js';

let carId = 1;

export function makeCar(state, x, y, angle, kind) {
  const colors = ['#d84a4a', '#4a7ad8', '#e8c33c', '#e8e8e8', '#3a3a3a', '#4ad8a8', '#d88a2a', '#8a5ad8'];
  const car = {
    id: carId++,
    x,
    y,
    angle,
    speed: 0,
    color: kind === 'police' ? '#1a2a4a' : state.rng.pick(colors),
    kind,
    health: CAR.health,
    target: null,
    wasParked: kind === 'parked',
    dead: false,
  };
  if (kind === 'traffic') {
    car.target = pickNextTarget(state, car);
    car.speed = TRAFFIC_SPEED * state.rng.range(0.8, 1.1);
  }
  return car;
}

/** Pick a random intersection a traffic car will drive to next. */
function pickNextTarget(state, car) {
  const p = snapToRoad(car.x, car.y);
  const onVertical = Math.abs(car.x - p.x) < Math.abs(car.y - p.y);
  const line = onVertical ? p.x : p.y;
  const other = state.rng.pick(ROAD_LINES);
  return onVertical ? { x: line, y: other } : { x: other, y: line };
}

/** Nearest non-dead car within maxDist of (x, y), any kind. */
export function nearestCar(state, x, y, maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of state.cars) {
    if (car.dead) continue;
    const dx = car.x - x;
    const dy = car.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function spawnTraffic(state) {
  const p = state.player;
  let traffic = 0;
  for (const car of state.cars) if (car.kind === 'traffic' && !car.dead) traffic += 1;
  if (traffic >= 14) return;
  // Spawn on a road just off-screen from the player.
  const angle = state.rng.next() * Math.PI * 2;
  const dist = state.rng.range(650, 850);
  const x = clamp(p.x + Math.cos(angle) * dist, 120, WORLD - 120);
  const y = clamp(p.y + Math.sin(angle) * dist, 120, WORLD - 120);
  const road = snapToRoad(x, y);
  const horiz = Math.abs(x - road.x) < Math.abs(y - road.y);
  const car = makeCar(state, road.x, road.y, horiz ? 0 : Math.PI / 2, 'traffic');
  if (horiz) car.angle = state.rng.chance(0.5) ? 0 : Math.PI;
  else car.angle = state.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
  state.cars.push(car);
}

export function updateTraffic(state, dt, audio) {
  // Prune the dead and the far away, then drive what is left.
  for (let i = state.cars.length - 1; i >= 0; i -= 1) {
    const car = state.cars[i];
    if (car.dead) {
      state.cars.splice(i, 1);
      continue;
    }
    if (car.kind === 'traffic') {
      const dx = state.player.x - car.x;
      const dy = state.player.y - car.y;
      if (dx * dx + dy * dy > 1400 * 1400) {
        state.cars.splice(i, 1);
        continue;
      }
    }
  }
  for (const car of state.cars) {
    if (car.kind !== 'traffic') continue;
    driveTrafficCar(state, car, dt);
  }
  collideCars(state, dt, audio);
}

function driveTrafficCar(state, car, dt) {
  if (!car.target) car.target = pickNextTarget(state, car);
  const dx = car.target.x - car.x;
  const dy = car.target.y - car.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 30) {
    car.target = pickNextTarget(state, car);
    return;
  }
  const wantAngle = Math.atan2(dy, dx);
  const turn = clamp(angleDiff(car.angle, wantAngle), -1.6 * dt, 1.6 * dt);
  car.angle += turn;

  // Brake for the car ahead so traffic does not pile up.
  let blocked = false;
  for (const other of state.cars) {
    if (other === car || other.dead) continue;
    const ox = other.x - car.x;
    const oy = other.y - car.y;
    const ahead = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
    const side = Math.abs(-ox * Math.sin(car.angle) + oy * Math.cos(car.angle));
    if (ahead > 0 && ahead < 70 && side < 30) {
      blocked = true;
      break;
    }
  }
  // And for a pedestrian crossing ahead.
  if (!blocked) {
    for (const ped of state.peds) {
      if (ped.dead) continue;
      const ox = ped.x - car.x;
      const oy = ped.y - car.y;
      const ahead = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
      const side = Math.abs(-ox * Math.sin(car.angle) + oy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 55 && side < 26) {
        blocked = true;
        break;
      }
    }
  }
  const targetSpeed = blocked ? 0 : TRAFFIC_SPEED;
  car.speed += clamp(targetSpeed - car.speed, -300 * dt, 140 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 30, WORLD - 30);
  car.y = clamp(car.y, 30, WORLD - 30);
  const body = { x: car.x, y: car.y, radius: 22 };
  resolveBuilding(state.city, body);
  car.x = body.x;
  car.y = body.y;
}

/** Car-to-car bumps: push apart, trade a little speed, dent both. */
function collideCars(state, dt, audio) {
  const cars = state.cars;
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    if (a.dead) continue;
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      if (b.dead) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 44 * 44 || d2 < 0.01) continue;
      const d = Math.sqrt(d2);
      const push = (44 - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const impact = Math.abs(a.speed - b.speed);
      if (impact > 120) {
        a.health -= impact * 0.05;
        b.health -= impact * 0.05;
        if (audio && impact > 240) audio.crash();
      }
      const avg = (a.speed + b.speed) / 2;
      a.speed = avg * 0.7;
      b.speed = avg * 0.7;
      if (a.health <= 0 && !a.dead) explodeCar(state, a, audio);
      if (b.health <= 0 && !b.dead) explodeCar(state, b, audio);
    }
  }
  // The player's car shoving a traffic car counts as a fender-bender, not a crime.
  const playerCar = state.player.inCar ? state.cars.find((c) => c.id === state.player.inCar) : null;
  if (playerCar) {
    for (const car of cars) {
      if (car === playerCar || car.dead || car.kind === 'traffic') continue;
      const dx = car.x - playerCar.x;
      const dy = car.y - playerCar.y;
      if (dx * dx + dy * dy < 40 * 40 && Math.abs(playerCar.speed) > 60) {
        car.health -= 8;
        if (car.health <= 0) explodeCar(state, car, audio);
      }
    }
  }
}
