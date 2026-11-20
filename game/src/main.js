// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between title, play, paused
// and game over, and saves progress as it goes.
//
// ?seed=N fixes the city. ?shot=start|play|chase|mission (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_WASTED } from './world.js';
import { createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { drawEndScreen, drawHud } from './hud.js';
import { createAudio } from './audio.js';
import { clearSave, readBest, readSave, writeBest, writeSave } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed), readSave());
const state = world.state;
state.seed = seed;
state.best = readBest();
state.won = false;
const renderer = createRenderer(canvas);
const audio = createAudio();

function persist() {
  writeSave({
    money: state.player.money,
    missionIndex: state.missionIndex,
    completed: state.completed,
    stashes: [...state.stashesTaken],
  });
  writeBest(Math.max(state.best, state.player.money));
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen);
    if (scene.screen === SCREEN_PLAY) drawHud(canvas.getContext('2d'), state, canvas.width, canvas.height);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let endKind = null;
  let hintUntil = 0;
  let lastPersist = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startNewGame() {
    clearSave();
    state.player.money = 0;
    state.missionIndex = 0;
    state.completed = [];
    state.stashesTaken = new Set();
    state.won = false;
    state.stats = { kills: 0, carsStolen: 0, missionsDone: 0, shotsFired: 0 };
    world.reset();
    screen = SCREEN_PLAY;
    hintUntil = state.time + 30;
    announce('Playing. Follow the objective at the top of the screen.');
    audio.unlock();
  }

  function continueGame() {
    world.reset();
    screen = SCREEN_PLAY;
    hintUntil = state.time + 30;
    announce('Playing. Follow the objective at the top of the screen.');
    audio.unlock();
  }

  function endGame(kind) {
    endKind = kind;
    screen = SCREEN_OVER;
    persist();
    announce(kind === 'busted' ? 'Busted. The police have you.' : 'Wasted. Game over.');
  }

  function frame(now) {
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    if (screen === SCREEN_TITLE) {
      if (input.wasPressed('confirm')) startNewGame();
      else if (input.mouse.clicked) startNewGame();
      // The title screen idles over the living city.
      world.step(input, null, STEP);
    } else if (screen === SCREEN_PLAY) {
      if (input.wasPressed('pause')) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else {
        accumulator += dt;
        while (accumulator >= STEP) {
          accumulator -= STEP;
          const events = world.step(input, audio, STEP);
          if (events & EVENT_WASTED) endGame('wasted');
          else if (events & EVENT_BUSTED) endGame('busted');
          if (screen !== SCREEN_PLAY) break;
        }
        if (state.missionIndex >= 6 && !state.mission && !state.won && screen === SCREEN_PLAY) {
          state.won = true;
          screen = SCREEN_WIN;
          endKind = 'win';
          persist();
        }
        const car = state.player.inCar ? state.cars.find((c) => c.id === state.player.inCar) : null;
        const speed = car ? Math.abs(car.speed) : 0;
        const policeNear = state.cars.some((c) => c.kind === 'police' && !c.dead);
        audio.update(dt, speed, policeNear);
        if (input.wasPressed('mute')) audio.setMuted(!audio.isMuted());
        if (state.time - lastPersist > 5) {
          lastPersist = state.time;
          persist();
        }
      }
    } else if (screen === SCREEN_PAUSED) {
      if (input.wasPressed('pause') || input.wasPressed('confirm')) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (input.wasPressed('confirm')) {
        world.reset();
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (input.wasPressed('reload')) {
        // Free roam: mark the story done so the win screen does not return.
        state.won = true;
        state.missionIndex = 6;
        world.reset();
        screen = SCREEN_PLAY;
        announce('Playing. Free roam.');
      }
    }
    input.setCamera({ x: state.camera.x, y: state.camera.y, scale: 1 });
    renderer.draw(state, screen);
    if (screen === SCREEN_PLAY) {
      drawHud(canvas.getContext('2d'), state, canvas.width, canvas.height);
      if (state.time < hintUntil) {
        const g = canvas.getContext('2d');
        g.textAlign = 'center';
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.font = '15px sans-serif';
        g.fillText('WASD move & drive · E enter car · Mouse aim, click shoot · Shift run', canvas.width / 2, canvas.height - 92);
      }
    }
    if (screen === SCREEN_OVER) {
      drawEndScreen(canvas.getContext('2d'), state, canvas.width, canvas.height, endKind);
    }
    if (screen === SCREEN_WIN) {
      drawEndScreen(canvas.getContext('2d'), state, canvas.width, canvas.height, 'win');
    }
    input.endFrame();
    requestAnimationFrame(frame);
  }

  // Expose a little state for automated play-testing, nothing the game needs.
  window.__solmar = {
    state,
    screen: () => screen,
    startNewGame,
  };
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
