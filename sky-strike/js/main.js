import { Game } from './game.js';
import { AudioSystem } from './audio.js';
import { AIRCRAFT_DEFS } from './aircraft.js';
import { MISSIONS } from './missions.js';
import { CHARACTERS, FRIENDS, getCharacter, getFriend, storyBeats, airportBeat, boardingBeat, freedomBeat } from './story.js';
import {
  loadSettings, saveSettings, loadSave, persistSave,
  unlockMission, recordScore, isMobileDevice
} from './settings.js';

const screens = {
  menu: document.getElementById('screen-menu'),
  character: document.getElementById('screen-character'),
  friend: document.getElementById('screen-friend'),
  story: document.getElementById('screen-story'),
  aircraft: document.getElementById('screen-aircraft'),
  missions: document.getElementById('screen-missions'),
  settings: document.getElementById('screen-settings'),
  loading: document.getElementById('screen-loading'),
  pause: document.getElementById('screen-pause'),
  result: document.getElementById('screen-result')
};

let settings = loadSettings();
let save = loadSave();
const audio = new AudioSystem();
const canvas = document.getElementById('game-canvas');
const game = new Game(canvas, audio, settings, save);
window.SkyStrikeGame = game;

let settingsReturn = 'menu';
let pendingMission = null;
let playAfterAircraft = false;
let lastResult = null;
let selectedCharacter = save.selectedCharacter || 'kai';
let selectedFriend = save.selectedFriend || 'daan';
let storyIndex = 0;
let storyQueue = [];
let afterStory = 'drive';

function show(name) {
  Object.values(screens).forEach((s) => s.classList.remove('active'));
  if (name && screens[name]) screens[name].classList.add('active');
}

function unlockAudio() {
  audio.unlock();
  audio.setEnabled(settings.sound);
  audio.setMusic(settings.music);
}

document.body.addEventListener('pointerdown', unlockAudio, { once: true });

function renderCast(kind) {
  const list = kind === 'character' ? CHARACTERS : FRIENDS;
  const grid = document.getElementById(kind === 'character' ? 'character-grid' : 'friend-grid');
  const current = kind === 'character' ? selectedCharacter : selectedFriend;
  grid.innerHTML = '';
  list.forEach((c) => {
    const btn = document.createElement('button');
    btn.className = `cast-card${c.id === current ? ' selected' : ''}`;
    btn.innerHTML = `
      <div class="cast-avatar" style="background:${c.color || '#7dffd4'}">${c.name[0]}</div>
      <h3>${c.name}</h3>
      <p>${c.role || c.city}</p>
      <p>${c.bio || c.trait}</p>
    `;
    btn.onclick = () => {
      if (kind === 'character') selectedCharacter = c.id;
      else selectedFriend = c.id;
      renderCast(kind);
      if (kind === 'character') game.previewPeople(selectedCharacter);
      else game.previewPeople(selectedCharacter, selectedFriend);
    };
    grid.appendChild(btn);
  });
}

function showStoryBeat(beat) {
  document.getElementById('story-kicker').textContent = beat.kicker;
  document.getElementById('story-title').textContent = beat.title;
  document.getElementById('story-speaker').textContent = beat.speaker || '';
  document.getElementById('story-text').textContent = beat.text;
  document.getElementById('btn-story-next').textContent = beat.btn || 'VERDER';
  show('story');
}

function beginStory() {
  const character = getCharacter(selectedCharacter);
  const friend = getFriend(selectedFriend);
  save.selectedCharacter = selectedCharacter;
  save.selectedFriend = selectedFriend;
  persistSave(save);
  storyQueue = storyBeats(character, friend);
  storyIndex = 0;
  afterStory = 'drive';
  showStoryBeat(storyQueue[0]);
}

function updateDriveHud(data) {
  const hud = document.getElementById('drive-hud');
  hud.classList.remove('hidden');
  document.getElementById('drive-speed').textContent = `${data.speed} KM/H`;
  document.getElementById('drive-dist').textContent = `${data.dist} KM`;
  document.getElementById('drive-loc').textContent = `DUITSLAND · ${data.loc}`;
  document.getElementById('drive-hp').style.width = `${Math.max(0, data.hp * 100)}%`;
  document.getElementById('drive-hp-txt').textContent = `${Math.round(data.hp * 100)}%`;
  document.getElementById('drive-progress').style.width = `${Math.max(0, data.progress * 100)}%`;
  document.getElementById('drive-obj').innerHTML = `<b>DOEL</b><br>${data.progress > 0.95 ? '✓' : '○'} Bereik het vliegveld<br>${data.hp > 0 ? '○' : '✗'} Ontsnap aan de boeven`;
}

function hideDriveHud() {
  document.getElementById('drive-hud').classList.add('hidden');
}

function hideLifeHud() {
  document.getElementById('life-hud').classList.add('hidden');
}

function updateLifeHud(data) {
  if (!data) return;
  const hud = document.getElementById('life-hud');
  hud.classList.remove('hidden');
  document.getElementById('life-badge').textContent = data.badge || 'BRUSSEL';
  document.getElementById('life-badge').classList.toggle('wanted', !!data.wanted);
  document.getElementById('life-loc').textContent = data.loc || '';
  const money = document.getElementById('life-money');
  if (data.money == null) money.textContent = 'RAAM 12A';
  else money.textContent = `€ ${Math.max(0, Math.round(data.money))}`;
  document.getElementById('life-obj').innerHTML = `<b>DOEL</b><br>${data.obj || ''}`;
  const toast = document.getElementById('life-toast');
  toast.textContent = data.toast || '';
  const prompt = document.getElementById('world-prompt');
  if (data.prompt) {
    prompt.classList.remove('hidden');
    prompt.classList.toggle('job', !!data.prompt.job);
    prompt.innerHTML = `<kbd>${data.prompt.key}</kbd>${data.prompt.text}`;
  } else prompt.classList.add('hidden');
  const jobs = document.getElementById('job-panel');
  const jobList = document.getElementById('job-list');
  if (data.jobs) {
    jobs.classList.remove('hidden');
    jobList.innerHTML = data.jobs.map((j) =>
      `<div class="job-row${j.active ? ' active' : ''}"><span>${j.active ? '► ' : ''}${j.name}</span><span>${j.dist}</span></div>`
    ).join('') + `<div class="job-hint">${data.jobHint || 'Loop naar het groene licht. Druk op E.'}</div>`;
  } else {
    jobs.classList.add('hidden');
  }
  const nav = document.getElementById('life-nav');
  if (data.navAngle != null) {
    nav.classList.remove('hidden');
    nav.style.transform = `translateX(-50%) rotate(${data.navAngle}deg)`;
  } else nav.classList.add('hidden');
  const wrap = document.getElementById('life-progress-wrap');
  if (data.progress != null) {
    wrap.classList.remove('hidden');
    document.getElementById('life-progress').style.width = `${Math.round(data.progress * 100)}%`;
  } else wrap.classList.add('hidden');
  if (data.money != null && data.money !== updateLifeHud._money) {
    updateLifeHud._money = data.money;
    persistSave(save);
  }
}

function refreshMenuMeta() {
  const euro = save.money ? ` · €${save.money}` : '';
  document.getElementById('menu-progress').textContent =
    `XP ${save.xp} · MISSION ${Math.max(...save.unlockedMissions)} UNLOCKED${euro}`;
  const free = document.getElementById('btn-freedom');
  if (free) free.style.display = save.freedomUnlocked ? 'block' : 'none';
}

function renderAircraft() {
  const grid = document.getElementById('aircraft-grid');
  grid.innerHTML = '';
  Object.values(AIRCRAFT_DEFS).forEach((def) => {
    const unlocked = save.unlockedAircraft.includes(def.id);
    const selected = save.selectedAircraft === def.id;
    const btn = document.createElement('button');
    btn.className = `ac-card${selected ? ' selected' : ''}${unlocked ? '' : ' locked'}`;
    btn.innerHTML = `
      <h3>${def.name}</h3>
      <p>${unlocked ? def.role : 'LOCKED · Earn XP to unlock'}</p>
      ${['speed', 'armor', 'agility', 'weapons'].map((k) => `
        <div class="stat-row"><span>${k.toUpperCase()}</span><span>${def.stats[k]}</span></div>
        <div class="stat-bar"><i style="width:${def.stats[k]}%"></i></div>
      `).join('')}
    `;
    btn.addEventListener('click', () => {
      if (!unlocked) return;
      save.selectedAircraft = def.id;
      persistSave(save);
      renderAircraft();
    });
    grid.appendChild(btn);
  });
}

function renderMissions() {
  const list = document.getElementById('mission-list');
  list.innerHTML = '';
  MISSIONS.forEach((m) => {
    const unlocked = save.unlockedMissions.includes(m.id);
    const best = save.bestScores[m.id] || 0;
    const btn = document.createElement('button');
    btn.className = `mission-card${unlocked ? '' : ' locked'}`;
    btn.innerHTML = `
      <div>
        <h3>MISSION ${m.id} · ${m.name}</h3>
        <p>${unlocked ? m.blurb : 'Complete the previous mission to unlock.'}</p>
      </div>
      <div>${unlocked ? (best ? `BEST ${best}` : 'READY') : 'LOCKED'}</div>
    `;
    btn.addEventListener('click', () => {
      if (!unlocked) return;
      pendingMission = m.id;
      show('aircraft');
      renderAircraft();
    });
    list.appendChild(btn);
  });
}

function nextCampaignMission() {
  const completed = save.completedMissions || [];
  const unlocked = [...save.unlockedMissions].sort((a, b) => a - b);
  return unlocked.find((id) => !completed.includes(id)) || unlocked[unlocked.length - 1];
}

function bindSettings() {
  const sound = document.getElementById('set-sound');
  const music = document.getElementById('set-music');
  const gfx = document.getElementById('set-graphics');
  const cam = document.getElementById('set-cam-sens');
  const fly = document.getElementById('set-fly-sens');
  const inv = document.getElementById('set-invert');
  const hud = document.getElementById('set-hud');

  const paint = () => {
    sound.dataset.on = String(settings.sound);
    sound.textContent = settings.sound ? 'ON' : 'OFF';
    music.dataset.on = String(settings.music);
    music.textContent = settings.music ? 'ON' : 'OFF';
    gfx.value = settings.graphics;
    cam.value = settings.cameraSensitivity;
    fly.value = settings.flightSensitivity;
    inv.dataset.on = String(settings.invertY);
    inv.textContent = settings.invertY ? 'ON' : 'OFF';
    hud.dataset.on = String(settings.showHud);
    hud.textContent = settings.showHud ? 'ON' : 'OFF';
  };
  paint();

  const commit = () => {
    saveSettings(settings);
    game.applySettings(settings);
    audio.setEnabled(settings.sound);
    audio.setMusic(settings.music);
  };

  sound.onclick = () => { settings.sound = !settings.sound; paint(); commit(); };
  music.onclick = () => { settings.music = !settings.music; paint(); commit(); };
  gfx.onchange = () => { settings.graphics = gfx.value; paint(); commit(); };
  cam.oninput = () => { settings.cameraSensitivity = Number(cam.value); commit(); };
  fly.oninput = () => { settings.flightSensitivity = Number(fly.value); commit(); };
  inv.onclick = () => { settings.invertY = !settings.invertY; paint(); commit(); };
  hud.onclick = () => { settings.showHud = !settings.showHud; paint(); commit(); };
}

async function launch(id) {
  unlockAudio();
  show('loading');
  document.getElementById('loading-title').textContent = MISSIONS.find((m) => m.id === id).name;
  document.getElementById('loading-desc').textContent = MISSIONS.find((m) => m.id === id).briefing;
  document.getElementById('load-fill').style.width = '30%';
  document.getElementById('loading-status').textContent = 'BUILDING THEATER…';
  await new Promise((r) => setTimeout(r, 120));
  document.getElementById('load-fill').style.width = '70%';
  await game.startMission(id, save.selectedAircraft);
  document.getElementById('load-fill').style.width = '100%';
}

game.onState = (state, payload) => {
  if (state === 'LOADING') {
    show('loading');
    document.getElementById('loading-title').textContent = payload.name;
    document.getElementById('loading-desc').textContent = payload.briefing;
    document.getElementById('loading-status').textContent = 'ARMING VX SYSTEMS…';
  }
  if (state === 'PLAYING') {
    hideDriveHud();
    hideLifeHud();
    show(null);
    document.getElementById('orient-hint').classList.toggle('hidden', !(isMobileDevice() && window.innerHeight > window.innerWidth));
  }
  if (state === 'DRIVING' || state === 'DRIVE_HUD') {
    if (state === 'DRIVING') show(null);
    if (payload && payload.speed != null) updateDriveHud(payload);
  }
  if (state === 'AIRPORT' || state === 'FLYING' || state === 'FREEDOM') {
    hideDriveHud();
    show(null);
  }
  if (state === 'LIFE_HUD') updateLifeHud(payload);
  if (state === 'DRIVE_COMPLETE') {
    hideDriveHud();
    if ((save.money || 0) < 180) save.money = (save.money || 0) + 400;
    persistSave(save);
    const beat = airportBeat(getCharacter(selectedCharacter), getFriend(selectedFriend));
    afterStory = 'airport';
    storyQueue = [beat];
    storyIndex = 0;
    showStoryBeat(beat);
  }
  if (state === 'BOARDED') {
    hideLifeHud();
    persistSave(save);
    const beat = boardingBeat(getCharacter(selectedCharacter));
    afterStory = 'flight';
    storyQueue = [beat];
    storyIndex = 0;
    showStoryBeat(beat);
  }
  if (state === 'LANDED_BELGIUM') {
    hideLifeHud();
    save.freedomUnlocked = true;
    persistSave(save);
    const beat = freedomBeat(getCharacter(selectedCharacter), getFriend(selectedFriend));
    afterStory = 'freedom';
    storyQueue = [beat];
    storyIndex = 0;
    showStoryBeat(beat);
  }
  if (state === 'DRIVE_FAILED') {
    hideDriveHud();
    lastResult = { def: { id: 0, name: 'Ontsnapping' }, stats: { kills: 0, time: 0 } };
    document.getElementById('result-kicker').textContent = 'ONTSMAPPING MISLUKT';
    document.getElementById('result-title').textContent = 'De boeven hebben de Tesla geramd';
    document.getElementById('result-stats').innerHTML = `<li><span>Probeer opnieuw</span><span>Keulen</span></li>`;
    document.getElementById('btn-next-mission').style.display = 'none';
    show('result');
  }
  if (state === 'PAUSED') show('pause');
  if (state === 'MAIN_MENU') {
    hideLifeHud();
    hideDriveHud();
    refreshMenuMeta();
    show('menu');
  }
  if (state === 'MISSION_COMPLETE') {
    lastResult = payload;
    const def = payload.def;
    if (!save.completedMissions) save.completedMissions = [];
    if (!save.completedMissions.includes(def.id)) save.completedMissions.push(def.id);
    unlockMission(save, Math.min(5, def.id + 1));
    recordScore(save, def.id, payload.stats.xp);
    if (save.xp >= 1000 && !save.unlockedAircraft.includes('viper')) save.unlockedAircraft.push('viper');
    if (save.xp >= 2500 && !save.unlockedAircraft.includes('titan')) save.unlockedAircraft.push('titan');
    persistSave(save);
    document.getElementById('result-kicker').textContent = 'MISSION COMPLETE';
    document.getElementById('result-title').textContent = def.name;
    document.getElementById('result-stats').innerHTML = `
      <li><span>Kills</span><span>${payload.stats.kills}</span></li>
      <li><span>Missiles fired</span><span>${payload.stats.missilesFired}</span></li>
      <li><span>Missiles hit</span><span>${payload.stats.missilesHit}</span></li>
      <li><span>Damage taken</span><span>${Math.round(payload.stats.damageTaken)}</span></li>
      <li><span>Time</span><span>${Math.round(payload.stats.time)}s</span></li>
      <li><span>XP gained</span><span>+${payload.xp}</span></li>
    `;
    document.getElementById('btn-next-mission').style.display = def.id < 5 ? 'block' : 'none';
    show('result');
  }
  if (state === 'MISSION_FAILED') {
    lastResult = payload;
    document.getElementById('result-kicker').textContent = 'MISSION FAILED';
    document.getElementById('result-title').textContent = payload.reason || 'AIRCRAFT DESTROYED';
    document.getElementById('result-stats').innerHTML = `
      <li><span>Kills</span><span>${payload.stats.kills}</span></li>
      <li><span>Time</span><span>${Math.round(payload.stats.time)}s</span></li>
    `;
    document.getElementById('btn-next-mission').style.display = 'none';
    show('result');
  }
};

document.getElementById('btn-play').onclick = () => {
  renderCast('character');
  game.previewPeople(selectedCharacter);
  show('character');
};
document.getElementById('btn-freedom').onclick = () => {
  unlockAudio();
  game.story = { character: getCharacter(selectedCharacter), friend: getFriend(selectedFriend) };
  game.startFreedom();
};
document.getElementById('btn-confirm-character').onclick = () => {
  renderCast('friend');
  game.previewPeople(selectedCharacter, selectedFriend);
  show('friend');
};
document.getElementById('friend-back').onclick = () => {
  renderCast('character');
  game.previewPeople(selectedCharacter);
  show('character');
};
document.getElementById('btn-confirm-friend').onclick = () => beginStory();
document.getElementById('btn-story-next').onclick = () => {
  storyIndex++;
  if (storyIndex < storyQueue.length) {
    showStoryBeat(storyQueue[storyIndex]);
    return;
  }
  if (afterStory === 'drive') {
    unlockAudio();
    const character = getCharacter(selectedCharacter);
    const friend = getFriend(selectedFriend);
    game.startDrive(character, friend);
  } else if (afterStory === 'airport') {
    unlockAudio();
    game.startAirport();
  } else if (afterStory === 'flight') {
    unlockAudio();
    game.startFlight();
  } else if (afterStory === 'freedom') {
    unlockAudio();
    game.startFreedom();
  }
};
document.getElementById('btn-drive-pause').onclick = () => game.togglePause();
document.getElementById('btn-life-pause').onclick = () => game.togglePause();
document.getElementById('btn-missions').onclick = () => { renderMissions(); show('missions'); };
document.getElementById('btn-aircraft').onclick = () => {
  playAfterAircraft = false;
  pendingMission = null;
  renderAircraft();
  show('aircraft');
};
document.getElementById('btn-settings').onclick = () => { settingsReturn = 'menu'; show('settings'); };
document.getElementById('settings-back').onclick = () => {
  if (settingsReturn === 'pause') show('pause');
  else show('menu');
};
document.querySelectorAll('[data-back]').forEach((b) => b.onclick = () => show('menu'));
document.getElementById('btn-confirm-aircraft').onclick = () => {
  persistSave(save);
  if (pendingMission) launch(pendingMission);
  else if (playAfterAircraft) launch(nextCampaignMission());
  else show('menu');
  playAfterAircraft = false;
};
document.getElementById('btn-resume').onclick = () => game.togglePause();
document.getElementById('btn-restart').onclick = () => {
  show('loading');
  if (lastResult?.def?.id === 0) game.restartDrive();
  else game.restartCurrent();
};
document.getElementById('btn-pause-settings').onclick = () => { settingsReturn = 'pause'; show('settings'); };
document.getElementById('btn-main-menu').onclick = () => game.returnToMenu();
document.getElementById('btn-next-mission').onclick = () => {
  const next = Math.min(5, (lastResult?.def.id || 1) + 1);
  launch(next);
};
document.getElementById('btn-result-restart').onclick = () => {
  if (lastResult?.def?.id === 0) game.restartDrive();
  else game.restart();
};
document.getElementById('btn-result-menu').onclick = () => game.returnToMenu();
document.getElementById('btn-pause').onclick = () => game.togglePause();

bindSettings();
game.applySettings(settings);
refreshMenuMeta();
show('menu');

const bootScene = new URLSearchParams(location.search).get('scene');
if (bootScene === 'airport' || bootScene === 'flight' || bootScene === 'freedom') {
  game.story = { character: getCharacter(selectedCharacter), friend: getFriend(selectedFriend) };
  if ((save.money || 0) < 220) save.money = 220;
  if (bootScene === 'airport') game.startAirport();
  if (bootScene === 'flight') game.startFlight();
  if (bootScene === 'freedom') {
    save.freedomUnlocked = true;
    persistSave(save);
    game.startFreedom();
  }
}

window.addEventListener('orientationchange', () => {
  document.getElementById('orient-hint').classList.toggle('hidden', !(isMobileDevice() && window.innerHeight > window.innerWidth));
});
