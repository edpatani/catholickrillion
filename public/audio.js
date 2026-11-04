/**
 * Catholic Krillion ("Credillion") — Pure Web Audio Procedural Synthesizer
 *
 * Implements 100% procedural ecclesiastical sound effects via the standard Web Audio API.
 * ZERO external audio files (.mp3, .wav) are required or loaded.
 *
 * Features:
 * 1. Bell Chimes: Additive sine synthesis harmonic bells for valid submissions,
 *    with custom frequency profiles for each rarity tier (Pew Warmer to Doctor of the Church).
 * 2. Pipe Organ Flourish: Multi-drawbar polyphonic organ chords (8', 4', 2 2/3', 2' drawbars
 *    with cathedral acoustic reverb envelope) triggered on "One-in-a-Credillion" Tier 5 discoveries.
 * 3. Error Buzz: Low-frequency dissonant sawtooth pair (minor second beat frequency) with lowpass filter
 *    for duplicate or invalid submissions.
 * 4. Ticking Heartbeat Countdown: Dual-transient acoustic heartbeat (lub-dub sub-bass thump + click)
 *    triggered during the final 15 seconds of each round.
 * 5. Victory Fanfare: Majestic brass trumpet fanfare sequence with sustained cathedral chords at match end.
 * 6. Browser Autoplay Compliance: Safe lazy AudioContext initialization with explicit gesture unlock listeners.
 */

class EcclesiasticalAudioSynthesizer {
  constructor(options = {}) {
    this.options = Object.assign({
      masterVolume: 0.85,
      reverbDuration: 1.2,
      autoUnlock: true
    }, options);

    this.ctx = null;
    this.masterGain = null;
    this.isMuted = false;
    this.unlocked = false;
    this.unlockCallbacks = [];

    // Frequency tables for bells and fanfare
    this.NOTES = {
      C3: 130.81,
      Cs3: 138.59,
      D3: 146.83,
      E3: 164.81,
      G3: 196.00,
      A3: 220.00,
      C4: 261.63,
      D4: 293.66,
      E4: 329.63,
      Fs4: 369.99,
      G4: 392.00,
      A4: 440.00,
      B4: 493.88,
      C5: 523.25,
      D5: 587.33,
      E5: 659.25,
      G5: 783.99,
      A5: 880.00,
      C6: 1046.50
    };

    if (typeof window !== 'undefined' && this.options.autoUnlock) {
      this._attachAutoplayUnlockListeners();
    }
  }

  /**
   * Lazily initializes and returns the AudioContext.
   */
  getAudioContext() {
    if (!this.ctx) {
      const AudioContextClass = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) ||
                                (typeof global !== 'undefined' && (global.AudioContext || global.webkitAudioContext)) ||
                                null;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.options.masterVolume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    return this.ctx;
  }

  /**
   * Unlocks and resumes the AudioContext on user gesture.
   */
  async unlockAudio() {
    const ctx = this.getAudioContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (err) {
        console.warn('[AudioSynth] AudioContext resume failed:', err);
      }
    }

    if (ctx.state === 'running') {
      this.unlocked = true;
      this._triggerUnlockCallbacks();
      return true;
    }
    return false;
  }

  /**
   * Checks if audio is fully unlocked and ready to play.
   */
  isUnlocked() {
    if (!this.ctx) return false;
    return this.ctx.state === 'running';
  }

  /**
   * Register a callback fired when audio is unlocked.
   */
  onUnlock(cb) {
    if (typeof cb === 'function') {
      if (this.isUnlocked()) {
        cb();
      } else {
        this.unlockCallbacks.push(cb);
      }
    }
  }

  _triggerUnlockCallbacks() {
    while (this.unlockCallbacks.length > 0) {
      const cb = this.unlockCallbacks.shift();
      try { cb(); } catch (e) { console.error(e); }
    }
  }

  _attachAutoplayUnlockListeners() {
    if (typeof document === 'undefined') return;

    const unlockHandler = () => {
      this.unlockAudio().then(success => {
        if (success) {
          document.removeEventListener('pointerdown', unlockHandler);
          document.removeEventListener('keydown', unlockHandler);
          document.removeEventListener('click', unlockHandler);
        }
      });
    };

    document.addEventListener('pointerdown', unlockHandler, { once: false, passive: true });
    document.addEventListener('keydown', unlockHandler, { once: false, passive: true });
    document.addEventListener('click', unlockHandler, { once: false, passive: true });
  }

  setMuted(muted) {
    this.isMuted = !!muted;
    if (this.masterGain && this.ctx) {
      const targetGain = this.isMuted ? 0 : this.options.masterVolume;
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(targetGain, this.ctx.currentTime + 0.05);
    }
  }

  toggleMute() {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  setMasterVolume(vol) {
    const clamped = Math.max(0, Math.min(1, vol));
    this.options.masterVolume = clamped;
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setValueAtTime(clamped, this.ctx.currentTime);
    }
  }

  // =========================================================================
  // 1. PROCEDURAL SOUND 1: Bell Chimes (Harmonic Additive Synthesis)
  // =========================================================================

  /**
   * Plays an ecclesiastical bell chime based on rarity tier.
   * - Pew Warmer (Tier 1): High, crisp silver handbell (880 Hz A5, quick crystalline decay)
   * - Altar Server (Tier 2): Dual-tone brass altar bell (523.25 Hz C5 + 659.25 Hz E5)
   * - Theologian (Tier 3): Multi-harmonic bronze bell (E4, A4, C#5 + sub-octave undertone)
   * - Doctor of the Church (Tier 4): Westminster sequenced double bell (G4, then D5)
   * - Fallback: Elegant liturgical bell
   */
  playBellChime(tier = 'pew_warmer') {
    const ctx = this.getAudioContext();
    if (!ctx || this.isMuted) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const t = ctx.currentTime;

    switch (tier) {
      case 'pew_warmer':
      default:
        this._playSilverHandbell(t);
        break;

      case 'altar_server':
        this._playBrassAltarBell(t);
        break;

      case 'theologian':
        this._playCathedralBronzeBell(t);
        break;

      case 'doctor_of_the_church':
        this._playWestminsterDoubleBell(t);
        break;

      case 'one_in_a_credillion':
        this.playOrganFlourish();
        break;
    }
  }

  /**
   * Pew Warmer: Silver handbell (A5 = 880 Hz with natural bell partials).
   */
  _playSilverHandbell(t) {
    const ctx = this.ctx;
    const baseFreq = 880;
    // Bell partials: fundamental, minor third, fifth, octave, tierce
    const partials = [
      { ratio: 1.0, gain: 0.55, decay: 0.45 },
      { ratio: 2.0, gain: 0.25, decay: 0.35 },
      { ratio: 2.76, gain: 0.15, decay: 0.25 },
      { ratio: 5.40, gain: 0.08, decay: 0.15 }
    ];

    partials.forEach(p => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * p.ratio, t);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(p.gain, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + p.decay);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + p.decay);
    });
  }

  /**
   * Altar Server: Dual-tone brass bell (C5 + E5).
   */
  _playBrassAltarBell(t) {
    const ctx = this.ctx;
    const tones = [
      { freq: 523.25, gain: 0.45, decay: 0.65 },
      { freq: 659.25, gain: 0.40, decay: 0.70 },
      { freq: 1046.50, gain: 0.15, decay: 0.30 }
    ];

    tones.forEach(tone => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(tone.freq, t);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(tone.gain, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + tone.decay);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + tone.decay);
    });
  }

  /**
   * Theologian: Deep cathedral bronze bell (rich partials & sub-harmonic).
   */
  _playCathedralBronzeBell(t) {
    const ctx = this.ctx;
    const partials = [
      { freq: 110.00, gain: 0.30, decay: 1.1 }, // sub-octave drone
      { freq: 329.63, gain: 0.45, decay: 1.2 }, // E4
      { freq: 440.00, gain: 0.40, decay: 1.0 }, // A4
      { freq: 554.37, gain: 0.35, decay: 0.9 }, // C#5
      { freq: 880.00, gain: 0.15, decay: 0.5 }
    ];

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, t);
    filter.connect(this.masterGain);

    partials.forEach(p => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(p.freq, t);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(p.gain, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + p.decay);

      osc.connect(gain);
      gain.connect(filter);

      osc.start(t);
      osc.stop(t + p.decay);
    });
  }

  /**
   * Doctor of the Church: Westminster Sequenced Double Bell.
   */
  _playWestminsterDoubleBell(t) {
    const ctx = this.ctx;

    // Strike 1: G4 at t
    const strike1 = [
      { freq: 392.00, gain: 0.45, decay: 0.95 },
      { freq: 784.00, gain: 0.18, decay: 0.50 }
    ];

    strike1.forEach(p => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(p.freq, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(p.gain, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + p.decay);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + p.decay);
    });

    // Strike 2: D5 at t + 0.14s
    const t2 = t + 0.14;
    const strike2 = [
      { freq: 587.33, gain: 0.50, decay: 1.30 },
      { freq: 1174.66, gain: 0.16, decay: 0.65 }
    ];

    strike2.forEach(p => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(p.freq, t2);
      gain.gain.setValueAtTime(0, t2);
      gain.gain.linearRampToValueAtTime(p.gain, t2 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t2 + p.decay);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t2);
      osc.stop(t2 + p.decay);
    });
  }

  // =========================================================================
  // 2. PROCEDURAL SOUND 2: Pipe Organ Flourish (One-in-a-Credillion)
  // =========================================================================

  /**
   * Pipe Organ Flourish: Majestic cathedral pipe organ chord with multi-drawbar synthesis.
   * D Major Cathedral Chord: D3, A3, D4, F#4, A4, D5.
   * Drawbar registers per pipe:
   *   - 8' Principal Fundamental (1.0x)
   *   - 4' Octave (2.0x, amp 0.55)
   *   - 2 2/3' Twelfth / Quint (3.0x, amp 0.30)
   *   - 2' Superoctave (4.0x, amp 0.20)
   * Lowpass filter with swell envelope and cathedral acoustic decay.
   */
  playOrganFlourish() {
    const ctx = this.getAudioContext();
    if (!ctx || this.isMuted) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const t = ctx.currentTime;
    const chordFrequencies = [
      this.NOTES.D3,  // 146.83 Hz Pedal
      this.NOTES.A3,  // 220.00 Hz
      this.NOTES.D4,  // 293.66 Hz
      this.NOTES.Fs4, // 369.99 Hz
      this.NOTES.A4,  // 440.00 Hz
      this.NOTES.D5   // 587.33 Hz
    ];

    // Master swell envelope for the flourish
    const swellGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, t);
    // Dynamic filter swell
    filter.frequency.linearRampToValueAtTime(3200, t + 0.5);
    filter.frequency.exponentialRampToValueAtTime(1200, t + 2.2);

    swellGain.gain.setValueAtTime(0, t);
    // Attack: 0.05s
    swellGain.gain.linearRampToValueAtTime(0.70, t + 0.05);
    // Swell peak at 0.6s
    swellGain.gain.linearRampToValueAtTime(0.85, t + 0.6);
    // Sustain until 1.1s
    swellGain.gain.setValueAtTime(0.80, t + 1.1);
    // Cathedral reverb decay to 2.4s
    swellGain.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);

    filter.connect(swellGain);
    swellGain.connect(this.masterGain);

    // Synthesize drawbars for each voice
    chordFrequencies.forEach((f0, voiceIdx) => {
      const voiceGain = ctx.createGain();
      const baseAmp = voiceIdx === 0 ? 0.35 : 0.16;
      voiceGain.gain.setValueAtTime(baseAmp, t);
      voiceGain.connect(filter);

      // Drawbars: 8', 4', 2 2/3', 2'
      const drawbars = [
        { mult: 1.0, type: 'sawtooth', amp: 0.50 }, // 8' Diapason
        { mult: 2.0, type: 'sine',     amp: 0.30 }, // 4' Octave
        { mult: 3.0, type: 'sine',     amp: 0.15 }, // 2 2/3' Quint
        { mult: 4.0, type: 'sine',     amp: 0.10 }  // 2' Superoctave
      ];

      drawbars.forEach(bar => {
        const osc = ctx.createOscillator();
        const barGain = ctx.createGain();

        osc.type = bar.type;
        // Slight detune for chorus warmth
        const detuneCents = (voiceIdx % 2 === 0 ? 1 : -1) * 3;
        osc.frequency.setValueAtTime(f0 * bar.mult, t);
        osc.detune.setValueAtTime(detuneCents, t);

        barGain.gain.setValueAtTime(bar.amp, t);

        osc.connect(barGain);
        barGain.connect(voiceGain);

        osc.start(t);
        osc.stop(t + 2.45);
      });
    });
  }

  // =========================================================================
  // 3. PROCEDURAL SOUND 3: Error Buzz (Dissonant Sawtooth Minor Second)
  // =========================================================================

  /**
   * Error Buzz: Low-frequency dissonant beat frequency for duplicate or rejected inputs.
   * Dual detuned sawtooths (C3 130.81 Hz + C#3 138.59 Hz) through an 800 Hz lowpass filter.
   */
  playErrorBuzz() {
    const ctx = this.getAudioContext();
    if (!ctx || this.isMuted) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const t = ctx.currentTime;
    const dur = 0.28;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.55, t + 0.005);
    gain.gain.setValueAtTime(0.50, t + dur - 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    filter.connect(gain);
    gain.connect(this.masterGain);

    // Two detuned sawtooth oscillators producing dissonant beating
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(130.81, t); // C3

    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(138.59, t); // C#3 (half-step clash)

    osc1.connect(filter);
    osc2.connect(filter);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + dur);
    osc2.stop(t + dur);
  }

  // =========================================================================
  // 4. PROCEDURAL SOUND 4: Ticking Heartbeat Countdown (Final 15s)
  // =========================================================================

  /**
   * Heartbeat Countdown: Dual transient lub-dub acoustic heartbeat pulse.
   * Fired once per second during the final 15 seconds of a round.
   * Sub-bass thump (90 Hz -> 35 Hz pitch drop) + mechanical tick transient.
   */
  playHeartbeat(remainingSeconds = 15) {
    const ctx = this.getAudioContext();
    if (!ctx || this.isMuted) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const t = ctx.currentTime;
    // Higher urgency / volume in final 5 seconds
    const urgency = remainingSeconds <= 5 ? 1.25 : 1.0;

    // --- First impact: "Lub" at t ---
    this._playHeartbeatPulse(t, 95, 38, 0.45 * urgency, 0.12);
    // Mechanical click transient
    this._playHeartbeatClick(t, 0.18 * urgency);

    // --- Second impact: "Dub" at t + 0.16s ---
    this._playHeartbeatPulse(t + 0.16, 85, 32, 0.35 * urgency, 0.10);
    this._playHeartbeatClick(t + 0.16, 0.12 * urgency);
  }

  _playHeartbeatPulse(t, startFreq, endFreq, peakGain, duration) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peakGain, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + duration);
  }

  _playHeartbeatClick(t, gainVal) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.02);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(gainVal, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.03);
  }

  // =========================================================================
  // 5. PROCEDURAL SOUND 5: Victory Fanfare (Brass Trumpet Arpeggio + Chords)
  // =========================================================================

  /**
   * Victory Fanfare: Brass trumpet arpeggio (C4 -> E4 -> G4 -> C5)
   * followed by a sustained majestic C Major chord with organ warmth.
   */
  playVictoryFanfare() {
    const ctx = this.getAudioContext();
    if (!ctx || this.isMuted) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const t = ctx.currentTime;

    // Arpeggio notes: C4 (0.0s), E4 (0.16s), G4 (0.32s), C5 (0.48s sustain)
    const notes = [
      { freq: this.NOTES.C4, start: 0.00, dur: 0.15 },
      { freq: this.NOTES.E4, start: 0.16, dur: 0.15 },
      { freq: this.NOTES.G4, start: 0.32, dur: 0.15 },
      { freq: this.NOTES.C5, start: 0.48, dur: 1.80 }
    ];

    notes.forEach(n => {
      this._playBrassNote(t + n.start, n.freq, n.dur, 0.45);
    });

    // Sustained backing chord starting at t + 0.48s: C4, G4, E5, C6
    const chordTime = t + 0.48;
    const chordNotes = [this.NOTES.C4, this.NOTES.G4, this.NOTES.C5, this.NOTES.E5];
    chordNotes.forEach(f => {
      this._playBrassNote(chordTime, f, 1.80, 0.22);
    });

    // Underpinning cathedral organ pedal
    this._playOrganPedal(chordTime, this.NOTES.C3, 2.0);
  }

  _playBrassNote(startTime, freq, duration, amp) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, startTime);

    // Brass filter envelope: opens with brass bite then stabilizes
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, startTime);
    filter.frequency.linearRampToValueAtTime(3000, startTime + 0.04);
    filter.frequency.linearRampToValueAtTime(1800, startTime + duration);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(amp, startTime + 0.03);
    gain.gain.setValueAtTime(amp * 0.85, startTime + duration - 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  _playOrganPedal(startTime, freq, duration) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.40, startTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  // =========================================================================
  // Dispatcher for Server WebSocket AUDIO_EVENT Messages
  // =========================================================================

  /**
   * Handles incoming AUDIO_EVENT WebSocket messages from the server.
   * Message format: { type: 'AUDIO_EVENT', sound: 'bell'|'organ'|'error'|'heartbeat'|'fanfare', tier: ... }
   */
  handleAudioEvent(event = {}) {
    if (!event || typeof event !== 'object') return;
    const sound = (event.sound || event.soundEvent || event.effect || '').toLowerCase();

    if (sound === 'organ' || sound.includes('organ')) {
      this.playOrganFlourish();
    } else if (sound === 'error' || sound.includes('buzz') || sound.includes('error')) {
      this.playErrorBuzz();
    } else if (sound === 'fanfare' || sound.includes('victory') || sound.includes('fanfare')) {
      this.playVictoryFanfare();
    } else if (sound === 'heartbeat') {
      this.playHeartbeat(event.remainingSeconds || 15);
    } else if (sound === 'bell' || sound.includes('chime') || sound === 'gong') {
      this.playBellChime(event.tier || 'pew_warmer');
    } else {
      this.playBellChime('pew_warmer');
    }
  }
}

// Browser & Node environment export handling
if (typeof window !== 'undefined') {
  window.EcclesiasticalAudioSynthesizer = EcclesiasticalAudioSynthesizer;
  window.credillionAudio = new EcclesiasticalAudioSynthesizer();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EcclesiasticalAudioSynthesizer };
}
