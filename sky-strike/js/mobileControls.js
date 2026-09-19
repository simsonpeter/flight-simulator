export class MobileControls {
  constructor(input, hooks) {
    this.input = input;
    this.hooks = hooks;
    this.root = document.getElementById('mobile-controls');
    this.zone = document.getElementById('stick-zone');
    this.knob = document.getElementById('stick-knob');
    this.base = document.getElementById('stick-base');
    this.track = document.getElementById('throttle-track');
    this.fill = document.getElementById('throttle-fill');
    this.pointerId = null;
    this.thrPointer = null;
    this.cx = 0;
    this.cy = 0;
    this.active = false;
    this.lastThrottle = 0;
    this.stickMode = 'fly';
    this.invertPitch = false;

    const bindHold = (id, on, off) => {
      const el = document.getElementById(id);
      if (!el) return;
      const start = (e) => {
        e.preventDefault();
        e.stopPropagation();
        try { el.setPointerCapture(e.pointerId); } catch { /* older WebViews */ }
        on(el, e);
      };
      const end = (e) => {
        e.preventDefault();
        off(el, e);
      };
      el.addEventListener('pointerdown', start, { passive: false });
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    };

    bindHold('m-fire', () => {
      this.input.fire = true;
      this.input.interact = true;
    }, () => {
      this.input.fire = false;
    });
    bindHold('m-missile', () => { this.hooks.onMissile(); }, () => {});
    bindHold('m-brake', (el) => {
      this.input.airbrake = true;
      el.classList.add('active');
    }, (el) => {
      this.input.airbrake = false;
      el.classList.remove('active');
    });
    bindHold('m-ab', (el) => {
      this.input.afterburner = true;
      el.classList.add('active');
      this.hooks.onAfterburner();
    }, (el) => {
      this.input.afterburner = false;
      el.classList.remove('active');
    });

    const look = document.getElementById('m-look');
    if (look) {
      look.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.hooks.onLookToggle(true);
        look.classList.add('active');
      }, { passive: false });
      look.addEventListener('pointerup', (e) => {
        e.preventDefault();
        this.hooks.onLookToggle(false);
        look.classList.remove('active');
      });
      look.addEventListener('pointercancel', () => {
        this.hooks.onLookToggle(false);
        look.classList.remove('active');
      });
    }

    document.getElementById('m-camera')?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.hooks.onCamera();
    }, { passive: false });

    document.getElementById('m-pause')?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.hooks.onPause();
    }, { passive: false });

    this.zone?.addEventListener('pointerdown', (e) => this.onStickDown(e), { passive: false });
    this.zone?.addEventListener('pointermove', (e) => this.onStickMove(e), { passive: false });
    this.zone?.addEventListener('pointerup', (e) => this.onStickUp(e));
    this.zone?.addEventListener('pointercancel', (e) => this.onStickUp(e));

    this.track?.addEventListener('pointerdown', (e) => this.onThrDown(e), { passive: false });
    this.track?.addEventListener('pointermove', (e) => this.onThrMove(e), { passive: false });
    this.track?.addEventListener('pointerup', (e) => this.onThrUp(e));
    this.track?.addEventListener('pointercancel', (e) => this.onThrUp(e));
  }

  setMode(mode) {
    this.stickMode = mode || 'fly';
    this.invertPitch = mode === 'walk' || mode === 'drive';
    const fire = document.getElementById('m-fire');
    if (fire) fire.textContent = mode === 'walk' ? 'E' : 'FIRE';
    const ab = document.getElementById('m-ab');
    if (ab) ab.textContent = mode === 'walk' || mode === 'drive' ? 'BOOST' : 'AB';
  }

  show(on) {
    if (this.root) this.root.classList.toggle('hidden', !on);
    this.active = on;
    if (!on) {
      this.resetStick();
      this.syncThrottle(0);
      this.hooks.setThrottleAbsolute(0);
    }
  }

  onStickDown(e) {
    if (!this.active) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    try { this.zone.setPointerCapture(e.pointerId); } catch { /* older WebViews */ }
    const r = this.base.getBoundingClientRect();
    this.cx = r.left + r.width / 2;
    this.cy = r.top + r.height / 2;
    this.applyStick(e.clientX, e.clientY);
  }

  onStickMove(e) {
    if (this.pointerId !== e.pointerId) return;
    e.preventDefault();
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
    const max = 52;
    const mag = Math.hypot(dx, dy);
    const nx = mag > max ? dx * max / mag : dx;
    const ny = mag > max ? dy * max / mag : dy;
    if (this.knob) this.knob.style.transform = `translate(${nx}px, ${ny}px)`;
    this.input.roll = nx / max;
    this.input.pitch = (this.invertPitch ? -ny : ny) / max;
    if (this.stickMode === 'drive' && this.input.pitch > 0.2) {
      this.input.throttle = Math.max(this.input.throttle, this.input.pitch);
    }
  }

  resetStick() {
    if (this.knob) this.knob.style.transform = 'translate(0,0)';
    this.input.roll = 0;
    this.input.pitch = 0;
    if (this.stickMode === 'drive') this.input.throttle = this.lastThrottle;
  }

  onThrDown(e) {
    if (!this.active) return;
    e.preventDefault();
    this.thrPointer = e.pointerId;
    try { this.track.setPointerCapture(e.pointerId); } catch { /* older WebViews */ }
    this.applyThrottle(e.clientY);
  }

  onThrMove(e) {
    if (this.thrPointer !== e.pointerId) return;
    e.preventDefault();
    this.applyThrottle(e.clientY);
  }

  onThrUp(e) {
    if (this.thrPointer !== e.pointerId) return;
    this.thrPointer = null;
  }

  applyThrottle(clientY) {
    const r = this.track.getBoundingClientRect();
    const v = Math.max(0, Math.min(1, 1 - (clientY - r.top) / r.height));
    this.input.throttle = v;
    this.lastThrottle = v;
    this.hooks.setThrottleAbsolute(v);
    this._paintThrottle(v);
  }

  syncThrottle(value) {
    this.lastThrottle = value;
    this._paintThrottle(value);
  }

  _paintThrottle(value) {
    if (this.fill) this.fill.style.height = `${Math.round(value * 100)}%`;
  }
}
