import * as THREE from 'three';
import { createCharacterMesh, poseSeated } from './character.js';
import { tr } from './i18n.js';

function metal(color, extras = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: extras.metalness ?? 0.55,
    roughness: extras.roughness ?? 0.28,
    emissive: extras.emissive ?? 0x000000,
    emissiveIntensity: extras.emissiveIntensity ?? 0
  });
}

export function createTeslaModelX(color = 0xf4f1ea) {
  const g = new THREE.Group();
  g.name = 'Tesla Model X';
  const body = metal(color, { metalness: 0.72, roughness: 0.22 });
  const dark = metal(0x111111, { roughness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x88b8d8, metalness: 0.2, roughness: 0.08, transparent: true, opacity: 0.45
  });
  const chrome = metal(0xcfd8e0, { metalness: 0.9, roughness: 0.15 });

  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.72, 4.9), body);
  hull.position.y = 0.72;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.42, 0.7), body);
  nose.position.set(0, 0.58, 2.55);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.7, 2.5), body);
  cabin.position.set(0, 1.28, -0.15);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.06, 2.2), glass);
  roof.position.set(0, 1.66, -0.1);
  g.add(hull, nose, cabin, roof);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 0.08), glass);
  windshield.position.set(0, 1.28, 1.12);
  windshield.rotation.x = -0.42;
  g.add(windshield);

  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  bar.position.set(0, 0.62, 2.92);
  g.add(bar);

  const doorL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 1.15), body);
  doorL.position.set(-1.12, 1.22, 0.15);
  doorL.rotation.z = 0.55;
  const doorR = doorL.clone();
  doorR.position.x = 1.12;
  doorR.rotation.z = -0.55;
  g.add(doorL, doorR);

  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const spots = [[-0.92, 0.38, 1.55], [0.92, 0.38, 1.55], [-0.92, 0.38, -1.55], [0.92, 0.38, -1.55]];
  spots.forEach((p) => {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.position.set(...p);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 10), chrome);
    cap.rotation.z = Math.PI / 2;
    cap.position.set(...p);
    g.add(w, cap);
  });

  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.06), new THREE.MeshBasicMaterial({ color: 0xff2244 }));
  tail.position.set(0, 0.7, -2.48);
  g.add(tail);
  return g;
}

export function createChaseCar(color = 0x1a1a1e) {
  const g = new THREE.Group();
  const body = metal(color, { roughness: 0.45 });
  const dark = metal(0x070707);
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.4), body);
  hull.position.y = 0.62;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 1.8), body);
  cabin.position.set(0, 1.05, -0.2);
  g.add(hull, cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  [[-0.8, 0.32, 1.3], [0.8, 0.32, 1.3], [-0.8, 0.32, -1.3], [0.8, 0.32, -1.3]].forEach((p) => {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.position.set(...p);
    g.add(w);
  });
  const light = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.05), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  light.position.set(0, 0.7, 2.22);
  g.add(light);
  return g;
}

export class DriveChase {
  constructor(scene, camera, audio, character, friend) {
    this.scene = scene;
    this.camera = camera;
    this.audio = audio;
    this.character = character;
    this.friend = friend;
    this.car = null;
    this.thugs = [];
    this.speed = 18;
    this.health = 100;
    this.progress = 0;
    this.goal = 2600;
    this.steer = 0;
    this.shake = 0;
    this.time = 0;
    this.signs = [];
    this.finished = false;
    this.failed = false;
    this.hitCd = 0;
    this._cam = new THREE.Vector3();
    this._look = new THREE.Vector3();
  }

  build() {
    this.scene.background = new THREE.Color(0x87a8c8);
    this.scene.fog = new THREE.Fog(0x87a8c8, 40, 420);
    const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x3a4a30, 0.85);
    const sun = new THREE.DirectionalLight(0xfff2d0, 1.15);
    sun.position.set(80, 140, 60);
    this.scene.add(hemi, sun);

    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 6000),
      new THREE.MeshStandardMaterial({ color: 0x3d6a38, roughness: 1 })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(0, 0, 1400);
    this.scene.add(grass);

    const road = new THREE.Mesh(
      new THREE.BoxGeometry(16, 0.2, 3200),
      new THREE.MeshStandardMaterial({ color: 0x2a2d32, roughness: 0.9 })
    );
    road.position.set(0, 0.1, 1400);
    this.scene.add(road);

    const paint = new THREE.MeshBasicMaterial({ color: 0xf2f2e8 });
    for (let z = 0; z < 3000; z += 18) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 7), paint);
      stripe.position.set(0, 0.16, z);
      this.scene.add(stripe);
    }
    const curb = new THREE.MeshStandardMaterial({ color: 0xcccfd4 });
    [-8.4, 8.4].forEach((x) => {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 3200), curb);
      c.position.set(x, 0.2, 1400);
      this.scene.add(c);
    });

    const treeMat = new THREE.MeshStandardMaterial({ color: 0x2f5a28 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22 });
    for (let i = 0; i < 70; i++) {
      const z = 40 + i * 42;
      [-1, 1].forEach((side) => {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 3.2, 5), trunkMat);
        const crown = new THREE.Mesh(new THREE.ConeGeometry(2.1, 4.4, 6), treeMat);
        const x = side * (14 + (i % 3) * 3);
        trunk.position.set(x, 1.6, z);
        crown.position.set(x, 4.4, z);
        this.scene.add(trunk, crown);
      });
    }

    this._sign('KEULEN', 80, 0xdd2222);
    this._sign('AACHEN  62 km', 700, 0x2266aa);
    this._sign('FLUGHAFEN', 1800, 0x2266aa);
    this._sign('BELGIË  →', 2400, 0xf5d76e);

    this.car = createTeslaModelX(0xece7dc);
    this.car.position.set(0, 0.2, 8);
    this.scene.add(this.car);
    if (this.character) {
      const you = createCharacterMesh(this.character.id, { scale: 0.85 });
      poseSeated(you);
      you.position.set(-0.38, 0.42, 0.35);
      you.rotation.y = Math.PI;
      this.car.add(you);
    }
    if (this.friend) {
      const pal = createCharacterMesh(this.friend.id, { scale: 0.85 });
      poseSeated(pal);
      pal.position.set(0.38, 0.42, 0.35);
      pal.rotation.y = Math.PI;
      this.car.add(pal);
    }

    const lanes = [-4.2, 4.2, 0.4, -2.2];
    for (let i = 0; i < 4; i++) {
      const thug = createChaseCar(i % 2 ? 0x141418 : 0x221014);
      thug.position.set(lanes[i], 0.2, -18 - i * 16);
      this.scene.add(thug);
      this.thugs.push({ mesh: thug, lane: lanes[i], lag: 12 + i * 7, side: i % 2 ? 1 : -1 });
    }

    this._airport();
  }

  _sign(text, z, color) {
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.4, 0.12), new THREE.MeshStandardMaterial({ color: 0x444 }));
    pole.position.set(10.2, 1.7, z);
    const board = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.3, 0.12), new THREE.MeshStandardMaterial({ color }));
    board.position.set(10.2, 3.4, z);
    this.scene.add(pole, board);
    this.signs.push({ z, text });
  }

  _airport() {
    const tarmac = new THREE.Mesh(
      new THREE.BoxGeometry(80, 0.25, 220),
      new THREE.MeshStandardMaterial({ color: 0x33363c, roughness: 0.85 })
    );
    tarmac.position.set(0, 0.12, 2720);
    const hall = new THREE.Mesh(
      new THREE.BoxGeometry(48, 16, 28),
      new THREE.MeshStandardMaterial({ color: 0x8aa0b4, metalness: 0.35, roughness: 0.45 })
    );
    hall.position.set(-28, 8, 2780);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 22, 8), new THREE.MeshStandardMaterial({ color: 0x667788 }));
    tower.position.set(22, 11, 2760);
    this.scene.add(tarmac, hall, tower);
  }

  update(dt, input) {
    if (this.finished || this.failed) return this.failed ? 'fail' : 'win';
    this.time += dt;
    this.hitCd = Math.max(0, this.hitCd - dt);
    this.shake = Math.max(0, this.shake - dt * 3);

    const accel = (input.throttle > 0 || input.pitch > 0.15) ? 1 : (input.throttle < 0 ? -0.4 : 0);
    const brake = input.airbrake || input.pitch < -0.2;
    const boost = input.afterburner;
    const target = brake ? 12 : 22 + (accel > 0 ? 26 : 0) + (boost ? 18 : 0);
    this.speed += (target - this.speed) * Math.min(1, dt * 1.6);
    this.speed = Math.max(8, this.speed);

    this.steer += ((input.roll || 0) * 9 - this.steer) * Math.min(1, dt * 8);
    this.car.position.x = THREE.MathUtils.clamp(this.car.position.x + this.steer * dt, -6.4, 6.4);
    this.car.rotation.y = 0;
    this.car.rotation.z = THREE.MathUtils.clamp(-this.steer * 0.04, -0.18, 0.18);
    this.car.position.z += this.speed * dt;
    this.progress = this.car.position.z;

    this.thugs.forEach((t, i) => {
      const wantX = this.car.position.x + Math.sin(this.time * (1.1 + i * 0.3) + i) * 3.2 * t.side;
      t.mesh.position.x += (wantX - t.mesh.position.x) * dt * 1.5;
      t.mesh.position.x = THREE.MathUtils.clamp(t.mesh.position.x, -6.5, 6.5);
      const wantZ = this.car.position.z - t.lag + Math.sin(this.time * 0.8 + i) * 4;
      t.mesh.position.z += (wantZ - t.mesh.position.z) * dt * 2.2;
      t.mesh.rotation.y = 0;
      const dx = t.mesh.position.x - this.car.position.x;
      const dz = t.mesh.position.z - this.car.position.z;
      if (dx * dx + dz * dz < 10 && this.hitCd <= 0) {
        this.health -= 14;
        this.hitCd = 0.7;
        this.shake = 0.5;
        this.car.position.x += Math.sign(dx || 1) * -0.8;
        if (this.audio) this.audio.playHitSound();
      }
    });

    if (this.health <= 0) {
      this.failed = true;
      return 'fail';
    }
    if (this.progress >= this.goal) {
      this.finished = true;
      return 'win';
    }

    this._cam.set(
      this.car.position.x * 0.35,
      4.2 + this.shake * 0.8,
      this.car.position.z - 9.5
    );
    this._cam.x += (Math.random() - 0.5) * this.shake;
    this.camera.position.lerp(this._cam, 1 - Math.exp(-6 * dt));
    this._look.set(this.car.position.x, 1.2, this.car.position.z + 14);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this._look);
    return 'ok';
  }

  hud() {
    const left = Math.max(0, this.goal - this.progress);
    const km = (left / 1000).toFixed(1);
    let loc = tr('locCologne');
    if (this.progress > 700) loc = tr('locAachen');
    if (this.progress > 1800) loc = tr('locAirport');
    return {
      speed: Math.round(this.speed * 9.2),
      hp: this.health / 100,
      dist: km,
      loc,
      wanted: true,
      progress: this.progress / this.goal
    };
  }
}
