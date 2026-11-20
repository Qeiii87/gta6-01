// The HUD: wanted stars, health and armor, money, the mission objective with
// its timer, speed and ammo — and a live minimap of Solmar Bay in the corner,
// with the player, the police and the mission target as blips.
import { ROAD_LINES, ROAD_WIDTH, WORLD, clamp } from './config.js';
import { currentObjective } from './missions.js';

const MAP_SIZE = 190;
const MAP_SCALE = MAP_SIZE / WORLD;

export function drawHud(ctx, state, vw, vh) {
  const p = state.player;
  const obj = currentObjective(state);
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  // Wanted stars, top left.
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < p.wanted ? '#ffd94a' : 'rgba(255,255,255,0.25)';
    drawStar(ctx, 34 + i * 34, 34, 13);
  }

  // Money and mission, top right.
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(8,18,32,0.55)';
  ctx.fillRect(vw - 250, 12, 238, 58);
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(`$${p.money.toLocaleString('en-US')}`, vw - 26, 38);
  ctx.fillStyle = '#cfe8f2';
  ctx.font = '15px sans-serif';
  ctx.fillText(obj.mission ? `Mission ${state.missionIndex + 1} of 6` : 'Free roam', vw - 26, 60);

  // Objective banner, top centre — sized to the text, never wider than the screen.
  ctx.textAlign = 'center';
  let objText = obj.text;
  if (obj.timer > 0) objText += `  —  ${Math.ceil(obj.timer)}s`;
  let objFont = 17;
  ctx.font = `bold ${objFont}px sans-serif`;
  let objWidth = ctx.measureText(objText).width + 40;
  if (objWidth > vw - 60) {
    objFont = 14;
    ctx.font = `bold ${objFont}px sans-serif`;
    objWidth = Math.min(vw - 60, ctx.measureText(objText).width + 40);
  }
  ctx.fillStyle = 'rgba(8,18,32,0.55)';
  ctx.fillRect(vw / 2 - objWidth / 2, 12, objWidth, 34);
  ctx.fillStyle = '#ffd94a';
  ctx.fillText(objText, vw / 2, 35);

  // Health and armor, bottom left.
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(8,18,32,0.55)';
  ctx.fillRect(16, vh - 78, 240, 62);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('HEALTH', 28, vh - 56);
  bar(ctx, 90, vh - 66, 150, 12, p.health / 100, p.health > 30 ? '#4ad86a' : '#d84a4a');
  ctx.fillText('ARMOR', 28, vh - 36);
  bar(ctx, 90, vh - 46, 150, 12, p.armor / 100, '#4a7ad8');
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 15px sans-serif';
  const ammoText = p.inCar ? '—' : `PISTOL  ${p.mag} / ${p.ammo}${p.reloading > 0 ? '  reloading…' : ''}`;
  ctx.fillText(ammoText, 28, vh - 16);

  // Speed, bottom centre, while driving.
  if (p.inCar) {
    const car = state.cars.find((c) => c.id === p.inCar);
    const mph = car ? Math.round(Math.abs(car.speed) * 0.12) : 0;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(8,18,32,0.55)';
    ctx.fillRect(vw / 2 - 70, vh - 52, 140, 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`${mph} mph`, vw / 2, vh - 24);
  }

  drawMinimap(ctx, state, vw, vh);

  // Direction arrow to the mission target, at the screen edge.
  if (obj.target) {
    const dx = obj.target.x - p.x;
    const dy = obj.target.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 420) {
      const ang = Math.atan2(dy, dx);
      const cx = vw / 2 + Math.cos(ang) * 300;
      const cy = vh / 2 + Math.sin(ang) * 220;
      ctx.save();
      ctx.translate(clamp(cx, 60, vw - 60), clamp(cy, 90, vh - 120));
      ctx.rotate(ang);
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-8, -9);
      ctx.lineTo(-8, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`${Math.round(dist)}m`, clamp(cx, 60, vw - 60), clamp(cy, 90, vh - 120) + 28);
    }
  }

  // Mission banner and transient message.
  if (state.banner && state.time < state.banner.until) {
    const alpha = clamp((state.banner.until - state.time) / 0.5, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(8,18,32,0.7)';
    ctx.fillRect(vw / 2 - 320, vh / 2 - 150, 640, 84);
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText(state.banner.text, vw / 2, vh / 2 - 112);
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px sans-serif';
    ctx.fillText(state.banner.sub, vw / 2, vh / 2 - 82);
    ctx.globalAlpha = 1;
  }
  if (state.message && state.time < state.messageUntil) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px sans-serif';
    ctx.fillText(state.message, vw / 2, vh - 110);
  }
  ctx.restore();
}

function bar(ctx, x, y, w, h, frac, color) {
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
}

function drawStar(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawMinimap(ctx, state, vw, vh) {
  const x0 = vw - MAP_SIZE - 16;
  const y0 = vh - MAP_SIZE - 16;
  ctx.fillStyle = 'rgba(8,18,32,0.72)';
  ctx.fillRect(x0 - 4, y0 - 4, MAP_SIZE + 8, MAP_SIZE + 8);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, MAP_SIZE, MAP_SIZE);
  ctx.clip();
  ctx.fillStyle = '#3f6a3a';
  ctx.fillRect(x0, y0, MAP_SIZE, MAP_SIZE);
  // Water and sand on the west edge.
  ctx.fillStyle = '#2fa8b5';
  ctx.fillRect(x0, y0, 80 * MAP_SCALE, MAP_SIZE);
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect(x0 + 80 * MAP_SCALE, y0, 70 * MAP_SCALE, MAP_SIZE);
  // Roads.
  ctx.strokeStyle = '#c9c2b2';
  ctx.lineWidth = ROAD_WIDTH * MAP_SCALE;
  for (const line of ROAD_LINES) {
    ctx.beginPath();
    ctx.moveTo(x0 + line * MAP_SCALE, y0);
    ctx.lineTo(x0 + line * MAP_SCALE, y0 + MAP_SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x0, y0 + line * MAP_SCALE);
    ctx.lineTo(x0 + MAP_SIZE, y0 + line * MAP_SCALE);
    ctx.stroke();
  }
  // Mission target.
  const obj = currentObjective(state);
  if (obj.target) {
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.arc(x0 + obj.target.x * MAP_SCALE, y0 + obj.target.y * MAP_SCALE, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police blips, then the player.
  for (const car of state.cars) {
    if (car.kind !== 'police' || car.dead) continue;
    ctx.fillStyle = '#4a7ad8';
    ctx.beginPath();
    ctx.arc(x0 + car.x * MAP_SCALE, y0 + car.y * MAP_SCALE, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const p = state.player;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x0 + p.x * MAP_SCALE, y0 + p.y * MAP_SCALE, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd94a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x0 + p.x * MAP_SCALE, y0 + p.y * MAP_SCALE, 6.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 - 4, y0 - 4, MAP_SIZE + 8, MAP_SIZE + 8);
}

/** Game-over and victory screens, drawn over the frozen world. */
export function drawEndScreen(ctx, state, vw, vh, kind) {
  ctx.fillStyle = 'rgba(8,18,32,0.72)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  if (kind === 'win') {
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('SOLMAR BAY IS YOURS', vw / 2, vh / 2 - 60);
    ctx.fillStyle = '#ffffff';
    ctx.font = '22px sans-serif';
    ctx.fillText('Every mission complete. The city is yours, Jace.', vw / 2, vh / 2 - 16);
  } else if (kind === 'busted') {
    ctx.fillStyle = '#4a7ad8';
    ctx.font = 'bold 72px sans-serif';
    ctx.fillText('BUSTED', vw / 2, vh / 2 - 60);
    ctx.fillStyle = '#ffffff';
    ctx.font = '22px sans-serif';
    ctx.fillText('The Solmar Bay PD has you. The city waits.', vw / 2, vh / 2 - 16);
  } else {
    ctx.fillStyle = '#d84a4a';
    ctx.font = 'bold 72px sans-serif';
    ctx.fillText('WASTED', vw / 2, vh / 2 - 60);
    ctx.fillStyle = '#ffffff';
    ctx.font = '22px sans-serif';
    ctx.fillText('Jace Marlowe did not make it out of Solmar Bay.', vw / 2, vh / 2 - 16);
  }
  ctx.fillStyle = '#cfe8f2';
  ctx.font = '18px sans-serif';
  ctx.fillText(`Money: $${state.player.money.toLocaleString('en-US')}   ·   Missions done: ${state.stats.missionsDone}   ·   Cars stolen: ${state.stats.carsStolen}`, vw / 2, vh / 2 + 30);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('ENTER — try again        R — free roam', vw / 2, vh / 2 + 84);
}
