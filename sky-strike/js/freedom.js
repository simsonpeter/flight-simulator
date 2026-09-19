import * as THREE from 'three';
import { createCharacterMesh, PersonMover, followCam, poseWalk, poseIdle, poseSeated, recolorTop } from './character.js';
import { createTeslaModelX, createChaseCar } from './drive.js';
import { tr } from './i18n.js';

function std(color, extras = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: extras.roughness ?? 0.78,
    metalness: extras.metalness ?? 0.08
  });
}

export const HOUSES = [
  { id: 'studio', nameKey: 'houseStudio', price: 1800, x: -42, z: 38, color: 0xb08a78 },
  { id: 'rijhuis', nameKey: 'houseTown', price: 3500, x: 48, z: -18, color: 0xc45c3a },
  { id: 'villa', nameKey: 'houseVilla', price: 6200, x: -8, z: 78, color: 0xd8c4a0 }
];

export const SHOP_ITEMS = [
  { id: 'outfit', nameKey: 'itemOutfit', price: 90, kind: 'clothes' },
  { id: 'sport', nameKey: 'itemSport', price: 950, kind: 'car' }
];

function aabb(x, z, w, d, list) {
  list.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
}

function makeLabel(text, color = '#7dffd4') {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(4, 12, 10, 0.82)';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, 500, 116);
  ctx.fillStyle = color;
  ctx.font = 'bold 52px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(6.2, 1.55),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  return mesh;
}

function makeBeacon(x, z, color, label) {
  const g = new THREE.Group();
  const col = new THREE.Color(color);
  const glow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 1.1, 9, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
  );
  glow.position.y = 4.5;
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 10, 8),
    new THREE.MeshBasicMaterial({ color: col })
  );
  core.position.y = 7.2;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.3, 1.7, 20),
    new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  const sign = makeLabel(label, '#' + col.getHexString());
  sign.position.y = 8.4;
  g.add(glow, core, ring, sign);
  g.position.set(x, 0, z);
  g.userData = { core, glow, sign };
  return g;
}

export class FreedomCity {
  constructor(scene, camera, audio, character, friend, save) {
    this.scene = scene;
    this.camera = camera;
    this.audio = audio;
    this.character = character;
    this.friend = friend;
    this.save = save;
    this.colliders = [];
    this.time = 0;
    this.player = null;
    this.mover = null;
    this.friendMesh = null;
    this.car = null;
    this.cars = [];
    this.npcs = [];
    this.markers = [];
    this.job = null;
    this.prompt = null;
    this.wanted = 0;
    this.interior = null;
    this.inHouse = false;
    this.toast = '';
    this.toastT = 0;
  }

  build() {
    if (this.save.money == null) this.save.money = 320;
    if (!this.save.ownedHouses) this.save.ownedHouses = [];
    if (!this.save.ownedCar) this.save.ownedCar = null;
    this.save.freedomUnlocked = true;

    this.scene.background = new THREE.Color(0x8fb4d0);
    this.scene.fog = new THREE.Fog(0x8fb4d0, 90, 380);
    this.scene.add(new THREE.HemisphereLight(0xd8ecff, 0x445544, 0.95));
    const sun = new THREE.DirectionalLight(0xfff1d0, 1.15);
    sun.position.set(60, 90, 30);
    this.scene.add(sun);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), std(0x3f6b38, { roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    this._roads();
    this._blocks();
    this._houses();
    this._landmarks();
    this._parkedCars();
    this._npcs();
    this._jobs();

    this.player = createCharacterMesh(this.character.id);
    this.mover = new PersonMover(this.player);
    this.mover.setPosition(0, -8, 0);
    this.scene.add(this.player);
    this.camera.position.set(0, 2.6, -14.5);
    this.camera.lookAt(0, 1.2, -8);

    this.friendMesh = createCharacterMesh(this.friend.id);
    this.friendMesh.position.set(1.4, 0, -10);
    this.scene.add(this.friendMesh);

    this._say(tr('toastJobs'));
  }

  _roads() {
    const asphalt = std(0x2c2f34, { roughness: 0.92 });
    const paint = new THREE.MeshBasicMaterial({ color: 0xe8e8dc });
    for (let i = -3; i <= 3; i++) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(420, 0.12, 10), asphalt);
      h.position.set(0, 0.06, i * 36);
      const v = new THREE.Mesh(new THREE.BoxGeometry(10, 0.12, 420), asphalt);
      v.position.set(i * 36, 0.06, 0);
      this.scene.add(h, v);
    }
    for (let z = -180; z < 180; z += 8) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.14, 3.2), paint);
      s.position.set(0, 0.14, z);
      this.scene.add(s);
    }
  }

  _blocks() {
    const palettes = [0x8a6a55, 0xb56a4a, 0xcfc6b8, 0x6a7a88, 0x9a5a48, 0xd0c8bc];
    for (let gx = -3; gx <= 2; gx++) {
      for (let gz = -3; gz <= 2; gz++) {
        if (gx === 0 && gz === 0) continue;
        const cx = gx * 36 + 18;
        const cz = gz * 36 + 18;
        if (Math.abs(cx) < 8 || Math.abs(cz) < 8) continue;
        const w = 18 + (gx & 1) * 4;
        const d = 16 + (gz & 1) * 5;
        const h = 8 + ((gx + gz + 9) % 5) * 3.2;
        const b = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, d),
          std(palettes[(gx + gz + 8) % palettes.length])
        );
        b.position.set(cx, h / 2, cz);
        this.scene.add(b);
        aabb(cx, cz, w, d, this.colliders);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.3, d + 0.4), std(0x3a3330));
        roof.position.set(cx, h + 0.15, cz);
        this.scene.add(roof);
      }
    }
  }

  _houses() {
    HOUSES.forEach((h) => {
      const owned = this.save.ownedHouses.includes(h.id);
      const body = new THREE.Mesh(new THREE.BoxGeometry(10, 7, 9), std(owned ? 0x3d8f6e : h.color));
      body.position.set(h.x, 3.5, h.z);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(8, 3.2, 4), std(0x5a3030));
      roof.position.set(h.x, 8.6, h.z);
      roof.rotation.y = Math.PI / 4;
      this.scene.add(body, roof);
      aabb(h.x, h.z, 10, 9, this.colliders);
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.2), std(owned ? 0xe7c36a : 0x222));
      door.position.set(h.x, 1.2, h.z + 4.6);
      this.scene.add(door);
      h.mesh = body;
      h.door = door;
    });
  }

  _landmarks() {
    const hall = new THREE.Mesh(new THREE.BoxGeometry(22, 14, 16), std(0xd8d2c6, { metalness: 0.2 }));
    hall.position.set(0, 7, 72);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(2.2, 10, 4), std(0xb8b0a4));
    spire.position.set(0, 19, 72);
    this.scene.add(hall, spire);
    aabb(0, 72, 22, 16, this.colliders);

    const shop = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 10), std(0x2266aa));
    shop.position.set(36, 2.5, 0);
    this.scene.add(shop);
    aabb(36, 0, 12, 10, this.colliders);
    this.shopPos = new THREE.Vector3(36, 0, 8);

    const bank = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 10), std(0xe7c36a));
    bank.position.set(-36, 3, 0);
    this.scene.add(bank);
    aabb(-36, 0, 10, 10, this.colliders);
    this.atmPos = new THREE.Vector3(-36, 0, 8);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6, 6), std(0x444));
    pole.position.set(4, 3, -4);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 0.05), new THREE.MeshBasicMaterial({ color: 0xf5d76e }));
    flag.position.set(5, 5.4, -4);
    const flagK = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 0.06), new THREE.MeshBasicMaterial({ color: 0x111 }));
    flagK.position.set(4.4, 5.4, -4);
    const flagR = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 0.06), new THREE.MeshBasicMaterial({ color: 0xdd2222 }));
    flagR.position.set(5.6, 5.4, -4);
    this.scene.add(pole, flag, flagK, flagR);
  }

  _parkedCars() {
    const spots = [
      [8, -20, 0], [-10, 16, Math.PI], [20, 8, Math.PI / 2], [-24, -28, 0],
      [12, 40, Math.PI], [44, -36, -Math.PI / 2]
    ];
    spots.forEach((s, i) => {
      const mesh = i === 0 && this.save.ownedCar === 'tesla'
        ? createTeslaModelX(0xece7dc)
        : createChaseCar(i % 2 ? 0x2a3344 : 0x8a3030);
      mesh.position.set(s[0], 0.15, s[1]);
      mesh.rotation.y = s[2];
      this.scene.add(mesh);
      this.cars.push({ mesh, yaw: s[2], taken: false, speed: 0 });
    });
    if (this.save.ownedCar === 'sport') {
      const sport = createChaseCar(0xc43c32);
      sport.position.set(2, 0.15, -12);
      this.scene.add(sport);
      this.cars.push({ mesh: sport, yaw: 0, taken: false, speed: 0, owned: true });
    }
  }

  _npcs() {
    const ids = ['daan', 'yara', 'finn', 'kai', 'nora'];
    for (let i = 0; i < 10; i++) {
      const mesh = createCharacterMesh(ids[i % ids.length]);
      const lane = i % 2 ? 6.2 : -6.2;
      mesh.position.set(lane + (i % 3) * 36 - 36, 0, (i * 17) % 80 - 40);
      this.scene.add(mesh);
      this.npcs.push({
        mesh,
        yaw: i % 2 ? 0 : Math.PI,
        wait: Math.random() * 4,
        speed: 1.4 + Math.random()
      });
    }
  }

  _jobs() {
    this.markers = [
      { id: 'post', nameKey: 'jobPost', pay: 160, x: 0, z: 10, phase: 'offer', drop: { x: -54, z: 0 } },
      { id: 'taxi', nameKey: 'jobTaxi', pay: 240, x: -14, z: 6, phase: 'offer', drop: { x: 54, z: -36 } },
      { id: 'klus', nameKey: 'jobOdd', pay: 110, x: 14, z: 8, phase: 'offer', drop: null }
    ];
    this.markers.forEach((m) => {
      m.name = tr(m.nameKey);
      const beacon = makeBeacon(m.x, m.z, 0x7dffd4, `JOB  €${m.pay}`);
      this.scene.add(beacon);
      m.beacon = beacon;
      m.lamp = beacon.userData.core;
    });
  }

  _say(text) {
    this.toast = text;
    this.toastT = 6.5;
  }

  _near(x, z, r = 3.2) {
    const p = this.player.position;
    return Math.hypot(p.x - x, p.z - z) < r;
  }

  _pressed(input) {
    const down = !!(input.interact || input.fire);
    const edge = down && !this._actHeld;
    this._actHeld = down;
    if (input.interact) input.interact = false;
    return edge;
  }

  _enterCar(entry, input) {
    if (!this._pressed(input)) return;
    this.car = entry;
    entry.taken = true;
    this.mover.inCar = true;
    this.player.visible = false;
    poseSeated(this.player);
    this._say(tr('carHint'));
  }

  _exitCar() {
    if (!this.car) return;
    const m = this.car.mesh;
    this.player.position.set(m.position.x + 1.6, 0, m.position.z);
    this.mover.yaw = this.car.yaw;
    this.player.rotation.y = this.car.yaw;
    this.player.visible = true;
    this.mover.inCar = false;
    this.car.taken = false;
    this.car = null;
  }

  _drive(dt, input) {
    const c = this.car;
    const accel = (input.throttle > 0 || input.pitch > 0.15) ? 1 : (input.throttle < 0 || input.pitch < -0.2 ? -0.6 : 0);
    const brake = input.airbrake;
    const boost = input.afterburner;
    const target = brake ? 0 : (accel * 18 + (boost ? 10 : 0));
    c.speed += (target - c.speed) * Math.min(1, dt * 2.2);
    c.yaw -= (input.roll || 0) * dt * (1.1 + Math.abs(c.speed) * 0.04);
    const nx = c.mesh.position.x + Math.sin(c.yaw) * c.speed * dt;
    const nz = c.mesh.position.z + Math.cos(c.yaw) * c.speed * dt;
    if (!this._carHit(nx, nz)) {
      c.mesh.position.x = nx;
      c.mesh.position.z = nz;
    } else {
      c.speed *= -0.2;
      this.wanted = Math.min(3, this.wanted + 0.35);
    }
    c.mesh.rotation.y = c.yaw;
    c.mesh.rotation.z = THREE.MathUtils.clamp(-(input.roll || 0) * 0.08, -0.16, 0.16);
    this.player.position.copy(c.mesh.position);
    this.mover.yaw = c.yaw;
    if (this.audio) this.audio.playEngineSound(Math.min(1, Math.abs(c.speed) / 22), !!boost, true);
    followCam(this.camera, c.mesh.position, c.yaw, dt, { dist: 8.5, height: 3.6, lookY: 1.1 });
  }

  _carHit(x, z) {
    return this.colliders.some((c) => x > c.minX - 1.4 && x < c.maxX + 1.4 && z > c.minZ - 2.2 && z < c.maxZ + 2.2);
  }

  update(dt, input) {
    this.time += dt;
    this.toastT = Math.max(0, this.toastT - dt);
    this.wanted = Math.max(0, this.wanted - dt * 0.12);
    this.prompt = null;

    this.npcs.forEach((n, i) => {
      n.wait -= dt;
      if (n.wait < 0) {
        n.mesh.position.x += Math.sin(n.yaw) * n.speed * dt;
        n.mesh.position.z += Math.cos(n.yaw) * n.speed * dt;
        if (Math.abs(n.mesh.position.x) > 90 || Math.abs(n.mesh.position.z) > 90) n.yaw += Math.PI;
        poseWalk(n.mesh, this.time + i, n.speed);
      } else poseIdle(n.mesh, this.time + i);
      n.mesh.rotation.y = n.yaw;
    });

    if (this.friendMesh && !this.job) {
      this.friendMesh.position.lerp(new THREE.Vector3(this.player.position.x + 1.2, 0, this.player.position.z - 1.4), dt * 1.6);
      const fdx = this.player.position.x - this.friendMesh.position.x;
      const fdz = this.player.position.z - this.friendMesh.position.z;
      this.friendMesh.rotation.y = Math.atan2(fdx, fdz);
      poseWalk(this.friendMesh, this.time, 2);
    }

    if (this.inHouse) {
      this._updateHouse(dt, input);
      return 'ok';
    }

    if (this.car) {
      this._drive(dt, input);
      this._jobTick(dt);
      this.tryDeliver(input);
      if (!(this.job?.phase === 'drop' && this.job.drop && this._near(this.job.drop.x, this.job.drop.z, 4.2))) {
        this.prompt = this.prompt || { key: 'E', text: tr('exitCar') };
        if (this._pressed(input)) this._exitCar();
      }
      return 'ok';
    }

    this.mover.update(dt, input, this.colliders, this.time);
    followCam(this.camera, this.player.position, this.mover.yaw, dt);
    this._pulseBeacons(dt);

    this._interactWorld(input);
    this._jobTick(dt);
    this.tryDeliver(input);

    if (!this.prompt) {
      const parked = this.cars.find((c) => !c.taken && this._near(c.mesh.position.x, c.mesh.position.z, 3.4));
      if (parked) {
        this.prompt = { key: 'E', text: tr('enterCar') };
        this._enterCar(parked, input);
      }
    }
    return 'ok';
  }

  _interactWorld(input) {
    for (const m of this.markers) {
      if (m.phase !== 'offer' && m.phase !== 'pick') continue;
      if (!this._near(m.x, m.z, 7.5)) continue;
      if (this.job && this.job.id !== m.id) continue;
      this.prompt = {
        key: 'E',
        job: true,
        text: tr('startJob', { name: tr(m.nameKey || 'jobPost'), pay: m.pay })
      };
      if (this._pressed(input)) this._startJob(m);
      return;
    }

    for (const h of HOUSES) {
      if (!this._near(h.x, h.z + 5.2, 3.4)) continue;
      const owned = this.save.ownedHouses.includes(h.id);
      if (owned) {
        this.prompt = { key: 'E', text: tr('enterHouse', { name: tr(h.nameKey) }) };
        if (this._pressed(input)) this._openHouse(h);
      } else {
        this.prompt = { key: 'E', text: tr('buyHouse', { name: tr(h.nameKey), price: h.price }) };
        if (this._pressed(input)) this._buyHouse(h);
      }
      return;
    }

    if (this._near(this.shopPos.x, this.shopPos.z, 3.5)) {
      const item = this.save.ownedCar === 'sport' ? SHOP_ITEMS[0] : SHOP_ITEMS[1];
      this.prompt = { key: 'E', text: tr('shopBuy', { name: tr(item.nameKey), price: item.price }) };
      if (this._pressed(input)) this._buyItem(item);
      return;
    }

    if (this._near(this.atmPos.x, this.atmPos.z, 3.2)) {
      this.prompt = { key: 'E', text: tr('atm') };
      if (this._pressed(input)) {
        this.save.money += 40;
        this._say('+€40');
        if (this.audio) this.audio.playLockSound();
      }
      return;
    }
  }

  _startJob(m) {
    this.job = { ...m, phase: m.drop ? 'drop' : 'work', work: 0 };
    m.phase = 'busy';
    if (m.beacon && m.drop) m.beacon.visible = false;
    if (m.drop) {
      const mark = makeBeacon(m.drop.x, m.drop.z, 0xe7c36a, 'HIER  AFLEVEREN');
      this.scene.add(mark);
      this.job.dropMesh = mark;
    }
    this._say(m.drop
      ? tr('jobStartDrop', { name: tr(m.nameKey) })
      : tr('jobStartWork', { name: tr(m.nameKey) }));
    if (this.audio) this.audio.playLockSound();
  }

  _pulseBeacons(dt) {
    const pulse = 0.55 + Math.sin(this.time * 3.2) * 0.35;
    this.markers.forEach((m) => {
      if (!m.beacon || !m.beacon.visible) return;
      const s = m.beacon.userData;
      if (s.core) s.core.scale.setScalar(0.85 + pulse * 0.4);
      if (s.glow) s.glow.material.opacity = 0.18 + pulse * 0.22;
      if (s.sign) {
        s.sign.quaternion.copy(this.camera.quaternion);
        s.sign.position.y = 8.4 + Math.sin(this.time * 2) * 0.15;
      }
    });
    if (this.job?.dropMesh?.userData?.sign) {
      this.job.dropMesh.userData.sign.quaternion.copy(this.camera.quaternion);
    }
  }

  _jobTick(dt = 0.016) {
    if (!this.job) return;
    const j = this.job;
    if (j.phase === 'drop' && j.drop) {
      if (this._near(j.drop.x, j.drop.z, 8)) {
        this.prompt = { key: 'E', job: true, text: tr('deliverJob', { name: tr(j.nameKey), pay: j.pay }) };
      }
    }
    if (j.phase === 'work') {
      if (this._near(j.x, j.z, 6)) {
        j.work += dt;
        this.prompt = { key: '…', job: true, text: tr('workingJob', { name: tr(j.nameKey), pct: Math.min(100, Math.round((j.work / 4) * 100)) }) };
        if (j.work > 4) this._finishJob();
      }
    }
  }

  tryDeliver(input) {
    if (!this.job || this.job.phase !== 'drop' || !this.job.drop) return;
    if (this._near(this.job.drop.x, this.job.drop.z, 8) && this._pressed(input)) this._finishJob();
  }

  _finishJob() {
    const pay = this.job.pay;
    this.save.money += pay;
    this._say(tr('jobDone', { name: tr(this.job.nameKey), pay }));
    const src = this.markers.find((m) => m.id === this.job.id);
    if (this.job.dropMesh) this.scene.remove(this.job.dropMesh);
    if (src) {
      src.phase = 'offer';
      if (src.beacon) src.beacon.visible = true;
    }
    this.job = null;
    if (this.audio) this.audio.playLockSound();
  }

  _buyHouse(h) {
    if (this.save.money < h.price) {
      this._say(tr('noMoney'));
      return;
    }
    this.save.money -= h.price;
    this.save.ownedHouses.push(h.id);
    h.mesh.material = std(0x3d8f6e);
    h.door.material = std(0xe7c36a);
    this._say(tr('boughtHouse', { name: tr(h.nameKey) }));
    if (this.audio) this.audio.playLockSound();
  }

  _buyItem(item) {
    if (this.save.money < item.price) {
      this._say(tr('tooExpensive'));
      return;
    }
    this.save.money -= item.price;
    if (item.kind === 'clothes') {
      const colors = [0xff7a6a, 0x7dffd4, 0x4aa3ff, 0xe7c36a];
      recolorTop(this.player, colors[Math.floor(Math.random() * colors.length)]);
      this._say(tr('newOutfit'));
    } else {
      this.save.ownedCar = 'sport';
      const sport = createChaseCar(0xc43c32);
      sport.position.set(this.player.position.x + 3, 0.15, this.player.position.z);
      this.scene.add(sport);
      this.cars.push({ mesh: sport, yaw: this.mover.yaw, taken: false, speed: 0, owned: true });
      this._say(tr('newCar'));
    }
    if (this.audio) this.audio.playLockSound();
  }

  _openHouse(h) {
    this.inHouse = h;
    this.interior = new THREE.Group();
    const wallM = std(0xe8dcc8);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(10, 0.1, 8), std(0x6a4430));
    const back = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 0.16), wallM);
    back.position.set(0, 2, -4);
    const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4, 8), wallM);
    sideL.position.set(-5, 2, 0);
    const sideR = sideL.clone();
    sideR.position.x = 5;
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(10, 0.12, 8), std(0xf2ece0));
    ceil.position.y = 4;
    const sofa = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 1.2), std(0x3d6a38));
    sofa.position.set(-2, 0.4, -2);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 3.4), std(0x4aa3ff));
    bed.position.set(2.4, 0.3, 1);
    this.interior.add(floor, back, sideL, sideR, ceil, sofa, bed);
    this.interior.position.set(h.x, 0.2, h.z);
    this.scene.add(this.interior);
    this.player.position.set(h.x, 0, h.z);
    this._say(tr('homeHint'));
  }

  _updateHouse(dt, input) {
    poseIdle(this.player, this.time);
    this.camera.position.lerp(new THREE.Vector3(this.inHouse.x, 3.2, this.inHouse.z + 5.5), 1 - Math.exp(-6 * dt));
    this.camera.lookAt(this.inHouse.x, 1.2, this.inHouse.z);
    this.prompt = { key: 'E', text: tr('goOutside') };
    if (this._pressed(input)) {
      this.scene.remove(this.interior);
      this.interior = null;
      this.player.position.set(this.inHouse.x, 0, this.inHouse.z + 7);
      this.inHouse = false;
    }
  }

  hud() {
    const p = this.player.position;
    const yaw = this.mover?.yaw || 0;
    const jobs = this.markers.map((m) => {
      const target = (this.job && this.job.id === m.id && this.job.drop)
        ? this.job.drop
        : { x: m.x, z: m.z };
      const dist = Math.hypot(p.x - target.x, p.z - target.z);
      const active = this.job?.id === m.id;
      return {
        name: tr(m.nameKey),
        dist: active && this.job.phase === 'drop' ? tr('metersDrop', { n: dist.toFixed(0) }) : tr('meters', { n: dist.toFixed(0) }),
        meters: dist,
        active,
        x: target.x,
        z: target.z,
        offer: m.phase === 'offer'
      };
    });

    let nav = this.job?.drop
      ? this.job.drop
      : jobs.filter((j) => j.offer).sort((a, b) => a.meters - b.meters)[0];
    if (this.job?.phase === 'work') nav = { x: this.job.x, z: this.job.z };
    let navAngle = null;
    if (nav && !this.inHouse) {
      const bearing = Math.atan2(nav.x - p.x, nav.z - p.z);
      navAngle = THREE.MathUtils.radToDeg(bearing - yaw);
    }

    let obj = tr('objJobs');
    let jobHint = tr('jobsHint');
    if (this.job) {
      const jn = tr(this.job.nameKey);
      if (this.job.phase === 'drop') {
        obj = tr('objDrop', { name: jn });
        jobHint = tr('jobHintDrop');
      } else {
        obj = tr('objWork', { name: jn });
        jobHint = tr('jobHintWork');
      }
    }
    if (this.job?.phase === 'drop' && this.job.drop && this._near(this.job.drop.x, this.job.drop.z, 8)) {
      this.prompt = this.prompt || { key: 'E', job: true, text: tr('deliverJob', { name: tr(this.job.nameKey), pay: this.job.pay }) };
    }
    return {
      badge: this.wanted > 0.4 ? tr('wanted') : tr('brussels'),
      loc: this.car ? tr('onRoad') : (this.inHouse ? tr('atHome') : tr('freePlay')),
      money: this.save.money || 0,
      obj,
      prompt: this.prompt,
      toast: this.toastT > 0 ? this.toast : '',
      wanted: this.wanted > 0.4,
      jobs,
      jobHint,
      navAngle
    };
  }
}
