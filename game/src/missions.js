// Six story missions for Nia Solano. Each mission is a small state machine over
// the shared world: objectives are checked every tick and the mission completes,
// fails, or advances on its own terms. No DOM here — main.js presents the text.
import { MISSION_DEFS, CAR_MODELS } from './config.js';
import { makeCar, makeThug, nearestCar } from './world.js';
import { clearWanted, addHeat } from './police.js';
import { dist2 } from './random.js';
import { snapToRoad } from './city.js';

export function missionDef(index) {
  return MISSION_DEFS[index] ?? null;
}

export function startMission(world) {
  const def = missionDef(world.missionIndex);
  if (!def) {
    world.mission = null;
    return null;
  }
  const m = {
    def,
    stage: 'go', // go | pickup | deliver | escape | done
    progress: 0,
    target: { ...def.target },
    timer: 0,
    thugsSpawned: false,
    car: null,
    passenger: false,
  };
  world.mission = m;

  if (def.kind === 'drive' || def.kind === 'deliver') {
    // The mission car waits near the player, parked on a road.
    const spot = snapToRoad(world.player.x + 160, world.player.y + 40);
    const model = CAR_MODELS.find((c) => c.id === def.carModel) || CAR_MODELS[0];
    const car = makeCar(model, spot, world.rng);
    world.cars.push(car);
    m.car = car;
    m.stage = 'steal';
  }
  if (def.kind === 'escort') {
    m.stage = 'pickup';
    m.target = { ...def.pickup };
  }
  if (def.kind === 'beat' || def.kind === 'finale') {
    spawnThugs(world, m);
  }
  if (def.kind === 'escape') {
    addHeat(world, 55, 'shoot');
    m.stage = 'escape';
  }
  if (def.kind === 'getaway') {
    // handled by escort
  }
  world.messages.push({ text: `New job: ${def.title} — ${def.brief}`, t: 6 });
  return m;
}

function spawnThugs(world, m) {
  const def = m.def;
  const base = def.spawn ?? def.target;
  const n = def.count ?? 3;
  for (let i = 0; i < n; i++) {
    const t = makeThug(base.x + world.rng.range(-90, 90), base.y + world.rng.range(-90, 90), world.rng);
    world.thugs.push(t);
  }
  m.thugsSpawned = true;
}

export function missionObjectiveText(world) {
  const m = world.mission;
  if (!m) {
    const next = missionDef(world.missionIndex);
    if (!next) return 'All jobs done — Solmar Bay is yours. Free roam!';
    return `Next job: ${next.title} — press M to start`;
  }
  const d = m.def;
  switch (d.kind) {
    case 'drive':
      return m.stage === 'steal'
        ? `Steal the ${d.carModel === 'coral' ? 'Coral Coupe' : 'mission car'} nearby, then drive to Sunset Park`
        : 'Drive to the Sunset Park meet';
    case 'deliver':
      return m.stage === 'steal'
        ? 'Steal the Harbor Hauler at the docks'
        : 'Deliver the Hauler to the Cedar Hills garage';
    case 'beat':
      return `Put down the Harlow lookouts (${m.progress}/${d.count})`;
    case 'escape':
      return 'Lose the cops — break line of sight and stay clean';
    case 'escort':
      return m.stage === 'pickup'
        ? 'Pick Rico up at the Marina'
        : 'Drive Rico to the Cedar Hills safehouse';
    case 'finale':
      return m.stage === 'fight'
        ? `Drop the Harlow enforcers (${m.progress}/${d.count})`
        : 'Escape to Palm Beach';
    default:
      return d.brief;
  }
}

export function completeMission(world) {
  const m = world.mission;
  if (!m) return;
  world.cash += m.def.reward;
  world.completedMissions.push(m.def.id);
  world.stats.missionsDone += 1;
  world.missionIndex += 1;
  world.messages.push({ text: `Job done: ${m.def.title} — +$${m.def.reward}`, t: 5 });
  clearWanted(world);
  world.mission = null;
  if (world.missionIndex >= MISSION_DEFS.length) {
    world.mode = 'won';
  }
}

export function failMission(world, reason) {
  world.mission = null;
  world.messages.push({ text: `Job failed: ${reason}. Press M to retry.`, t: 5 });
  // Retry the same mission next time.
}

export function updateMission(world, dt) {
  const m = world.mission;
  if (!m) return;
  const d = m.def;
  const p = world.player;
  m.timer += dt;

  switch (d.kind) {
    case 'drive':
    case 'deliver': {
      if (m.stage === 'steal') {
        if (p.car === m.car) {
          m.stage = 'drive';
          world.messages.push({ text: 'Got it. Now drive to the marker.', t: 3 });
        }
      } else if (p.car === m.car && dist2(p.x, p.y, m.target.x, m.target.y) < d.radius * d.radius) {
        completeMission(world);
      }
      break;
    }
    case 'beat': {
      if (m.thugsDownAtStart === undefined) m.thugsDownAtStart = world.stats.thugsDown;
      m.progress = world.stats.thugsDown - m.thugsDownAtStart;
      if (m.progress >= d.count) completeMission(world);
      break;
    }
    case 'escape': {
      if (world.wanted === 0 && m.timer > 5) completeMission(world);
      break;
    }
    case 'escort': {
      if (m.stage === 'pickup') {
        if (dist2(p.x, p.y, m.target.x, m.target.y) < 90 * 90) {
          m.stage = 'drive';
          m.passenger = true;
          m.target = { ...d.target };
          addHeat(world, 30, 'shoot');
          world.messages.push({ text: 'Rico is in. Drive — and watch the mirrors.', t: 4 });
        }
      } else if (dist2(p.x, p.y, m.target.x, m.target.y) < d.radius * d.radius) {
        completeMission(world);
      }
      break;
    }
    case 'finale': {
      if (m.stage === 'go') m.stage = 'fight';
      if (m.stage === 'fight') {
        if (m.thugsDownAtStart === undefined) m.thugsDownAtStart = world.stats.thugsDown;
        m.progress = world.stats.thugsDown - m.thugsDownAtStart;
        if (m.progress >= d.count) {
          m.stage = 'escape';
          m.target = { ...d.target };
          world.messages.push({ text: 'Harlow is finished. Get to Palm Beach!', t: 4 });
        }
      } else if (dist2(p.x, p.y, m.target.x, m.target.y) < d.radius * d.radius) {
        completeMission(world);
      }
      break;
    }
    default:
      break;
  }
}

// Called by combat code when a thug goes down.
export function countThugDown(world) {
  world.stats.thugsDown += 1;
}
