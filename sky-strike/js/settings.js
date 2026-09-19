import { detectLang } from './i18n.js';

const SAVE_KEY = 'sky-strike-save-v1';
const SETTINGS_KEY = 'sky-strike-settings-v1';

const defaultSettings = () => ({
  language: 'nl',
  sound: true,
  music: true,
  graphics: 'high',
  cameraSensitivity: 1,
  flightSensitivity: 1,
  invertY: false,
  showHud: true
});

const defaultSave = () => ({
  xp: 0,
  unlockedMissions: [1],
  unlockedAircraft: ['raptor'],
  selectedAircraft: 'raptor',
  selectedCharacter: 'kai',
  selectedFriend: 'daan',
  completedMissions: [],
  bestScores: {},
  kills: 0,
  money: 0,
  ticketBought: false,
  freedomUnlocked: false,
  ownedHouses: [],
  ownedCar: null
});

function detectDefaultGraphics() {
  const mobile = isMobileDevice();
  if (mobile) return 'low';
  const cores = navigator.hardwareConcurrency || 4;
  return cores <= 4 ? 'medium' : 'high';
}

export function isMobileDevice() {
  const ua = navigator.userAgent || '';
  const iPadOS = navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1;
  const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const small = Math.min(window.innerWidth, window.innerHeight) < 900;
  return iPadOS || /Mobi|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile/i.test(ua) || (touch && small);
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      const s = defaultSettings();
      s.graphics = detectDefaultGraphics();
      s.language = detectLang();
      return s;
    }
    const parsed = { ...defaultSettings(), ...JSON.parse(raw) };
    if (!parsed.language) parsed.language = detectLang();
    return parsed;
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    return { ...defaultSave(), ...JSON.parse(raw) };
  } catch {
    return defaultSave();
  }
}

export function persistSave(save) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

export function addXp(save, amount) {
  save.xp += amount;
  if (save.xp >= 1000 && !save.unlockedAircraft.includes('viper')) save.unlockedAircraft.push('viper');
  if (save.xp >= 2500 && !save.unlockedAircraft.includes('titan')) save.unlockedAircraft.push('titan');
  persistSave(save);
  return save.xp;
}

export function unlockMission(save, id) {
  if (!save.unlockedMissions.includes(id)) save.unlockedMissions.push(id);
  persistSave(save);
}

export function recordScore(save, missionId, score) {
  const prev = save.bestScores[missionId] || 0;
  if (score > prev) save.bestScores[missionId] = score;
  persistSave(save);
}
