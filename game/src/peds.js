// Pedestrians: Solmar Bay's residents, walking the sidewalks, crossing at
// intersections, and running for cover when gunfire or a speeding car comes
// too close. Hitting one is a crime the law notices.
import { PED_SPEED, ROAD_LINES, WORLD, clamp } from './config.js';
import { resolveBuilding } from './city.js';
import { addHeat } from './police.js';

const SHIRTS = ['#e86a6a', '#6a9ae8', '#e8c96a', '#6ad88a', '#c86ae8', '#e8e8e8', '#e88a4a', '#4ad8d8'];

export function spawnPeds(state) {
  const p = state.player;
  let count = 0;
  for (const ped of state.peds) if (!ped.dead) count += 1;
  if (count >= 36) return;
  const angle = state.rng.next() * Math.PI * 2;
  const dist = state.rng.range(500, 800);
  const x = clamp(p.x + Math.cos(angle) * dist, 100, WORLD - 100);
  const y = clamp(p.y + Math.sin(angle) * dist, 100, WORLD - 100);
  state.peds.push(makePed(state, x, y));
}

export function makePed(state, x, y) {
  // Start on a sidewalk: just off a road centre line.
  const line = state.rng.pick(ROAD_LINES);
  const horiz = state.rng.chance(0.5);
  const px = horiz ? x : line + (state.rng.chance(0.5) ? 62 : -62);
  const py = horiz ? line + (state.rng.chance(0.5) ? 62 : -62) : y;
  return {
    x: clamp(px, 60, WORLD - 60),
    y: clamp(py, 60, WORLD - 60),
    angle: state.rng.next() * Math.PI * 2,
    speed: PED_SPEED * state.rng.range(0.7, 1.3),
    shirt: state.rng.pick(SHIRTS),
    state: 'walk',
    panic: 0,
    dead: false,
    wander: state.rng.range(2, 6),
  };
}

export function updatePeds(state, dt) {
  const p = state.player;
  for (let i = state.peds.length - 1; i >= 0; i -= 1) {
    const ped = state.peds[i];
    if (ped.dead) {
      state.peds.splice(i, 1);
      continue;
    }
    const dx = p.x - ped.x;
    const dy = p.y - ped.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > 1200 * 1200) {
      state.peds.splice(i, 1);
      continue;
    }
    // Panic: gunfire nearby, or a fast car bearing down.
    const shooting = state.bullets.length > 0;
    let danger = null;
    if (shooting) danger = { x: p.x, y: p.y };
    for (const car of state.cars) {
      if (car.dead || Math.abs(car.speed) < 150) continue;
      const cdx = car.x - ped.x;
      const cdy = car.y - ped.y;
      if (cdx * cdx + cdy * cdy < 130 * 130) danger = { x: car.x, y: car.y };
    }
    if (danger) {
      ped.state = 'flee';
      ped.panic = 3;
      ped.angle = Math.atan2(ped.y - danger.y, ped.x - danger.x);
    } else if (ped.panic > 0) {
      ped.panic -= dt;
      if (ped.panic <= 0) ped.state = 'walk';
    }

    if (ped.state === 'flee') {
      ped.x += Math.cos(ped.angle) * PED_SPEED * 2.1 * dt;
      ped.y += Math.sin(ped.angle) * PED_SPEED * 2.1 * dt;
    } else {
      ped.wander -= dt;
      if (ped.wander <= 0) {
        ped.wander = state.rng.range(2, 7);
        ped.angle += state.rng.range(-1.2, 1.2);
      }
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
    }
    ped.x = clamp(ped.x, 40, WORLD - 40);
    ped.y = clamp(ped.y, 40, WORLD - 40);
    const body = { x: ped.x, y: ped.y, radius: 10 };
    if (resolveBuilding(state.city, body)) {
      ped.x = body.x;
      ped.y = body.y;
      ped.angle += Math.PI / 2;
    } else {
      ped.x = body.x;
      ped.y = body.y;
    }

    // Run over by a fast car: a crime only when it is the player's car.
    // Traffic hitting a pedestrian is the city's problem, not the player's.
    for (const car of state.cars) {
      if (car.dead) continue;
      const cdx = car.x - ped.x;
      const cdy = car.y - ped.y;
      if (cdx * cdx + cdy * cdy < 26 * 26 && Math.abs(car.speed) > 60) {
        ped.dead = true;
        state.stats.kills += 1;
        if (car.kind === 'player') {
          addHeat(state, 45);
          state.message = 'Pedestrian hit — wanted level up';
          state.messageUntil = state.time + 2.5;
        }
        break;
      }
    }
    // Walked into by the player on foot: a shove, not a crime.
    if (!ped.dead && d2 < 22 * 22) {
      ped.x -= dx * 0.02;
      ped.y -= dy * 0.02;
    }
  }
}
