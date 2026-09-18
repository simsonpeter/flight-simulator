export class MobileControls {
  constructor(input, hooks) {
    this.input = input;
    this.hooks = hooks;
    this.root = document.getElementById('mobile-controls');
    this.zone = document.getElementById('stick-zone');
    this.knob = document.getElementById('stick-knob');
    this.base = document.getElementById('stick-base');
    this.throttle = document.getElementById('throttle-slider');
    this.pointerId = null;
    this.lookPointer = null;
    this.cx = 0;
    this.cy = 0;
    this.active = false;
    this.lastThrottle = 0;

    this.throttle.addEventListener('input', () => {
      if (!this.active) return;
      const v = Number(this.throttle.value) / 100;
      this.input.throttle = v - this.lastThrottle > 0 ? 0.9 : (v - this.lastThrottle < 0 ? -0.9 : 0);
      this.lastThrottle = v;
      this.hooks.setThrottleAbsolute(v);
    });

    const bindHold = (id, on, off) => {
      const el = document.getElementById(id);
      const start = (e) => { e.preventDefault(); on(el); };
      const end = (e) => { e.preventDefault(); off(el); };
      el.addEventListener('pointerdown', start);
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('pointerleave', end);
    };

    bindHold('m-fire', () => { this.input.fire = true; }, () => { this.input.fire = false; });
    bindHold('m-missile', () => { this.hooks.onMissile(); }, () => {});
    bindHold('m-brake', (el) => { this.input.airbrake = true; el.classList.add('active'); }, (el) => { this.input.airbrake = false; el.classList.remove('active'); });
    bindHold('m-ab', (el) => {
      this.input.afterburner = true;
      el.classList.add('active');
      this.hooks.onAfterburner();
    }, (el) => { this.input.afterburner = false; el.classList.remove('active'); });

    document.getElementById('m-camera').addEventListener('click', (e) => {
      e.preventDefault();
      this.hooks.onCamera();
    });
    document.getElementById('m-look').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.hooks.onLookToggle(true);
      document.getElementById('m-look').classList.add('active');
    });
    document.getElementById('m-look').addEventListener('pointerup', (e) => {
      e.preventDefault();
      this.hooks.onLookToggle(false);
      document.getElementById('m-look').classList.remove('active');
    });

    this.zone.addEventListener('pointerdown', (e) => this.onStickDown(e));
    this.zone.addEventListener('pointermove', (e) => this.onStickMove(e));
    this.zone.addEventListener('pointerup', (e) => this.onStickUp(e));
    this.zone.addEventListener('pointercancel', (e) => this.onStickUp(e));

    this._lookMove = (e) => {
      if (!this.active || !this.hooks.isLookActive()) return;
      if (e.pointerId === this.pointerId) return;
      this.hooks.onLook(e.movementX || 0, e.movementY || 0);
    };
    window.addEventListener('pointermove', this._lookMove);
  }

  show(on) {
    this.root.classList.toggle('hidden', !on);
    this.active = on;
    if (!on) this.resetStick();
  }

  onStickDown(e) {
    if (!this.active) return;
    this.pointerId = e.pointerId;
    this.zone.setPointerCapture(e.pointerId);
    const r = this.base.getBoundingClientRect();
    this.cx = r.left + r.width / 2;
    this.cy = r.top + r.height / 2;
    this.applyStick(e.clientX, e.clientY);
  }

  onStickMove(e) {
    if (this.pointerId !== e.pointerId) return;
    this.applyStick(e.clientX, e.clientY);
  }

  onStickUp(e) {
    if (this.pointerId !== e.pointerId) return;
    this.pointerId = null;
    this.resetStick();
  }

  applyStick(x, y) {
    const dx = x - this.cx;
    const dy = y - this.cy;
    const max = 48;
    const mag = Math.hypot(dx, dy);
    const nx = mag > max ? dx * max / mag : dx;
    const ny = mag > max ? dy * max / mag : dy;
    this.knob.style.transform = `translate(${nx}px, ${ny}px)`;
    this.input.roll = nx / max;
    this.input.pitch = ny / max;
  }

  resetStick() {
    this.knob.style.transform = 'translate(0,0)';
    this.input.roll = 0;
    this.input.pitch = 0;
  }

  syncThrottle(value) {
    this.throttle.value = String(Math.round(value * 100));
    this.lastThrottle = value;
  }
}
