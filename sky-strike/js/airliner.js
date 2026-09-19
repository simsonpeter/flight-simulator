import * as THREE from 'three';
import { createCharacterMesh, poseSeated, poseIdle } from './character.js';

function metal(color, extras = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: extras.metalness ?? 0.55,
    roughness: extras.roughness ?? 0.3
  });
}

export function createAirliner() {
  const g = new THREE.Group();
  const body = metal(0xe8eef4, { metalness: 0.45, roughness: 0.28 });
  const stripe = metal(0x2266aa);
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.25, 18, 16, 1, false), body);
  fuse.rotation.x = Math.PI / 2;
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.25, 12, 10), body);
  nose.position.z = 9.2;
  nose.scale.z = 1.4;
  const tailcone = new THREE.Mesh(new THREE.ConeGeometry(1.25, 3.2, 12), body);
  tailcone.rotation.x = -Math.PI / 2;
  tailcone.position.z = -10.4;
  g.add(fuse, nose, tailcone);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(16, 0.18, 3.2), body);
  wing.position.set(0, -0.3, 0.4);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.14, 1.4), body);
  stab.position.set(0, 0.2, -9.4);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.2, 1.8), stripe);
  fin.position.set(0, 2.0, -9.6);
  g.add(wing, stab, fin);

  const engineM = metal(0x8899aa, { metalness: 0.7 });
  [-4.2, 4.2].forEach((x) => {
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.5, 2.4, 10), engineM);
    eng.rotation.x = Math.PI / 2;
    eng.position.set(x, -0.85, 0.2);
    g.add(eng);
  });

  const band = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 14), new THREE.MeshBasicMaterial({ color: 0x2266aa }));
  band.position.set(1.32, 0.15, 0);
  g.add(band);
  return g;
}

function makeSeat(color = 0x2a3a55) {
  const g = new THREE.Group();
  const m = metal(color, { metalness: 0.1, roughness: 0.7 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.52), m);
  base.position.y = 0.32;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.7, 0.1), m);
  back.position.set(0, 0.7, -0.22);
  g.add(base, back);
  return g;
}

export class PassengerFlight {
  constructor(scene, camera, audio, character, friend) {
    this.scene = scene;
    this.camera = camera;
    this.audio = audio;
    this.character = character;
    this.friend = friend;
    this.t = 0;
    this.duration = 36;
    this.landed = false;
    this.cabin = null;
    this.you = null;
    this.buddy = null;
    this.airliner = null;
    this._look = 0;
  }

  build() {
    this.scene.background = new THREE.Color(0x7eb6e0);
    this.scene.fog = new THREE.Fog(0x9ec8e8, 40, 280);
    this.scene.add(new THREE.HemisphereLight(0xdeeeff, 0x6a7a50, 1.05));
    const sun = new THREE.DirectionalLight(0xfff3d4, 1.25);
    sun.position.set(40, 80, -20);
    this.scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2400, 4000),
      new THREE.MeshStandardMaterial({ color: 0x4d7a3c, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -70;
    this.scene.add(ground);
    this.ground = ground;

    const cloudM = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
    this.clouds = [];
    for (let i = 0; i < 18; i++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(6 + Math.random() * 5, 8, 6), cloudM);
      c.position.set((Math.random() - 0.5) * 160, -8 - Math.random() * 16, -40 - i * 22);
      c.scale.set(1.6, 0.55, 1.1);
      this.scene.add(c);
      this.clouds.push(c);
    }

    this.cabin = new THREE.Group();
    const wall = metal(0xe8edf2, { metalness: 0.1, roughness: 0.55 });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.08, 9), metal(0x5a4638, { roughness: 0.8, metalness: 0.05 }));
    floor.position.y = 0;
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.08, 9), wall);
    ceil.position.y = 2.15;
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.15, 9), wall);
    left.position.set(-1.6, 1.07, 0);
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.15, 9), wall);
    right.position.set(1.6, 1.07, 0);
    this.cabin.add(floor, ceil, left, right);

    const winM = new THREE.MeshStandardMaterial({
      color: 0x88c8ff, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.35
    });
    for (let i = 0; i < 6; i++) {
      const z = -3.2 + i * 1.35;
      const w = new THREE.Mesh(new THREE.CircleGeometry(0.18, 12), winM);
      w.position.set(-1.55, 1.25, z);
      w.rotation.y = Math.PI / 2;
      this.cabin.add(w);
      const frame = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.22, 12), metal(0x334455));
      frame.position.copy(w.position);
      frame.rotation.y = Math.PI / 2;
      this.cabin.add(frame);
    }

    for (let i = 0; i < 5; i++) {
      const rowZ = -3 + i * 1.4;
      const s1 = makeSeat(0x1f4f8a);
      s1.position.set(-0.95, 0, rowZ);
      const s2 = makeSeat(0x1f4f8a);
      s2.position.set(-0.38, 0, rowZ);
      const s3 = makeSeat(0x1f4f8a);
      s3.position.set(0.45, 0, rowZ);
      const s4 = makeSeat(0x1f4f8a);
      s4.position.set(1.02, 0, rowZ);
      this.cabin.add(s1, s2, s3, s4);
    }

    this.you = createCharacterMesh(this.character.id);
    poseSeated(this.you);
    this.you.position.set(-0.95, 0.02, 0.05);
    this.you.rotation.y = Math.PI;
    this.cabin.add(this.you);

    this.buddy = createCharacterMesh(this.friend.id);
    poseSeated(this.buddy);
    this.buddy.position.set(-0.38, 0.02, 0.05);
    this.buddy.rotation.y = Math.PI;
    this.cabin.add(this.buddy);

    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.28), metal(0xcfcfc8, { metalness: 0.3 }));
    tray.position.set(-0.95, 0.72, 0.35);
    this.cabin.add(tray);

    this.cabin.position.set(0, 0, 0);
    this.scene.add(this.cabin);

    this.airliner = createAirliner();
    this.airliner.scale.setScalar(0.35);
    this.airliner.position.set(18, -6, -12);
    this.scene.add(this.airliner);

    const wing = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 2.2), metal(0xdde4ec));
    wing.position.set(-6.2, -0.4, 1.2);
    this.scene.add(wing);
    this.wing = wing;
  }

  update(dt, input) {
    this.t += dt;
    this._look += ((input.roll || 0) * 0.45 - this._look) * dt * 3;
    poseIdle(this.you, this.t);
    poseSeated(this.you);
    poseSeated(this.buddy);
    this.buddy.userData.head.rotation.y = Math.sin(this.t * 0.4) * 0.2;

    this.ground.position.z = -70 + this.t * 18;
    this.clouds.forEach((c, i) => {
      c.position.z += dt * 14;
      if (c.position.z > 20) c.position.z = -220 - i * 8;
    });
    this.airliner.position.x = 16 + Math.sin(this.t * 0.3) * 2;
    this.airliner.position.z = -10 - this.t * 0.4;
    this.airliner.rotation.z = Math.sin(this.t * 0.5) * 0.04;

    const shake = Math.sin(this.t * 2.2) * 0.015;
    this.camera.position.set(-0.05, 1.38 + shake, -1.25);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(-0.95, 1.12, 0.15);

    if (this.audio) this.audio.playEngineSound(0.45, false, true);

    if (this.t >= this.duration || ((input.interact || input.fire) && this.t > 4)) {
      this.landed = true;
      return 'landed';
    }
    return 'ok';
  }

  hud() {
    const p = Math.min(1, this.t / this.duration);
    let loc = 'KEULEN';
    if (p > 0.22) loc = 'AACHEN';
    if (p > 0.48) loc = 'GRENS DE / BE';
    if (p > 0.72) loc = 'BELGIË · BRUSSEL';
    return {
      badge: 'VLUCHT SN 182',
      loc,
      money: null,
      obj: p < 0.95
        ? `Zitplaats 12A · ${this.character.name} vliegt naar België`
        : 'Landing in Brussel…',
      prompt: this.t > 4 ? { key: 'E', text: 'Sla over · land in België' } : null,
      progress: p
    };
  }
}
