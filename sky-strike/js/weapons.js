import * as THREE from 'three';

const _pos = new THREE.Vector3();
const _fwd = new THREE.Vector3();

export class GunSystem {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.active = [];
    const geo = new THREE.CylinderGeometry(0.06, 0.06, 2.4, 4);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffee88 });
    for (let i = 0; i < 70; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      scene.add(m);
      this.pool.push({
        mesh: m,
        vel: new THREE.Vector3(),
        life: 0,
        damage: 0,
        owner: null
      });
    }
  }

  tryFire(originMesh, owner, damage, muzzleOffset = 8) {
    const b = this.pool.pop();
    if (!b) return false;
    _fwd.set(0, 0, 1).applyQuaternion(originMesh.quaternion);
    b.mesh.position.copy(originMesh.position).addScaledVector(_fwd, muzzleOffset);
    b.mesh.quaternion.copy(originMesh.quaternion);
    b.vel.copy(_fwd).multiplyScalar(520);
    b.life = 1.15;
    b.damage = damage;
    b.owner = owner;
    b.mesh.visible = true;
    this.active.push(b);
    return true;
  }

  update(dt, targets) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const b = this.active[i];
      b.life -= dt;
      b.mesh.position.addScaledVector(b.vel, dt);
      let hit = null;
      for (const t of targets) {
        if (!t.alive) continue;
        if (b.owner === t.id) continue;
        if (b.mesh.position.distanceToSquared(t.position) < 196) {
          hit = t;
          break;
        }
      }
      if (hit || b.life <= 0 || b.mesh.position.y < 0) {
        b.mesh.visible = false;
        this.active.splice(i, 1);
        this.pool.push(b);
        if (hit) hit.applyDamage(b.damage, 'gun');
      }
    }
  }
}
