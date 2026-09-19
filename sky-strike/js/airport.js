import * as THREE from 'three';
import { createCharacterMesh, PersonMover, followCam, poseIdle, poseWalk } from './character.js';
import { tr } from './i18n.js';

function std(color, extras = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: extras.roughness ?? 0.7,
    metalness: extras.metalness ?? 0.15
  });
}

function box(w, h, d, mat, x, y, z, colliders) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (colliders) {
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  }
  return m;
}

export class AirportTerminal {
  constructor(scene, camera, audio, character, friend, save) {
    this.scene = scene;
    this.camera = camera;
    this.audio = audio;
    this.character = character;
    this.friend = friend;
    this.save = save;
    this.colliders = [];
    this.player = null;
    this.mover = null;
    this.friendMesh = null;
    this.time = 0;
    this.ticketBought = !!save.ticketBought;
    this.boarded = false;
    this.prompt = null;
  }

  build() {
    this.scene.background = new THREE.Color(0xb9cfe0);
    this.scene.fog = new THREE.Fog(0xb9cfe0, 30, 90);
    this.scene.add(new THREE.HemisphereLight(0xe8f4ff, 0x8899aa, 0.95));
    const sun = new THREE.DirectionalLight(0xfff4dc, 1.1);
    sun.position.set(20, 40, 10);
    this.scene.add(sun);

    const floor = new THREE.Mesh(new THREE.BoxGeometry(28, 0.2, 90), std(0xd8dde4, { roughness: 0.45 }));
    floor.position.set(0, -0.1, 28);
    this.scene.add(floor);

    const glass = new THREE.MeshStandardMaterial({
      color: 0x9ec4e0, metalness: 0.4, roughness: 0.08, transparent: true, opacity: 0.35
    });
    this.scene.add(box(28, 10, 0.4, glass, 0, 5, -8));
    this.scene.add(box(0.4, 10, 90, std(0xcfd8e0), -14, 5, 28, this.colliders));
    this.scene.add(box(0.4, 10, 90, std(0xcfd8e0), 14, 5, 28, this.colliders));
    this.scene.add(box(28, 10, 0.4, std(0xcfd8e0), 0, 5, 72, this.colliders));

    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(28, 0.3, 90), std(0xeef2f6));
    ceiling.position.set(0, 10.2, 28);
    this.scene.add(ceiling);

    for (let i = 0; i < 8; i++) {
      const light = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.5), new THREE.MeshBasicMaterial({ color: 0xffffee }));
      light.position.set((i % 2 ? -5 : 5), 9.7, i * 10);
      this.scene.add(light);
    }

    this.scene.add(box(8, 1.4, 2.4, std(0x2c3a4a), -5, 0.7, 18, this.colliders));
    const deskSign = box(3.2, 0.7, 0.12, std(0x2266aa), -5, 1.7, 16.7);
    this.scene.add(deskSign);
    const clerk = createCharacterMesh('finn');
    clerk.position.set(-5, 0, 19.2);
    clerk.rotation.y = Math.PI;
    this.scene.add(clerk);
    this.clerk = clerk;

    const seatsMat = std(0x3a4a5c);
    for (let i = 0; i < 6; i++) {
      this.scene.add(box(1.1, 0.55, 1.1, seatsMat, 6 + (i % 2) * 1.4, 0.35, 8 + Math.floor(i / 2) * 2.2));
    }

    const gate = box(10, 4.5, 0.4, std(0x334455), 0, 2.25, 62);
    this.scene.add(gate);
    const jet = box(3.2, 2.4, 8, std(0xdfe6ee, { metalness: 0.4 }), 0, 1.2, 68);
    this.scene.add(jet);

    const board = box(6, 2.2, 0.12, std(0x111820), 5, 4.4, 12);
    this.scene.add(board);
    const led = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.6, 0.04), new THREE.MeshBasicMaterial({ color: 0x1ecf6a }));
    led.position.set(5, 4.4, 11.88);
    this.scene.add(led);

    this.player = createCharacterMesh(this.character.id);
    this.mover = new PersonMover(this.player);
    this.mover.setPosition(0, 0, 0);
    this.scene.add(this.player);
    this.camera.position.set(0, 2.4, -5.6);
    this.camera.lookAt(0, 1.2, 0);

    this.friendMesh = createCharacterMesh(this.friend.id);
    this.friendMesh.position.set(1.1, 0, -1.2);
    this.scene.add(this.friendMesh);
  }

  update(dt, input) {
    this.time += dt;
    this.mover.update(dt, input, this.colliders, this.time);
    this.friendMesh.position.lerp(
      new THREE.Vector3(this.player.position.x + 0.9, 0, this.player.position.z - 1.1),
      1 - Math.exp(-3 * dt)
    );
    const fdx = this.player.position.x - this.friendMesh.position.x;
    const fdz = this.player.position.z - this.friendMesh.position.z;
    this.friendMesh.rotation.set(0, Math.atan2(fdx, fdz), 0);
    poseWalk(this.friendMesh, this.time, this.mover.speed * 0.8);
    poseIdle(this.clerk, this.time);
    followCam(this.camera, this.player.position, this.mover.yaw, dt, { dist: 5.6, height: 2.5 });

    const pz = this.player.position.z;
    const px = this.player.position.x;
    this.prompt = null;
    const act = !!(input.interact || input.fire);
    const edge = act && !this._held;
    this._held = act;
    if (input.interact) input.interact = false;
    if (!this.ticketBought && Math.hypot(px + 5, pz - 16.5) < 3.2) {
      this.prompt = { key: 'E', text: tr('buyTicket') };
      if (edge) {
        const cost = 180;
        if ((this.save.money || 0) < cost) this.save.money = (this.save.money || 0) + 400;
        this.save.money -= cost;
        this.save.ticketBought = true;
        this.ticketBought = true;
        this.prompt = { key: '✓', text: tr('ticketBought') };
        if (this.audio) this.audio.playLockSound();
      }
    } else if (this.ticketBought && !this.boarded && pz > 58 && Math.abs(px) < 4) {
      this.prompt = { key: 'E', text: tr('boardPlane') };
      if (edge) {
        this.boarded = true;
        return 'board';
      }
    }
    return 'ok';
  }

  hud() {
    return {
      badge: tr('locCologne') + ' CGN',
      loc: this.ticketBought ? tr('gate') : tr('checkIn'),
      money: this.save.money || 0,
      obj: this.ticketBought ? tr('objGate') : tr('objTicket'),
      prompt: this.prompt
    };
  }
}
