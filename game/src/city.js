// Solmar Bay itself: a seeded grid city on a beach, with a port to the south,
// a downtown of towers in the middle, parks and parking lots between blocks,
// palms along the sand and lamps along every avenue.
import { PALETTE, ROAD_FIRST, ROAD_LINES, ROAD_STEP, ROAD_WIDTH, WORLD } from './config.js';

export function isRoad(x, y) {
  for (const line of ROAD_LINES) {
    if (Math.abs(x - line) < ROAD_WIDTH / 2 || Math.abs(y - line) < ROAD_WIDTH / 2) return true;
  }
  return false;
}

export function nearestRoadPoint(x, y) {
  let bestX = ROAD_LINES[0];
  let bestY = ROAD_LINES[0];
  for (const line of ROAD_LINES) {
    if (Math.abs(x - line) < Math.abs(x - bestX)) bestX = line;
    if (Math.abs(y - line) < Math.abs(y - bestY)) bestY = line;
  }
  return { x: bestX, y: bestY };
}

/** Snap a point onto the nearest road centre line. */
export function snapToRoad(x, y) {
  const p = nearestRoadPoint(x, y);
  if (Math.abs(x - p.x) < Math.abs(y - p.y)) return { x: p.x, y };
  return { x, y: p.y };
}

export function createCity(rng) {
  const buildings = [];
  const parks = [];
  const lots = [];
  const props = [];
  const stashes = [];

  // Beach strip and port strip are ground, not blocks.
  const beachX = 150;
  const portY = 3050;

  for (let bx = 0; bx < 8; bx += 1) {
    for (let by = 0; by < 8; by += 1) {
      const x0 = ROAD_FIRST + bx * ROAD_STEP + ROAD_WIDTH / 2;
      const y0 = ROAD_FIRST + by * ROAD_STEP + ROAD_WIDTH / 2;
      const size = ROAD_STEP - ROAD_WIDTH;
      if (x0 + size > portY || y0 + size > portY) continue;
      const cx = x0 + size / 2;
      const cy = y0 + size / 2;
      const downtown = cx > 900 && cx < 2300 && cy > 900 && cy < 2300;
      const roll = rng.next();
      if (roll < 0.14) {
        // Park block: lawn, paths, trees, a pond.
        const trees = [];
        const count = rng.int(7, 12);
        for (let i = 0; i < count; i += 1) {
          trees.push({ x: x0 + rng.range(24, size - 24), y: y0 + rng.range(24, size - 24), r: rng.range(7, 11) });
        }
        parks.push({ x: x0, y: y0, size, trees, pond: rng.chance(0.5) });
        continue;
      }
      if (roll < 0.22) {
        // Parking lot: painted bays, a few parked cars.
        const bays = [];
        const rows = rng.int(2, 3);
        for (let r = 0; r < rows; r += 1) {
          for (let c = 0; c < 5; c += 1) {
            bays.push({ x: x0 + 30 + c * 52, y: y0 + 40 + r * 80, angle: 0 });
          }
        }
        lots.push({ x: x0, y: y0, size, bays });
        continue;
      }
      // Built block: one tall tower downtown, or two to four low buildings.
      const count = downtown ? 1 : rng.int(2, 4);
      for (let i = 0; i < count; i += 1) {
        const bw = downtown ? rng.range(150, 210) : rng.range(70, 130);
        const bh = downtown ? rng.range(150, 210) : rng.range(60, 110);
        const bx0 = downtown ? cx - bw / 2 : x0 + rng.range(8, size - bw - 8);
        const by0 = downtown ? cy - bh / 2 : y0 + rng.range(8, size - bh - 8);
        const color = rng.pick(PALETTE.building);
        const roof = rng.pick(PALETTE.buildingRoof);
        buildings.push({
          x: bx0,
          y: by0,
          w: bw,
          h: bh,
          color,
          roof,
          tall: downtown,
          floors: downtown ? rng.int(6, 14) : rng.int(1, 3),
        });
      }
    }
  }

  // Palms along the beach, lamps along the avenues, containers at the port.
  for (let y = 200; y < WORLD; y += 130) {
    props.push({ kind: 'palm', x: rng.range(120, 165), y: y + rng.range(-20, 20) });
  }
  for (const line of ROAD_LINES) {
    for (let v = 300; v < WORLD; v += 400) {
      props.push({ kind: 'lamp', x: line + ROAD_WIDTH / 2 - 4, y: v });
      props.push({ kind: 'lamp', x: v, y: line + ROAD_WIDTH / 2 - 4 });
    }
  }
  for (let i = 0; i < 26; i += 1) {
    props.push({
      kind: 'container',
      x: rng.range(200, 3000),
      y: rng.range(3080, 3170),
      w: rng.range(50, 90),
      h: 26,
      color: rng.pick(['#c85a3a', '#3a7ac8', '#4a9a4a', '#c8a83a']),
    });
  }

  // Ten cash stashes hidden around the city, for free-roam collectors.
  for (let i = 0; i < 10; i += 1) {
    const p = snapToRoad(rng.range(250, 2950), rng.range(250, 2950));
    stashes.push({ x: p.x + rng.range(-140, 140), y: p.y + rng.range(-140, 140), taken: false });
  }

  // Named places the story and the HUD point at.
  const places = {
    garage: { x: 1000, y: 1000, name: "Mara's Garage" },
    docks: { x: 2600, y: 3000, name: 'Harbor Docks' },
    bank: { x: 1800, y: 1400, name: 'Solmar National Bank' },
    tower: { x: 1400, y: 1800, name: 'Meridian Tower' },
    hideout: { x: 600, y: 2600, name: 'Hideout' },
    beach: { x: 200, y: 600, name: 'Palmetto Beach' },
    gangYard: { x: 2600, y: 2600, name: 'Kings Yard' },
  };

  return { buildings, parks, lots, props, stashes, places, beachX, portY };
}

/** True when the circle at (x, y) with radius r overlaps any building. */
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}

/** Push a circle out of any building it overlaps; returns true on a hit. */
export function resolveBuilding(city, body) {
  const b = hitsBuilding(city, body.x, body.y, body.radius);
  if (!b) return false;
  const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
  const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
  let dx = body.x - cx;
  let dy = body.y - cy;
  let d = Math.hypot(dx, dy);
  if (d < 0.001) {
    // Centre inside the building: push out along the shortest side.
    const left = body.x - b.x;
    const right = b.x + b.w - body.x;
    const top = body.y - b.y;
    const bottom = b.y + b.h - body.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) body.x = b.x - body.radius;
    else if (m === right) body.x = b.x + b.w + body.radius;
    else if (m === top) body.y = b.y - body.radius;
    else body.y = b.y + b.h + body.radius;
    return true;
  }
  dx /= d;
  dy /= d;
  body.x = cx + dx * body.radius;
  body.y = cy + dy * body.radius;
  return true;
}
