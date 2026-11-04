/**
 * Catholic Krillion ("Credillion") - Validation Engine
 * 
 * Implements 8-stage normalization, length-gated Levenshtein typo tolerance,
 * per-team duplicate prevention, and Round 2 1.5x multiplier calculations.
 */

const fs = typeof require !== 'undefined' ? require('fs') : null;
const path = typeof require !== 'undefined' ? require('path') : null;

/**
 * 8-Stage Normalization Pipeline
 * 1. Trim & lowercase.
 * 2. Unicode NFD diacritics removal (e.g. Thérèse -> therese).
 * 3. Ligature replacement (æ->ae, œ->oe, ß->ss, ð->d, þ->th).
 * 4. Hyphens to spaces.
 * 5. Strip punctuation & non-alphanumerics.
 * 6. Collapse multiple whitespaces.
 * 7. Strip leading prefixes: "saint ", "st ", "ste ", "san ", "santa ", "santo ", "the ", "a ", "an ".
 * 8. Final trim.
 * 
 * @param {string} raw - Raw input string
 * @returns {string} Normalized string
 */
function normalizeString(raw) {
  if (!raw || typeof raw !== 'string') return '';

  // 1. Trim & lowercase
  let s = raw.trim().toLowerCase();

  // 2. Unicode NFD diacritics decomposition & stripping
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // 3. Handle special ligatures & characters
  s = s.replace(/æ/g, 'ae')
       .replace(/œ/g, 'oe')
       .replace(/ß/g, 'ss')
       .replace(/ð/g, 'd')
       .replace(/þ/g, 'th');

  // 4. Convert hyphens to spaces
  s = s.replace(/-/g, ' ');

  // 5. Strip punctuation & non-alphanumerics (retain spaces and digits)
  s = s.replace(/[^a-z0-9 ]/g, '');

  // 6. Collapse multiple whitespaces
  s = s.replace(/\s+/g, ' ').trim();

  // 7. Honorific, title, church/cathedral/chapel, and definite/indefinite article prefix stripping
  const prefixRegex = /^(saint|st|ste|san|santa|santo|sao|cathedral of the|cathedral of|church of the|church of|chapel of the|chapel of|parish of the|parish of|the|a|an)\s+/;
  while (prefixRegex.test(s)) {
    s = s.replace(prefixRegex, '').trim();
  }

  return s.trim();
}

/**
 * Computes Levenshtein edit distance between strings a and b.
 * 
 * @param {string} a 
 * @param {string} b 
 * @returns {number} Minimum number of single-character edits
 */
function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (!a || a.length === 0) return b ? b.length : 0;
  if (!b || b.length === 0) return a ? a.length : 0;

  const m = a.length;
  const n = b.length;
  const dp = [];

  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,        // deletion
        dp[i][j - 1] + 1,        // insertion
        dp[i - 1][j - 1] + cost   // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Length-Gated Typo Tolerance Rule
 * L <= 4:  0 (exact match only)
 * 5 <= L <= 8: 1
 * L >= 9:  2
 * 
 * @param {number} targetLength 
 * @returns {number} Maximum allowed Levenshtein distance
 */
function maxAllowedDistance(targetLength) {
  if (targetLength <= 4) return 0;
  if (targetLength <= 8) return 1;
  return 2;
}

// Points and depths by tier for Round 1
const TIER_CONFIG = {
  pew_warmer: {
    round1Points: 10,
    round1Depth: 100,
    round2Points: 15,
    round2Depth: 150,
    audioTrigger: 'pew_warmer_chime'
  },
  altar_server: {
    round1Points: 30,
    round1Depth: 300,
    round2Points: 45,
    round2Depth: 450,
    audioTrigger: 'altar_server_chime'
  },
  theologian: {
    round1Points: 60,
    round1Depth: 600,
    round2Points: 90,
    round2Depth: 900,
    audioTrigger: 'theologian_chime'
  },
  doctor_of_the_church: {
    round1Points: 85,
    round1Depth: 850,
    round2Points: 128, // Math.round(85 * 1.5) = 128
    round2Depth: 1275, // Math.round(850 * 1.5) = 1275
    audioTrigger: 'doctor_chime'
  },
  one_in_a_credillion: {
    round1Points: 100,
    round1Depth: 1000,
    round2Points: 150,
    round2Depth: 1500,
    audioTrigger: 'credillion_organ'
  }
};

/**
 * KrillionValidator Class
 */
class KrillionValidator {
  /**
   * @param {Object|Array|string} [questionsData] - Optional questions data, path, or JSON string.
   * @param {Object} [options] - Configuration options (e.g. { matchWideUnique: true }).
   */
  constructor(questionsData, options = {}) {
    this.options = Object.assign({
      matchWideUnique: false
    }, options);
    let data = questionsData;

    if (!data) {
      if (typeof window !== 'undefined' && window.KRILLION_QUESTIONS) {
        data = window.KRILLION_QUESTIONS;
      } else if (typeof global !== 'undefined' && global.KRILLION_QUESTIONS) {
        data = global.KRILLION_QUESTIONS;
      } else if (path && fs && typeof __dirname !== 'undefined') {
        const defaultPath = path.join(__dirname, '../data/questions.json');
        if (fs.existsSync(defaultPath)) {
          const raw = fs.readFileSync(defaultPath, 'utf8');
          data = JSON.parse(raw);
        }
      }
    } else if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        if (fs && fs.existsSync && fs.existsSync(data)) {
          const raw = fs.readFileSync(data, 'utf8');
          data = JSON.parse(raw);
        } else {
          throw new Error('Invalid questionsData string or file path: ' + data);
        }
      }
    }

    let categoriesArray = [];
    if (data && Array.isArray(data.categories)) {
      categoriesArray = data.categories;
    } else if (Array.isArray(data)) {
      categoriesArray = data;
    }

    this.categories = new Map();
    this.rawCategories = categoriesArray;

    for (const cat of categoriesArray) {
      this._indexCategory(cat);
    }

    // Map: `${teamId}:${categoryId}` -> Set of canonical answer identifiers
    this.scoredAnswers = new Map();
  }

  /**
   * Indexes a category for O(1) canonical lookup and fast fuzzy scanning.
   * @private
   */
  _indexCategory(cat) {
    const id = cat.id;
    const title = cat.title || '';
    const prompt = cat.prompt || '';
    const tiers = cat.tiers || {};
    const aliases = cat.aliases || {};

    const canonicalMap = new Map(); // normalized -> { canonical, tier }
    const aliasMap = new Map();     // normalized alias -> normalized canonical
    const searchPool = [];          // Array of { normalized, canonical, tier }

    const tierKeys = ['pew_warmer', 'altar_server', 'theologian', 'doctor_of_the_church', 'one_in_a_credillion'];

    for (const tierKey of tierKeys) {
      const answers = tiers[tierKey] || [];
      for (const canonical of answers) {
        const norm = this.normalize(canonical);
        if (norm) {
          const entry = { canonical, tier: tierKey, normalized: norm };
          canonicalMap.set(norm, entry);
          searchPool.push(entry);
        }
      }
    }

    // Process aliases
    for (const [aliasKey, targetCanonical] of Object.entries(aliases)) {
      const normAlias = this.normalize(aliasKey);
      const normTarget = this.normalize(targetCanonical);
      if (normAlias && normTarget) {
        aliasMap.set(normAlias, normTarget);
        // Find canonical entry to assign tier to alias for fuzzy pool
        const targetEntry = canonicalMap.get(normTarget);
        if (targetEntry) {
          searchPool.push({
            normalized: normAlias,
            canonical: targetEntry.canonical,
            tier: targetEntry.tier
          });
        }
      }
    }

    this.categories.set(id, {
      id,
      title,
      prompt,
      tiers,
      aliases,
      canonicalMap,
      aliasMap,
      searchPool
    });
  }

  /**
   * Normalizes raw user input using the 8-stage pipeline.
   * @param {string} rawText 
   * @returns {string}
   */
  normalize(rawText) {
    return normalizeString(rawText);
  }

  /**
   * Levenshtein distance helper
   */
  levenshteinDistance(a, b) {
    return levenshteinDistance(a, b);
  }

  /**
   * Length-gated maximum allowed distance helper
   */
  maxAllowedDistance(len) {
    return maxAllowedDistance(len);
  }

  /**
   * Resets active session scores and duplicate tracking.
   * If both teamId and categoryId are provided, resets only that combination.
   * If only teamId is provided, resets that team across all categories and match.
   * If neither is provided, clears all tracking.
   */
  resetSession(teamId, categoryId) {
    if (teamId && categoryId) {
      this.scoredAnswers.delete(`${teamId}:${categoryId}`);
      this.scoredAnswers.delete(`shared:${categoryId}`);
    } else if (teamId) {
      for (const key of this.scoredAnswers.keys()) {
        if (key.startsWith(`${teamId}:`) || key === `match:${teamId}`) {
          this.scoredAnswers.delete(key);
        }
      }
    } else {
      this.scoredAnswers.clear();
    }
  }

  /**
   * Checks whether a canonical answer has already been scored for a team & category,
   * or already claimed by ANY team in this category (cross-team lock: first team locks it),
   * or already scored in the current match if matchWideUnique is enabled.
   */
  isDuplicate(teamId, categoryId, canonical) {
    if (!canonical) return false;
    const lower = canonical.toLowerCase().trim();

    // 1. Check cross-team shared duplicate for this category (first to claim locks it)
    const sharedKey = `shared:${categoryId}`;
    const sharedSet = this.scoredAnswers.get(sharedKey);
    if (sharedSet && sharedSet.has(lower)) return true;

    // 2. Check prompt / category duplicate for this team
    const catKey = `${teamId}:${categoryId}`;
    const catSet = this.scoredAnswers.get(catKey);
    if (catSet && catSet.has(lower)) return true;

    // 3. Check match-wide duplicate if enabled in options
    if (this.options && this.options.matchWideUnique) {
      const matchKey = `match:${teamId}`;
      const matchSet = this.scoredAnswers.get(matchKey);
      if (matchSet && matchSet.has(lower)) return true;
    }

    return false;
  }

  /**
   * Records a canonical answer as scored for a team & category, in the shared category lock,
   * and optionally in the match-wide log.
   */
  recordAnswer(teamId, categoryId, canonical) {
    if (!canonical) return;
    const lower = canonical.toLowerCase().trim();

    // Category bucket
    const catKey = `${teamId}:${categoryId}`;
    if (!this.scoredAnswers.has(catKey)) {
      this.scoredAnswers.set(catKey, new Set());
    }
    this.scoredAnswers.get(catKey).add(lower);

    // Shared cross-team category lock bucket
    const sharedKey = `shared:${categoryId}`;
    if (!this.scoredAnswers.has(sharedKey)) {
      this.scoredAnswers.set(sharedKey, new Set());
    }
    this.scoredAnswers.get(sharedKey).add(lower);

    // Match-wide bucket
    if (this.options && this.options.matchWideUnique) {
      const matchKey = `match:${teamId}`;
      if (!this.scoredAnswers.has(matchKey)) {
        this.scoredAnswers.set(matchKey, new Set());
      }
      this.scoredAnswers.get(matchKey).add(lower);
    }
  }

  /**
   * Retrieves all scored canonical answers for a team & category.
   */
  getScoredAnswers(teamId, categoryId) {
    const key = `${teamId}:${categoryId}`;
    const set = this.scoredAnswers.get(key);
    return set ? Array.from(set) : [];
  }

  /**
   * Retrieves a category by ID.
   */
  getCategory(categoryId) {
    return this.categories.get(categoryId) || null;
  }

  /**
   * Retrieves all categories array.
   */
  getAllCategories() {
    return this.rawCategories;
  }

  /**
   * Retrieves array of all category IDs.
   */
  getCategoryIds() {
    return Array.from(this.categories.keys());
  }

  /**
   * Evaluates an answer submission for a given category, team, and round.
   * 
   * @param {string} categoryId - Target category identifier
   * @param {string} rawInput - Raw text input from user
   * @param {string} [teamId='team1'] - Submitting team ('team1' or 'team2')
   * @param {number} [roundNumber=1] - Active match round (1 or 2)
   * @returns {Object} Evaluation result matching interface contract
   */
  evaluateAnswer(categoryId, rawInput, teamId = 'team1', roundNumber = 1) {
    const teamKey = String(teamId || 'team1');
    const isRound2 = Number(roundNumber) === 2;

    // 1. Validate raw input
    if (!rawInput || typeof rawInput !== 'string' || !rawInput.trim()) {
      return {
        accepted: false,
        tier: null,
        canonical: null,
        matchedCanonical: null,
        points: 0,
        depthMeters: 0,
        reason: 'invalid_input',
        message: 'Empty submission',
        normalizedInput: '',
        audioTrigger: 'error_buzz',
        teamId: teamKey,
        rawInput: rawInput || ''
      };
    }

    // 2. Normalize
    const normalized = this.normalize(rawInput);
    if (!normalized) {
      return {
        accepted: false,
        tier: null,
        canonical: null,
        matchedCanonical: null,
        points: 0,
        depthMeters: 0,
        reason: 'invalid_input',
        normalizedInput: '',
        audioTrigger: 'error_buzz',
        teamId: teamKey,
        rawInput
      };
    }

    // 3. Find category
    const cat = this.categories.get(categoryId);
    if (!cat) {
      return {
        accepted: false,
        tier: null,
        canonical: null,
        matchedCanonical: null,
        points: 0,
        depthMeters: 0,
        reason: 'not_found',
        normalizedInput: normalized,
        audioTrigger: 'error_buzz',
        teamId: teamKey,
        rawInput
      };
    }

    let matched = null;

    // 4. Exact match in canonicalMap
    if (cat.canonicalMap.has(normalized)) {
      matched = cat.canonicalMap.get(normalized);
    }

    // 5. Exact match in aliasMap
    if (!matched && cat.aliasMap.has(normalized)) {
      const targetNorm = cat.aliasMap.get(normalized);
      if (cat.canonicalMap.has(targetNorm)) {
        matched = cat.canonicalMap.get(targetNorm);
      }
    }

    // 6. Plural/singular fallback for common English suffixes
    if (!matched && normalized.endsWith('s')) {
      const singular1 = normalized.slice(0, -1);
      if (cat.canonicalMap.has(singular1)) {
        matched = cat.canonicalMap.get(singular1);
      } else if (normalized.endsWith('es')) {
        const singular2 = normalized.slice(0, -2);
        if (cat.canonicalMap.has(singular2)) {
          matched = cat.canonicalMap.get(singular2);
        }
      }
    }

    // 7. Length-gated Levenshtein fuzzy matching across canonicals and aliases
    if (!matched) {
      let bestMatch = null;
      let minDistance = Infinity;

      for (const entry of cat.searchPool) {
        const target = entry.normalized;
        const targetLen = target.length;
        const maxDist = maxAllowedDistance(targetLen);

        // Quick length delta gate
        if (Math.abs(normalized.length - targetLen) > maxDist) {
          continue;
        }

        const dist = levenshteinDistance(normalized, target);
        if (dist <= maxDist && dist < minDistance) {
          minDistance = dist;
          bestMatch = entry;
          if (dist === 0) break; // Perfect match
        }
      }

      if (bestMatch) {
        matched = bestMatch;
      }
    }

    // 8. If no match found
    if (!matched) {
      return {
        accepted: false,
        tier: null,
        canonical: null,
        matchedCanonical: null,
        points: 0,
        depthMeters: 0,
        reason: 'not_found',
        normalizedInput: normalized,
        audioTrigger: 'error_buzz',
        teamId: teamKey,
        rawInput
      };
    }

    // 9. Duplicate detection
    const canonicalName = matched.canonical;
    if (this.isDuplicate(teamKey, categoryId, canonicalName)) {
      const lower = canonicalName.toLowerCase().trim();
      const ownSet = this.scoredAnswers.get(`${teamKey}:${categoryId}`);
      const isOpponentClaimed = !ownSet || !ownSet.has(lower);
      const message = isOpponentClaimed 
        ? 'Already claimed by opposing team!' 
        : 'Already scored! Only one word at a time.';

      return {
        accepted: false,
        tier: null,
        canonical: canonicalName,
        matchedCanonical: canonicalName,
        points: 0,
        depthMeters: 0,
        reason: 'duplicate',
        message,
        normalizedInput: normalized,
        audioTrigger: 'error_buzz',
        teamId: teamKey,
        rawInput
      };
    }

    // 10. Record scored answer
    this.recordAnswer(teamKey, categoryId, canonicalName);

    // 11. Calculate points, depth, and audio event
    const tierInfo = TIER_CONFIG[matched.tier] || TIER_CONFIG.pew_warmer;
    const points = isRound2 ? tierInfo.round2Points : tierInfo.round1Points;
    const depthMeters = isRound2 ? tierInfo.round2Depth : tierInfo.round1Depth;
    const audioTrigger = tierInfo.audioTrigger;

    return {
      accepted: true,
      tier: matched.tier,
      canonical: canonicalName,
      matchedCanonical: canonicalName,
      points,
      depthMeters,
      reason: null,
      normalizedInput: normalized,
      audioTrigger,
      teamId: teamKey,
      rawInput
    };
  }
}

// Module exports for CommonJS and browser/ESM environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    KrillionValidator,
    normalizeString,
    levenshteinDistance,
    maxAllowedDistance,
    TIER_CONFIG
  };
  module.exports.KrillionValidator = KrillionValidator;
  module.exports.default = KrillionValidator;
}

if (typeof window !== 'undefined') {
  window.KrillionValidator = KrillionValidator;
}
if (typeof global !== 'undefined') {
  global.KrillionValidator = KrillionValidator;
}
