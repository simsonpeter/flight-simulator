import * as THREE from 'three';

function fireTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,220,1)');
  grd.addColorStop(0.3, 'rgba(255,140,40,0.9)');
  grd.addColorStop(1, 'rgba(40,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class ExplosionSystem {
  constructor(scene, quality) {
    this.scene = scene;
    this.quality = quality;
    this.items = [];
    this.tex = fireTexture();
    this.shockGeo = new THREE.RingGeometry(0.6, 1.1, 24);
    this.shockMat = new THREE.MeshBasicMaterial({ color: 0xffeeaa, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
    this.debrisGeo = new THREE.BoxGeometry(0.4, 0.18, 0.7);
    this.debrisMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.6, roughness: 0.4 });
  }

  explode(position, scale = 1, big = false) {
    const group = new THREE.Group();
    group.position.copy(position);
    this.scene.add(group);

    const fire = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.tex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    fire.scale.set(8 * scale, 8 * scale, 1);
    group.add(fire);

    const shock = new THREE.Mesh(this.shockGeo, this.shockMat.clone());
    shock.lookAt(shock.position.clone().add(new THREE.Vector3(0, 1, 0)));
    group.add(shock);

    const light = new THREE.PointLight(0xffaa55, 3.5 * scale, 80 * scale);
    group.add(light);

    const debris = [];
    const n = this.quality === 'low' ? 4 : big ? 14 : 8;
    for (let i = 0; i < n; i++) {
      const d = new THREE.Mesh(this.debrisGeo, this.debrisMat);
      d.position.set((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2);
      group.add(d);
      debris.push({
        mesh: d,
        vel: new THREE.Vector3((Math.random() - 0.5) * 40, 12 + Math.random() * 30, (Math.random() - 0.5) * 40)
      });
    }

    this.items.push({
      group, fire, shock, light, debris,
      age: 0,
      life: big ? 1.6 : 0.9,
      scale
    });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const e = this.items[i];
      e.age += dt;
      const t = e.age / e.life;
      const s = e.scale * (6 + t * 22);
      e.fire.scale.set(s, s, 1);
      e.fire.material.opacity = Math.max(0, 1 - t);
      e.shock.scale.setScalar(1 + t * 18);
      e.shock.material.opacity = Math.max(0, 0.5 - t);
      e.light.intensity = Math.max(0, 3.5 * e.scale * (1 - t));
      for (const d of e.debris) {
        d.vel.y -= 28 * dt;
        d.mesh.position.addScaledVector(d.vel, dt);
        d.mesh.rotation.x += dt * 4;
        d.mesh.rotation.z += dt * 3;
      }
      if (t >= 1) {
        this.scene.remove(e.group);
        e.group.traverse((o) => {
          if (o.material && o.material !== this.debrisMat && o.material.dispose) o.material.dispose();
        });
        this.items.splice(i, 1);
      }
    }
  }

  clear() {
    while (this.items.length) {
      const e = this.items.pop();
      this.scene.remove(e.group);
    }
  }
}
