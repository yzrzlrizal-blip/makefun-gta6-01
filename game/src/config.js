// SOLMAR BAY — an original open-world crime game. All names, places, people,
// vehicles, story, art and sound are invented for this game; nothing is taken
// from any commercial game. Tuning numbers and colours live here, in one place.
// The world is a fixed 3600 x 2700 top-down city; the renderer scales the view
// to the window, so no rule below depends on the screen size.

export const WORLD = { width: 3600, height: 2700 };
export const STEP = 1 / 60;
export const SAVE_KEY = 'solmar-bay.save.v1';
export const BEST_KEY = 'solmar-bay.best.v1';

// Road grid: roads run every BLOCK_PITCH pixels; ROAD_W is the asphalt width.
export const ROAD = { pitch: 300, width: 72, sidewalk: 14 };
export const DAY_LENGTH = 360; // seconds for a full in-game day

export const PLAYER = {
  radius: 13, walk: 215, sprint: 330, accel: 2400,
  health: 100, armor: 0, punchDamage: 12, punchRange: 34, punchArc: 1.1,
  pistolDamage: 26, pistolRange: 420, pistolCooldown: 0.22, startAmmo: 48,
};

export const CAR = {
  length: 52, width: 26, accel: 520, reverse: 300, brake: 900,
  maxSpeed: 640, turn: 3.2, grip: 6.5, drag: 0.55, health: 100,
};

export const WANTED = {
  decay: 0.12,           // stars lost per second while unseen and calm
  maxStars: 5,
  copCars: [0, 1, 1, 2, 3, 4],   // police cars out, by star level
  copFoot: [0, 0, 1, 2, 3, 4],
  bustRadius: 46, bustTime: 2.2, // seconds a cop must stand on you to bust you
  escapeBonus: 500,
};

export const MISSION_REWARDS = [400, 900, 1400, 1100, 1800, 5000];

export const PALETTE = {
  water: '#1d6f8e', sand: '#e8cf96', grass: '#5d9b4e', park: '#4c8a42',
  asphalt: '#33373d', asphaltEdge: '#26292e', lane: '#d8c95a',
  sidewalk: '#9aa0a3', building: '#b08968', downtown: '#7d8aa0',
  marina: '#c9a86a', industrial: '#8a7f72', rooftop: '#5c5148',
  text: '#f4f1e6', muted: '#c9c4b4', gold: '#f2c94c', red: '#e5534b',
  blue: '#4fc3f7', green: '#7ed491', panel: 'rgba(12,16,22,0.82)',
  police: '#2f6fd0', taxi: '#f2c94c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// Original vehicle models, with their own colours and handling tweaks.
export const CAR_MODELS = [
  { name: 'Comet Runabout', color: '#c94f43', speed: 1.0, accel: 1.0 },
  { name: 'Solmar Taxi', color: '#f2c94c', speed: 0.92, accel: 0.95, taxi: true },
  { name: 'Bayliner Coupe', color: '#4f7ec9', speed: 1.12, accel: 1.05 },
  { name: 'Dune Buggy', color: '#7ed491', speed: 0.95, accel: 1.1 },
  { name: 'Harbor Van', color: '#e8e4da', speed: 0.82, accel: 0.8 },
  { name: 'Nightshade GT', color: '#2b2f38', speed: 1.25, accel: 1.15 },
  { name: 'Palm Cruiser', color: '#e08ab8', speed: 1.0, accel: 1.0 },
  { name: 'Dock Truck', color: '#c98a2b', speed: 0.78, accel: 0.85 },
];
export const POLICE_MODEL = { name: 'Solmar PD Interceptor', color: '#2f6fd0', speed: 1.18, accel: 1.15 };

// Districts of Solmar Bay, by rectangle. The beach and marina touch the sea.
export const DISTRICTS = [
  { name: 'Downtown', x: 1200, y: 300, w: 1200, h: 900, tint: '#7d8aa0' },
  { name: 'Old Town', x: 300, y: 300, w: 900, h: 900, tint: '#b08968' },
  { name: 'Marina', x: 2400, y: 300, w: 900, h: 600, tint: '#c9a86a' },
  { name: 'Palm Beach', x: 300, y: 2100, w: 3000, h: 300, tint: '#e8cf96' },
  { name: 'Harbor Docks', x: 2400, y: 1500, w: 900, h: 600, tint: '#8a7f72' },
  { name: 'Cedar Hills', x: 300, y: 1200, w: 900, h: 900, tint: '#5d9b4e' },
  { name: 'Sunset Park', x: 1200, y: 1200, w: 1200, h: 900, tint: '#4c8a42' },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  return DISTRICTS[0];
}
