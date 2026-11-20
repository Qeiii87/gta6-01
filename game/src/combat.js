// Combat: a pistol with a magazine and a reload, bullets that fly straight
// and hit what they cross, and the Harbor Kings gang, who shoot back. A
// bullet that finds a bystander is a crime — see police.js.
import { BULLET_SPEED, PISTOL_DAMAGE, PISTOL_MAG, PISTOL_RATE, WORLD } from './config.js';
import { hitsBuilding } from './city.js';
import { addHeat } from './police.js';
import { damagePlayer, explodeCar } from './player.js';
import { addParticles } from './world.js';

/** Fire one shot from `shooter` along `angle`. `from` is 'player' or 'gang'. */
export function fireWeapon(state, shooter, angle, from) {
  const p = state.player;
  if (from === 'player') {
    if (p.mag <= 0) {
      if (p.ammo > 0 && p.reloading <= 0) {
        p.reloading = 1.1;
        const take = Math.min(PISTOL_MAG - p.mag, p.ammo);
        p.mag += take;
        p.ammo -= take;
      }
      return;
    }
    p.mag -= 1;
    p.fireTimer = PISTOL_RATE;
    state.stats.shotsFired += 1;
  }
  const spread = from === 'player' ? 0.03 : 0.12;
  const a = angle + (state.rng.next() - 0.5) * 2 * spread;
  state.bullets.push({
    x: shooter.x + Math.cos(a) * 20,
    y: shooter.y + Math.sin(a) * 20,
    vx: Math.cos(a) * BULLET_SPEED,
    vy: Math.sin(a) * BULLET_SPEED,
    from,
    damage: PISTOL_DAMAGE,
    life: 0.8,
  });
  addParticles(state, shooter.x + Math.cos(a) * 22, shooter.y + Math.sin(a) * 22, 3, '#ffd94a', 120, 0.12, 3);
}

export function updateBullets(state, dt, audio) {
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let dead = b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD || b.y > WORLD;
    if (!dead && hitsBuilding(state.city, b.x, b.y, 2)) {
      addParticles(state, b.x, b.y, 4, '#c8b898', 90, 0.25, 3);
      dead = true;
    }
    if (!dead) {
      // Cars: a bullet dents the body; a dead car explodes.
      for (const car of state.cars) {
        if (car.dead) continue;
        const dx = b.x - car.x;
        const dy = b.y - car.y;
        const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
        const across = -dx * Math.sin(car.angle) + dy * Math.cos(car.angle);
        if (Math.abs(along) < 30 && Math.abs(across) < 15) {
          car.health -= b.damage;
          addParticles(state, b.x, b.y, 5, '#ffb84a', 140, 0.3, 3);
          if (car.health <= 0) explodeCar(state, car, audio);
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.from === 'player') {
      // Gang members and officers on foot.
      for (const g of state.gang) {
        if (g.dead) continue;
        const dx = b.x - g.x;
        const dy = b.y - g.y;
        if (dx * dx + dy * dy < 15 * 15) {
          g.health -= b.damage;
          addParticles(state, b.x, b.y, 5, '#d84a4a', 120, 0.3, 3);
          if (g.health <= 0) {
            g.dead = true;
            state.stats.kills += 1;
          }
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (const o of state.officers) {
          const dx = b.x - o.x;
          const dy = b.y - o.y;
          if (dx * dx + dy * dy < 14 * 14) {
            state.officers.splice(state.officers.indexOf(o), 1);
            state.stats.kills += 1;
            addHeat(state, 60);
            addParticles(state, b.x, b.y, 5, '#1a2a4a', 120, 0.3, 3);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const ped of state.peds) {
          if (ped.dead) continue;
          const dx = b.x - ped.x;
          const dy = b.y - ped.y;
          if (dx * dx + dy * dy < 13 * 13) {
            ped.dead = true;
            state.stats.kills += 1;
            addHeat(state, 45);
            state.message = 'Bystander down — wanted level up';
            state.messageUntil = state.time + 2.5;
            dead = true;
            break;
          }
        }
      }
    }
    if (!dead && b.from === 'gang') {
      const p = state.player;
      if (!p.inCar) {
        const dx = b.x - p.x;
        const dy = b.y - p.y;
        if (dx * dx + dy * dy < 14 * 14) {
          damagePlayer(state, b.damage * 0.7);
          addParticles(state, b.x, b.y, 4, '#d84a4a', 110, 0.25, 3);
          dead = true;
        }
      } else {
        const car = state.cars.find((c) => c.id === p.inCar);
        if (car) {
          const dx = b.x - car.x;
          const dy = b.y - car.y;
          const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
          const across = -dx * Math.sin(car.angle) + dy * Math.cos(car.angle);
          if (Math.abs(along) < 30 && Math.abs(across) < 15) {
            car.health -= b.damage * 0.5;
            if (car.health <= 0) explodeCar(state, car, audio);
            dead = true;
          }
        }
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
}

/** Spawn a gang member at (x, y) who fights the player on sight. */
export function spawnGangMember(state, x, y) {
  const g = {
    x,
    y,
    angle: state.rng.next() * Math.PI * 2,
    health: 70,
    fireTimer: state.rng.range(0.3, 1),
    dead: false,
    shirt: '#8a2a2a',
  };
  state.gang.push(g);
  return g;
}

export function updateGang(state, dt, audio) {
  const p = state.player;
  for (let i = state.gang.length - 1; i >= 0; i -= 1) {
    const g = state.gang[i];
    if (g.dead) {
      state.gang.splice(i, 1);
      continue;
    }
    const dx = p.x - g.x;
    const dy = p.y - g.y;
    const d = Math.hypot(dx, dy);
    if (d > 1100) continue;
    g.angle = Math.atan2(dy, dx);
    g.fireTimer -= dt;
    if (d > 260) {
      // Close the distance, but never through a wall.
      g.x += Math.cos(g.angle) * 110 * dt;
      g.y += Math.sin(g.angle) * 110 * dt;
    } else if (g.fireTimer <= 0 && d < 480) {
      fireWeapon(state, g, g.angle, 'gang');
      g.fireTimer = state.rng.range(0.9, 1.7);
      if (audio) audio.enemyShot();
    }
  }
}
