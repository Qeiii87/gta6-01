// The world: one state object, one fixed step. Every system (player, traffic,
// pedestrians, police, combat, missions) gets its turn each step, in an order
// that keeps cause and effect honest: the player acts, the city reacts.
import { PLAYER, ROAD_LINES, WORLD, clamp } from './config.js';
import { createCity, nearestRoadPoint } from './city.js';
import { updatePlayer } from './player.js';
import { makeCar, spawnTraffic, updateTraffic } from './vehicles.js';
import { spawnPeds, updatePeds } from './peds.js';
import { updateGang, updateBullets } from './combat.js';
import { updateMissions, startMission } from './missions.js';
import { addHeat, updateOfficers, updatePoliceCars, updateWanted } from './police.js';

export const EVENT_NONE = 0;
export const EVENT_WASTED = 1;
export const EVENT_BUSTED = 2;
export const EVENT_MISSION_DONE = 4;

export function createWorld(rng, saveData, existingCity) {
  const city = existingCity ?? createCity(rng);
  const state = {
    rng,
    seed: 0,
    time: 0,
    city,
    player: {
      x: 1000,
      y: 940,
      angle: -Math.PI / 2,
      speed: 0,
      health: PLAYER.health,
      armor: saveData ? 0 : 0,
      money: saveData ? saveData.money : 0,
      ammo: 24,
      mag: 12,
      reloading: 0,
      fireTimer: 0,
      inCar: null,
      wanted: 0,
      heat: 0,
      lastCrimeSeen: -99,
      alive: true,
      busted: false,
      wasted: false,
    },
    cars: [],
    peds: [],
    officers: [],
    gang: [],
    bullets: [],
    particles: [],
    pickups: [],
    missionIndex: saveData ? saveData.missionIndex : 0,
    mission: null,
    completed: saveData ? [...saveData.completed] : [],
    stashesTaken: saveData ? new Set(saveData.stashes) : new Set(),
    camera: { x: 1000, y: 940, shake: 0, zoom: 1 },
    stats: { kills: 0, carsStolen: 0, missionsDone: 0, shotsFired: 0 },
    banner: null,
    message: null,
    messageUntil: 0,
    started: false,
    won: false,
  };
  spawnInitial(state);
  startMission(state, state.missionIndex);
  return { state, step, reset };

  function reset() {
    const keep = {
      money: state.player.money,
      missionIndex: state.missionIndex,
      completed: state.completed,
      stashesTaken: state.stashesTaken,
      won: state.won,
    };
    const fresh = createWorld(
      rng,
      {
        money: keep.money,
        missionIndex: keep.missionIndex,
        completed: keep.completed,
        stashes: [...keep.stashesTaken],
      },
      city,
    );
    Object.assign(state, fresh.state);
    state.won = keep.won;
  }

  function step(input, audio, dt) {
    state.time += dt;
    if (!state.player.alive) return EVENT_NONE;
    let events = EVENT_NONE;
    updatePlayer(state, input, dt, audio);
    updateTraffic(state, dt, audio);
    updatePeds(state, dt);
    updatePoliceCars(state, dt, audio);
    updateOfficers(state, dt, audio);
    updateGang(state, dt, audio);
    updateBullets(state, dt, audio);
    updateParticles(state, dt);
    updatePickups(state, audio);
    updateMissions(state, dt, audio);
    updateWanted(state, dt);
    updateCamera(state, dt);
    spawnTraffic(state);
    spawnPeds(state);
    if (state.player.health <= 0 && state.player.alive) {
      state.player.alive = false;
      state.player.wasted = true;
      events |= EVENT_WASTED;
    }
    if (state.player.busted) events |= EVENT_BUSTED;
    return events;
  }
}

function spawnInitial(state) {
  const { rng, city } = state;
  // Parked cars along the roads near the start.
  for (let i = 0; i < 10; i += 1) {
    const line = rng.pick(ROAD_LINES);
    const along = rng.range(300, 2900);
    const horiz = rng.chance(0.5);
    state.cars.push(makeCar(state, horiz ? along : line, horiz ? line : along, horiz ? 0 : Math.PI / 2, 'parked'));
  }
  // A drivable car right by the garage, so the first mission starts fast.
  state.cars.push(makeCar(state, 1000, 880, -Math.PI / 2, 'parked'));
  // Pickups: health, armor and ammo scattered on sidewalks.
  for (let i = 0; i < 8; i += 1) {
    const p = nearestRoadPoint(rng.range(300, 2900), rng.range(300, 2900));
    state.pickups.push({
      x: p.x + rng.range(-70, 70),
      y: p.y + rng.range(-70, 70),
      kind: ['health', 'armor', 'ammo'][i % 3],
      taken: false,
    });
  }
  for (let i = 0; i < state.city.stashes.length; i += 1) {
    if (!state.stashesTaken.has(i)) {
      const s = state.city.stashes[i];
      state.pickups.push({ x: s.x, y: s.y, kind: 'cash', stashIndex: i, taken: false });
    }
  }
}

export function addParticles(state, x, y, count, color, speed, life, size) {
  for (let i = 0; i < count; i += 1) {
    const a = state.rng.next() * Math.PI * 2;
    const s = state.rng.range(0.3, 1) * speed;
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: state.rng.range(0.5, 1) * life,
      maxLife: life,
      size: state.rng.range(0.5, 1) * size,
      color,
    });
  }
}

function updateParticles(state, dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
  if (state.particles.length > 400) state.particles.splice(0, state.particles.length - 400);
}

function updatePickups(state, audio) {
  const p = state.player;
  if (p.inCar) return;
  for (const pk of state.pickups) {
    if (pk.taken) continue;
    const dx = p.x - pk.x;
    const dy = p.y - pk.y;
    if (dx * dx + dy * dy < 28 * 28) {
      pk.taken = true;
      if (pk.kind === 'health') p.health = Math.min(100, p.health + 50);
      if (pk.kind === 'armor') p.armor = Math.min(100, p.armor + 50);
      if (pk.kind === 'ammo') p.ammo += 36;
      if (pk.kind === 'cash') {
        p.money += 250;
        state.stashesTaken.add(pk.stashIndex);
      }
      if (audio) audio.pickup();
      state.message = pk.kind === 'cash' ? '+$250 stash found' : `Picked up ${pk.kind}`;
      state.messageUntil = state.time + 2;
    }
  }
}

function updateCamera(state, dt) {
  const p = state.player;
  const focus = p.inCar ? state.cars.find((c) => c.id === p.inCar) : p;
  const fx = focus ? focus.x : p.x;
  const fy = focus ? focus.y : p.y;
  const look = p.inCar ? 0.25 : 0.12;
  const speed = focus && focus.speed ? focus.speed : 0;
  const ang = focus ? focus.angle : p.angle;
  const tx = clamp(fx + Math.cos(ang) * speed * look, 640, WORLD - 640);
  const ty = clamp(fy + Math.sin(ang) * speed * look, 360, WORLD - 360);
  const k = 1 - Math.pow(0.001, dt);
  state.camera.x += (tx - state.camera.x) * k;
  state.camera.y += (ty - state.camera.y) * k;
  state.camera.shake = Math.max(0, state.camera.shake - dt * 30);
}

export function shakeCamera(state, amount) {
  state.camera.shake = Math.min(14, state.camera.shake + amount);
}

export function showBanner(state, text, sub, seconds = 3) {
  state.banner = { text, sub, until: state.time + seconds };
}

export { addHeat };
