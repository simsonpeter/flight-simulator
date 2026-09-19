import * as THREE from 'three';

export const CHAR_LOOKS = {
  kai: { skin: 0xc68642, hair: 0x1a120c, hairStyle: 'short', top: 0x2b6fd6, bottom: 0x243044, shoes: 0x111111, height: 1.0 },
  nora: { skin: 0xe0ac69, hair: 0x3b2218, hairStyle: 'bun', top: 0x2a8f7a, bottom: 0x1c1c22, shoes: 0x222222, height: 0.96 },
  max: { skin: 0xf1c27d, hair: 0xc9a227, hairStyle: 'cap', top: 0xc9a227, bottom: 0x2a2a30, shoes: 0x111111, height: 1.02 },
  lina: { skin: 0xd1a370, hair: 0x140c08, hairStyle: 'tail', top: 0xc43c32, bottom: 0x1a1a1e, shoes: 0x2a1010, height: 0.97 },
  daan: { skin: 0xc68642, hair: 0x2a1a10, hairStyle: 'short', top: 0x3d8f6e, bottom: 0x2a3340, shoes: 0x111111, height: 1.0 },
  yara: { skin: 0xe0ac69, hair: 0x4a2818, hairStyle: 'bun', top: 0xd4a017, bottom: 0x2a2430, shoes: 0x221808, height: 0.95 },
  finn: { skin: 0xf1c27d, hair: 0x1c1410, hairStyle: 'short', top: 0x3a6ea8, bottom: 0x243040, shoes: 0x111111, height: 1.01 }
};

function mat(color, extras = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: extras.roughness ?? 0.62,
    metalness: extras.metalness ?? 0.08
  });
}

export function lookFor(id) {
  return CHAR_LOOKS[id] || CHAR_LOOKS.kai;
}

export function createCharacterMesh(id, options = {}) {
  const look = { ...lookFor(id), ...(options.look || {}) };
  const g = new THREE.Group();
  g.name = id;
  const s = look.height * (options.scale || 1);

  const skin = mat(look.skin, { roughness: 0.55 });
  const top = mat(look.top);
  const bottom = mat(look.bottom);
  const hairM = mat(look.hair, { roughness: 0.8 });
  const shoe = mat(look.shoes, { roughness: 0.4 });

  const hips = new THREE.Group();
  hips.position.y = 0.58 * s;
  g.add(hips);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42 * s, 0.52 * s, 0.24 * s), top);
  torso.position.y = 0.28 * s;
  hips.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 10, 8), skin);
  head.position.y = 0.66 * s;
  hips.add(head);

  const hair = makeHair(look.hairStyle, hairM, s);
  hair.position.y = 0.72 * s;
  hips.add(hair);

  if (look.hairStyle === 'cap') {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.17 * s, 0.08 * s, 10), mat(look.top, { roughness: 0.45 }));
    cap.position.y = 0.8 * s;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.22 * s, 0.03 * s, 0.16 * s), mat(look.top));
    brim.position.set(0, 0.77 * s, 0.12 * s);
    hips.add(cap, brim);
  }

  const armL = new THREE.Group();
  armL.position.set(-0.28 * s, 0.42 * s, 0);
  const armR = new THREE.Group();
  armR.position.set(0.28 * s, 0.42 * s, 0);
  const uArm = new THREE.Mesh(new THREE.BoxGeometry(0.1 * s, 0.42 * s, 0.1 * s), top);
  uArm.position.y = -0.18 * s;
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.08 * s, 0.08 * s, 0.08 * s), skin);
  hand.position.y = -0.4 * s;
  const aL = uArm.clone();
  const aR = uArm.clone();
  const hL = hand.clone();
  const hR = hand.clone();
  armL.add(aL, hL);
  armR.add(aR, hR);
  hips.add(armL, armR);

  const legL = new THREE.Group();
  legL.position.set(-0.12 * s, 0, 0);
  const legR = new THREE.Group();
  legR.position.set(0.12 * s, 0, 0);
  const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.14 * s, 0.5 * s, 0.14 * s), bottom);
  thigh.position.y = -0.28 * s;
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14 * s, 0.08 * s, 0.24 * s), shoe);
  foot.position.set(0, -0.56 * s, 0.04 * s);
  const tL = thigh.clone();
  const tR = thigh.clone();
  const fL = foot.clone();
  const fR = foot.clone();
  legL.add(tL, fL);
  legR.add(tR, fR);
  hips.add(legL, legR);

  g.userData = { hips, armL, armR, legL, legR, head, look, seated: false, walk: 0 };
  return g;
}

function makeHair(style, material, s) {
  if (style === 'bun') {
    const g = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.17 * s, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), material);
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.08 * s, 8, 6), material);
    bun.position.set(0, 0.12 * s, -0.04 * s);
    g.add(dome, bun);
    return g;
  }
  if (style === 'tail') {
    const g = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.17 * s, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), material);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08 * s, 0.28 * s, 0.08 * s), material);
    tail.position.set(0, -0.02 * s, -0.16 * s);
    tail.rotation.x = 0.35;
    g.add(dome, tail);
    return g;
  }
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.17 * s, 8, 6, 0, Math.PI * 2, 0, Math.PI / 1.7), material);
  return dome;
}

export function poseIdle(mesh, t = 0) {
  if (!mesh?.userData?.armL) return;
  const u = mesh.userData;
  u.armL.rotation.x = Math.sin(t * 1.3) * 0.06;
  u.armR.rotation.x = Math.sin(t * 1.3 + 1) * 0.06;
  u.legL.rotation.x = 0;
  u.legR.rotation.x = 0;
  u.hips.rotation.x = 0;
  u.hips.position.y = 0.58 * (u.look?.height || 1);
}

export function poseWalk(mesh, t, speed) {
  if (!mesh?.userData?.armL) return;
  const amp = Math.min(0.7, 0.15 + Math.abs(speed) * 0.12);
  const w = t * (6 + Math.abs(speed) * 1.5);
  const u = mesh.userData;
  u.legL.rotation.x = Math.sin(w) * amp;
  u.legR.rotation.x = Math.sin(w + Math.PI) * amp;
  u.armL.rotation.x = Math.sin(w + Math.PI) * amp * 0.8;
  u.armR.rotation.x = Math.sin(w) * amp * 0.8;
  u.hips.position.y = 0.58 * (u.look?.height || 1) + Math.abs(Math.sin(w * 2)) * 0.03;
}

export function poseSeated(mesh) {
  if (!mesh?.userData?.armL) return;
  const u = mesh.userData;
  u.seated = true;
  u.legL.rotation.x = -1.15;
  u.legR.rotation.x = -1.15;
  u.armL.rotation.x = -0.45;
  u.armR.rotation.x = -0.35;
  u.hips.rotation.x = 0.12;
  u.hips.position.y = 0.58;
}

export function recolorTop(mesh, color) {
  mesh.traverse((o) => {
    if (o.material && o.material.color && o.parent === mesh.userData.hips && o.geometry?.type === 'BoxGeometry') {
      /* skip */
    }
  });
  const torso = mesh.userData.hips?.children?.find((c) => c.geometry?.type === 'BoxGeometry' && c.position.y > 0.2);
  if (torso?.material) torso.material = mat(color);
}

export class PersonMover {
  constructor(mesh) {
    this.mesh = mesh;
    this.yaw = 0;
    this.speed = 0;
    this.radius = 0.42;
    this.inCar = false;
  }

  setPosition(x, z, yaw = 0) {
    this.mesh.position.set(x, 0, z);
    this.yaw = yaw;
    this.mesh.rotation.y = yaw;
  }

  update(dt, input, colliders, time) {
    if (this.inCar) return 0;
    const turn = input.roll || 0;
    const fwd = input.pitch || 0;
    const sprint = (input.afterburner || input.throttle > 0.4) ? 1.7 : 1;
    this.yaw -= turn * dt * 2.6;
    const wish = fwd * 4.8 * sprint;
    this.speed += (wish - this.speed) * Math.min(1, dt * 8);
    const nx = this.mesh.position.x + Math.sin(this.yaw) * this.speed * dt;
    const nz = this.mesh.position.z + Math.cos(this.yaw) * this.speed * dt;
    if (!hitsCollider(nx, nz, this.radius, colliders)) {
      this.mesh.position.x = nx;
      this.mesh.position.z = nz;
    } else if (!hitsCollider(this.mesh.position.x, nz, this.radius, colliders)) {
      this.mesh.position.z = nz;
    } else if (!hitsCollider(nx, this.mesh.position.z, this.radius, colliders)) {
      this.mesh.position.x = nx;
    }
    this.mesh.rotation.y = this.yaw;
    if (Math.abs(this.speed) > 0.4) poseWalk(this.mesh, time, this.speed);
    else poseIdle(this.mesh, time);
    return this.speed;
  }
}

export function hitsCollider(x, z, r, colliders) {
  if (!colliders) return false;
  for (const c of colliders) {
    if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true;
  }
  return false;
}

export function followCam(camera, target, yaw, dt, extras = {}) {
  const dist = extras.dist ?? 6.4;
  const height = extras.height ?? 2.8;
  const lookY = extras.lookY ?? 1.35;
  const want = new THREE.Vector3(
    target.x - Math.sin(yaw) * dist,
    height,
    target.z - Math.cos(yaw) * dist
  );
  camera.position.lerp(want, 1 - Math.exp(-(extras.lerp || 7) * dt));
  camera.up.set(0, 1, 0);
  camera.lookAt(target.x, lookY, target.z);
}

export class CharacterStudio {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.mesh = null;
    this.friend = null;
    this.t = 0;
  }

  build(charId, friendId = null) {
    this.scene.background = new THREE.Color(0x101820);
    this.scene.fog = new THREE.Fog(0x101820, 12, 28);
    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x1a1a22, 0.9);
    const key = new THREE.DirectionalLight(0xfff2d8, 1.2);
    key.position.set(4, 8, 6);
    const rim = new THREE.DirectionalLight(0x4aa3ff, 0.45);
    rim.position.set(-6, 4, -4);
    this.scene.add(hemi, key, rim);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(4.2, 32),
      new THREE.MeshStandardMaterial({ color: 0x1c2430, metalness: 0.3, roughness: 0.5 })
    );
    floor.rotation.x = -Math.PI / 2;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.1, 0.04, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0x7dffd4 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    this.scene.add(floor, ring);
    this.setPeople(charId, friendId);
  }

  setPeople(charId, friendId = null) {
    if (this.mesh) this.scene.remove(this.mesh);
    if (this.friend) this.scene.remove(this.friend);
    this.mesh = createCharacterMesh(charId);
    this.mesh.position.set(friendId ? -0.7 : 0, 0, 0);
    this.scene.add(this.mesh);
    this.friend = null;
    if (friendId) {
      this.friend = createCharacterMesh(friendId);
      this.friend.position.set(0.75, 0, 0.1);
      this.friend.rotation.y = -0.4;
      this.scene.add(this.friend);
    }
  }

  update(dt) {
    this.t += dt;
    if (this.mesh) {
      this.mesh.rotation.y = this.t * 0.55;
      poseIdle(this.mesh, this.t);
      poseWalk(this.mesh, this.t, 2.2);
    }
    if (this.friend) poseIdle(this.friend, this.t + 1);
    this.camera.position.set(0, 1.55, 3.6);
    this.camera.lookAt(0, 1.0, 0);
  }
}
