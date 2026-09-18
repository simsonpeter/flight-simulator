import * as THREE from 'three';

const _fwd = new THREE.Vector3();
const _to = new THREE.Vector3();
const _steer = new THREE.Quaternion();
const _look = new THREE.Quaternion();

function smokeTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, 'rgba(255,255,255,0.7)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

export class MissileSystem {
  constructor(scene, explosions, audio) {
    this.scene = scene;
    this.explosions = explosions;
    this.audio = audio;
    this.active = [];
    this.pool = [];
    this.smokePool = [];
    this.smokeTex = smokeTexture();
    const body = new THREE.CylinderGeometry(0.12, 0.14, 2.2, 6);
    body.rotateX(Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0xdde2e8, metalness: 0.7, roughness: 0.3 });
    for (let i = 0; i < 24; i++) {
      const mesh = new THREE.Mesh(body, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push({
        mesh,
        vel: new THREE.Vector3(),
        target: null,
        owner: null,
        life: 0,
        smokeT: 0,
        damage: 55,
        turn: 1.8
      });
    }
    for (let i = 0; i < 80; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.smokeTex,
        transparent: true,
        opacity: 0.45,
        depthWrite: false
      }));
      s.visible = false;
      s.scale.set(3, 3, 3);
      scene.add(s);
      this.smokePool.push({ sprite: s, life: 0 });
    }
    this.smokes = [];
    this.incoming = false;
  }

  launch(fromMesh, target, owner, damage = 55, turn = 1.8) {
    const m = this.pool.pop();
    if (!m) return false;
    _fwd.set(0, 0, 1).applyQuaternion(fromMesh.quaternion);
    m.mesh.position.copy(fromMesh.position).addScaledVector(_fwd, 6).add(new THREE.Vector3(owner === 'player' ? 1.4 : -1.2, -0.6, 0).applyQuaternion(fromMesh.quaternion));
    m.mesh.quaternion.copy(fromMesh.quaternion);
    m.mesh.visible = true;
    m.vel.copy(_fwd).multiplyScalar(180);
    m.target = target;
    m.owner = owner;
    m.life = 7;
    m.damage = damage;
    m.turn = turn;
    m.smokeT = 0;
    this.active.push(m);
    if (this.audio) this.audio.playMissileLaunchSound();
    return true;
  }

  update(dt) {
    this.incoming = false;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const m = this.active[i];
      m.life -= dt;
      if (m.target && m.target.alive) {
        _to.copy(m.target.position).sub(m.mesh.position);
        if (_to.lengthSq() > 0.01) {
          _to.normalize();
          _look.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _to);
          m.mesh.quaternion.rotateTowards(_look, m.turn * dt);
        }
      }
      _fwd.set(0, 0, 1).applyQuaternion(m.mesh.quaternion);
      const spd = 210 + (7 - m.life) * 18;
      m.vel.copy(_fwd).multiplyScalar(spd);
      m.mesh.position.addScaledVector(m.vel, dt);

      m.smokeT -= dt;
      if (m.smokeT <= 0) {
        m.smokeT = 0.05;
        this._puff(m.mesh.position);
      }

      let hit = false;
      if (m.target && m.target.alive && m.mesh.position.distanceToSquared(m.target.position) < 160) {
        m.target.applyDamage(m.damage, 'missile');
        hit = true;
        if (m.owner === 'player' && m.target.onMissileHit) m.target.onMissileHit();
      }
      if (m.owner !== 'player' && m.target && m.target.id === 'player') {
        const d = m.mesh.position.distanceTo(m.target.position);
        if (d < 700) this.incoming = true;
      }
      if (hit || m.life <= 0 || m.mesh.position.y < 1) {
        this.explosions.explode(m.mesh.position.clone(), hit ? 1.1 : 0.5, false);
        m.mesh.visible = false;
        this.active.splice(i, 1);
        this.pool.push(m);
      }
    }

    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i];
      s.life -= dt;
      s.sprite.material.opacity = Math.max(0, s.life);
      s.sprite.scale.multiplyScalar(1 + dt * 0.8);
      if (s.life <= 0) {
        s.sprite.visible = false;
        this.smokes.splice(i, 1);
        this.smokePool.push(s);
      }
    }
  }

  _puff(pos) {
    const s = this.smokePool.pop();
    if (!s) return;
    s.sprite.position.copy(pos);
    s.sprite.scale.set(2.4, 2.4, 2.4);
    s.sprite.material.opacity = 0.4;
    s.sprite.visible = true;
    s.life = 0.5;
    this.smokes.push(s);
  }

  clear() {
    while (this.active.length) {
      const m = this.active.pop();
      m.mesh.visible = false;
      this.pool.push(m);
    }
  }
}
