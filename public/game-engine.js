/**
 * Catholic Krillion ("Credillion") — Browser Client Engine & Cloud Relay
 * 
 * Provides:
 * 1. Fully client-side authoritative game engine (matching server.js)
 * 2. Real-time Cloud Relay over EMQX public WSS MQTT broker for zero-server Netlify deployment
 * 3. 30-second automatic category rotation and multi-word answer validation
 * 4. Match-wide duplicate prevention and anti-spam rate limiting
 */

(function(global) {
  'use strict';

  const ROUND_1_DURATION_MS = 180 * 1000;
  const HALFTIME_DURATION_MS = 30 * 1000;
  const ROUND_2_DURATION_MS = 180 * 1000;
  const CATEGORY_ROTATION_MS = 60 * 1000;
  const SUBMIT_COOLDOWN_MS = 350;

  const TIER_CONFIG = {
    pew_warmer: { name: 'Pew Warmer', basePoints: 10, baseMeters: 100, audio: 'chime_pew_warmer' },
    altar_server: { name: 'Altar Server', basePoints: 30, baseMeters: 300, audio: 'chime_altar_server' },
    theologian: { name: 'Theologian', basePoints: 60, baseMeters: 600, audio: 'chime_theologian' },
    doctor_of_the_church: { name: 'Doctor of the Church', basePoints: 85, baseMeters: 850, audio: 'chime_doctor' },
    one_in_a_credillion: { name: 'One-in-a-Credillion', basePoints: 100, baseMeters: 1000, audio: 'organ_flourish' }
  };

  class ClientGameEngine {
    constructor(questionsData, onBroadcast) {
      this.questionsData = questionsData || (typeof window !== 'undefined' && window.KRILLION_QUESTIONS) || (typeof global !== 'undefined' && global.KRILLION_QUESTIONS) || { categories: [] };
      this.onBroadcast = onBroadcast || (() => {});
      this.categories = (this.questionsData && this.questionsData.categories) || [];
      this.usedCategoryIds = new Set();
      this.timerId = null;

      // Initialize validator
      const ValClass = (typeof window !== 'undefined' && window.KrillionValidator) || 
                       (typeof global !== 'undefined' && global.KrillionValidator);
      if (ValClass) {
        this.validator = new ValClass(this.questionsData, { matchWideUnique: false });
      } else {
        this.validator = null;
      }

      this.reset();
    }

    reset() {
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }

      this.phase = 'lobby';
      this.round = 0;
      this.multiplier = 1.0;
      this.remainingMs = 0;
      this.totalMs = 0;
      this.paused = false;
      this.pausedRemainingMs = 0;

      this.categoryRemainingMs = CATEGORY_ROTATION_MS;
      this.categoryTotalMs = CATEGORY_ROTATION_MS;
      this.usedCategoryIds.clear();

      const defaultCat = this.categories[0] || {
        id: 'words_in_our_father',
        title: "Words in the Our Father / Lord's Prayer",
        prompt: "Name words that appear in the traditional Catholic Lord's Prayer (Our Father)!",
        description: "Accessible prayer foundation prompt."
      };

      this.prompt = {
        id: defaultCat.id,
        title: defaultCat.title,
        prompt: defaultCat.prompt,
        description: defaultCat.description || defaultCat.prompt
      };

      this.scores = {
        team1: { points: 0, depthMeters: 0, wordsScored: [] },
        team2: { points: 0, depthMeters: 0, wordsScored: [] }
      };

      this.liveTyping = { team1: '', team2: '' };
      this.lastSubmitTime = { team1: 0, team2: 0 };

      if (this.validator && typeof this.validator.resetSession === 'function') {
        this.validator.resetSession();
      }

      this.broadcastStateSync();
    }

    pickRandomCategory() {
      if (!this.categories || this.categories.length === 0) return this.prompt;
      let pool = this.categories.filter(c => !this.usedCategoryIds.has(c.id));
      if (pool.length === 0) {
        this.usedCategoryIds.clear();
        pool = this.categories.filter(c => c.id !== (this.prompt && this.prompt.id));
        if (pool.length === 0) pool = this.categories;
      }

      const idx = Math.floor(Math.random() * pool.length);
      const chosen = pool[idx];
      this.usedCategoryIds.add(chosen.id);

      this.prompt = {
        id: chosen.id,
        title: chosen.title,
        prompt: chosen.prompt,
        description: chosen.description || chosen.prompt
      };

      this.liveTyping.team1 = '';
      this.liveTyping.team2 = '';
      this.categoryRemainingMs = CATEGORY_ROTATION_MS;

      return chosen;
    }

    startMatch() {
      this.reset();
      this.phase = 'round1';
      this.round = 1;
      this.multiplier = 1.0;
      this.remainingMs = ROUND_1_DURATION_MS;
      this.totalMs = ROUND_1_DURATION_MS;
      this.categoryRemainingMs = CATEGORY_ROTATION_MS;
      this.pickRandomCategory();

      this.startClock();
      this.broadcastStateSync();
      this.broadcastAudio('gong');
    }

    startClock() {
      if (this.timerId) clearInterval(this.timerId);
      this.timerId = setInterval(() => this.tick(), 1000);
    }

    pauseMatch() {
      if (this.phase !== 'round1' && this.phase !== 'round2' && this.phase !== 'halftime') return;
      this.paused = !this.paused;
      this.broadcastTimerSync();
      this.broadcastStateSync();
    }

    resumeMatch() {
      if (this.paused) {
        this.paused = false;
        this.broadcastTimerSync();
        this.broadcastStateSync();
      }
    }

    tick() {
      if (this.paused) return;

      if (this.remainingMs > 0) {
        this.remainingMs -= 1000;
        if (this.remainingMs < 0) this.remainingMs = 0;
      }

      // Handle 30s Category Rotation
      if (this.phase === 'round1' || this.phase === 'round2') {
        this.categoryRemainingMs -= 1000;
        if (this.categoryRemainingMs <= 0) {
          this.pickRandomCategory();
          this.broadcastCategoryRotated();
        }
      }

      // Handle Phase Transitions
      if (this.remainingMs <= 0) {
        if (this.phase === 'round1') {
          this.phase = 'halftime';
          this.round = 0;
          this.remainingMs = HALFTIME_DURATION_MS;
          this.totalMs = HALFTIME_DURATION_MS;
          this.categoryRemainingMs = CATEGORY_ROTATION_MS;
          this.broadcastAudio('gong');
          this.broadcastStateSync();
        } else if (this.phase === 'halftime') {
          this.phase = 'round2';
          this.round = 2;
          this.multiplier = 1.5;
          this.remainingMs = ROUND_2_DURATION_MS;
          this.totalMs = ROUND_2_DURATION_MS;
          this.categoryRemainingMs = CATEGORY_ROTATION_MS;
          this.pickRandomCategory();
          this.broadcastAudio('gong');
          this.broadcastStateSync();
        } else if (this.phase === 'round2') {
          this.phase = 'gameover';
          this.round = 0;
          this.remainingMs = 0;
          if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
          }
          this.broadcastAudio('victory_fanfare');
          this.broadcastStateSync();
        }
      }

      this.broadcastTimerSync();
    }

    submitWord(team, word) {
      const now = Date.now();
      if (!this.lastSubmitTime[team]) this.lastSubmitTime[team] = 0;
      if (now - this.lastSubmitTime[team] < SUBMIT_COOLDOWN_MS) {
        return { accepted: false, reason: 'rate_limited' };
      }
      this.lastSubmitTime[team] = now;

      if (this.phase !== 'round1' && this.phase !== 'round2') {
        return { accepted: false, reason: 'round_not_active' };
      }
      if (this.paused) {
        return { accepted: false, reason: 'paused' };
      }

      const trimmed = (word || '').trim();
      if (!trimmed) {
        return { accepted: false, reason: 'empty_input' };
      }

      let evalResult = null;
      if (this.validator && typeof this.validator.evaluateAnswer === 'function') {
        evalResult = this.validator.evaluateAnswer(this.prompt.id, trimmed, team, this.round || 1);
      } else {
        evalResult = { accepted: false, reason: 'no_validator' };
      }

      // Check duplicate against words scored across both teams in this category (cross-team lock)
      if (evalResult.accepted) {
        const canonical = evalResult.canonical || trimmed;
        const norm = canonical.toLowerCase().trim();
        const activeCatId = this.prompt ? this.prompt.id : null;
        
        const scoredByTeam1 = this.scores.team1 && this.scores.team1.wordsScored.some(w => 
          w.categoryId === activeCatId && (w.canonical || w.word || '').toLowerCase().trim() === norm
        );
        const scoredByTeam2 = this.scores.team2 && this.scores.team2.wordsScored.some(w => 
          w.categoryId === activeCatId && (w.canonical || w.word || '').toLowerCase().trim() === norm
        );

        if (scoredByTeam1 || scoredByTeam2) {
          evalResult.accepted = false;
          evalResult.reason = 'duplicate';
          evalResult.message = scoredByTeam1 ? 'Already claimed by Team 1!' : 'Already claimed by Team 2!';
          evalResult.audioTrigger = 'error_buzz';
        }
      }

      if (evalResult.accepted) {
        const tierKey = evalResult.tier || 'pew_warmer';
        const mult = this.round === 2 ? 1.5 : 1.0;
        const cfg = TIER_CONFIG[tierKey] || TIER_CONFIG.pew_warmer;
        const pts = evalResult.points || Math.round(cfg.basePoints * mult);
        const meters = evalResult.depthMeters || Math.round(cfg.baseMeters * mult);

        this.scores[team].points += pts;
        this.scores[team].depthMeters += meters;

        const record = {
          word: trimmed,
          canonical: evalResult.canonical || trimmed,
          tier: tierKey,
          tierName: cfg.name,
          points: pts,
          depthMeters: meters,
          round: this.round,
          categoryId: this.prompt ? this.prompt.id : null,
          timestamp: Date.now()
        };

        this.scores[team].wordsScored.unshift(record);

        // Audio trigger
        const audioKey = evalResult.audioTrigger || cfg.audio || 'chime_altar_server';
        this.broadcastAudio(audioKey);

        const evalMsg = {
          type: 'WORD_EVALUATED',
          team,
          scores: this.scores,
          result: {
            accepted: true,
            word: trimmed,
            canonical: record.canonical,
            tier: tierKey,
            tierName: cfg.name,
            points: pts,
            depthMeters: meters,
            audioTrigger: audioKey,
            scores: this.scores
          }
        };
        this.onBroadcast(evalMsg);
        this.broadcastStateSync();
        return evalResult;
      } else {
        // Rejected
        this.broadcastAudio(evalResult.audioTrigger || 'error_buzz');
        const evalMsg = {
          type: 'WORD_EVALUATED',
          team,
          scores: this.scores,
          result: {
            accepted: false,
            word: trimmed,
            reason: evalResult.reason || 'not_found',
            audioTrigger: evalResult.audioTrigger || 'error_buzz',
            scores: this.scores
          }
        };
        this.onBroadcast(evalMsg);
        return evalResult;
      }
    }

    setLiveTyping(team, text) {
      this.liveTyping[team] = text || '';
      this.onBroadcast({
        type: 'LIVE_TYPING_RELAY',
        team,
        text: this.liveTyping[team]
      });
    }

    handleAction(action, payload) {
      switch (action) {
        case 'START':
          this.startMatch();
          break;
        case 'PAUSE':
          this.pauseMatch();
          break;
        case 'RESUME':
          this.resumeMatch();
          break;
        case 'RESET':
          this.reset();
          break;
        case 'NEXT_CATEGORY':
          this.pickRandomCategory();
          this.broadcastCategoryRotated();
          break;
        default:
          break;
      }
    }

    broadcastStateSync() {
      const msg = {
        type: 'STATE_SYNC',
        phase: this.phase,
        round: this.round,
        multiplier: this.multiplier,
        prompt: this.prompt,
        scores: this.scores,
        liveTyping: this.liveTyping,
        paused: this.paused,
        remainingMs: this.remainingMs,
        totalMs: this.totalMs,
        categoryRemainingSeconds: Math.ceil(this.categoryRemainingMs / 1000)
      };
      this.onBroadcast(msg);
    }

    broadcastTimerSync() {
      const msg = {
        type: 'TIMER_SYNC',
        phase: this.phase,
        remainingMs: this.remainingMs,
        totalMs: this.totalMs,
        paused: this.paused,
        categoryRemainingSeconds: Math.ceil(this.categoryRemainingMs / 1000),
        serverTime: Date.now()
      };
      this.onBroadcast(msg);
    }

    broadcastCategoryRotated() {
      const msg = {
        type: 'CATEGORY_ROTATED',
        prompt: this.prompt,
        categoryRemainingSeconds: Math.ceil(this.categoryRemainingMs / 1000) || 60
      };
      this.onBroadcast(msg);
      this.broadcastAudio('chime_pew_warmer');
      this.broadcastStateSync();
    }

    broadcastAudio(effect) {
      this.onBroadcast({
        type: 'AUDIO_EVENT',
        effect
      });
    }
  }

  // --- Cloud Relay over MQTT WSS ---
  class CloudRelay {
    constructor(options = {}) {
      this.roomId = options.roomId || 'credillion';
      this.role = options.role || 'host'; // 'host' | 'team1' | 'team2'
      this.onMessage = options.onMessage || (() => {});
      this.onStatus = options.onStatus || (() => {});
      this.brokerUrl = options.brokerUrl || 'wss://broker.emqx.io:8084/mqtt';
      this.client = null;
      this.connected = false;

      this.inboundTopic = `catholic-krillion/room/${this.roomId}/inbound`;
      this.broadcastTopic = `catholic-krillion/room/${this.roomId}/broadcast`;
    }

    connect() {
      if (typeof mqtt === 'undefined') {
        console.warn('[CloudRelay] MQTT library not found, cannot connect to cloud broker.');
        return;
      }

      const randomId = Math.random().toString(16).substring(2, 8);
      const clientId = `kril_${this.role}_${randomId}`;

      try {
        this.client = mqtt.connect(this.brokerUrl, {
          clientId,
          clean: true,
          reconnectPeriod: 2000,
          connectTimeout: 5000
        });

        this.client.on('connect', () => {
          this.connected = true;
          this.onStatus('connected');
          console.log(`[CloudRelay] Connected to cloud broker (${this.role}) for room: ${this.roomId}`);

          if (this.role === 'host') {
            this.client.subscribe(this.inboundTopic, { qos: 0 });
          } else {
            this.client.subscribe(this.broadcastTopic, { qos: 0 });
            // Send registration immediately
            this.publish({ type: 'REGISTER', role: this.role });
          }
        });

        this.client.on('message', (topic, payload) => {
          try {
            const data = JSON.parse(payload.toString());
            this.onMessage(data);
          } catch (e) {
            console.error('[CloudRelay] Message parse error:', e);
          }
        });

        this.client.on('offline', () => {
          this.connected = false;
          this.onStatus('offline');
        });

        this.client.on('error', (err) => {
          console.warn('[CloudRelay] Broker error:', err);
          this.onStatus('error');
        });
      } catch (err) {
        console.error('[CloudRelay] Connection exception:', err);
        this.onStatus('error');
      }
    }

    publish(msg) {
      if (!this.client || !this.connected) return false;
      const topic = this.role === 'host' ? this.broadcastTopic : this.inboundTopic;
      this.client.publish(topic, JSON.stringify(msg), { qos: 0 });
      return true;
    }

    disconnect() {
      if (this.client) {
        this.client.end(true);
        this.connected = false;
      }
    }
  }

  global.ClientGameEngine = ClientGameEngine;
  global.CloudRelay = CloudRelay;
  global.TIER_CONFIG = TIER_CONFIG;

})(typeof window !== 'undefined' ? window : this);
