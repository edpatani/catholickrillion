/**
 * Catholic Krillion ("Credillion") — Real-Time Game Server
 *
 * Provides:
 * 1. HTTP server with static asset serving for public/ and API endpoints
 * 2. LAN IP auto-detection & QR code generation for mobile/laptop connection
 * 3. Authoritative WebSocket server with TCP setNoDelay(true) for < 100ms keystroke relay
 * 4. Authoritative match timer and state machine (lobby -> round1 -> halftime -> round2 -> gameover)
 * 5. Integrated question validation and duplicate prevention with fallback support
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');
const QRCode = require('qrcode');

// --- Configuration & Constants ---
const PORT = parseInt(process.env.PORT, 10) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const ROUND_1_DURATION_MS = 180 * 1000; // 3 minutes (3 categories x 1 min)
const HALFTIME_DURATION_MS = 30 * 1000;  // 30 seconds
const ROUND_2_DURATION_MS = 180 * 1000; // 3 minutes (3 categories x 1 min)
const TICK_INTERVAL_MS = 1000;
const CATEGORY_ROTATION_MS = 60 * 1000; // 60 seconds (1 minute) automatic category rotation

const TIER_CONFIG = {
  pew_warmer: { name: 'Pew Warmer', basePoints: 10, baseMeters: 100 },
  altar_server: { name: 'Altar Server', basePoints: 30, baseMeters: 300 },
  theologian: { name: 'Theologian', basePoints: 60, baseMeters: 600 },
  doctor_of_the_church: { name: 'Doctor of the Church', basePoints: 85, baseMeters: 850 },
  one_in_a_credillion: { name: 'One-in-a-Credillion', basePoints: 100, baseMeters: 1000 }
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// --- LAN IP Detection ---
function getLocalIpAddress() {
  const nets = os.networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(nets)) {
    const isVirtual = /vEthernet|virtual|wsl|hyper-v|loopback|docker|vmware/i.test(name);
    for (const net of nets[name]) {
      const isIpv4 = net.family === 'IPv4' || net.family === 4;
      if (isIpv4 && !net.internal) {
        candidates.push({
          name,
          address: net.address,
          isVirtual,
          isPrivate192: net.address.startsWith('192.168.'),
          isPrivate10: net.address.startsWith('10.'),
          isPrivate172: /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(net.address)
        });
      }
    }
  }

  const nonVirtual = candidates.filter(c => !c.isVirtual);
  const pool = nonVirtual.length > 0 ? nonVirtual : candidates;

  pool.sort((a, b) => {
    if (a.isPrivate192 && !b.isPrivate192) return -1;
    if (!a.isPrivate192 && b.isPrivate192) return 1;
    if (a.isPrivate10 && !b.isPrivate10) return -1;
    if (!a.isPrivate10 && b.isPrivate10) return 1;
    return 0;
  });

  return pool.length > 0 ? pool[0].address : '127.0.0.1';
}

const LAN_IP = getLocalIpAddress();

function getEffectiveBaseUrl() {
  const candidateFiles = [
    path.join(__dirname, 'public_url.txt'),
    path.join(__dirname, 'scratch', 'public_url.txt'),
    path.join(__dirname, '..', '..', 'scratch', 'public_url.txt')
  ];
  for (const urlFile of candidateFiles) {
    if (fs.existsSync(urlFile)) {
      try {
        const u = fs.readFileSync(urlFile, 'utf8').trim();
        if (u && u.startsWith('http')) return u.replace(/\/$/, '');
      } catch (e) {}
    }
  }
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  return `http://${LAN_IP}:${PORT}`;
}

// --- Built-in Starter Categories & Fallback Validator ---
const FALLBACK_CATEGORIES = [
  {
    id: 'words_in_our_father',
    title: "Words in the Our Father / Lord's Prayer",
    prompt: "Name words that appear in the traditional Catholic Lord's Prayer (Our Father)!",
    description: "Accessible prayer foundation prompt for university students.",
    tiers: {
      pew_warmer: ['father', 'heaven', 'name', 'kingdom', 'bread', 'earth', 'daily', 'day', 'deliver', 'evil', 'amen'],
      altar_server: ['hallowed', 'come', 'done', 'give', 'forgive', 'trespasses', 'trespass', 'against', 'lead', 'temptation'],
      theologian: ['art', 'thy', 'thine', 'will', 'debtors', 'debts', 'power', 'glory'],
      doctor_of_the_church: ['pater', 'noster', 'panem', 'quotidianum', 'debita', 'inducas', 'malo'],
      one_in_a_credillion: ['supersubstantial', 'dimitte', 'tentationem', 'caelis', 'sanctificetur']
    }
  },
  {
    id: 'popular_intercessory_saints',
    title: "Popular Intercessory Saints & Angels",
    prompt: "Beloved saints and archangels Catholics invoke for help and prayers!",
    description: "Patrons and holy intercessors.",
    tiers: {
      pew_warmer: ['mary', 'joseph', 'michael', 'anthony', 'francis of assisi', 'peter', 'paul', 'patrick'],
      altar_server: ['jude', 'therese of lisieux', 'padre pio', 'benedict', 'joan of arc', 'christopher', 'rita of cascia', 'gabriel', 'raphael'],
      theologian: ['thomas aquinas', 'augustine', 'ignatius of loyola', 'teresa of avila', 'john of the cross', 'faustina', 'maximilian kolbe', 'kateri tekakwitha'],
      doctor_of_the_church: ['athanasius', 'john chrysostom', 'gregory the great', 'basil', 'hildegard of bingen', 'catherine of siena', 'robert bellarmine'],
      one_in_a_credillion: ['drogo', 'joseph of cupertino', 'moses the black', 'gemma galgani', 'pier giorgio frassati', 'carlo acutis', 'dymphna']
    }
  },
  {
    id: 'sacramentals_and_prayer_objects',
    title: "Objects & Sacramentals Used in Prayer",
    prompt: "Sacred items, sacramentals, and physical objects Catholics use when praying!",
    description: "Sensory sacramentals and holy articles.",
    tiers: {
      pew_warmer: ['rosary beads', 'crucifix', 'holy water', 'bible', 'candle', 'statue', 'prayer card', 'rosary'],
      altar_server: ['brown scapular', 'miraculous medal', 'incense', 'palm branch', 'blessed ashes', 'blessed salt', 'missal'],
      theologian: ['thurible', 'boat', 'aspergillum', 'reliquary', 'holy icon', 'green scapular', 'st benedict medal', 'prayer shawl'],
      doctor_of_the_church: ['humeral veil', 'ciborium', 'monstrance', 'asperges', 'prie dieu', 'breviary', 'komboskini'],
      one_in_a_credillion: ['tintinnabulum', 'ombrellino', 'agnus dei wax tablet', 'holy water font', 'bulla', 'bugia']
    }
  },
  {
    id: 'latin_and_liturgical_words',
    title: "Traditional Latin & Liturgical Words",
    prompt: "Latin words and ancient liturgical phrases heard at Mass and in prayer!",
    description: "Universal language of the Roman rite.",
    tiers: {
      pew_warmer: ['amen', 'alleluia', 'hosanna', 'kyrie', 'gloria', 'sanctus', 'credo', 'regina'],
      altar_server: ['agnus dei', 'mea culpa', 'pax vobiscum', 'deo gratias', 'dominus vobiscum', 'sursum corda', 'in excelsis'],
      theologian: ['confiteor', 'miserere', 'anima christi', 'salve regina', 'te deum', 'tantum ergo', 'pange lingua', 'o salutaris'],
      doctor_of_the_church: ['asperges me', 'vidi aquam', 'requiem aeternam', 'sub tuum praesidium', 'stabat mater', 'dies irae', 'lauda sion'],
      one_in_a_credillion: ['per ipsum et cum ipso', 'ite missa est', 'ecce agnus dei', 'mandatum', 'exsultet', 'introibo ad altare dei']
    }
  },
  {
    id: 'seven_sacraments',
    title: "The Seven Sacraments & Sacramental Terms",
    prompt: "The Seven Sacraments of the Church and essential sacramental concepts!",
    description: "Channels of divine grace instituted by Christ.",
    tiers: {
      pew_warmer: ['baptism', 'confirmation', 'eucharist', 'confession', 'marriage', 'holy orders', 'anointing of the sick'],
      altar_server: ['reconciliation', 'penance', 'matrimony', 'last rites', 'communion', 'ordination', 'priesthood'],
      theologian: ['transubstantiation', 'real presence', 'sacramental character', 'matter and form', 'absolution', 'chrismation', 'viaticum'],
      doctor_of_the_church: ['ex opere operato', 'indelible mark', 'epiclesis', 'contrition', 'attrition', 'consummation', 'valid and licit'],
      one_in_a_credillion: ['form and matter', 'res et sacramentum', 'sacramentum tantum', 'res tantum', 'anaphora', 'mystagogia']
    }
  }
];

function levenshteinDistance(s1, s2) {
  if (s1 === s2) return 0;
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;

  const v0 = new Array(s2.length + 1);
  const v1 = new Array(s2.length + 1);

  for (let i = 0; i <= s2.length; i++) v0[i] = i;

  for (let i = 0; i < s1.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < s2.length; j++) {
      const cost = s1[i] === s2[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= s2.length; j++) v0[j] = v1[j];
  }
  return v0[s2.length];
}

function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/æ/g, 'ae')
    .replace(/œ/g, 'oe')
    .replace(/ß/g, 'ss')
    .replace(/-/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^(saint|st|ste|san|santa|santo|the|a|an)\s+/i, '')
    .trim();
}

// Fallback validator state
const fallbackScoredCache = {
  team1: {},
  team2: {}
};

function fallbackEvaluateAnswer(categoryId, rawInput, teamId, roundNumber) {
  const norm = normalizeText(rawInput);
  if (!norm) {
    return {
      accepted: false,
      tier: null,
      canonical: null,
      points: 0,
      depthMeters: 0,
      reason: 'invalid_input'
    };
  }

  const category = FALLBACK_CATEGORIES.find(c => c.id === categoryId) || FALLBACK_CATEGORIES[0];
  const mult = roundNumber === 2 ? 1.5 : 1.0;

  // Initialize duplicate bucket (per-category for this team and cross-team shared)
  if (!fallbackScoredCache[teamId]) fallbackScoredCache[teamId] = {};
  if (!fallbackScoredCache[teamId][category.id]) fallbackScoredCache[teamId][category.id] = new Set();
  const scoredSet = fallbackScoredCache[teamId][category.id];

  if (!fallbackScoredCache.shared) fallbackScoredCache.shared = {};
  if (!fallbackScoredCache.shared[category.id]) fallbackScoredCache.shared[category.id] = new Set();
  const sharedSet = fallbackScoredCache.shared[category.id];

  // Search through tiers (from highest rarity to lowest)
  const tierOrder = ['one_in_a_credillion', 'doctor_of_the_church', 'theologian', 'altar_server', 'pew_warmer'];

  for (const tierKey of tierOrder) {
    const list = category.tiers[tierKey] || [];
    for (const item of list) {
      const normTarget = normalizeText(item);
      let match = false;

      if (norm === normTarget) {
        match = true;
      } else {
        const len = normTarget.length;
        const maxDist = len <= 4 ? 0 : (len <= 8 ? 1 : 2);
        if (maxDist > 0 && Math.abs(norm.length - len) <= maxDist) {
          if (levenshteinDistance(norm, normTarget) <= maxDist) {
            match = true;
          }
        }
      }

      if (match) {
        if (scoredSet.has(normTarget) || sharedSet.has(normTarget)) {
          return {
            accepted: false,
            tier: tierKey,
            canonical: item,
            points: 0,
            depthMeters: 0,
            reason: 'duplicate',
            message: 'Already claimed by another team!'
          };
        }

        scoredSet.add(normTarget);
        sharedSet.add(normTarget);
        const cfg = TIER_CONFIG[tierKey];
        const pts = Math.round(cfg.basePoints * mult);
        const meters = Math.round(cfg.baseMeters * mult);

        return {
          accepted: true,
          tier: tierKey,
          canonical: item,
          points: pts,
          depthMeters: meters,
          reason: null
        };
      }
    }
  }

  return {
    accepted: false,
    tier: null,
    canonical: null,
    points: 0,
    depthMeters: 0,
    reason: 'not_found'
  };
}

// Dynamic Validator loader (delegates to Worker M2's validator when available)
let externalValidator = null;

function getValidator() {
  if (externalValidator) return externalValidator;

  try {
    const questionsPath = path.join(__dirname, 'data', 'questions.json');
    const validatorPath = path.join(__dirname, 'engine', 'validator.js');

    if (fs.existsSync(questionsPath) && fs.existsSync(validatorPath)) {
      delete require.cache[require.resolve(validatorPath)];
      delete require.cache[require.resolve(questionsPath)];

      const qData = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
      const valMod = require(validatorPath);
      const ValClass = valMod.KrillionValidator || valMod.default || valMod;

      if (typeof ValClass === 'function') {
        externalValidator = new ValClass(qData, { matchWideUnique: false });
        console.log('[Validator] Successfully integrated external KrillionValidator');
        return externalValidator;
      }
    }
  } catch (err) {
    // Keep using fallback quietly
  }

  return null;
}

function loadAllCategories() {
  try {
    const questionsPath = path.join(__dirname, 'data', 'questions.json');
    if (fs.existsSync(questionsPath)) {
      const raw = fs.readFileSync(questionsPath, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.categories) && data.categories.length > 0) {
        return data.categories.map(c => ({
          id: c.id,
          title: c.title,
          prompt: c.prompt,
          description: c.description || c.prompt
        }));
      }
    }
  } catch (err) {
    console.warn('[Server] Could not load questions.json, falling back to built-ins:', err.message);
  }
  return FALLBACK_CATEGORIES.map(c => ({
    id: c.id,
    title: c.title,
    prompt: c.prompt,
    description: c.description || c.prompt
  }));
}

// --- Authoritative Game State ---
class GameStateManager {
  constructor() {
    this.allCategories = loadAllCategories();
    this.usedCategoryIds = new Set();
    this.reset();
  }

  reset() {
    this.phase = 'lobby'; // 'lobby' | 'round1' | 'halftime' | 'round2' | 'gameover'
    this.round = 0;
    this.multiplier = 1.0;
    this.totalDurationMs = 0;
    this.remainingMs = 0;
    this.startTime = 0;
    this.endTime = 0;
    this.paused = false;
    this.pausedRemainingMs = 0;

    this.categoryRemainingMs = CATEGORY_ROTATION_MS;
    this.categoryTotalMs = CATEGORY_ROTATION_MS;
    this.usedCategoryIds = new Set();

    const defaultCat = (this.allCategories && this.allCategories[0]) || FALLBACK_CATEGORIES[0];
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

    this.liveTyping = {
      team1: '',
      team2: ''
    };

    this.lastSubmitTime = {
      team1: 0,
      team2: 0
    };

    // Reset fallback duplicates
    fallbackScoredCache.team1 = {};
    fallbackScoredCache.team2 = {};

    const ext = getValidator();
    if (ext && typeof ext.resetSession === 'function') {
      ext.resetSession();
    }
  }

  pickRandomCategory() {
    if (!this.allCategories || this.allCategories.length === 0) return this.prompt;

    let pool = this.allCategories.filter(c => !this.usedCategoryIds.has(c.id));
    if (pool.length === 0) {
      this.usedCategoryIds.clear();
      pool = this.allCategories.filter(c => c.id !== (this.prompt && this.prompt.id));
      if (pool.length === 0) pool = this.allCategories;
    }

    const randomIndex = Math.floor(Math.random() * pool.length);
    const chosen = pool[randomIndex];
    this.usedCategoryIds.add(chosen.id);

    this.prompt = {
      id: chosen.id,
      title: chosen.title,
      prompt: chosen.prompt,
      description: chosen.description || chosen.prompt
    };

    // Reset live typing on category change
    this.liveTyping.team1 = '';
    this.liveTyping.team2 = '';
    this.categoryRemainingMs = CATEGORY_ROTATION_MS;

    return chosen;
  }

  setCategory(catId) {
    const found = this.allCategories.find(c => c.id === catId);
    if (found) {
      this.prompt = {
        id: found.id,
        title: found.title,
        prompt: found.prompt,
        description: found.description || found.prompt
      };
      this.liveTyping.team1 = '';
      this.liveTyping.team2 = '';
      this.categoryRemainingMs = CATEGORY_ROTATION_MS;
    }
  }

  startMatch() {
    this.reset();
    this.phase = 'round1';
    this.round = 1;
    this.multiplier = 1.0;
    this.totalDurationMs = ROUND_1_DURATION_MS;
    this.remainingMs = ROUND_1_DURATION_MS;
    this.startTime = Date.now();
    this.endTime = this.startTime + ROUND_1_DURATION_MS;
    this.paused = false;

    // Pick a random category when contest starts!
    this.pickRandomCategory();
    this.categoryRemainingMs = CATEGORY_ROTATION_MS;
    this.categoryTotalMs = CATEGORY_ROTATION_MS;
  }

  pause() {
    if (this.paused || this.phase === 'lobby' || this.phase === 'gameover') return;
    this.paused = true;
    this.pausedRemainingMs = Math.max(0, this.endTime - Date.now());
  }

  resume() {
    if (!this.paused || this.phase === 'lobby' || this.phase === 'gameover') return;
    this.paused = false;
    this.endTime = Date.now() + this.pausedRemainingMs;
  }

  skipHalftime() {
    if (this.phase === 'halftime' || this.phase === 'round1') {
      this.phase = 'round2';
      this.round = 2;
      this.multiplier = 1.5;
      this.totalDurationMs = ROUND_2_DURATION_MS;
      this.remainingMs = ROUND_2_DURATION_MS;
      this.startTime = Date.now();
      this.endTime = this.startTime + ROUND_2_DURATION_MS;
      this.paused = false;

      // Pick a new random category for round 2
      this.pickRandomCategory();
      this.categoryRemainingMs = CATEGORY_ROTATION_MS;
    }
  }

  setTime(remainingMs) {
    if (this.phase === 'round1' || this.phase === 'halftime' || this.phase === 'round2') {
      this.remainingMs = Math.max(0, remainingMs);
      this.endTime = Date.now() + this.remainingMs;
      if (this.paused) {
        this.pausedRemainingMs = this.remainingMs;
      }
    }
  }

  tick() {
    if (this.paused || this.phase === 'lobby' || this.phase === 'gameover') {
      return { phaseChanged: false, timeEvent: null, categoryChanged: false };
    }

    const now = Date.now();
    this.remainingMs = Math.max(0, this.endTime - now);

    let phaseChanged = false;
    let timeEvent = null;
    let categoryChanged = false;

    if (this.remainingMs <= 0) {
      phaseChanged = true;
      if (this.phase === 'round1') {
        this.phase = 'halftime';
        this.totalDurationMs = HALFTIME_DURATION_MS;
        this.remainingMs = HALFTIME_DURATION_MS;
        this.startTime = now;
        this.endTime = now + HALFTIME_DURATION_MS;
      } else if (this.phase === 'halftime') {
        this.phase = 'round2';
        this.round = 2;
        this.multiplier = 1.5;
        this.totalDurationMs = ROUND_2_DURATION_MS;
        this.remainingMs = ROUND_2_DURATION_MS;
        this.startTime = now;
        this.endTime = now + ROUND_2_DURATION_MS;
        this.pickRandomCategory();
        this.categoryRemainingMs = CATEGORY_ROTATION_MS;
        categoryChanged = true;
      } else if (this.phase === 'round2') {
        this.phase = 'gameover';
        this.totalDurationMs = 0;
        this.remainingMs = 0;
        timeEvent = 'match_end';
      }
    } else {
      // In active gameplay rounds, count down the 20s category rotation timer
      if (this.phase === 'round1' || this.phase === 'round2') {
        this.categoryRemainingMs = Math.max(0, this.categoryRemainingMs - TICK_INTERVAL_MS);
        if (this.categoryRemainingMs <= 0) {
          this.pickRandomCategory();
          this.categoryRemainingMs = CATEGORY_ROTATION_MS;
          categoryChanged = true;
        }

        if (this.remainingMs <= 15000) {
          timeEvent = 'heartbeat';
        }
      }
    }

    return { phaseChanged, timeEvent, categoryChanged };
  }

  submitWord(teamId, word) {
    if (this.paused || this.phase === 'lobby' || this.phase === 'gameover' || this.phase === 'halftime') {
      return {
        accepted: false,
        tier: null,
        canonical: null,
        points: 0,
        depthMeters: 0,
        reason: 'game_not_active'
      };
    }

    const team = (teamId === 'team1' || teamId === 'team2') ? teamId : 'team1';

    // 1. Submission cooldown: rate limit rapid-fire spamming (minimum 350ms between submissions)
    const now = Date.now();
    if (this.lastSubmitTime && now - (this.lastSubmitTime[team] || 0) < 350) {
      return {
        accepted: false,
        tier: null,
        canonical: null,
        points: 0,
        depthMeters: 0,
        reason: 'rate_limited',
        message: 'Slow down! Only one word at a time.'
      };
    }
    if (this.lastSubmitTime) {
      this.lastSubmitTime[team] = now;
    }

    let result;

    const ext = getValidator();
    if (ext && typeof ext.evaluateAnswer === 'function') {
      result = ext.evaluateAnswer(this.prompt.id, word, team, this.round || 1);
    } else {
      result = fallbackEvaluateAnswer(this.prompt.id, word, team, this.round || 1);
    }

    if (result && result.accepted) {
      // 3. Defense-in-depth: check if this canonical was already recorded across EITHER team in this category (cross-team lock)
      const canonicalName = (result.canonical || word).toLowerCase().trim();
      const currentCatId = this.prompt ? this.prompt.id : null;
      
      const scoredByTeam1 = this.scores.team1 && this.scores.team1.wordsScored.some(
        w => (w.categoryId === currentCatId) && (w.word || '').toLowerCase().trim() === canonicalName
      );
      const scoredByTeam2 = this.scores.team2 && this.scores.team2.wordsScored.some(
        w => (w.categoryId === currentCatId) && (w.word || '').toLowerCase().trim() === canonicalName
      );

      if (scoredByTeam1 || scoredByTeam2) {
        const claimingTeam = scoredByTeam1 ? 'Team 1' : 'Team 2';
        return {
          accepted: false,
          tier: result.tier,
          canonical: result.canonical,
          points: 0,
          depthMeters: 0,
          reason: 'duplicate',
          message: `Already claimed by ${claimingTeam}!`
        };
      }

      this.scores[team].points += result.points;
      this.scores[team].depthMeters += result.depthMeters;
      this.scores[team].wordsScored.push({
        word: result.canonical || word,
        tier: result.tier,
        points: result.points,
        depthMeters: result.depthMeters,
        round: this.round || 1,
        categoryId: currentCatId,
        timestamp: Date.now()
      });
    }

    return result;
  }

  getStatePayload() {
    return {
      type: 'STATE_SYNC',
      phase: this.phase,
      round: this.round,
      multiplier: this.multiplier,
      prompt: this.prompt,
      scores: this.scores,
      liveTyping: this.liveTyping,
      paused: this.paused,
      categoryRemainingSeconds: Math.ceil(this.categoryRemainingMs / 1000)
    };
  }

  getTimerPayload() {
    return {
      type: 'TIMER_SYNC',
      phase: this.phase,
      remainingMs: this.remainingMs,
      totalMs: this.totalDurationMs,
      paused: this.paused,
      categoryRemainingSeconds: Math.ceil(this.categoryRemainingMs / 1000),
      serverTime: Date.now()
    };
  }
}

// --- Server Factory ---
function createKrillionServer(options = {}) {
  const gameState = new GameStateManager();
  const clients = new Set(); // Set of active WebSocket instances

  // Helper: Broadcast to all connected clients or filtered by role
  function broadcast(data, filterFn) {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    for (const ws of clients) {
      if (ws.readyState === 1 /* WebSocket.OPEN */) {
        if (!filterFn || filterFn(ws)) {
          ws.send(payload);
        }
      }
    }
  }

  // HTTP Request Handler
  const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname = parsedUrl.pathname;

    // --- API Endpoints ---
    if (pathname === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (pathname === '/api/info') {
      let hostCount = 0;
      let team1Count = 0;
      let team2Count = 0;
      for (const c of clients) {
        if (c.role === 'host') hostCount++;
        else if (c.role === 'team1') team1Count++;
        else if (c.role === 'team2') team2Count++;
      }

      const effectiveBaseUrl = getEffectiveBaseUrl();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ready',
        app: 'Credillion',
        version: '1.0.0',
        ip: LAN_IP,
        port: PORT,
        localUrl: `http://localhost:${PORT}`,
        hostUrl: `${effectiveBaseUrl}/`,
        team1Url: `${effectiveBaseUrl}/team1`,
        team2Url: `${effectiveBaseUrl}/team2`,
        publicUrl: effectiveBaseUrl.includes('trycloudflare') ? effectiveBaseUrl : null,
        phase: gameState.phase,
        round: gameState.round,
        scores: gameState.scores,
        prompt: gameState.prompt,
        connected: {
          total: clients.size,
          host: hostCount,
          team1: team1Count,
          team2: team2Count
        }
      }, null, 2));
      return;
    }

    if (pathname === '/api/state') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(gameState.getStatePayload(), null, 2));
      return;
    }

    if (pathname === '/api/reset') {
      handleHostAction('RESET');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'reset', phase: gameState.phase }));
      return;
    }

    if (pathname === '/api/start') {
      handleHostAction('START_MATCH');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'started', phase: gameState.phase, prompt: gameState.prompt }));
      return;
    }

    if (pathname === '/api/pause') {
      handleHostAction('PAUSE');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'paused', paused: gameState.paused }));
      return;
    }

    if (pathname === '/api/resume') {
      handleHostAction('RESUME');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'resumed', paused: gameState.paused }));
      return;
    }

    // QR Code Endpoints: /api/qr/team1, /api/qr/team2
    if (pathname === '/api/qr/team1' || pathname === '/api/qr/team2') {
      const team = pathname.endsWith('team1') ? 'team1' : 'team2';
      const effectiveBaseUrl = getEffectiveBaseUrl();
      const targetUrl = `${effectiveBaseUrl}/${team}`;
      const format = parsedUrl.searchParams.get('format') || '';
      const acceptsSvg = req.headers.accept && req.headers.accept.includes('image/svg+xml');

      try {
        if (format === 'svg' || acceptsSvg) {
          const svg = await QRCode.toString(targetUrl, {
            type: 'svg',
            margin: 2,
            color: { dark: '#0F172A', light: '#FFFFFF' }
          });
          res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
          res.end(svg);
        } else {
          const dataUrl = await QRCode.toDataURL(targetUrl, {
            margin: 2,
            color: { dark: '#0F172A', light: '#FFFFFF' }
          });
          const svg = await QRCode.toString(targetUrl, {
            type: 'svg',
            margin: 2,
            color: { dark: '#0F172A', light: '#FFFFFF' }
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            team,
            url: targetUrl,
            qr: dataUrl,
            dataUrl,
            svg
          }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'QR Code generation failed', details: err.message }));
      }
      return;
    }

    // HTTP Control API (allows curl/script manipulation)
    if (pathname === '/api/control' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}');
          handleHostAction(data.action, data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, state: gameState.getStatePayload() }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // --- Static File Routing ---
    // Rewrite path aliases
    if (pathname === '/' || pathname === '/host') {
      pathname = '/index.html';
    } else if (pathname === '/team1' || pathname === '/team2') {
      pathname = '/team.html';
    }

    const safePath = path.normalize(path.join(PUBLIC_DIR, pathname));

    // Security check: ensure path is within PUBLIC_DIR
    if (!safePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('403 Forbidden');
      return;
    }

    fs.stat(safePath, (err, stats) => {
      if (err || !stats.isFile()) {
        // If file doesn't exist yet (e.g. Workers M3/M4 still building public UI),
        // render a helpful placeholder page so server is always browseable
        const ext = path.extname(safePath).toLowerCase();
        if (ext === '.html' || ext === '') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Catholic Krillion ("Credillion")</title>
  <style>
    body { background: #0F172A; color: #C59B27; font-family: sans-serif; text-align: center; padding: 40px; }
    h1 { color: #E4BC4A; margin-bottom: 8px; }
    p { color: #CBD5E1; }
    .badge { display: inline-block; padding: 6px 14px; background: #881337; color: white; border-radius: 9999px; margin: 8px; }
    a { color: #E4BC4A; }
  </style>
</head>
<body>
  <h1>Catholic Krillion (Credillion)</h1>
  <p>Real-Time Server Active on port ${PORT}</p>
  <div class="badge">Phase: ${gameState.phase}</div>
  <p>Connecting to WebSocket at <code>ws://${LAN_IP}:${PORT}</code></p>
  <p><a href="/api/info">API Info</a> | <a href="/api/qr/team1">QR Team 1</a> | <a href="/api/qr/team2">QR Team 2</a></p>
</body>
</html>`);
          return;
        }

        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`404 Not Found: ${pathname}`);
        return;
      }

      const ext = path.extname(safePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(safePath).pipe(res);
    });
  });

  // --- WebSocket Server ---
  const wss = new WebSocketServer({ server });

  function handleHostAction(action, payload = {}) {
    switch (action) {
      case 'START_MATCH':
        gameState.startMatch();
        broadcast(gameState.getStatePayload());
        broadcast(gameState.getTimerPayload());
        break;
      case 'PAUSE':
        gameState.pause();
        broadcast(gameState.getStatePayload());
        broadcast(gameState.getTimerPayload());
        break;
      case 'RESUME':
        gameState.resume();
        broadcast(gameState.getStatePayload());
        broadcast(gameState.getTimerPayload());
        break;
      case 'RESET':
        gameState.reset();
        broadcast(gameState.getStatePayload());
        broadcast(gameState.getTimerPayload());
        break;
      case 'SKIP_HALFTIME':
        gameState.skipHalftime();
        broadcast(gameState.getStatePayload());
        broadcast(gameState.getTimerPayload());
        break;
      case 'SET_TIME':
        if (typeof payload.remainingMs === 'number') {
          gameState.setTime(payload.remainingMs);
          broadcast(gameState.getTimerPayload());
        }
        break;
      case 'SET_CATEGORY':
        const targetCatId = payload.categoryId || (payload.payload && payload.payload.categoryId);
        if (targetCatId) {
          gameState.setCategory(targetCatId);
          broadcast(gameState.getStatePayload());
        }
        break;
      default:
        console.warn('[Server] Unrecognized host action:', action);
    }
  }

  wss.on('connection', (ws, req) => {
    // TCP setNoDelay(true) eliminates Nagle buffering for zero-latency live typing
    if (req && req.socket && typeof req.socket.setNoDelay === 'function') {
      req.socket.setNoDelay(true);
    }
    if (ws._socket && typeof ws._socket.setNoDelay === 'function') {
      ws._socket.setNoDelay(true);
    }

    ws.id = 'client_' + Math.random().toString(36).substr(2, 9);
    ws.role = 'unknown'; // 'host' | 'team1' | 'team2'
    clients.add(ws);

    // Send immediate state & timer sync upon connection
    ws.send(JSON.stringify(gameState.getStatePayload()));
    ws.send(JSON.stringify(gameState.getTimerPayload()));

    ws.on('message', rawData => {
      let message;
      try {
        message = JSON.parse(rawData);
      } catch (err) {
        console.error('[Server] Malformed WS message:', err.message);
        return;
      }

      const { type } = message;

      switch (type) {
        // --- 1. Client Registration ---
        case 'REGISTER': {
          const role = message.role;
          if (role === 'host' || role === 'team1' || role === 'team2') {
            ws.role = role;
          }
          ws.send(JSON.stringify({
            type: 'REGISTER_ACK',
            role: ws.role,
            clientId: ws.id,
            phase: gameState.phase,
            round: gameState.round,
            scores: gameState.scores
          }));
          break;
        }

        // --- 2. Live Keystroke Relay (< 100ms requirement) ---
        case 'INPUT_UPDATE': {
          const team = ws.role === 'team1' || ws.role === 'team2' ? ws.role : (message.team || 'team1');
          const text = typeof message.text === 'string' ? message.text : '';
          gameState.liveTyping[team] = text;

          const relayMsg = JSON.stringify({
            type: 'LIVE_TYPING_RELAY',
            team,
            text,
            seq: message.seq || 0,
            timestamp: message.timestamp || Date.now(),
            serverTimestamp: Date.now()
          });

          // Relay immediately to host screen(s)
          for (const client of clients) {
            if (client.readyState === 1 && (client.role === 'host' || client.role === 'unknown')) {
              client.send(relayMsg);
            }
          }
          break;
        }

        // --- 3. Word Submission ---
        case 'SUBMIT_WORD': {
          const team = ws.role === 'team1' || ws.role === 'team2' ? ws.role : (message.team || 'team1');
          const rawWord = message.word || '';

          // Clear live typing display on submission
          gameState.liveTyping[team] = '';
          const clearRelay = JSON.stringify({
            type: 'LIVE_TYPING_RELAY',
            team,
            text: '',
            seq: (message.seq || 0) + 1,
            timestamp: Date.now()
          });
          broadcast(clearRelay, c => c.role === 'host');

          const result = gameState.submitWord(team, rawWord);

          // Audio Event determination
          let soundEvent = 'error';
          if (result.accepted) {
            soundEvent = result.tier === 'one_in_a_credillion' ? 'organ' : 'bell';
          }

          // Broadcast evaluation to all relevant screens
          const evalMsg = JSON.stringify({
            type: 'WORD_EVALUATED',
            team,
            word: rawWord,
            result,
            scores: gameState.scores
          });
          broadcast(evalMsg);

          // Broadcast audio event
          broadcast(JSON.stringify({
            type: 'AUDIO_EVENT',
            sound: soundEvent,
            team,
            tier: result.tier
          }));

          // Broadcast updated state sync
          broadcast(gameState.getStatePayload());
          break;
        }

        // --- 4. Host Control ---
        case 'HOST_CONTROL':
        case 'HOST_ACTION': {
          handleHostAction(message.action, message);
          break;
        }
        case 'START_MATCH': {
          handleHostAction('START_MATCH', message);
          break;
        }

        // --- 5. Ping / Keepalive ---
        case 'PING': {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          break;
        }

        default:
          console.warn('[Server] Unknown message type:', type);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', err => {
      console.warn('[Server] WebSocket client error:', err.message);
      clients.delete(ws);
    });
  });

  // Authoritative 1,000ms Timer Ticker
  const ticker = setInterval(() => {
    const { phaseChanged, timeEvent, categoryChanged } = gameState.tick();

    if (phaseChanged) {
      broadcast(gameState.getStatePayload());
      if (gameState.phase === 'gameover') {
        broadcast(JSON.stringify({ type: 'AUDIO_EVENT', sound: 'fanfare' }));
      }
    }

    if (categoryChanged) {
      broadcast(gameState.getStatePayload());
      broadcast(JSON.stringify({
        type: 'AUDIO_EVENT',
        sound: 'bell'
      }));
      broadcast(JSON.stringify({
        type: 'CATEGORY_ROTATED',
        prompt: gameState.prompt,
        categoryRemainingSeconds: Math.ceil(gameState.categoryRemainingMs / 1000)
      }));
    }

    if (timeEvent === 'heartbeat') {
      broadcast(JSON.stringify({
        type: 'AUDIO_EVENT',
        sound: 'heartbeat',
        remainingSeconds: Math.ceil(gameState.remainingMs / 1000)
      }));
    }

    // Always broadcast authoritative clock sync
    broadcast(gameState.getTimerPayload());
  }, TICK_INTERVAL_MS);

  // Clean shutdown helper
  function close() {
    clearInterval(ticker);
    for (const ws of clients) {
      ws.terminate();
    }
    wss.close();
    server.close();
  }

  return {
    server,
    wss,
    gameState,
    clients,
    ticker,
    close,
    getLocalIpAddress
  };
}

// --- CLI Runner ---
if (require.main === module) {
  const instance = createKrillionServer();
  instance.server.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`   Catholic Krillion ("Credillion") Server Active      `);
    console.log(`=======================================================`);
    console.log(` Local Display:     http://localhost:${PORT}/ (Host Screen 1)`);
    console.log(` Network Host:      http://${LAN_IP}:${PORT}/`);
    console.log(` Team A Controller: http://${LAN_IP}:${PORT}/team1`);
    console.log(` Team B Controller: http://${LAN_IP}:${PORT}/team2`);
    console.log(` WebSocket Port:    ${PORT} [TCP setNoDelay(true)]`);
    console.log(` Info Endpoint:     http://${LAN_IP}:${PORT}/api/info`);
    console.log(` QR Team 1:         http://${LAN_IP}:${PORT}/api/qr/team1`);
    console.log(` QR Team 2:         http://${LAN_IP}:${PORT}/api/qr/team2`);
    console.log(`=======================================================`);
  });

  process.on('SIGINT', () => {
    console.log('\nGracefully shutting down Catholic Krillion server...');
    instance.close();
    process.exit(0);
  });
}

module.exports = {
  createKrillionServer,
  GameStateManager,
  getLocalIpAddress,
  PORT,
  LAN_IP
};
