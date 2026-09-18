import * as THREE from 'three';

function fmt(n, digits = 0) {
  return n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export class HUD {
  constructor() {
    this.el = {
      speed: document.getElementById('hud-speed'),
      alt: document.getElementById('hud-alt'),
      hdg: document.getElementById('hud-hdg'),
      thr: document.getElementById('hud-thr'),
      hp: document.getElementById('hud-hp'),
      hpFill: document.getElementById('hp-fill'),
      boost: document.getElementById('boost-fill'),
      fuel: document.getElementById('fuel-fill'),
      missiles: document.getElementById('hud-missiles'),
      target: document.getElementById('hud-target'),
      tdist: document.getElementById('hud-tdist'),
      talt: document.getElementById('hud-talt'),
      tspd: document.getElementById('hud-tspd'),
      thp: document.getElementById('hud-thp'),
      camera: document.getElementById('camera-mode'),
      ab: document.getElementById('ab-flag'),
      lock: document.getElementById('lock-status'),
      lockBox: document.getElementById('lock-box'),
      missileWarn: document.getElementById('missile-warn'),
      crit: document.getElementById('crit-warn'),
      toast: document.getElementById('toast'),
      objectives: document.getElementById('objectives'),
      score: document.getElementById('score-chip'),
      mission: document.getElementById('mission-name'),
      tod: document.getElementById('tod-badge'),
      cockpit: document.getElementById('cockpit-frame'),
      horizon: document.getElementById('horizon-canvas'),
      nav: document.getElementById('nav-arrow'),
      hud: document.getElementById('hud'),
      vignette: document.getElementById('damage-vignette'),
      flash: document.getElementById('flash-overlay')
    };
    this.toastT = 0;
    this.warnT = 0;
  }

  show(on) {
    this.el.hud.classList.toggle('hidden', !on);
  }

  setCockpit(on) {
    this.el.cockpit.classList.toggle('hidden', !on);
  }

  toast(text, time = 2.2) {
    this.el.toast.textContent = text;
    this.toastT = time;
  }

  flash(amount = 0.45) {
    this.el.flash.style.opacity = String(amount);
  }

  damagePulse(hpFrac) {
    const a = hpFrac < 1 ? 0.25 + (1 - hpFrac) * 0.55 : 0;
    this.el.vignette.style.boxShadow = `inset 0 0 140px rgba(255, 0, 0, ${a})`;
  }

  update(dt, data) {
    this.toastT = Math.max(0, this.toastT - dt);
    if (this.toastT <= 0) this.el.toast.textContent = '';
    this.el.flash.style.opacity = String(Math.max(0, Number(this.el.flash.style.opacity || 0) - dt * 2.5));

    if (!data.showHud) {
      this.el.hud.style.opacity = '0';
      return;
    }
    this.el.hud.style.opacity = '1';

    this.el.speed.textContent = `${fmt(data.speedKmh)} KM/H`;
    this.el.alt.textContent = `${fmt(data.alt)} M`;
    this.el.hdg.textContent = `${String(Math.round(data.heading) % 360).padStart(3, '0')}°`;
    this.el.thr.textContent = `${Math.round(data.throttle * 100)}%`;
    this.el.hp.textContent = `${Math.round(data.hp * 100)}%`;
    this.el.hpFill.style.width = `${Math.max(0, data.hp * 100)}%`;
    this.el.hpFill.parentElement.classList.toggle('low', data.hp < 0.3);
    this.el.boost.style.width = `${data.boost * 100}%`;
    this.el.fuel.style.width = `${data.fuel * 100}%`;
    this.el.missiles.textContent = String(data.missiles);
    this.el.camera.textContent = data.look ? `${data.camera} · LOOK` : data.camera;
    this.el.ab.classList.toggle('hidden', !data.afterburner);
    this.el.mission.textContent = data.missionName;
    this.el.tod.textContent = data.tod;
    this.el.score.textContent = `XP ${data.xp}`;
    this.el.crit.classList.toggle('hidden', data.hp > 0.28);
    this.el.missileWarn.classList.toggle('hidden', !data.incoming);
    this.setCockpit(data.camera === 'COCKPIT');

    if (data.target) {
      this.el.target.textContent = data.target.name;
      this.el.tdist.textContent = `DIST ${ (data.target.dist / 1000).toFixed(1) } KM`;
      this.el.talt.textContent = `ALT ${fmt(data.target.alt)} M`;
      this.el.tspd.textContent = `SPD ${fmt(data.target.speed * 3.6)} KM/H`;
      this.el.thp.textContent = `HP ${Math.round(data.target.hp * 100)}%`;
    } else {
      this.el.target.textContent = 'NONE';
      this.el.tdist.textContent = '—';
      this.el.talt.textContent = '—';
      this.el.tspd.textContent = '—';
      this.el.thp.textContent = '—';
    }

    if (data.lockState === 'LOCKING') this.el.lock.textContent = 'LOCKING...';
    else if (data.lockState === 'LOCKED') this.el.lock.textContent = 'LOCKED';
    else this.el.lock.textContent = '';

    if (data.lockScreen) {
      this.el.lockBox.classList.remove('hidden');
      this.el.lockBox.classList.toggle('locked', data.lockState === 'LOCKED');
      this.el.lockBox.style.left = `${data.lockScreen.x}px`;
      this.el.lockBox.style.top = `${data.lockScreen.y}px`;
    } else {
      this.el.lockBox.classList.add('hidden');
    }

    this.el.objectives.innerHTML = `<b>OBJECTIVES</b><br>${data.objectives.map((o) => `${o.done ? '✓' : '○'} ${o.text}`).join('<br>')}`;

    if (data.navAngle != null) {
      this.el.nav.style.transform = `rotate(${data.navAngle}deg)`;
      this.el.nav.style.opacity = '1';
    } else {
      this.el.nav.style.opacity = '0.2';
    }

    this._horizon(data.pitch, data.roll);
    this.damagePulse(data.hp);
  }

  _horizon(pitch, roll) {
    const c = this.el.horizon;
    if (!c) return;
    const ctx = c.getContext('2d');
    const w = c.width;
    const h = c.height;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(roll);
    ctx.translate(0, pitch * 40);
    ctx.fillStyle = '#3d7ccc';
    ctx.fillRect(-200, -200, 400, 200);
    ctx.fillStyle = '#6a4a28';
    ctx.fillRect(-200, 0, 400, 200);
    ctx.strokeStyle = '#7dffd4';
    ctx.beginPath();
    ctx.moveTo(-80, 0);
    ctx.lineTo(80, 0);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#7dffd4';
    ctx.strokeRect(1, 1, w - 2, h - 2);
  }
}

export function projectToScreen(pos, camera, canvas) {
  const v = pos.clone().project(camera);
  if (v.z > 1) return null;
  return {
    x: (v.x * 0.5 + 0.5) * canvas.clientWidth,
    y: (-v.y * 0.5 + 0.5) * canvas.clientHeight,
    z: v.z
  };
}
