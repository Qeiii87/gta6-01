// The story: six missions for Jace Marlowe, from stealing his first car to
// taking down Viktor Kroll. Each mission is a short list of steps — go there,
// lose them, take them out, wait — and the game watches each step complete.
import { addHeat } from './police.js';
import { spawnGangMember } from './combat.js';
import { showBanner } from './world.js';

const MISSIONS = [
  {
    name: 'First Wheels',
    brief: 'Mara needs wheels. Take any car and bring it to her garage.',
    reward: 500,
    steps: [
      { type: 'enterCar', text: 'Steal a car (walk up to one and press E)' },
      { type: 'goto', x: 1000, y: 1000, r: 70, text: "Drive to Mara's Garage" },
    ],
  },
  {
    name: 'Dockside Run',
    brief: 'A package for the harbor. Ninety seconds, no questions.',
    reward: 800,
    steps: [{ type: 'goto', x: 2600, y: 3000, r: 80, time: 90, text: 'Deliver the package to the docks' }],
  },
  {
    name: 'Lay Low',
    brief: 'The Kings set you up. Shake the heat before Mara will talk to you.',
    reward: 700,
    steps: [
      { type: 'gainWanted', stars: 2, text: 'Draw the heat — make some noise' },
      { type: 'loseWanted', text: 'Lose the cops' },
    ],
  },
  {
    name: 'Turf War',
    brief: 'The Kings own the yard. Take it back, four at a time.',
    reward: 1200,
    steps: [{ type: 'killGang', count: 4, x: 2600, y: 2600, text: 'Take out 4 Kings at the yard' }],
  },
  {
    name: 'The Vault Job',
    brief: 'Solmar National keeps its vault behind one sleepy guard. In, out, gone.',
    reward: 2500,
    steps: [
      { type: 'goto', x: 1800, y: 1400, r: 60, text: 'Reach Solmar National Bank' },
      { type: 'wait', seconds: 6, text: 'Cracking the vault…' },
      { type: 'goto', x: 600, y: 2600, r: 80, text: 'Escape to the hideout', wanted: 3 },
    ],
  },
  {
    name: "Kingpin's Fall",
    brief: 'Viktor Kroll runs this city from the Meridian Tower. End it tonight.',
    reward: 5000,
    steps: [
      { type: 'killGang', count: 6, x: 1400, y: 1800, text: 'Clear the Meridian Tower crew' },
      { type: 'goto', x: 1400, y: 1800, r: 60, text: 'Reach the rooftop marker' },
    ],
  },
];

export function missionCount() {
  return MISSIONS.length;
}

export function startMission(state, index) {
  if (index >= MISSIONS.length) {
    state.mission = null;
    return;
  }
  state.missionIndex = index;
  state.mission = {
    index,
    stepIndex: 0,
    step: null,
    timer: 0,
    killsAtStart: state.stats.kills,
    failed: false,
  };
  setupStep(state);
  const m = MISSIONS[index];
  showBanner(state, m.name, m.brief, 4);
}

function setupStep(state) {
  const m = MISSIONS[state.mission.index];
  const step = m.steps[state.mission.stepIndex];
  state.mission.step = step;
  state.mission.timer = step.time ?? 0;
  state.mission.killsAtStart = state.stats.kills;
  if (step.type === 'killGang') {
    for (let i = 0; i < step.count; i += 1) {
      spawnGangMember(state, step.x + state.rng.range(-120, 120), step.y + state.rng.range(-120, 120));
    }
  }
  if (step.type === 'gainWanted') {
    state.message = 'Make noise — steal a car, hit something, fire a shot';
    state.messageUntil = state.time + 4;
  }
  if (step.type === 'wait') {
    state.mission.timer = step.seconds;
  }
}

function failMission(state, audio, reason) {
  const m = MISSIONS[state.mission.index];
  state.mission = null;
  if (audio) audio.missionFail();
  showBanner(state, 'Mission failed', reason, 3);
  state.message = `${m.name} — try again`;
  state.messageUntil = state.time + 4;
  // Restart the same mission from its first step.
  startMission(state, state.missionIndex);
}

function completeMission(state, audio) {
  const m = MISSIONS[state.mission.index];
  state.player.money += m.reward;
  state.completed.push(m.name);
  state.stats.missionsDone += 1;
  if (audio) audio.missionDone();
  showBanner(state, 'Mission complete', `${m.name} — +$${m.reward}`, 3.5);
  const next = state.missionIndex + 1;
  if (next >= MISSIONS.length) {
    state.mission = null;
    state.missionIndex = next;
    showBanner(state, 'Solmar Bay is yours', 'Every mission done — free roam, Jace', 5);
  } else {
    startMission(state, next);
  }
}

export function updateMissions(state, dt, audio) {
  const mission = state.mission;
  if (!mission) return;
  const step = mission.step;
  const p = state.player;
  const dx = step.x !== undefined ? p.x - step.x : 0;
  const dy = step.y !== undefined ? p.y - step.y : 0;
  const dist = Math.hypot(dx, dy);

  if (step.time) {
    mission.timer -= dt;
    if (mission.timer <= 0) {
      failMission(state, audio, 'Out of time');
      return;
    }
  }
  if (step.type === 'wait') {
    mission.timer -= dt;
    if (mission.timer <= 0) advance(state, audio);
    return;
  }
  if (step.type === 'enterCar' && p.inCar) {
    advance(state, audio);
    return;
  }
  if (step.type === 'gainWanted' && p.wanted >= step.stars) {
    advance(state, audio);
    return;
  }
  if (step.type === 'loseWanted' && p.wanted === 0) {
    advance(state, audio);
    return;
  }
  if (step.type === 'killGang') {
    const done = state.stats.kills - mission.killsAtStart;
    if (done >= step.count) {
      advance(state, audio);
      return;
    }
  }
  if (step.type === 'goto' && dist < step.r) {
    if (step.wanted) addHeat(state, 120);
    advance(state, audio);
  }
}

function advance(state, audio) {
  const m = MISSIONS[state.mission.index];
  state.mission.stepIndex += 1;
  if (state.mission.stepIndex >= m.steps.length) {
    completeMission(state, audio);
  } else {
    setupStep(state);
  }
}

/** Jump a mission straight to one of its steps (used by the screenshot scenes). */
export function jumpToStep(state, index, stepIndex) {
  startMission(state, index);
  state.mission.stepIndex = stepIndex;
  setupStep(state);
}

/** What the HUD shows: the current objective, its target and its timer. */
export function currentObjective(state) {
  const mission = state.mission;
  if (!mission) {
    return { text: 'Free roam — Solmar Bay is yours', target: null, timer: 0 };
  }
  const m = MISSIONS[mission.index];
  const step = mission.step;
  let text = `${m.name}: ${step.text}`;
  if (step.type === 'killGang') {
    const done = state.stats.kills - mission.killsAtStart;
    text += ` (${Math.min(done, step.count)}/${step.count})`;
  }
  const target = step.x !== undefined ? { x: step.x, y: step.y } : null;
  return { text, target, timer: step.time ? mission.timer : 0, mission: m.name };
}
