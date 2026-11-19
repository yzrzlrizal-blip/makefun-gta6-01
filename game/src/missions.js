// Story and missions for Solmar Bay. The player is Nia Solano, a getaway
// driver back in her hometown after five years away; her old friend Rico
// Ferrante pulls her into one last run of jobs against the Harlow crew, who
// run the docks. Six story missions, in order, plus two side activities
// (taxi fares and hidden sun-coins) that pay cash any time.
// A mission is a list of stages; each stage has an objective line, a target
// point and a radius, and a kind: go, talk, steal, fight, collect, deliver,
// escape. The world checks the stage each step and advances it.
import { MISSION_REWARDS } from './config.js';

export const STORY_INTRO = [
  'Nia Solano is home. Five years away, and Solmar Bay still smells of salt and gasoline.',
  'Rico Ferrante waits at the Marina — one last run of jobs, then she is out for good.',
  'The Harlow crew runs the docks now. Nia plans to take it all back, one job at a time.',
];

function stage(kind, text, x, y, radius, extra) {
  return { kind, text, x, y, radius: radius || 70, ...(extra || {}) };
}

export const MISSIONS = [
  {
    id: 1, name: 'First Light', giver: 'Rico Ferrante',
    briefing: 'Meet Rico at the Marina Pier. He has a car and a plan — drive the package to the safehouse in Old Town.',
    stages: [
      stage('go', 'Drive to Rico at the Marina Pier', 2700, 480, 80),
      stage('talk', 'Talk to Rico (walk up to him)', 2700, 480, 60),
      stage('deliver', 'Drive the package to the Solmar Safehouse', 600, 690, 80, { needCar: true }),
    ],
  },
  {
    id: 2, name: 'Hot Wheels', giver: 'Rico Ferrante',
    briefing: 'The Harlow crew parked a Nightshade GT at Bayview Garage. Steal it — any car will do to get there, but bring the GT back.',
    stages: [
      stage('go', 'Get to Bayview Garage', 2400, 990, 90),
      stage('steal', 'Steal the Nightshade GT (press E beside it)', 2400, 990, 70, { model: 'Nightshade GT' }),
      stage('deliver', 'Deliver the GT to the Safehouse — the cops will notice', 600, 690, 80, { wanted: 2 }),
    ],
  },
  {
    id: 3, name: 'Payback at the Docks', giver: 'Rico Ferrante',
    briefing: 'Harlow’s enforcers are shaking down the dock workers. Go to the Harbor Docks Gate and send them packing.',
    stages: [
      stage('go', 'Reach the Harbor Docks Gate', 2700, 1890, 90),
      stage('fight', 'Deal with the Harlow enforcers (5)', 2700, 1890, 260, { count: 5 }),
      stage('go', 'Get clear — return to the Safehouse', 600, 690, 80),
    ],
  },
  {
    id: 4, name: 'Fare Play', giver: 'Mara the Dispatcher',
    briefing: 'Mara needs a driver for the night shift. Pick up three fares around the city and drop each one off — tips pay well.',
    stages: [
      stage('taxi', 'Pick up fare 1 — Downtown Plaza', 1800, 690, 70, { fare: 1 }),
      stage('taxi', 'Drop fare 1 at Palm Beach Boardwalk', 1200, 2490, 80, { fare: 1, drop: true }),
      stage('taxi', 'Pick up fare 2 — Cedar Hills Lookout', 600, 1590, 70, { fare: 2 }),
      stage('taxi', 'Drop fare 2 at the Marina Pier', 2700, 480, 80, { fare: 2, drop: true }),
      stage('taxi', 'Pick up fare 3 — Sunset Park Fountain', 1800, 1590, 70, { fare: 3 }),
      stage('taxi', 'Drop fare 3 at the Safehouse', 600, 690, 80, { fare: 3, drop: true }),
    ],
  },
  {
    id: 5, name: 'Three Keys', giver: 'Rico Ferrante',
    briefing: 'The Harlow crew hid three lockboxes around the city — Downtown, the Park and the Beach. Grab all three before the timer runs out.',
    stages: [
      stage('collect', 'Collect lockbox 1 — Downtown Plaza', 1800, 690, 70, { timer: 150 }),
      stage('collect', 'Collect lockbox 2 — Sunset Park Fountain', 1800, 1590, 70),
      stage('collect', 'Collect lockbox 3 — Palm Beach Boardwalk', 1200, 2490, 70),
      stage('deliver', 'Bring the lockboxes to the Safehouse', 600, 690, 80),
    ],
  },
  {
    id: 6, name: 'The Solmar Job', giver: 'Rico Ferrante',
    briefing: 'The finale. An armored van crosses Downtown at dusk. Ram it, take the cash, and lose a four-star wanted level at the Safehouse.',
    stages: [
      stage('go', 'Intercept the armored van in Downtown', 1800, 690, 120),
      stage('fight', 'Stop the armored van — ram it or shoot it out', 1800, 690, 320, { count: 1, van: true }),
      stage('collect', 'Grab the cash from the van', 1800, 690, 80),
      stage('escape', 'Lose the cops — reach the Safehouse with no wanted level', 600, 690, 90, { wanted: 4 }),
    ],
  },
];

export const SUN_COINS = 20; // hidden collectibles scattered across the city
export const TAXI_FARE_PAY = 150;

export function createMissionState() {
  return {
    index: 0,            // which mission is active (0-based); 6 = story complete
    stage: 0,            // stage inside the active mission
    started: false,      // mission briefing shown / timer running
    fightLeft: 0, timer: 0, fareInCar: false,
    completed: [],       // ids of finished missions
    banner: '', bannerT: 0,
  };
}

export function currentMission(ms) {
  return ms.index < MISSIONS.length ? MISSIONS[ms.index] : null;
}
export function currentStage(ms) {
  const m = currentMission(ms);
  return m ? m.stages[ms.stage] : null;
}
export function missionReward(ms) { return MISSION_REWARDS[ms.index] || 0; }

// Human-readable objective line for the HUD.
export function objectiveText(ms) {
  const m = currentMission(ms);
  if (!m) return 'Story complete — free roam. Find sun-coins, drive taxis, cause trouble.';
  if (!ms.started) return `New job: ${m.name} — head for the gold marker`;
  const s = currentStage(ms);
  if (!s) return m.name;
  let text = s.text;
  if (s.kind === 'fight' && ms.fightLeft > 0) text += ` — ${ms.fightLeft} left`;
  if (ms.timer > 0) text += ` — ${Math.ceil(ms.timer)}s`;
  return text;
}

export function startMission(ms) {
  const m = currentMission(ms);
  if (!m) return;
  ms.started = true; ms.stage = 0; ms.fightLeft = 0; ms.timer = 0;
  const s = m.stages[0];
  if (s && s.timer) ms.timer = s.timer;
  if (s && s.kind === 'fight') ms.fightLeft = s.count;
  ms.banner = `${m.name} — ${m.giver}`; ms.bannerT = 4;
}

export function advanceStage(ms) {
  const m = currentMission(ms);
  if (!m) return false;
  ms.stage += 1;
  if (ms.stage >= m.stages.length) {
    ms.completed.push(m.id);
    ms.index += 1; ms.stage = 0; ms.started = false; ms.timer = 0;
    return true; // mission complete
  }
  const s = m.stages[ms.stage];
  if (s.timer) ms.timer = s.timer;
  if (s.kind === 'fight') ms.fightLeft = s.count;
  ms.fareInCar = s.kind === 'taxi' && !!s.drop;
  return false;
}
