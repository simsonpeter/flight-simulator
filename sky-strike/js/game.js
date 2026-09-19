import * as THREE from 'three';
import { World } from './world.js';
import { Player } from './player.js';
import { EnemyManager } from './enemyAI.js';
import { GunSystem } from './weapons.js';
import { MissileSystem } from './missiles.js';
import { ExplosionSystem } from './explosions.js';
import { CameraController } from './camera.js';
import { InputState, DesktopControls } from './controls.js';
import { MobileControls } from './mobileControls.js';
import { HUD, projectToScreen } from './hud.js';
import { Radar } from './radar.js';
import { MISSIONS, MissionRuntime } from './missions.js';
import { createAircraftMesh, AIRCRAFT_DEFS, updateExhaust } from './aircraft.js';
import { DriveChase } from './drive.js';
import { isMobileDevice } from './settings.js';
import { CharacterStudio } from './character.js';
import { AirportTerminal } from './airport.js';
import { PassengerFlight } from './airliner.js';
import { FreedomCity } from './freedom.js';

const _fwd = new THREE.Vector3();
const _to = new THREE.Vector3();
const _euler = new THREE.Euler();

export class Game {
  constructor(canvas, audio, settings, save) {
    this.canvas = canvas;
    this.audio = audio;
    this.settings = settings;
    this.save = save;
    this.quality = settings.graphics;
    this.mobile = isMobileDevice();

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.quality !== 'low', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this._pixelRatio());
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.shadowMap.enabled = this.quality === 'high';
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / Math.max(1, window.innerHeight), 0.3, 20000);
    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();
    this.cam = new CameraController(this.camera);
    this.hud = new HUD();
    this.radar = new Radar(document.getElementById('radar'));
    this.input = new InputState();
    this.absThrottle = null;
    this.gunCd = 0;
    this.lockArmed = false;
    this.warnCd = 0;
    this.timeScale = 1;
    this.slowMo = 0;
    this.mode = 'ATTRACT';
    this.missionDef = null;
    this.mission = null;
    this.player = null;
    this.enemies = null;
    this.world = null;
    this.guns = null;
    this.missiles = null;
    this.explosions = null;
    this.demo = null;
    this.waveQueued = 0;
    this.stats = this._emptyStats();
    this.xpSession = 0;
    this.onState = () => {};
    this.landedOnce = false;
    this.running = true;
    this.paused = false;
    this.lookHold = false;
    this.streaks = [];
    this.drive = null;
    this.studio = null;
    this.airport = null;
    this.flight = null;
    this.city = null;
    this.story = { character: null, friend: null };

    const hooks = {
      onCamera: () => this.cycleCamera(),
      onTarget: () => this.cycleTarget(),
      onPause: () => this.togglePause(),
      onAfterburner: () => this.audio.playAfterburnerSound(),
      onLookToggle: (forced) => this.toggleLook(forced),
      onLook: (x, y) => this.cam.addLook(x, y),
      isLookActive: () => this.cam.lookActive,
      onMissile: () => { this.input.missile = true; },
      setThrottleAbsolute: (v) => { this.absThrottle = v; }
    };
    this.desktop = new DesktopControls(this.input, canvas, hooks);
    this.touch = new MobileControls(this.input, hooks);

    window.addEventListener('resize', () => this.resize());
    this._buildAttract();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  _pixelRatio() {
    const dpr = window.devicePixelRatio || 1;
    if (this.quality === 'low') return 1;
    if (this.quality === 'medium') return Math.min(1.4, dpr);
    return Math.min(1.75, dpr);
  }

  applySettings(settings) {
    this.settings = settings;
    this.quality = settings.graphics;
    this.cam.sensitivity = settings.cameraSensitivity;
    this.input.sensitivity = settings.flightSensitivity;
    this.renderer.setPixelRatio(this._pixelRatio());
    this.audio.setEnabled(settings.sound);
    this.audio.setMusic(settings.music);
  }

  _emptyStats() {
    return { kills: 0, missilesFired: 0, missilesHit: 0, damageTaken: 0, time: 0, xp: 0 };
  }

  _clearScene() {
    if (this.camera.parent) this.camera.parent.remove(this.camera);
    this.scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose?.();
    });
    this.scene = new THREE.Scene();
  }

  _buildAttract() {
    this._clearScene();
    this.world = new World(this.scene, this.quality);
    this.world.build('DAY', 'CLEAR');
    this.demo = createAircraftMesh(AIRCRAFT_DEFS.raptor);
    this.scene.add(this.demo);
    this.mode = 'ATTRACT';
    this.hud.show(false);
    this.touch.show(false);
    this.desktop.setEnabled(false);
  }

  async startMission(id, aircraftId) {
    this.missionDef = MISSIONS.find((m) => m.id === id) || MISSIONS[0];
    this.onState('LOADING', this.missionDef);
    await new Promise((r) => setTimeout(r, 80));
    this._clearScene();
    this.world = new World(this.scene, this.quality);
    this.world.build(this.missionDef.tod, this.missionDef.weather);
    this.explosions = new ExplosionSystem(this.scene, this.quality);
    this.guns = new GunSystem(this.scene);
    this.missiles = new MissileSystem(this.scene, this.explosions, this.audio);
    this.player = new Player(this.scene, aircraftId);
    this.enemies = new EnemyManager(this.scene);
    const zone = this.missionDef.zone ? new THREE.Vector3(...this.missionDef.zone) : null;
    for (const e of this.missionDef.enemies) {
      this._spawnEnemy(e.type, new THREE.Vector3(...e.pos), zone);
    }
    this._completeArmed = false;
    this.mission = new MissionRuntime(this.scene, this.missionDef);
    this.cam = new CameraController(this.camera);
    this.cam.modeIndex = 1;
    this.cam.sensitivity = this.settings.cameraSensitivity;
    this.stats = this._emptyStats();
    this.xpSession = 0;
    this.timeScale = 1;
    this.slowMo = 0;
    this.paused = false;
    this.landedOnce = false;
    this.waveQueued = 0;
    this.absThrottle = this.mobile ? 0 : null;
    this.input.resetAxes();
    this.input.fire = false;
    this.input.afterburner = false;
    this.lockArmed = false;
    this._makeStreaks();
    this.mode = 'PLAYING';
    this.desktop.setEnabled(true);
    this.touch.show(this.mobile);
    this.hud.show(true);
    this.touch.syncThrottle(0);
    this.onState('PLAYING', this.missionDef);
    if (this.missionDef.id === 1) this.hud.toast('SHIFT: GAS  ·  S: STIJGEN  ·  naar België');
  }

  restart() {
    if (this.missionDef) this.startMission(this.missionDef.id, this.player?.def.id || this.save.selectedAircraft);
  }

  async startDrive(character, friend) {
    this.story = { character, friend };
    this.onState('LOADING', { name: 'TESLA MODEL X', briefing: 'Keulen. Autobahn. Boeven in de achtervolging.', tod: 'DAY' });
    await new Promise((r) => setTimeout(r, 60));
    this._clearScene();
    this.drive = new DriveChase(this.scene, this.camera, this.audio, character, friend);
    this.drive.build();
    this.paused = false;
    this.mode = 'DRIVING';
    this.input.resetAxes();
    this.desktop.setEnabled(true);
    this.touch.show(this.mobile);
    this.hud.show(false);
    const mob = document.getElementById('mobile-controls');
    if (mob) mob.classList.add('drive-mode');
    this.onState('DRIVING');
  }

  restartDrive() {
    this.startDrive(this.story.character, this.story.friend);
  }

  _walkHud() {
    this.desktop.setEnabled(true);
    this.touch.show(this.mobile);
    this.hud.show(false);
    const mob = document.getElementById('mobile-controls');
    if (mob) {
      mob.classList.remove('drive-mode');
      mob.classList.add('walk-mode');
    }
    const fire = document.getElementById('m-fire');
    if (fire) fire.textContent = 'E';
  }

  startPreview(charId, friendId = null) {
    this._clearScene();
    this.studio = new CharacterStudio(this.scene, this.camera);
    this.studio.build(charId, friendId);
    this.mode = 'PREVIEW';
    this.paused = false;
    this.desktop.setEnabled(false);
    this.touch.show(false);
    this.hud.show(false);
  }

  previewPeople(charId, friendId = null) {
    if (this.mode !== 'PREVIEW' || !this.studio) this.startPreview(charId, friendId);
    else this.studio.setPeople(charId, friendId);
  }

  async startAirport() {
    this.onState('LOADING', { name: 'VLIEGVELD KEULEN', briefing: 'Koop een ticket naar Brussel en board het toestel.' });
    await new Promise((r) => setTimeout(r, 50));
    this._clearScene();
    this.airport = new AirportTerminal(this.scene, this.camera, this.audio, this.story.character, this.story.friend, this.save);
    this.airport.build();
    this.paused = false;
    this.mode = 'AIRPORT';
    this.input.resetAxes();
    this._walkHud();
    this.onState('AIRPORT');
  }

  async startFlight() {
    this.onState('LOADING', { name: 'VLUCHT NAAR BRUSSEL', briefing: 'Stoel 12A. Je vliegt als passagier van Duitsland naar België.' });
    await new Promise((r) => setTimeout(r, 50));
    this._clearScene();
    this.flight = new PassengerFlight(this.scene, this.camera, this.audio, this.story.character, this.story.friend);
    this.flight.build();
    this.paused = false;
    this.mode = 'FLYING';
    this.input.resetAxes();
    this._walkHud();
    this.onState('FLYING');
  }

  async startFreedom() {
    this.save.freedomUnlocked = true;
    if (!this.save.money) this.save.money = 220;
    this.onState('LOADING', { name: 'BRUSSEL', briefing: 'Freedom. Verdien geld, koop een huis, doe wat je wilt.' });
    await new Promise((r) => setTimeout(r, 50));
    this._clearScene();
    this.city = new FreedomCity(this.scene, this.camera, this.audio, this.story.character, this.story.friend, this.save);
    this.city.build();
    this.paused = false;
    this.mode = 'FREEDOM';
    this.input.resetAxes();
    this._walkHud();
    this.onState('FREEDOM');
  }

  restartCurrent() {
    const m = this.mode === 'PAUSED' ? this._resumeMode : this.mode;
    if (m === 'DRIVING') return this.restartDrive();
    if (m === 'AIRPORT') return this.startAirport();
    if (m === 'FLYING') return this.startFlight();
    if (m === 'FREEDOM') return this.startFreedom();
    this.restart();
  }

  _updateAirport(dt) {
    this.desktop.update();
    const status = this.airport.update(dt, this.input);
    this.input.interact = false;
    this.onState('LIFE_HUD', this.airport.hud());
    if (status === 'board') {
      this.mode = 'STORY';
      this.desktop.setEnabled(false);
      this.touch.show(false);
      this.onState('BOARDED');
    }
  }

  _updateFlight(dt) {
    this.desktop.update();
    const status = this.flight.update(dt, this.input);
    this.input.interact = false;
    this.onState('LIFE_HUD', this.flight.hud());
    if (status === 'landed') {
      this.mode = 'STORY';
      this.desktop.setEnabled(false);
      this.touch.show(false);
      this.onState('LANDED_BELGIUM');
    }
  }

  _updateFreedom(dt) {
    this.desktop.update();
    this.city.update(dt, this.input);
    this.input.interact = false;
    this.onState('LIFE_HUD', this.city.hud());
  }

  _updateDrive(dt) {
    this.desktop.update();
    if (this.mobile && this.absThrottle != null && this.absThrottle > 0.08) this.input.throttle = 1;
    const status = this.drive.update(dt, this.input);
    this.audio.playEngineSound(Math.min(1, this.drive.speed / 50), !!this.input.afterburner, true);
    this.onState('DRIVE_HUD', this.drive.hud());
    if (status === 'win') {
      this.mode = 'STORY';
      this.desktop.setEnabled(false);
      this.touch.show(false);
      document.getElementById('mobile-controls')?.classList.remove('drive-mode');
      this.onState('DRIVE_COMPLETE', this.story);
    } else if (status === 'fail') {
      this.mode = 'STORY';
      this.desktop.setEnabled(false);
      this.touch.show(false);
      document.getElementById('mobile-controls')?.classList.remove('drive-mode');
      this.onState('DRIVE_FAILED');
    }
  }

  returnToMenu() {
    this.mode = 'ATTRACT';
    this.paused = false;
    this.hud.show(false);
    this.touch.show(false);
    this.desktop.setEnabled(false);
    document.getElementById('mobile-controls')?.classList.remove('drive-mode', 'walk-mode');
    document.getElementById('drive-hud')?.classList.add('hidden');
    document.getElementById('life-hud')?.classList.add('hidden');
    const fire = document.getElementById('m-fire');
    if (fire) fire.textContent = 'FIRE';
    this._buildAttract();
    this.onState('MAIN_MENU');
  }

  togglePause() {
    const live = ['DRIVING', 'AIRPORT', 'FLYING', 'FREEDOM', 'PLAYING'];
    if (live.includes(this.mode)) {
      this._resumeMode = this.mode;
      this.paused = true;
      this.mode = 'PAUSED';
      this.desktop.setEnabled(false);
      this.onState('PAUSED');
      return;
    }
    if (this.mode !== 'PAUSED') return;
    this.paused = false;
    this.mode = this._resumeMode || 'PLAYING';
    this._resumeMode = null;
    this.desktop.setEnabled(true);
    this.onState(this.mode === 'DRIVING' ? 'DRIVING' : this.mode === 'PLAYING' ? 'PLAYING' : this.mode);
  }

  _spawnEnemy(type, position, zone) {
    const e = this.enemies.spawn(type, position, position);
    e.onMissileHit = () => { this.stats.missilesHit++; };
    if (zone) e.ingress = zone.clone();
    return e;
  }

  cycleCamera() {
    this.cam.cycle();
  }

  toggleLook(forced) {
    if (forced === true || forced === false) this.cam.setLook(forced);
    else this.cam.setLook(!this.cam.lookActive);
  }

  cycleTarget() {
    if (!this.player) return;
    const alive = this.enemies.alive();
    if (!alive.length) {
      this.player.target = null;
      this.player.locked = false;
      return;
    }
    const idx = alive.indexOf(this.player.target);
    this.player.target = alive[(idx + 1) % alive.length];
    this.player.locked = false;
    this.player.lockTimer = 0;
    this.lockArmed = false;
  }

  _makeStreaks() {
    this.streaks.forEach((s) => this.camera.remove(s));
    this.streaks = [];
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 4 + Math.random() * 6), mat.clone());
      m.position.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 5, -6 - Math.random() * 12);
      this.camera.add(m);
      this.streaks.push(m);
    }
    this.scene.add(this.camera);
  }

  _loop() {
    if (!this.running) return;
    requestAnimationFrame(this._loop);
    const raw = Math.min(0.05, this.clock.getDelta());
    if (this.mode === 'ATTRACT') {
      this._updateAttract(raw);
      this.renderer.render(this.scene, this.camera);
      this.audio.updateMusic(raw, true);
      return;
    }
    if (this.mode === 'PREVIEW') {
      this.studio?.update(raw);
      this.renderer.render(this.scene, this.camera);
      this.audio.updateMusic(raw, true);
      return;
    }
    if (this.mode === 'PAUSED') {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (this.mode === 'DRIVING') {
      this._updateDrive(raw);
      this.renderer.render(this.scene, this.camera);
      this.audio.updateMusic(raw, true);
      return;
    }
    if (this.mode === 'AIRPORT') {
      this._updateAirport(raw);
      this.renderer.render(this.scene, this.camera);
      this.audio.updateMusic(raw, true);
      return;
    }
    if (this.mode === 'FLYING') {
      this._updateFlight(raw);
      this.renderer.render(this.scene, this.camera);
      this.audio.updateMusic(raw, true);
      return;
    }
    if (this.mode === 'FREEDOM') {
      this._updateFreedom(raw);
      this.renderer.render(this.scene, this.camera);
      this.audio.updateMusic(raw, true);
      return;
    }
    if (this.mode !== 'PLAYING') {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.slowMo = Math.max(0, this.slowMo - raw);
    this.timeScale = this.slowMo > 0 ? 0.38 : 1;
    const dt = raw * this.timeScale;
    this._updatePlay(dt, raw);
    this.renderer.render(this.scene, this.camera);
  }

  _updateAttract(dt) {
    this.world.update(dt, this.demo.position);
    const t = this.clock.elapsedTime * 0.28;
    const r = 420;
    const pos = new THREE.Vector3(Math.cos(t) * r, 88, Math.sin(t) * r);
    const next = new THREE.Vector3(Math.cos(t + 0.08) * r, 90, Math.sin(t + 0.08) * r);
    this.demo.position.copy(pos);
    _to.copy(next).sub(pos).normalize();
    this.demo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _to);
    updateExhaust(this.demo, 0.8, true, this.clock.elapsedTime);
    this.camera.position.copy(pos).add(new THREE.Vector3(Math.cos(t) * 38, 14, Math.sin(t) * 38));
    this.camera.lookAt(pos);
    this.renderer.toneMappingExposure = 1.05;
  }

  _updatePlay(dt, raw) {
    this.desktop.update();
    this.input.sensitivity = this.settings.flightSensitivity;
    if (this.mobile && this.absThrottle != null) {
      this.player.flight.throttle = this.absThrottle;
      this.input.throttle = 0;
    }
    const phys = {
      pitch: this.settings.invertY ? -this.input.pitch : this.input.pitch,
      roll: this.input.roll,
      yaw: this.input.yaw,
      throttle: this.input.throttle,
      airbrake: this.input.airbrake,
      afterburner: this.input.afterburner,
      sensitivity: this.settings.flightSensitivity
    };

    const event = this.player.update(dt, phys, this.world, this.clock.elapsedTime);
    if (event === 'crash') this._destroyPlayer();
    if (event === 'landed' && !this.landedOnce) {
      this.landedOnce = true;
      this.mission.onLanding();
      this._award(150, 'LANDING SUCCESSFUL');
    }
    if (!this.player.flight.grounded) this.mission.onTakeoff();

    if (!this.player.alive) return;

    this.world.update(dt, this.player.position);
    this.enemies.update(dt, this.player, this.clock.elapsedTime, this.guns, this.missiles);
    this._combat(dt);
    this.guns.update(dt, [this.player, ...this.enemies.list]);
    this.missiles.update(dt);
    this.explosions.update(dt);
    this.enemies.removeDead(this.explosions, (e) => this._onKill(e));
    this._targeting(dt);
    this._waves();
    const cp = this.mission.update(dt, this.player, this.enemies.list);
    if (cp) {
      if (cp.border) this._award(120, 'WELKOM IN BELGIË');
      else this._award(80, (cp.name ? cp.name.toUpperCase() : 'CHECKPOINT') + `  ${cp.checkpoint}/${cp.total}`);
    }
    const objs = this.mission.objectives(this.player, this.enemies.alive().length, this.enemies.list.length);
    if (this.mission.complete && !this._completeArmed) {
      this._completeArmed = true;
      setTimeout(() => this._complete(), 800);
    }
    if (this.mission.failed) this._fail(this.mission.failReason);
    this.stats.damageTaken = this.player.hitsTaken;
    if (this.player.hurt) {
      this.player.hurt = false;
      this.cam.addShake(0.35);
      this.audio.playHitSound();
    }
    if (this.player.health <= 0) this._destroyPlayer();

    const speedNorm = this.player.flight.speed / this.player.def.maxSpeed;
    if (this.player.mesh.userData.cockpitInterior) {
      this.player.mesh.userData.cockpitInterior.visible = this.cam.mode === 'COCKPIT';
    }
    this.cam.update(dt, this.player.mesh, this.player.flight.afterburner, speedNorm);
    this._updateStreaks(this.player.flight.afterburner, speedNorm);
    this.audio.playEngineSound(this.player.flight.throttle, this.player.flight.afterburner, !this.player.flight.grounded);
    this.audio.updateMusic(raw, true);
    this.stats.time += dt;
    this._updateHud(objs);
    this._updateRadar();

    if (this.missiles.incoming) {
      this.warnCd -= dt;
      if (this.warnCd <= 0) {
        this.audio.playWarningSound();
        this.warnCd = 0.85;
      }
    }
  }

  _combat(dt) {
    this.gunCd = Math.max(0, this.gunCd - dt);
    if (this.input.fire && this.gunCd <= 0) {
      if (this.guns.tryFire(this.player.mesh, 'player', this.player.def.gunDamage, 9)) {
        this.audio.playGunSound();
        this.gunCd = 0.065;
      }
    }
    if (this.input.missile) {
      this.input.missile = false;
      this._fireMissile();
    }
  }

  _fireMissile() {
    if (this.player.missiles <= 0) {
      this.hud.toast('NO MISSILES');
      return;
    }
    if (!this.player.locked || !this.player.target || !this.player.target.alive) {
      this.hud.toast('NO LOCK');
      return;
    }
    if (this.missiles.launch(this.player.mesh, this.player.target, 'player', 62, 2.1)) {
      this.player.missiles--;
      this.stats.missilesFired++;
    }
  }

  _targeting(dt) {
    const alive = this.enemies.alive();
    if (this.player.target && !this.player.target.alive) {
      this.player.target = alive[0] || null;
      this.player.locked = false;
      this.player.lockTimer = 0;
      this.lockArmed = false;
    }
    if (!this.player.target && alive.length) {
      alive.sort((a, b) => a.position.distanceToSquared(this.player.position) - b.position.distanceToSquared(this.player.position));
      this.player.target = alive[0];
    }
    const t = this.player.target;
    if (!t) {
      this.player.locked = false;
      return;
    }
    _fwd.set(0, 0, 1).applyQuaternion(this.player.mesh.quaternion);
    _to.copy(t.position).sub(this.player.position);
    const dist = _to.length();
    _to.multiplyScalar(1 / Math.max(dist, 0.001));
    const ang = Math.acos(THREE.MathUtils.clamp(_fwd.dot(_to), -1, 1));
    const inCone = ang < 0.42 && dist < 2600 && dist > 40;
    if (inCone) {
      this.player.lockTimer += dt;
      if (this.player.lockTimer > 1.15) {
        if (!this.player.locked) this.audio.playLockSound();
        this.player.locked = true;
      }
    } else {
      this.player.lockTimer = Math.max(0, this.player.lockTimer - dt * 1.4);
      if (this.player.lockTimer <= 0) this.player.locked = false;
    }
  }

  _waves() {
    const waves = this.mission.extraWaves();
    if (!waves.length) return;
    if (this.waveQueued >= waves.length) return;
    let spawned = this.missionDef.enemies.length;
    for (let i = 0; i < this.waveQueued; i++) spawned += waves[i].length;
    if (this.mission.kills >= spawned) {
      for (const e of waves[this.waveQueued]) this._spawnEnemy(e.type, new THREE.Vector3(...e.pos));
      this.waveQueued++;
      this.hud.toast('NEW CONTACTS');
    }
  }

  _onKill(enemy) {
    this.stats.kills++;
    this.save.kills = (this.save.kills || 0) + 1;
    this.mission.onKill(enemy);
    this.cam.addShake(0.55);
    this.slowMo = 0.32;
    this.hud.flash(0.28);
    this.audio.playExplosionSound();
    this._award(enemy.score, `TARGET DESTROYED  +${enemy.score} XP`);
  }

  _award(xp, text) {
    this.xpSession += xp;
    this.stats.xp += xp;
    this.save.xp += xp;
    this.hud.toast(text);
  }

  _destroyPlayer() {
    if (!this.player.alive && this.mode !== 'PLAYING') return;
    if (this.player.alive) {
      this.player.alive = false;
      this.player.health = 0;
      this.explosions.explode(this.player.position.clone(), 1.8, true);
      this.player.mesh.visible = false;
      this.audio.playExplosionSound();
      this.cam.addShake(0.9);
      this.hud.toast('AIRCRAFT DESTROYED');
      setTimeout(() => this._fail('AIRCRAFT DESTROYED'), 1200);
    }
  }

  _complete() {
    if (this.mode !== 'PLAYING') return;
    this.mode = 'MISSION_COMPLETE';
    this.desktop.setEnabled(false);
    this._award(this.missionDef.xp, 'MISSION COMPLETE');
    this.onState('MISSION_COMPLETE', { def: this.missionDef, stats: this.stats, xp: this.xpSession });
  }

  _fail(reason) {
    if (this.mode !== 'PLAYING') return;
    this.mode = 'MISSION_FAILED';
    this.desktop.setEnabled(false);
    this.onState('MISSION_FAILED', { def: this.missionDef, stats: this.stats, reason });
  }

  _updateHud(objs) {
    const p = this.player;
    _euler.setFromQuaternion(p.mesh.quaternion, 'YXZ');
    let lockScreen = null;
    let lockState = '';
    if (p.target && p.target.alive) {
      lockScreen = projectToScreen(p.target.position, this.camera, this.canvas);
      if (lockScreen && (lockScreen.x < 0 || lockScreen.y < 0 || lockScreen.x > this.canvas.clientWidth || lockScreen.y > this.canvas.clientHeight)) lockScreen = null;
      lockState = p.locked ? 'LOCKED' : (p.lockTimer > 0.2 ? 'LOCKING' : '');
    }
    const nav = this.mission.currentNav() || (p.target ? p.target.position : null);
    let navAngle = null;
    if (nav) {
      const dx = nav.x - p.position.x;
      const dz = nav.z - p.position.z;
      const bearing = Math.atan2(dx, dz);
      const hdg = THREE.MathUtils.degToRad(p.heading);
      navAngle = THREE.MathUtils.radToDeg(bearing - hdg);
    }
    const t = p.target && p.target.alive ? {
      name: p.target.name,
      dist: p.position.distanceTo(p.target.position),
      alt: p.target.position.y,
      speed: p.target.speed,
      hp: p.target.health / p.target.maxHealth
    } : null;

    this.hud.update(0, {
      showHud: this.settings.showHud,
      speedKmh: p.flight.speed * 3.6,
      alt: Math.max(0, p.position.y),
      heading: p.heading,
      throttle: p.flight.throttle,
      hp: p.health / p.maxHealth,
      boost: p.flight.boostEnergy,
      fuel: p.flight.fuel,
      missiles: p.missiles,
      camera: this.cam.mode,
      look: this.cam.lookActive,
      afterburner: p.flight.afterburner,
      missionName: this.missionDef.name,
      tod: this.missionDef.tod,
      xp: this.save.xp,
      incoming: this.missiles.incoming,
      target: t,
      lockState,
      lockScreen,
      objectives: objs,
      navAngle,
      pitch: _euler.x,
      roll: _euler.z
    });
  }

  _updateRadar() {
    this.radar.update(0.016, {
      x: this.player.position.x,
      z: this.player.position.z,
      heading: this.player.heading,
      enemies: this.enemies.alive().map((e) => ({ x: e.position.x, z: e.position.z })),
      missiles: this.missiles.active.map((m) => ({ x: m.mesh.position.x, z: m.mesh.position.z })),
      objectives: this.mission.checkpoints.filter((c) => !c.done).map((c) => ({ x: c.pos.x, z: c.pos.z }))
        .concat(this.mission.def.intercept ? [{ x: this.mission.def.zone[0], z: this.mission.def.zone[2] }] : [])
    });
  }

  _updateStreaks(ab, speedNorm) {
    const show = ab || speedNorm > 0.85;
    for (const s of this.streaks) {
      s.material.opacity = show ? 0.18 + Math.random() * 0.25 : 0;
      if (show) s.position.z = -4 - Math.random() * 18;
    }
  }

  resize() {
    const w = window.innerWidth;
    const h = Math.max(1, window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }
}
