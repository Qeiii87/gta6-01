// Everything the player sees of Solmar Bay: sun-soaked ground, the road grid,
// pastel towers with long shadows, traffic, crowds, gunfire and the mission
// beacon — all drawn in canvas, culled to the camera's view.
import { PALETTE, ROAD_LINES, ROAD_WIDTH, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

function inView(cam, vw, vh, x, y, margin) {
  return (
    x > cam.x - vw / 2 - margin &&
    x < cam.x + vw / 2 + margin &&
    y > cam.y - vh / 2 - margin &&
    y < cam.y + vh / 2 + margin
  );
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const vw = canvas.width;
  const vh = canvas.height;

  function drawGround(state) {
    const cam = state.camera;
    const left = cam.x - vw / 2;
    const top = cam.y - vh / 2;
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(left, top, vw, vh);
    // Beach and ocean on the west edge.
    if (left < 150) {
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(Math.max(left, 80), top, 150 - Math.max(left, 80), vh);
      ctx.fillStyle = PALETTE.water;
      ctx.fillRect(left, top, Math.max(0, 80 - left), vh);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      for (let y = Math.floor(top / 46) * 46; y < top + vh; y += 46) {
        ctx.beginPath();
        ctx.moveTo(70 + Math.sin(state.time * 0.7 + y * 0.05) * 5, y);
        ctx.lineTo(80, y);
        ctx.stroke();
      }
    }
    // Port concrete on the south edge.
    if (top + vh > 3050) {
      ctx.fillStyle = PALETTE.port;
      ctx.fillRect(left, 3050, vw, top + vh - 3050);
    }
  }

  function drawRoads(state) {
    const cam = state.camera;
    const left = cam.x - vw / 2;
    const top = cam.y - vh / 2;
    ctx.fillStyle = PALETTE.asphalt;
    for (const line of ROAD_LINES) {
      if (line > left - ROAD_WIDTH && line < left + vw + ROAD_WIDTH) {
        ctx.fillRect(line - ROAD_WIDTH / 2, top, ROAD_WIDTH, vh);
      }
      if (line > top - ROAD_WIDTH && line < top + vh + ROAD_WIDTH) {
        ctx.fillRect(left, line - ROAD_WIDTH / 2, vw, ROAD_WIDTH);
      }
    }
    // Centre dashes and edge lines.
    ctx.strokeStyle = PALETTE.lineYellow;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 22]);
    for (const line of ROAD_LINES) {
      if (line > left - ROAD_WIDTH && line < left + vw + ROAD_WIDTH) {
        ctx.beginPath();
        ctx.moveTo(line, top);
        ctx.lineTo(line, top + vh);
        ctx.stroke();
      }
      if (line > top - ROAD_WIDTH && line < top + vh + ROAD_WIDTH) {
        ctx.beginPath();
        ctx.moveTo(left, line);
        ctx.lineTo(left + vw, line);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    // Crosswalks at every intersection in view.
    ctx.fillStyle = PALETTE.lineWhite;
    for (const x of ROAD_LINES) {
      for (const y of ROAD_LINES) {
        if (!inView(cam, vw, vh, x, y, 120)) continue;
        for (let i = -3; i <= 3; i += 1) {
          ctx.fillRect(x - 44 + i * 13, y - 58, 6, 14);
          ctx.fillRect(x - 44 + i * 13, y + 44, 6, 14);
          ctx.fillRect(x - 58, y - 44 + i * 13, 14, 6);
          ctx.fillRect(x + 44, y - 44 + i * 13, 14, 6);
        }
      }
    }
  }

  function drawBlocks(state) {
    const cam = state.camera;
    const city = state.city;
    for (const park of city.parks) {
      if (!inView(cam, vw, vh, park.x + park.size / 2, park.y + park.size / 2, 200)) continue;
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x, park.y, park.size, park.size);
      if (park.pond) {
        ctx.fillStyle = PALETTE.waterDeep;
        ctx.beginPath();
        ctx.ellipse(park.x + park.size * 0.7, park.y + park.size * 0.65, 42, 26, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const t of park.trees) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.ellipse(t.x + 4, t.y + 5, t.r, t.r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.tree;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.treeLight;
        ctx.beginPath();
        ctx.arc(t.x - 3, t.y - 3, t.r * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const lot of city.lots) {
      if (!inView(cam, vw, vh, lot.x + lot.size / 2, lot.y + lot.size / 2, 200)) continue;
      ctx.fillStyle = '#9a938a';
      ctx.fillRect(lot.x, lot.y, lot.size, lot.size);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2;
      for (const bay of lot.bays) {
        ctx.strokeRect(bay.x - 14, bay.y - 26, 28, 52);
      }
    }
    for (const b of city.buildings) {
      if (!inView(cam, vw, vh, b.x + b.w / 2, b.y + b.h / 2, 160)) continue;
      // Long sun shadow to the south-east.
      ctx.fillStyle = 'rgba(0,0,0,0.20)';
      ctx.fillRect(b.x + 10, b.y + 12, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      if (b.tall) {
        // Window grid and rooftop plant.
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        const cols = Math.floor(b.w / 22);
        const rows = Math.floor(b.h / 22);
        for (let cx = 0; cx < cols; cx += 1) {
          for (let cy = 0; cy < rows; cy += 1) {
            ctx.fillRect(b.x + 10 + cx * 22, b.y + 10 + cy * 22, 10, 8);
          }
        }
        ctx.fillStyle = '#6a6a6a';
        ctx.fillRect(b.x + b.w / 2 - 14, b.y + b.h / 2 - 10, 28, 20);
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(b.x + b.w / 2 - 8, b.y + b.h / 2 - 8, 16, 16);
      }
    }
    for (const prop of city.props) {
      if (!inView(cam, vw, vh, prop.x, prop.y, 60)) continue;
      if (prop.kind === 'palm') {
        ctx.strokeStyle = '#7a5a34';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(prop.x, prop.y);
        ctx.lineTo(prop.x + 3, prop.y - 16);
        ctx.stroke();
        ctx.fillStyle = PALETTE.palm;
        for (let i = 0; i < 5; i += 1) {
          const a = (i / 5) * Math.PI * 2 + 0.4;
          ctx.beginPath();
          ctx.ellipse(prop.x + 3 + Math.cos(a) * 9, prop.y - 18 + Math.sin(a) * 7, 10, 4, a, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (prop.kind === 'lamp') {
        ctx.fillStyle = '#4a4a4a';
        ctx.fillRect(prop.x - 2, prop.y - 2, 4, 4);
        ctx.fillStyle = 'rgba(255,240,170,0.85)';
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (prop.kind === 'container') {
        ctx.fillStyle = prop.color;
        ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(prop.x, prop.y, prop.w, prop.h);
      }
    }
  }

  function drawPickups(state) {
    const cam = state.camera;
    for (const pk of state.pickups) {
      if (pk.taken || !inView(cam, vw, vh, pk.x, pk.y, 40)) continue;
      const bob = Math.sin(state.time * 3 + pk.x) * 3;
      const y = pk.y + bob;
      ctx.save();
      ctx.translate(pk.x, y);
      if (pk.kind === 'health') {
        ctx.fillStyle = '#f2f2f2';
        ctx.fillRect(-11, -11, 22, 22);
        ctx.fillStyle = '#d83a3a';
        ctx.fillRect(-3, -8, 6, 16);
        ctx.fillRect(-8, -3, 16, 6);
      } else if (pk.kind === 'armor') {
        ctx.fillStyle = '#3a6ad8';
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(10, -7);
        ctx.lineTo(10, 3);
        ctx.quadraticCurveTo(10, 10, 0, 13);
        ctx.quadraticCurveTo(-10, 10, -10, 3);
        ctx.lineTo(-10, -7);
        ctx.closePath();
        ctx.fill();
      } else if (pk.kind === 'ammo') {
        ctx.fillStyle = '#e8c33c';
        ctx.fillRect(-11, -8, 22, 16);
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(-7, -4, 4, 8);
        ctx.fillRect(-1, -4, 4, 8);
        ctx.fillRect(5, -4, 4, 8);
      } else {
        ctx.fillStyle = '#2a8a4a';
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', 0, 1);
      }
      ctx.restore();
    }
  }

  function drawMarker(state, target) {
    if (!target) return;
    const pulse = 1 + Math.sin(state.time * 4) * 0.15;
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.ellipse(target.x, target.y, 26 * pulse, 10 * pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.moveTo(target.x, target.y - 44);
    ctx.lineTo(target.x + 10, target.y - 24);
    ctx.lineTo(target.x - 10, target.y - 24);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,217,74,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 30 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawCar(car, isPlayer, time) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    roundRect(ctx, -26 + 3, -11 + 4, 54, 26, 8);
    ctx.fill();
    // Wheels.
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-20, -15, 12, 6);
    ctx.fillRect(-20, 9, 12, 6);
    ctx.fillRect(10, -15, 12, 6);
    ctx.fillRect(10, 9, 12, 6);
    // Body.
    ctx.fillStyle = car.color;
    roundRect(ctx, -27, -13, 54, 26, 8);
    ctx.fill();
    // Roof and glass.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    roundRect(ctx, -8, -10, 20, 20, 5);
    ctx.fill();
    ctx.fillStyle = '#bfe8f2';
    ctx.fillRect(8, -10, 7, 20);
    ctx.fillRect(-24, -10, 5, 20);
    // Headlights.
    ctx.fillStyle = '#fff8c8';
    ctx.fillRect(25, -10, 3, 5);
    ctx.fillRect(25, 5, 3, 5);
    if (car.kind === 'police') {
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(-6, -13, 12, 26);
      const flash = Math.floor(time * 4) % 2 === 0;
      ctx.fillStyle = flash ? '#ff2a2a' : '#2a6aff';
      ctx.fillRect(-4, -13, 5, 4);
      ctx.fillStyle = flash ? '#2a6aff' : '#ff2a2a';
      ctx.fillRect(-4, 9, 5, 4);
    }
    if (car.kind === 'taxi') {
      ctx.fillStyle = '#f2c200';
      ctx.fillRect(-8, -13, 16, 26);
    }
    if (isPlayer) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      roundRect(ctx, -30, -16, 60, 32, 10);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, shirt, skin, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 11 * scale, 8 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(angle);
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 9 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(4 * scale, 0, 5 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function draw(state, screen) {
    const cam = state.camera;
    const shakeX = cam.shake > 0 ? (state.rng.next() - 0.5) * cam.shake : 0;
    const shakeY = cam.shake > 0 ? (state.rng.next() - 0.5) * cam.shake : 0;
    ctx.save();
    ctx.clearRect(0, 0, vw, vh);
    ctx.translate(vw / 2 - cam.x - shakeX, vh / 2 - cam.y - shakeY);
    drawGround(state);
    drawRoads(state);
    drawBlocks(state);
    drawPickups(state);
    // Mission marker under the actors.
    if (state.mission) {
      const obj = state.mission.step && state.mission.step.x !== undefined
        ? { x: state.mission.step.x, y: state.mission.step.y }
        : null;
      drawMarker(state, obj);
    }
    for (const car of state.cars) {
      if (car.dead || !inView(cam, vw, vh, car.x, car.y, 80)) continue;
      drawCar(car, state.player.inCar === car.id, state.time);
    }
    for (const ped of state.peds) {
      if (ped.dead || !inView(cam, vw, vh, ped.x, ped.y, 40)) continue;
      drawPerson(ped.x, ped.y, ped.angle, ped.shirt, '#e8b890');
    }
    for (const o of state.officers) {
      if (!inView(cam, vw, vh, o.x, o.y, 40)) continue;
      drawPerson(o.x, o.y, o.angle, '#1a2a4a', '#e8b890');
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath();
      ctx.arc(o.x, o.y - 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const g of state.gang) {
      if (g.dead || !inView(cam, vw, vh, g.x, g.y, 40)) continue;
      drawPerson(g.x, g.y, g.angle, '#8a2a2a', '#c89878');
    }
    const p = state.player;
    if (p.alive && !p.inCar && inView(cam, vw, vh, p.x, p.y, 40)) {
      drawPerson(p.x, p.y, p.angle, '#2a9a8a', '#e8b890', 1.05);
      // Gun barrel when aiming.
      ctx.strokeStyle = '#2a2a2a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(p.angle) * 10, p.y + Math.sin(p.angle) * 10);
      ctx.lineTo(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20);
      ctx.stroke();
    }
    for (const b of state.bullets) {
      ctx.strokeStyle = '#fff2a8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Sun glare and vignette, in screen space.
    const grad = ctx.createLinearGradient(0, 0, vw, vh);
    grad.addColorStop(0, 'rgba(255,240,190,0.10)');
    grad.addColorStop(0.5, 'rgba(255,240,190,0)');
    grad.addColorStop(1, 'rgba(10,20,40,0.14)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, vw, vh);
    if (screen === SCREEN_TITLE) drawTitle(state);
    if (screen === SCREEN_PAUSED) drawPaused();
  }

  function drawTitle(state) {
    ctx.fillStyle = 'rgba(8,18,32,0.55)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 84px sans-serif';
    ctx.fillText('SOLMAR BAY', vw / 2, 200);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('an open-world crime story', vw / 2, 248);
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#cfe8f2';
    ctx.fillText('Steal cars. Lose the cops. Take the city.', vw / 2, 292);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('ENTER — New game        C — Continue', vw / 2, 400);
    ctx.font = '17px sans-serif';
    ctx.fillStyle = '#cfe8f2';
    ctx.fillText('WASD drive & walk · E enter car · Mouse aim, click shoot · R reload · Shift run · Esc pause · M mute', vw / 2, 448);
    ctx.fillText('Missions, wanted stars, police chases and a living city — all original, all offline.', vw / 2, 478);
    if (state.best > 0) {
      ctx.fillStyle = '#ffd94a';
      ctx.font = '18px sans-serif';
      ctx.fillText(`Best haul: $${state.best}`, vw / 2, 520);
    }
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(8,18,32,0.6)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText('PAUSED', vw / 2, vh / 2 - 10);
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#cfe8f2';
    ctx.fillText('Esc to resume · progress saves automatically', vw / 2, vh / 2 + 30);
  }

  return { draw, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER, SCREEN_WIN };
}
