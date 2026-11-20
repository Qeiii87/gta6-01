// The law: a heat meter that becomes wanted stars, police cruisers that
// chase down the grid, and officers on foot who will arrest a player who
// lingers too close. Lose them, stay out of sight, and the heat fades.
import { COP_SPEED, ROAD_LINES, WANTED_DECAY_SECONDS, WORLD, angleDiff, clamp } from './config.js';
import { makeCar } from './vehicles.js';
import { resolveBuilding, snapToRoad } from './city.js';
import { damagePlayer } from './player.js';

/** Add heat; stars rise at 25 / 60 / 110 / 170 / 240 heat. */
export function addHeat(state, amount) {
  const p = state.player;
  p.heat = Math.min(260, p.heat + amount);
  p.wanted = heatToStars(p.heat);
}

export function heatToStars(heat) {
  if (heat >= 240) return 5;
  if (heat >= 170) return 4;
  if (heat >= 110) return 3;
  if (heat >= 60) return 2;
  if (heat >= 25) return 1;
  return 0;
}

export function updateWanted(state, dt) {
  const p = state.player;
  if (p.wanted === 0) {
    p.heat = Math.max(0, p.heat - dt * 4);
    return;
  }
  // Heat fades only while no police can see the player.
  let seen = false;
  for (const car of state.cars) {
    if (car.kind !== 'police' || car.dead) continue;
    const dx = car.x - p.x;
    const dy = car.y - p.y;
    if (dx * dx + dy * dy < 600 * 600) {
      seen = true;
      break;
    }
  }
  if (!seen) {
    for (const o of state.officers) {
      const dx = o.x - p.x;
      const dy = o.y - p.y;
      if (dx * dx + dy * dy < 500 * 500) {
        seen = true;
        break;
      }
    }
  }
  if (!seen) {
    p.heat -= dt * (60 / WANTED_DECAY_SECONDS);
    if (p.heat < 0) p.heat = 0;
    const stars = heatToStars(p.heat);
    if (stars < p.wanted) {
      p.wanted = stars;
      if (stars === 0) {
        state.message = 'You lost the cops';
        state.messageUntil = state.time + 2.5;
      }
    }
  }
}

export function updatePoliceCars(state, dt, audio) {
  const p = state.player;
  const want = p.wanted === 0 ? 0 : Math.min(2 + p.wanted, 6);
  let count = 0;
  for (const car of state.cars) if (car.kind === 'police' && !car.dead) count += 1;
  if (p.wanted > 0 && count < want) {
    // Spawn a cruiser on a road just off-screen.
    const angle = state.rng.next() * Math.PI * 2;
    const dist = state.rng.range(700, 900);
    const x = clamp(p.x + Math.cos(angle) * dist, 120, WORLD - 120);
    const y = clamp(p.y + Math.sin(angle) * dist, 120, WORLD - 120);
    const road = snapToRoad(x, y);
    const car = makeCar(state, road.x, road.y, 0, 'police');
    car.speed = 200;
    state.cars.push(car);
  }
  for (const car of state.cars) {
    if (car.kind !== 'police' || car.dead) continue;
    chasePlayer(state, car, dt);
    // A cruiser ramming the player's car dents it and hurts the player.
    const playerCar = p.inCar ? state.cars.find((c) => c.id === p.inCar) : null;
    if (playerCar) {
      const dx = car.x - playerCar.x;
      const dy = car.y - playerCar.y;
      if (dx * dx + dy * dy < 46 * 46) {
        playerCar.health -= 6 * dt * 10;
        if (Math.abs(car.speed) > 200) damagePlayer(state, 4 * dt * 10);
        if (audio && state.rng.chance(dt * 2)) audio.crash();
      }
    }
  }
}

/** Grid chase: steer along the roads toward the player, one axis at a time. */
function chasePlayer(state, car, dt) {
  const p = state.player;
  const dx = p.x - car.x;
  const dy = p.y - car.y;
  const dist = Math.hypot(dx, dy);
  const wantAngle = Math.atan2(dy, dx);
  // Near the player, aim straight at them; further off, stick to the grid.
  let targetAngle = wantAngle;
  if (dist > 260) {
    const onVertical = Math.abs(dx) > Math.abs(dy);
    targetAngle = onVertical ? (dx > 0 ? 0 : Math.PI) : dy > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
  const turn = clamp(angleDiff(car.angle, targetAngle), -3.2 * dt, 3.2 * dt);
  car.angle += turn;
  const maxSpeed = 300 + state.player.wanted * 30;
  car.speed += clamp(maxSpeed - car.speed, -400 * dt, 260 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 30, WORLD - 30);
  car.y = clamp(car.y, 30, WORLD - 30);
  const body = { x: car.x, y: car.y, radius: 22 };
  resolveBuilding(state.city, body);
  car.x = body.x;
  car.y = body.y;
  if (car.health <= 0) {
    car.dead = true;
  }
}

export function updateOfficers(state, dt, audio) {
  const p = state.player;
  // Officers appear when the player is wanted and on foot, or loitering.
  if (p.wanted > 0 && !p.inCar && state.officers.length < Math.min(p.wanted + 1, 4)) {
    if (state.rng.chance(dt * 0.5)) {
      const angle = state.rng.next() * Math.PI * 2;
      state.officers.push({
        x: clamp(p.x + Math.cos(angle) * 420, 60, WORLD - 60),
        y: clamp(p.y + Math.sin(angle) * 420, 60, WORLD - 60),
        angle: 0,
        speed: COP_SPEED,
        arrestTimer: 0,
      });
    }
  }
  for (let i = state.officers.length - 1; i >= 0; i -= 1) {
    const o = state.officers[i];
    const dx = p.x - o.x;
    const dy = p.y - o.y;
    const d = Math.hypot(dx, dy);
    if (p.wanted === 0 || p.inCar || d > 900) {
      state.officers.splice(i, 1);
      continue;
    }
    o.angle = Math.atan2(dy, dx);
    o.x += Math.cos(o.angle) * o.speed * dt;
    o.y += Math.sin(o.angle) * o.speed * dt;
    const body = { x: o.x, y: o.y, radius: 11 };
    resolveBuilding(state.city, body);
    o.x = body.x;
    o.y = body.y;
    if (d < 26) {
      o.arrestTimer += dt;
      if (o.arrestTimer > 1.6) {
        p.busted = true;
        p.alive = false;
        if (audio) audio.missionFail();
      }
    } else {
      o.arrestTimer = 0;
    }
  }
}
