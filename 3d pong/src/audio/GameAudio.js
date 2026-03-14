export class GameAudio {
  constructor() {
    this.audioContext = null;
    this.unlocked = false;
    this.activeJumpscareClip = null;
    this.jumpscareFallbackDuration = 0.4;
    this.templates = {
      puckHit: this.createTemplate("./src/assets/audio/puck-hit.wav", 0.6),
      wallHit: this.createTemplate("./src/assets/audio/wall-hit.wav", 0.5),
      goal: this.createTemplate("./src/assets/audio/goal.wav", 0.72),
      jumpscare: this.createTemplate("./src/assets/audio/scary.mp3", 0.9),
    };

    this.cooldowns = {
      puckHit: 0,
      wallHit: 0,
      goal: 0,
      jumpscare: 0,
    };
  }

  unlock() {
    if (this.unlocked) {
      return;
    }

    this.unlocked = true;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      return;
    }

    this.audioContext = this.audioContext || new Ctx();
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume().catch(() => {});
    }
  }

  tick(dt) {
    this.cooldowns.puckHit = Math.max(0, this.cooldowns.puckHit - dt);
    this.cooldowns.wallHit = Math.max(0, this.cooldowns.wallHit - dt);
    this.cooldowns.goal = Math.max(0, this.cooldowns.goal - dt);
    this.cooldowns.jumpscare = Math.max(0, this.cooldowns.jumpscare - dt);
  }

  playPuckHit(intensity = 1) {
    if (this.cooldowns.puckHit > 0) {
      return;
    }
    this.cooldowns.puckHit = 0.04;
    const playbackRate = clamp(0.9 + intensity * 0.2, 0.85, 1.2);
    const volume = clamp(0.35 + intensity * 0.35, 0.2, 0.85);
    this.play("puckHit", playbackRate, volume, () => {
      this.playSynth(190 + intensity * 55, 0.045, volume * 0.5, "triangle");
    });
  }

  playWallHit(speed = 1) {
    if (this.cooldowns.wallHit > 0) {
      return;
    }
    this.cooldowns.wallHit = 0.05;
    const intensity = clamp(speed / 28, 0.2, 1);
    const playbackRate = clamp(0.92 + intensity * 0.22, 0.86, 1.2);
    const volume = clamp(0.2 + intensity * 0.35, 0.15, 0.65);
    this.play("wallHit", playbackRate, volume, () => {
      this.playSynth(120 + intensity * 35, 0.05, volume * 0.6, "square");
    });
  }

  playGoal(isPlayerGoal) {
    if (this.cooldowns.goal > 0) {
      return;
    }
    this.cooldowns.goal = 0.35;
    const playbackRate = isPlayerGoal ? 1.02 : 0.96;
    this.play("goal", playbackRate, 0.8, () => {
      this.playSynth(isPlayerGoal ? 520 : 340, 0.18, 0.33, "sawtooth");
      this.playSynth(isPlayerGoal ? 690 : 250, 0.16, 0.22, "triangle", 0.05);
    });
  }

  playJumpscare() {
    if (this.cooldowns.jumpscare > 0) {
      return;
    }
    this.cooldowns.jumpscare = 1;
    const clip = this.play("jumpscare", 1, 0.95, () => {
      this.playSynth(120, 0.35, 0.35, "sawtooth");
      this.playSynth(85, 0.35, 0.25, "triangle", 0.02);
    });
    if (clip) {
      this.activeJumpscareClip = clip;
      if (Number.isFinite(clip.duration) && clip.duration > 0) {
        this.jumpscareFallbackDuration = clip.duration;
      }
      clip.addEventListener(
        "ended",
        () => {
          if (this.activeJumpscareClip === clip) {
            this.activeJumpscareClip = null;
          }
        },
        { once: true }
      );
    }
  }

  isJumpscarePlaying() {
    const clip = this.activeJumpscareClip;
    if (!clip) {
      return false;
    }
    return !clip.paused && !clip.ended;
  }

  getJumpscareRemainingSeconds() {
    const clip = this.activeJumpscareClip;
    if (!clip) {
      return 0;
    }
    if (!Number.isFinite(clip.duration) || clip.duration <= 0) {
      return this.jumpscareFallbackDuration;
    }
    return Math.max(0, clip.duration - clip.currentTime);
  }

  createTemplate(path, volume) {
    const audio = new Audio(path);
    audio.preload = "auto";
    audio.volume = volume;
    audio.addEventListener("error", () => {
      audio.dataset.failed = "1";
    });
    return audio;
  }

  play(key, playbackRate, volume, fallback) {
    const template = this.templates[key];
    if (!template || template.dataset.failed === "1") {
      fallback?.();
      return null;
    }

    const clip = template.cloneNode();
    clip.volume = volume;
    clip.playbackRate = playbackRate;
    clip.currentTime = 0;
    clip.play().catch(() => fallback?.());
    return clip;
  }

  playSynth(frequency, duration, volume, type, delaySeconds = 0) {
    if (!this.audioContext) {
      return;
    }

    const now = this.audioContext.currentTime + delaySeconds;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    osc.start(now);
    osc.stop(now + duration);
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
