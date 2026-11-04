/**
 * Catholic Krillion ("Credillion") - Adversarial Fuzzy Engine & Rarity Tier Oracle
 * 
 * Challenger 2 Adversarial Test Suite:
 * 1. Typo Boundary Attacks: Generates perturbed words at edit distances 0, 1, 2, 3 across
 *    all 28 curated categories; verifies strict adherence to length-gated thresholds
 *    (L<=4: dist 0 only; 5<=L<=8: dist 1 max; L>=9: dist 2 max).
 * 2. Malicious Input Attacks: Massive string injections (10,000+ chars, 50,000 chars),
 *    chained prefix ReDoS vectors, null bytes, control characters, unicode emojis,
 *    combining diacritics, prototype pollution (__proto__, constructor), and type coercion.
 * 3. Duplicate Evasion Attacks: Bypasses attempted via case variations, whitespace/newline padding,
 *    diacritics stripping, prefix padding ("Saint", "The"), alias substitutions, typo variations,
 *    and plural forms. Verifies cross-team and cross-category scoping invariants.
 * 4. Multiplier Validation: Verifies Round 1 vs Round 2 (1.5x) exact mathematical points,
 *    depth meters, and audio triggers across all 28 categories and all 5 depth tiers.
 *    Verifies zero-point guarantees on errors in Round 2.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const {
  KrillionValidator,
  normalizeString,
  levenshteinDistance,
  maxAllowedDistance,
  TIER_CONFIG
} = require('../engine/validator.js');

// Load questions data
const questionsPath = path.join(__dirname, '../data/questions.json');
const questionsData = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
const validator = new KrillionValidator(questionsData);

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;
const failureLog = [];

function check(condition, message, context = {}) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
  } else {
    failedAssertions++;
    const errMsg = `FAIL: ${message} | Context: ${JSON.stringify(context)}`;
    failureLog.push(errMsg);
    console.error(`  ✗ ${errMsg}`);
  }
}

function suiteHeader(title) {
  console.log('\n===============================================================');
  console.log(` ${title}`);
  console.log('===============================================================');
}

/**
 * Perturbation generator: creates perturbed words at exact edit distance `desiredDist`
 * from `targetNorm`, ensuring no unintended collision with other entries in `cat.searchPool`.
 */
function generateCleanPerturbation(targetNorm, cat, desiredDist) {
  const chars = ['x', 'z', 'q', 'j', 'k', 'y', 'w'];
  const pool = cat.searchPool;
  
  function isValid(cand) {
    if (!cand || cand.length === 0) return false;
    if (levenshteinDistance(cand, targetNorm) !== desiredDist) return false;
    for (const entry of pool) {
      if (entry.normalized === targetNorm) continue;
      const d = levenshteinDistance(cand, entry.normalized);
      if (d <= maxAllowedDistance(entry.normalized.length)) return false;
    }
    return true;
  }

  if (desiredDist === 0) return targetNorm;

  if (desiredDist === 1) {
    for (let i = 0; i < targetNorm.length; i++) {
      if (targetNorm[i] === ' ') continue;
      for (const ch of chars) {
        if (ch === targetNorm[i]) continue;
        const cand = targetNorm.slice(0, i) + ch + targetNorm.slice(i + 1);
        if (isValid(cand)) return cand;
      }
    }
  }

  if (desiredDist === 2 && targetNorm.length >= 2) {
    for (let i = 0; i < targetNorm.length - 1; i++) {
      if (targetNorm[i] === ' ') continue;
      for (let j = i + 1; j < targetNorm.length; j++) {
        if (targetNorm[j] === ' ') continue;
        for (const ch1 of ['x', 'z']) {
          for (const ch2 of ['q', 'j']) {
            const arr = targetNorm.split('');
            arr[i] = ch1; arr[j] = ch2;
            const cand = arr.join('');
            if (isValid(cand)) return cand;
          }
        }
      }
    }
  }

  if (desiredDist === 3 && targetNorm.length >= 3) {
    for (let i = 0; i < targetNorm.length - 2; i++) {
      if (targetNorm[i] === ' ') continue;
      for (let j = i + 1; j < targetNorm.length - 1; j++) {
        if (targetNorm[j] === ' ') continue;
        for (let k = j + 1; k < targetNorm.length; k++) {
          if (targetNorm[k] === ' ') continue;
          const arr = targetNorm.split('');
          arr[i] = 'x'; arr[j] = 'z'; arr[k] = 'q';
          const cand = arr.join('');
          if (isValid(cand)) return cand;
        }
      }
    }
  }
  return null;
}

// ============================================================================
// SUITE 1: Typo Boundary Attacks Across All 28 Categories
// ============================================================================
suiteHeader('SUITE 1: Typo Boundary Attacks (Distances 0, 1, 2, 3 on 28 Categories)');

let typoAttacksCount = 0;

for (const cat of questionsData.categories) {
  const catObj = validator.getCategory(cat.id);
  check(catObj !== null, `Category ${cat.id} must exist in validator`);

  const allWords = Object.values(cat.tiers).flat();

  // Pick representative answers across length buckets
  const shortW = allWords.find(w => {
    const l = validator.normalize(w).length;
    return l > 0 && l <= 4;
  });
  const medW = allWords.find(w => {
    const l = validator.normalize(w).length;
    return l >= 5 && l <= 8;
  });
  const longW = allWords.find(w => {
    const l = validator.normalize(w).length;
    return l >= 9;
  });

  const targets = [];
  if (shortW) targets.push({ word: shortW, bucket: 'short (L<=4)', maxAllowed: 0 });
  if (medW) targets.push({ word: medW, bucket: 'medium (5<=L<=8)', maxAllowed: 1 });
  if (longW) targets.push({ word: longW, bucket: 'long (L>=9)', maxAllowed: 2 });

  for (const t of targets) {
    const norm = validator.normalize(t.word);

    for (let dist = 0; dist <= 3; dist++) {
      const perturbed = generateCleanPerturbation(norm, catObj, dist);
      if (!perturbed) continue;

      validator.resetSession('team_oracle', cat.id);
      const res = validator.evaluateAnswer(cat.id, perturbed, 'team_oracle', 1);
      typoAttacksCount++;

      const shouldAccept = (dist <= t.maxAllowed);

      if (shouldAccept) {
        check(
          res.accepted === true && res.reason === null,
          `Typo distance ${dist} on ${t.bucket} word "${norm}" (perturbed: "${perturbed}") in ${cat.id} should be ACCEPTED`,
          { categoryId: cat.id, word: norm, perturbed, dist, res }
        );
      } else {
        check(
          res.accepted === false && res.reason === 'not_found' && res.points === 0 && res.depthMeters === 0,
          `Typo distance ${dist} on ${t.bucket} word "${norm}" (perturbed: "${perturbed}") in ${cat.id} should be REJECTED with not_found`,
          { categoryId: cat.id, word: norm, perturbed, dist, res }
        );
      }
    }
  }
}
console.log(`  ✓ Exercised ${typoAttacksCount} length-gated typo boundary perturbations across 28 categories`);

// Exact transition boundary tests: L=4 vs L=5, L=8 vs L=9
console.log('  Testing exact boundary transitions: L=4 vs L=5, and L=8 vs L=9');
check(maxAllowedDistance(4) === 0, 'L=4 maxAllowedDistance must be exactly 0');
check(maxAllowedDistance(5) === 1, 'L=5 maxAllowedDistance must be exactly 1');
check(maxAllowedDistance(8) === 1, 'L=8 maxAllowedDistance must be exactly 1');
check(maxAllowedDistance(9) === 2, 'L=9 maxAllowedDistance must be exactly 2');

// False positive rejection of random English words and out-of-domain terms
const randomTerms = [
  'supercalifragilisticexpialidocious', 'javascript', 'google chrome', 'playstation',
  'honda civic', 'pizza margherita', 'darth vader', 'harry potter', 'batman',
  'superman', 'einstein', 'quantum mechanics', 'algorithm', 'python', 'windows 11',
  'banana', 'refrigerator', 'submarine', 'helicopter', 'microwave', 'spaghetti'
];

let falsePositives = 0;
for (const cat of questionsData.categories) {
  for (const word of randomTerms) {
    validator.resetSession('team_fp', cat.id);
    const res = validator.evaluateAnswer(cat.id, word, 'team_fp', 1);
    if (res.accepted) {
      falsePositives++;
      check(false, `False positive: "${word}" accepted in category ${cat.id}`, { res });
    }
  }
}
check(falsePositives === 0, 'Zero false positives on 588 random word cross-category tests');
console.log(`  ✓ Tested 588 random word submissions across all 28 categories with 0 false positives`);

// ============================================================================
// SUITE 2: Malicious Inputs & Injections Stress Harness
// ============================================================================
suiteHeader('SUITE 2: Malicious Inputs & Injections (Massive Strings, ReDoS, Nulls, Proto Pollution)');

// 1. Massive string injections
console.log('  1. Massive String Injections & ReDoS resilience:');
const massivePayloads = [
  { name: '10,000 "a" characters', text: 'a'.repeat(10000) },
  { name: '50,000 random alphanumeric characters', text: 'x9q7'.repeat(12500) },
  { name: '10,000 spaces', text: ' '.repeat(10000) },
  { name: '10,000 newlines and tabs', text: '\n\t\r'.repeat(3334) },
  { name: '10,000 punctuation marks', text: '!?.,;:/\'"()[]{}<>~`@#$%^&*-_=+'.repeat(334) },
  { name: '2,000 chained prefixes with target ("the ".repeat(2000) + "rosary")', text: 'the '.repeat(2000) + 'rosary' },
  { name: '2,000 chained honorific prefixes ("saint ".repeat(2000) + "peter")', text: 'saint '.repeat(2000) + 'peter' }
];

for (const p of massivePayloads) {
  const t0 = performance.now();
  validator.resetSession('team_stress', 'sacramentals_and_prayer_objects');
  const res = validator.evaluateAnswer('sacramentals_and_prayer_objects', p.text, 'team_stress', 1);
  const dur = performance.now() - t0;

  check(dur < 50, `Massive input "${p.name}" evaluated in under 50ms (took ${dur.toFixed(2)}ms)`);
  if (p.text.endsWith('rosary')) {
    check(res.accepted === true && res.canonical.toLowerCase() === 'rosary beads', `Chained prefix input ended in "rosary" and must match canonical`);
  } else if (p.text.endsWith('peter')) {
    check(res.accepted === false, `Chained prefix input ended in "peter" which is not in sacramentals_and_prayer_objects`);
  } else {
    check(res.accepted === false, `Massive random input "${p.name}" must be rejected`);
  }
}
console.log('  ✓ Massive string injections and prefix loops executed without timeouts or ReDoS');

// 2. Null bytes & control characters
console.log('  2. Null bytes and control characters:');
const controlPayloads = [
  { name: 'Trailing null byte', text: 'rosary\0', expectMatch: true },
  { name: 'Leading null byte', text: '\0rosary', expectMatch: true },
  { name: 'Triple null bytes', text: '\0\0\0', expectMatch: false, expectedReason: 'invalid_input' },
  { name: 'Embedded control chars (0x01..0x1F, 0x7F)', text: 'rosary\x01\x02\x03\x04\x05\x06\x07\x08\x0b\x0c\x0e\x0f\x10\x1f\x7f', expectMatch: true },
  { name: 'ANSI escape sequences', text: '\u001b[31;1mrosary\u001b[0m', expectMatch: false, expectedReason: 'not_found' },
  { name: 'BiDi RTL override characters', text: '\u202Erosary\u202C', expectMatch: true },
  { name: 'Zero-width spaces & joiners', text: '\u200B\u200C\u200D\uFEFFrosary', expectMatch: true }
];

for (const p of controlPayloads) {
  validator.resetSession('team_ctrl', 'sacramentals_and_prayer_objects');
  const res = validator.evaluateAnswer('sacramentals_and_prayer_objects', p.text, 'team_ctrl', 1);
  if (p.expectMatch) {
    check(res.accepted === true && res.canonical === 'rosary beads', `Control/null sequence "${p.name}" safely sanitized to match rosary beads`);
  } else {
    check(res.accepted === false && res.reason === p.expectedReason, `Payload "${p.name}" safely rejected with reason=${p.expectedReason} (zero crash)`);
  }
}
console.log('  ✓ Null bytes, ANSI escapes, BiDi overrides, and zero-width chars safely handled with zero crashes');

// 3. Emojis, script mixing & diacritics
console.log('  3. Emojis, Cyrillic homoglyphs, and combining diacritics:');
const unicodePayloads = [
  { text: '📿', expectedReason: 'invalid_input' },
  { text: '🙏', expectedReason: 'invalid_input' },
  { text: '✝️', expectedReason: 'invalid_input' },
  { text: '🇻🇦', expectedReason: 'invalid_input' },
  { text: 'rosary 📿', expectedCanonical: 'rosary beads' },
  { text: '🙏 Our Father 🙏', expectedCanonical: 'father', category: 'words_in_our_father' },
  { text: 'Thérèse of Lisieux', expectedCanonical: 'therese of lisieux', category: 'popular_intercessory_saints' },
  { text: 'r\u0300\u0301\u0302o\u0303s\u0304a\u0305r\u0306y\u0307', expectedCanonical: 'rosary beads' } // Stacking zalgo diacritics
];

for (const p of unicodePayloads) {
  const catId = p.category || 'sacramentals_and_prayer_objects';
  validator.resetSession('team_uni', catId);
  const res = validator.evaluateAnswer(catId, p.text, 'team_uni', 1);
  if (p.expectedReason) {
    check(res.accepted === false && res.reason === p.expectedReason, `Pure emoji "${p.text}" must return ${p.expectedReason}`);
  } else if (p.expectedCanonical) {
    check(res.accepted === true && res.canonical.toLowerCase() === p.expectedCanonical.toLowerCase(), `Unicode payload "${p.text}" matched expected canonical "${p.expectedCanonical}"`);
  }
}

// Cyrillic homoglyph injection (non-Latin letters stripped by stage 5 -> resulting 'rsry' should not match long 'rosary')
validator.resetSession('team_homo', 'sacramentals_and_prayer_objects');
const homoglyphRes = validator.evaluateAnswer('sacramentals_and_prayer_objects', 'r\u043Es\u0430ry', 'team_homo', 1);
check(homoglyphRes.accepted === false, 'Cyrillic homoglyph substitution must not produce valid match');
console.log('  ✓ Unicode diacritics, zalgo stripping, and emoji handling verified');

// 4. Prototype Pollution Injections
console.log('  4. Prototype Pollution Attack Vectors:');
const protoPayloads = ['__proto__', 'constructor', 'prototype', 'toString', 'valueOf', '__defineGetter__', '__defineSetter__'];

for (const p of protoPayloads) {
  // Test in categoryId
  const resCat = validator.evaluateAnswer(p, 'rosary');
  check(resCat.accepted === false && resCat.reason === 'not_found', `Proto payload in categoryId "${p}" returned not_found`);

  // Test in rawInput
  const resInput = validator.evaluateAnswer('sacramentals_and_prayer_objects', p);
  check(resInput.accepted === false, `Proto payload in rawInput "${p}" rejected`);

  // Test in teamId
  const resTeam = validator.evaluateAnswer('sacramentals_and_prayer_objects', 'rosary', p);
  check(resTeam.accepted === true, `Valid answer with proto payload teamId "${p}" safely evaluated`);

  // Verify internal helper methods
  check(validator.getCategory(p) === null, `getCategory("${p}") returned null`);
  check(validator.isDuplicate(p, p, p) === false, `isDuplicate("${p}") returned false`);
  validator.recordAnswer(p, p, p);
  check(validator.isDuplicate(p, p, p) === true, `isDuplicate("${p}") after recording is true`);
  validator.resetSession(p, p);
  check(validator.isDuplicate(p, p, p) === false, `isDuplicate("${p}") after reset is false`);
}

// Global prototype integrity assertions
check(Object.prototype.polluted === undefined, 'Object.prototype.polluted must be undefined');
check({}.polluted === undefined, 'Plain object {}.polluted must be undefined');
check(Array.prototype.polluted === undefined, 'Array.prototype.polluted must be undefined');
console.log('  ✓ Prototype pollution attacks completely defended: zero prototype contamination');

// 5. Type Coercion & Malformed Data
console.log('  5. Type Coercion & Malformed Types:');
const malformedTypes = [
  null,
  undefined,
  0,
  42,
  -999,
  NaN,
  Infinity,
  true,
  false,
  {},
  { word: 'rosary' },
  [],
  ['rosary'],
  () => 'rosary',
  Symbol('hack')
];

for (const val of malformedTypes) {
  try {
    const res = validator.evaluateAnswer('sacramentals_and_prayer_objects', val);
    check(res.accepted === false && res.reason === 'invalid_input', `Malformed type (${typeof val}: ${String(val)}) returned invalid_input`);
  } catch (err) {
    check(false, `Malformed type (${typeof val}: ${String(val)}) threw unhandled exception: ${err.message}`);
  }
}
console.log('  ✓ All 15 malformed data types rejected safely with zero crashes');

// ============================================================================
// SUITE 3: Duplicate Evasion Attacks
// ============================================================================
suiteHeader('SUITE 3: Duplicate Evasion Attacks (Case, Whitespace, Diacritics, Prefixes, Aliases, Typos)');

// 1. Case variation evasion
validator.resetSession('team1', 'sacramentals_and_prayer_objects');
let r1 = validator.evaluateAnswer('sacramentals_and_prayer_objects', 'rosary beads', 'team1', 1);
check(r1.accepted === true, 'Initial submission "rosary beads" accepted');
const caseEvasions = ['ROSARY BEADS', 'Rosary Beads', 'rOsArY bEaDs', 'RoSaRy BeAdS'];
for (const cand of caseEvasions) {
  const dupRes = validator.evaluateAnswer('sacramentals_and_prayer_objects', cand, 'team1', 1);
  check(dupRes.accepted === false && dupRes.reason === 'duplicate', `Case evasion attempt "${cand}" rejected with reason=duplicate`);
}

// 2. Whitespace and newline padding evasion
validator.resetSession('team1', 'sacramentals_and_prayer_objects');
r1 = validator.evaluateAnswer('sacramentals_and_prayer_objects', 'crucifix', 'team1', 1);
check(r1.accepted === true, 'Initial submission "crucifix" accepted');
const wsEvasions = ['  crucifix  ', '\tcrucifix\n', '   crucifix', 'crucifix   ', '\r\n\t crucifix \t\r\n'];
for (const cand of wsEvasions) {
  const dupRes = validator.evaluateAnswer('sacramentals_and_prayer_objects', cand, 'team1', 1);
  check(dupRes.accepted === false && dupRes.reason === 'duplicate', `Whitespace padding evasion attempt "${JSON.stringify(cand)}" rejected with reason=duplicate`);
}

// 3. Diacritics evasion
validator.resetSession('team1', 'popular_intercessory_saints');
r1 = validator.evaluateAnswer('popular_intercessory_saints', 'Thérèse of Lisieux', 'team1', 1);
check(r1.accepted === true, 'Initial submission "Thérèse of Lisieux" accepted');
const diacriticEvasions = ['Therese of Lisieux', 'THÉRÈSE OF LISIEUX', 'Thérèse of Lisieux', 'tHéRèSe oF lIsIeUx'];
for (const cand of diacriticEvasions) {
  const dupRes = validator.evaluateAnswer('popular_intercessory_saints', cand, 'team1', 1);
  check(dupRes.accepted === false && dupRes.reason === 'duplicate', `Diacritics evasion attempt "${cand}" rejected with reason=duplicate`);
}

// 4. Prefix padding evasion
validator.resetSession('team1', 'popular_intercessory_saints');
r1 = validator.evaluateAnswer('popular_intercessory_saints', 'Francis of Assisi', 'team1', 1);
check(r1.accepted === true, 'Initial submission "Francis of Assisi" accepted');
const prefixEvasions = [
  'Saint Francis of Assisi',
  'St. Francis of Assisi',
  'St Francis of Assisi',
  'San Francis of Assisi',
  'The Saint Francis of Assisi',
  'The Francis of Assisi'
];
for (const cand of prefixEvasions) {
  const dupRes = validator.evaluateAnswer('popular_intercessory_saints', cand, 'team1', 1);
  check(dupRes.accepted === false && dupRes.reason === 'duplicate', `Prefix padding evasion attempt "${cand}" rejected with reason=duplicate`);
}

// Inverted Prefix: submit prefixed first, unprefixed second
validator.resetSession('team1', 'popular_intercessory_saints');
r1 = validator.evaluateAnswer('popular_intercessory_saints', 'Saint Benedict', 'team1', 1);
check(r1.accepted === true, 'Prefixed first "Saint Benedict" accepted');
const r1Unprefixed = validator.evaluateAnswer('popular_intercessory_saints', 'Benedict', 'team1', 1);
check(r1Unprefixed.accepted === false && r1Unprefixed.reason === 'duplicate', 'Unprefixed second "Benedict" rejected with duplicate');

// 5. Alias evasion (canonical first, alias second)
validator.resetSession('team1', 'ways_and_forms_of_praying');
r1 = validator.evaluateAnswer('ways_and_forms_of_praying', 'Liturgy of the Hours', 'team1', 1);
check(r1.accepted === true, 'Canonical "Liturgy of the Hours" accepted');
const aliasEvasions = ['Breviary', 'Hours'];
for (const alias of aliasEvasions) {
  const dupRes = validator.evaluateAnswer('ways_and_forms_of_praying', alias, 'team1', 1);
  check(dupRes.accepted === false && dupRes.reason === 'duplicate', `Alias evasion attempt "${alias}" rejected with reason=duplicate`);
}

// Additional verified alias duplicate tests across multiple categories
validator.resetSession('team1', 'words_in_our_father');
validator.evaluateAnswer('words_in_our_father', 'father', 'team1', 1);
const dupOurFather = validator.evaluateAnswer('words_in_our_father', 'Our Father', 'team1', 1);
check(dupOurFather.accepted === false && dupOurFather.reason === 'duplicate', 'Alias "Our Father" rejected after canonical "father"');

validator.resetSession('team1', 'popular_intercessory_saints');
validator.evaluateAnswer('popular_intercessory_saints', 'Anthony', 'team1', 1);
const dupPadua = validator.evaluateAnswer('popular_intercessory_saints', 'Anthony of Padua', 'team1', 1);
check(dupPadua.accepted === false && dupPadua.reason === 'duplicate', 'Alias "Anthony of Padua" rejected after canonical "Anthony"');

validator.resetSession('team1', 'sacramentals_and_prayer_objects');
validator.evaluateAnswer('sacramentals_and_prayer_objects', 'Rosary Beads', 'team1', 1);
const dupRosaryAlias = validator.evaluateAnswer('sacramentals_and_prayer_objects', 'Rosary', 'team1', 1);
check(dupRosaryAlias.accepted === false && dupRosaryAlias.reason === 'duplicate', 'Alias "Rosary" rejected after canonical "Rosary Beads"');

// Inverted Alias: alias first, canonical second
validator.resetSession('team1', 'ways_and_forms_of_praying');
r1 = validator.evaluateAnswer('ways_and_forms_of_praying', 'Breviary', 'team1', 1);
check(r1.accepted === true && r1.canonical === 'liturgy of the hours', 'Alias first "Breviary" accepted with canonical "liturgy of the hours"');
const r1Canonical = validator.evaluateAnswer('ways_and_forms_of_praying', 'Liturgy of the Hours', 'team1', 1);
check(r1Canonical.accepted === false && r1Canonical.reason === 'duplicate', 'Canonical second "Liturgy of the Hours" rejected with duplicate');

// 6. Typo evasion (canonical first, typo second)
validator.resetSession('team1', 'things_in_a_catholic_sanctuary');
r1 = validator.evaluateAnswer('things_in_a_catholic_sanctuary', 'tabernacle', 'team1', 1);
check(r1.accepted === true, 'Canonical "tabernacle" accepted');
const typoEvasions = ['tabernakle', 'tebernacle', 'tabernacel'];
for (const typo of typoEvasions) {
  const dupRes = validator.evaluateAnswer('things_in_a_catholic_sanctuary', typo, 'team1', 1);
  check(dupRes.accepted === false && dupRes.reason === 'duplicate', `Typo evasion attempt "${typo}" rejected with reason=duplicate`);
}

// Inverted Typo: typo first, canonical second
validator.resetSession('team1', 'things_in_a_catholic_sanctuary');
r1 = validator.evaluateAnswer('things_in_a_catholic_sanctuary', 'tabernakle', 'team1', 1);
check(r1.accepted === true && r1.canonical === 'tabernacle', 'Typo first "tabernakle" accepted matching canonical "tabernacle"');
const r1Exact = validator.evaluateAnswer('things_in_a_catholic_sanctuary', 'tabernacle', 'team1', 1);
check(r1Exact.accepted === false && r1Exact.reason === 'duplicate', 'Canonical second "tabernacle" rejected with duplicate');

// 7. Plural variation evasion
validator.resetSession('team1', 'sacramentals_and_prayer_objects');
r1 = validator.evaluateAnswer('sacramentals_and_prayer_objects', 'statue', 'team1', 1);
check(r1.accepted === true, 'Singular "statue" accepted');
const r1Plural = validator.evaluateAnswer('sacramentals_and_prayer_objects', 'statues', 'team1', 1);
check(r1Plural.accepted === false && r1Plural.reason === 'duplicate', 'Plural "statues" rejected with duplicate');

// 8. Cross-Team and Cross-Category Scoping Invariants
validator.resetSession();
// Team 1 scores "chalice"
const t1Chalice = validator.evaluateAnswer('sacred_vessels_and_altar_linens', 'Chalice', 'team1', 1);
check(t1Chalice.accepted === true, 'Team 1 scores Chalice');
// Team 2 independently scores "chalice"
const t2Chalice = validator.evaluateAnswer('sacred_vessels_and_altar_linens', 'Chalice', 'team2', 1);
check(t2Chalice.accepted === true, 'Team 2 can independently score Chalice');
// Team 1 duplicate rejected
const t1ChaliceDup = validator.evaluateAnswer('sacred_vessels_and_altar_linens', 'Chalice', 'team1', 1);
check(t1ChaliceDup.accepted === false && t1ChaliceDup.reason === 'duplicate', 'Team 1 duplicate Chalice rejected');
// Team 2 duplicate rejected
const t2ChaliceDup = validator.evaluateAnswer('sacred_vessels_and_altar_linens', 'Chalice', 'team2', 1);
check(t2ChaliceDup.accepted === false && t2ChaliceDup.reason === 'duplicate', 'Team 2 duplicate Chalice rejected');

// Cross-category isolation: "rosary" in two different categories
validator.resetSession('team1');
const rCatA = validator.evaluateAnswer('ways_and_forms_of_praying', 'rosary', 'team1', 1);
check(rCatA.accepted === true, 'Team 1 scores rosary in ways_and_forms_of_praying');
const rCatB = validator.evaluateAnswer('sacramentals_and_prayer_objects', 'rosary beads', 'team1', 1);
check(rCatB.accepted === true, 'Team 1 scores rosary beads in sacramentals_and_prayer_objects');
const rCatADup = validator.evaluateAnswer('ways_and_forms_of_praying', 'rosary', 'team1', 1);
check(rCatADup.accepted === false && rCatADup.reason === 'duplicate', 'Team 1 duplicate in ways_and_forms_of_praying rejected');

console.log('  ✓ Duplicate evasion attacks systematically defeated: 100% duplicate rejection rate');

// ============================================================================
// SUITE 4: Multiplier Validation (Round 1 vs Round 2 Across All Tiers)
// ============================================================================
suiteHeader('SUITE 4: Multiplier Validation (Round 1 vs Round 2 Across All 28 Categories & Tiers)');

const expectedTierValues = {
  pew_warmer: { r1Pts: 10, r1Depth: 100, r2Pts: 15, r2Depth: 150, audio: 'pew_warmer_chime' },
  altar_server: { r1Pts: 30, r1Depth: 300, r2Pts: 45, r2Depth: 450, audio: 'altar_server_chime' },
  theologian: { r1Pts: 60, r1Depth: 600, r2Pts: 90, r2Depth: 900, audio: 'theologian_chime' },
  doctor_of_the_church: { r1Pts: 85, r1Depth: 850, r2Pts: 128, r2Depth: 1275, audio: 'doctor_chime' },
  one_in_a_credillion: { r1Pts: 100, r1Depth: 1000, r2Pts: 150, r2Depth: 1500, audio: 'credillion_organ' }
};

let multiplierChecksCount = 0;

for (const cat of questionsData.categories) {
  for (const [tier, expected] of Object.entries(expectedTierValues)) {
    const sampleWord = cat.tiers[tier][0];
    check(Boolean(sampleWord), `Category ${cat.id} has at least 1 word in tier ${tier}`);

    // Verify Round 1
    validator.resetSession('team_mult', cat.id);
    const r1 = validator.evaluateAnswer(cat.id, sampleWord, 'team_mult', 1);
    multiplierChecksCount++;
    check(r1.accepted === true, `R1 answer "${sampleWord}" accepted in ${cat.id}`);
    check(r1.tier === tier, `R1 answer "${sampleWord}" has tier ${tier}`);
    check(r1.points === expected.r1Pts, `R1 points for ${tier} must be ${expected.r1Pts} (got ${r1.points})`);
    check(r1.depthMeters === expected.r1Depth, `R1 depth for ${tier} must be ${expected.r1Depth} (got ${r1.depthMeters})`);
    check(r1.audioTrigger === expected.audio, `R1 audio for ${tier} must be ${expected.audio} (got ${r1.audioTrigger})`);

    // Verify Round 2 (1.5x Multiplier)
    validator.resetSession('team_mult', cat.id);
    const r2 = validator.evaluateAnswer(cat.id, sampleWord, 'team_mult', 2);
    multiplierChecksCount++;
    check(r2.accepted === true, `R2 answer "${sampleWord}" accepted in ${cat.id}`);
    check(r2.tier === tier, `R2 answer "${sampleWord}" has tier ${tier}`);
    check(r2.points === expected.r2Pts, `R2 points for ${tier} must be ${expected.r2Pts} (got ${r2.points})`);
    check(r2.depthMeters === expected.r2Depth, `R2 depth for ${tier} must be ${expected.r2Depth} (got ${r2.depthMeters})`);
    check(r2.audioTrigger === expected.audio, `R2 audio for ${tier} must be ${expected.audio} (got ${r2.audioTrigger})`);
  }
}
console.log(`  ✓ Verified ${multiplierChecksCount} tier evaluations across all 28 categories in Round 1 & Round 2`);

// Error cases in Round 2 must NOT receive multiplier points
console.log('  Testing zero-point guarantees on errors in Round 2:');
validator.resetSession('team_mult', 'words_in_our_father');
// 1. Invalid input
const r2Invalid = validator.evaluateAnswer('words_in_our_father', '   ', 'team_mult', 2);
check(r2Invalid.accepted === false && r2Invalid.points === 0 && r2Invalid.depthMeters === 0 && r2Invalid.audioTrigger === 'error_buzz', 'Round 2 invalid_input awards 0 points and 0 depth');

// 2. Not found
const r2NotFound = validator.evaluateAnswer('words_in_our_father', 'nonexistent_word_xyz', 'team_mult', 2);
check(r2NotFound.accepted === false && r2NotFound.points === 0 && r2NotFound.depthMeters === 0 && r2NotFound.audioTrigger === 'error_buzz', 'Round 2 not_found awards 0 points and 0 depth');

// 3. Duplicate
validator.evaluateAnswer('words_in_our_father', 'father', 'team_mult', 2);
const r2Dup = validator.evaluateAnswer('words_in_our_father', 'father', 'team_mult', 2);
check(r2Dup.accepted === false && r2Dup.reason === 'duplicate' && r2Dup.points === 0 && r2Dup.depthMeters === 0 && r2Dup.audioTrigger === 'error_buzz', 'Round 2 duplicate awards 0 points and 0 depth');

// Round number parameter edge cases
const roundParams = [
  { val: '2', expectedR2: true },
  { val: 2, expectedR2: true },
  { val: '1', expectedR2: false },
  { val: 1, expectedR2: false },
  { val: 0, expectedR2: false },
  { val: -1, expectedR2: false },
  { val: 3, expectedR2: false },
  { val: null, expectedR2: false },
  { val: undefined, expectedR2: false },
  { val: NaN, expectedR2: false }
];

for (const p of roundParams) {
  validator.resetSession('team_param', 'words_in_our_father');
  const res = validator.evaluateAnswer('words_in_our_father', 'father', 'team_param', p.val);
  const expectedPoints = p.expectedR2 ? 15 : 10;
  check(res.points === expectedPoints, `Round param (${typeof p.val}: ${String(p.val)}) resolved points to ${expectedPoints}`);
}
console.log('  ✓ Zero-point error guarantees and round parameter edge cases verified');

// ============================================================================
// SUMMARY & VERDICT
// ============================================================================
console.log('\n===============================================================');
console.log(' Catholic Krillion: Adversarial Oracle Summary Report');
console.log('===============================================================');
console.log(`  Total Invariant Assertions: ${totalAssertions}`);
console.log(`  Passed Assertions:          ${passedAssertions}`);
console.log(`  Failed Assertions:          ${failedAssertions}`);
console.log(`  Success Rate:               ${((passedAssertions / totalAssertions) * 100).toFixed(2)}%`);
console.log('===============================================================\n');

if (failedAssertions > 0) {
  console.error(`FATAL: ${failedAssertions} adversarial assertion(s) FAILED!`);
  process.exit(1);
} else {
  console.log('SUCCESS: All adversarial oracle assertions PASSED (Verdict: APPROVE).');
  process.exit(0);
}
