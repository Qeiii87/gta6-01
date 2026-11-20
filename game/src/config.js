// Solmar Bay — tuning, palette and shared helpers. Every number that shapes
// how the city feels lives here, so the rest of the game reads like a story.
export const WORLD = 3200;
export const ROAD_STEP = 400;
export const ROAD_FIRST = 200;
export const ROAD_WIDTH = 100;
export const STEP = 1 / 60;
export const ROAD_LINES = [];
for (let v = ROAD_FIRST; v < WORLD; v += ROAD_STEP) ROAD_LINES.push(v);

export const PLAYER = {
  walkSpeed: 170,
  runSpeed: 265,
  radius: 13,
  health: 100,
  armor: 50,
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 340,
  brake: 520,
  reverseAccel: 220,
  maxSpeed: 460,
  maxReverse: 150,
  turnRate: 2.6,
  grip: 0.86,
  health: 100,
};

export const TRAFFIC_SPEED = 120;
export const PED_SPEED = 46;
export const COP_SPEED = 150;
export const BULLET_SPEED = 950;
export const PISTOL_DAMAGE = 34;
export const PISTOL_RATE = 0.22;
export const PISTOL_MAG = 12;

export const WANTED_DECAY_SECONDS = 9;
export const SAVE_KEY = 'solmar-bay-save-v1';
export const BEST_KEY = 'solmar-bay-best-v1';

// Sun-soaked coastal palette: warm sand, turquoise water, pastel blocks.
export const PALETTE = {
  grass: '#7fae5a',
  grassDark: '#74a24f',
  sidewalk: '#c9c2b2',
  sidewalkEdge: '#b3ab97',
  asphalt: '#3a4048',
  asphaltEdge: '#2e333b',
  lineYellow: '#e8c33c',
  lineWhite: '#e8e6df',
  sand: '#e8d29a',
  sandDark: '#dcc27f',
  water: '#2fa8b5',
  waterDeep: '#1f8a99',
  port: '#8d8578',
  building: ['#e8b4a0', '#f2c98a', '#a8c8d8', '#d8a8b8', '#b8d8a8', '#e8d8b0', '#c8b8d8', '#f0a890'],
  buildingRoof: ['#b0785a', '#a8885a', '#7a98a8', '#986878', '#789868', '#b09868', '#887898', '#c07858'],
  park: '#6fae54',
  tree: '#3f7d3a',
  treeLight: '#5a9a4a',
  palm: '#4a8a3a',
  car: ['#d84a4a', '#4a7ad8', '#e8c33c', '#e8e8e8', '#3a3a3a', '#4ad8a8', '#d88a2a', '#8a5ad8', '#c8d84a'],
  police: '#1a2a4a',
  taxi: '#f2c200',
};

export const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};
export const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
/** Shortest signed turn from angle a to angle b, in (-PI, PI]. */
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}
export const TAU = Math.PI * 2;
