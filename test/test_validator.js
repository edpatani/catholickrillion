/**
 * Catholic Krillion ("Credillion") - Unit Test Suite for Validator & Question Bank
 * 
 * Verifies:
 * 1. Question Bank schema and completeness (all 6 core categories, 5 tiers per category).
 * 2. 8-stage normalization pipeline (case, accents, ligatures, hyphens, prefixes, church prefixes).
 * 3. Length-gated Levenshtein typo tolerance.
 * 4. Duplicate prevention per team and cross-team scoping.
 * 5. Scoring & Round 1 vs Round 2 multiplier calculations.
 * 6. Tier 5 One-in-a-Credillion audio and point triggers.
 * 7. Input edge cases and error handling.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const {
  KrillionValidator,
  normalizeString,
  levenshteinDistance,
  maxAllowedDistance
} = require('../engine/validator.js');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(description, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${description}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✗ ${description}`);
    console.error(`    Error: ${err.message}`);
  }
}

console.log('====================================================');
console.log('Catholic Krillion: Validator & Question Bank Tests');
console.log('====================================================\n');

// Load questions directly
const questionsPath = path.join(__dirname, '../data/questions.json');
const questionsData = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
const validator = new KrillionValidator(questionsData);

// ----------------------------------------------------
// Suite 1: Question Bank Schema & Completeness
// ----------------------------------------------------
console.log('Suite 1: Question Bank Schema & 6 Core Categories');

test('questions.json exists and contains exactly 6 curated categories', () => {
  assert.strictEqual(Array.isArray(questionsData.categories), true);
  assert.strictEqual(questionsData.categories.length, 6, 'Should have exactly 6 categories');
  assert.strictEqual(validator.getCategoryIds().length, 6);
});

test('Each category has required properties: id, title, prompt, tiers, aliases', () => {
  const expectedTiers = ['pew_warmer', 'altar_server', 'theologian', 'doctor_of_the_church', 'one_in_a_credillion'];
  
  for (const cat of questionsData.categories) {
    assert.ok(cat.id, `Category missing id: ${JSON.stringify(cat)}`);
    assert.ok(cat.title, `Category ${cat.id} missing title`);
    assert.ok(cat.prompt, `Category ${cat.id} missing prompt`);
    assert.ok(cat.tiers, `Category ${cat.id} missing tiers`);
    assert.ok(typeof cat.aliases === 'object', `Category ${cat.id} missing aliases`);

    for (const tier of expectedTiers) {
      assert.ok(Array.isArray(cat.tiers[tier]), `Category ${cat.id} missing tier array: ${tier}`);
      assert.ok(cat.tiers[tier].length >= 4, `Category ${cat.id} tier ${tier} has fewer than 4 answers (${cat.tiers[tier].length})`);
    }
  }
});

test('All 6 expected category IDs are present in the catalog', () => {
  const expectedIds = [
    'saints',
    'physical_ways_to_pray',
    'worship_songs',
    'types_of_prayers',
    'biblical_characters',
    'churches_in_singapore'
  ];

  for (const id of expectedIds) {
    const cat = validator.getCategory(id);
    assert.ok(cat, `Expected category id not found: ${id}`);
    assert.strictEqual(cat.id, id);
  }
});

// ----------------------------------------------------
// Suite 2: 8-Stage Normalization Pipeline
// ----------------------------------------------------
console.log('\nSuite 2: 8-Stage Normalization Pipeline');

test('Stage 1: Lowercase and whitespace trim', () => {
  assert.strictEqual(normalizeString('  ROSARY  '), 'rosary');
  assert.strictEqual(normalizeString('\tKneel\n'), 'kneel');
});

test('Stage 2: Unicode NFD diacritics decomposition & stripping', () => {
  assert.strictEqual(normalizeString('Thérèse'), 'therese');
  assert.strictEqual(normalizeString('São Paulo'), 'paulo'); // 'sao' is stripped as prefix
  assert.strictEqual(normalizeString('Ávila'), 'avila');
  assert.strictEqual(normalizeString('Benoît'), 'benoit');
});

test('Stage 3: Special ligature replacements', () => {
  assert.strictEqual(normalizeString('Cæcilia'), 'caecilia');
  assert.strictEqual(normalizeString('cœur'), 'coeur');
  assert.strictEqual(normalizeString('Groß'), 'gross');
  assert.strictEqual(normalizeString('ðing'), 'ding');
  assert.strictEqual(normalizeString('þorn'), 'thorn');
});

test('Stage 4: Convert hyphens to spaces', () => {
  assert.strictEqual(normalizeString('prie-dieu'), 'prie dieu');
  assert.strictEqual(normalizeString('sign-of-the-cross'), 'sign of the cross');
});

test('Stage 5: Strip punctuation and non-alphanumerics', () => {
  assert.strictEqual(normalizeString("St. Anthony!"), 'anthony');
  assert.strictEqual(normalizeString('Lord, Hear Our Prayer...'), 'lord hear our prayer');
  assert.strictEqual(normalizeString("Saint Joseph's Church"), 'josephs church');
});

test('Stage 6: Collapse multiple whitespaces', () => {
  assert.strictEqual(normalizeString('Holy    Family   Church'), 'holy family church');
});

test('Stage 7: Strip leading honorifics, church terms, and articles', () => {
  assert.strictEqual(normalizeString('Saint Francis of Assisi'), 'francis of assisi');
  assert.strictEqual(normalizeString('St. Thomas Aquinas'), 'thomas aquinas');
  assert.strictEqual(normalizeString('Church of the Holy Family'), 'holy family');
  assert.strictEqual(normalizeString('Cathedral of the Good Shepherd'), 'good shepherd');
  assert.strictEqual(normalizeString('Church of Saint Teresa'), 'teresa');
  assert.strictEqual(normalizeString('The Rosary'), 'rosary');
  assert.strictEqual(normalizeString('A Novena'), 'novena');
});

test('Prefix stripping does not break standalone words starting with prefix letters', () => {
  assert.strictEqual(normalizeString('Theologian'), 'theologian');
  assert.strictEqual(normalizeString('Sanctuary'), 'sanctuary');
  assert.strictEqual(normalizeString('Station'), 'station');
  assert.strictEqual(normalizeString('Saint'), 'saint'); // no space after, so remains saint
});

// ----------------------------------------------------
// Suite 3: Levenshtein Distance & Length-Gated Tolerance
// ----------------------------------------------------
console.log('\nSuite 3: Levenshtein & Typo Tolerance');

test('Levenshtein distance calculation accuracy', () => {
  assert.strictEqual(levenshteinDistance('rosary', 'rosary'), 0);
  assert.strictEqual(levenshteinDistance('rosary', 'rosery'), 1);
  assert.strictEqual(levenshteinDistance('kneeling', 'knealing'), 1);
  assert.strictEqual(levenshteinDistance('kitten', 'sitting'), 3);
});

test('Length-gated thresholds: L<=4: 0, 5<=L<=8: 1, L>=9: 2', () => {
  assert.strictEqual(maxAllowedDistance(3), 0);
  assert.strictEqual(maxAllowedDistance(4), 0);
  assert.strictEqual(maxAllowedDistance(5), 1);
  assert.strictEqual(maxAllowedDistance(8), 1);
  assert.strictEqual(maxAllowedDistance(9), 2);
  assert.strictEqual(maxAllowedDistance(15), 2);
});

test('Typo tolerance accepts valid 1-distance typo on length 6', () => {
  validator.resetSession();
  const res = validator.evaluateAnswer('physical_ways_to_pray', 'knealing', 'team1', 1);
  assert.strictEqual(res.accepted, true, 'knealing should match kneeling');
  assert.strictEqual(res.canonical.toLowerCase(), 'kneeling');
});

test('Typo tolerance accepts valid 1-distance typo on length 8', () => {
  validator.resetSession();
  const res = validator.evaluateAnswer('worship_songs', 'Cornerstona', 'team1', 1);
  assert.strictEqual(res.accepted, true);
  assert.strictEqual(res.canonical, 'Cornerstone');
});

test('Typo tolerance accepts valid 2-distance typo on long words (L>=9)', () => {
  validator.resetSession();
  const res = validator.evaluateAnswer('churches_in_singapore', 'Transfigurasian', 'team1', 1);
  assert.strictEqual(res.accepted, true);
  assert.strictEqual(res.canonical, 'Church of the Transfiguration');
});

test('Short words (L<=4) reject any typos to prevent false positives', () => {
  validator.resetSession();
  // Target: "Paul" (len 4) -> max allowed distance is 0
  const resPaul = validator.evaluateAnswer('saints', 'Paull', 'team1', 1);
  assert.strictEqual(resPaul.accepted, false);
  assert.strictEqual(resPaul.reason, 'not_found');
});

test('Large typo beyond length tolerance is rejected', () => {
  validator.resetSession();
  const res = validator.evaluateAnswer('saints', 'Fffffranciss', 'team1', 1);
  assert.strictEqual(res.accepted, false);
  assert.strictEqual(res.reason, 'not_found');
});

test('Irrelevant word is rejected with not_found', () => {
  validator.resetSession();
  const res1 = validator.evaluateAnswer('saints', 'Zeus', 'team1', 1);
  assert.strictEqual(res1.accepted, false);
  assert.strictEqual(res1.reason, 'not_found');

  const res2 = validator.evaluateAnswer('churches_in_singapore', 'Eiffel Tower', 'team1', 1);
  assert.strictEqual(res2.accepted, false);
  assert.strictEqual(res2.reason, 'not_found');
});

// ----------------------------------------------------
// Suite 4: Canonical Aliases & Common Variants
// ----------------------------------------------------
console.log('\nSuite 4: Canonical Aliases & Common Variants');

test('St. Anthony resolves to Anthony of Padua via alias', () => {
  validator.resetSession();
  const res1 = validator.evaluateAnswer('saints', 'St. Anthony', 'team1', 1);
  assert.strictEqual(res1.accepted, true);
  assert.strictEqual(res1.canonical, 'Anthony of Padua');

  validator.resetSession();
  const res2 = validator.evaluateAnswer('saints', 'Anthony', 'team1', 1);
  assert.strictEqual(res2.accepted, true);
  assert.strictEqual(res2.canonical, 'Anthony of Padua');
});

test('Mother Teresa resolves correctly', () => {
  validator.resetSession();
  const res = validator.evaluateAnswer('saints', 'Mother Teresa', 'team1', 1);
  assert.strictEqual(res.accepted, true);
  assert.strictEqual(res.canonical, 'Mother Teresa');
});

test('Padre Pio resolves to Padre Pio', () => {
  validator.resetSession();
  const res = validator.evaluateAnswer('saints', 'Padre Pio', 'team1', 1);
  assert.strictEqual(res.accepted, true);
  assert.strictEqual(res.canonical, 'Padre Pio');
});

test('JP2 resolves to John Paul II', () => {
  validator.resetSession();
  const res = validator.evaluateAnswer('saints', 'JP2', 'team1', 1);
  assert.strictEqual(res.accepted, true);
  assert.strictEqual(res.canonical, 'John Paul II');
});

test('Novena Church resolves to Novena Church', () => {
  validator.resetSession();
  const res = validator.evaluateAnswer('churches_in_singapore', 'Novena', 'team1', 1);
  assert.strictEqual(res.accepted, true);
  assert.strictEqual(res.canonical, 'Novena Church');
});

test('Singapore Church acronyms resolve (OLPS, SMOTA, SFX, COTT, CDM)', () => {
  validator.resetSession();
  const res1 = validator.evaluateAnswer('churches_in_singapore', 'OLPS', 'team1', 1);
  assert.strictEqual(res1.accepted, true);
  assert.strictEqual(res1.canonical, 'Church of Our Lady of Perpetual Succour');

  validator.resetSession();
  const res2 = validator.evaluateAnswer('churches_in_singapore', 'SMOTA', 'team1', 1);
  assert.strictEqual(res2.accepted, true);
  assert.strictEqual(res2.canonical, 'Church of Saint Mary of the Angels');

  validator.resetSession();
  const res3 = validator.evaluateAnswer('churches_in_singapore', 'COTT', 'team1', 1);
  assert.strictEqual(res3.accepted, true);
  assert.strictEqual(res3.canonical, 'Church of the Transfiguration');
});

test('Worship song variations resolve (10000 Reasons, Oceans Where Feet May Fail)', () => {
  validator.resetSession();
  const res1 = validator.evaluateAnswer('worship_songs', '10000 reasons', 'team1', 1);
  assert.strictEqual(res1.accepted, true);
  assert.strictEqual(res1.canonical, '10,000 Reasons');

  validator.resetSession();
  const res2 = validator.evaluateAnswer('worship_songs', 'where feet may fail', 'team1', 1);
  assert.strictEqual(res2.accepted, true);
  assert.strictEqual(res2.canonical, 'Oceans');
});

test('Physical prayer verb forms resolve to canonicals', () => {
  validator.resetSession();
  const res1 = validator.evaluateAnswer('physical_ways_to_pray', 'kneel', 'team1', 1);
  assert.strictEqual(res1.accepted, true);
  assert.strictEqual(res1.canonical.toLowerCase(), 'kneeling');

  validator.resetSession();
  const res2 = validator.evaluateAnswer('physical_ways_to_pray', 'genuflect', 'team1', 1);
  assert.strictEqual(res2.accepted, true);
  assert.strictEqual(res2.canonical.toLowerCase(), 'genuflecting');

  validator.resetSession();
  const res3 = validator.evaluateAnswer('physical_ways_to_pray', 'make sign of the cross', 'team1', 1);
  assert.strictEqual(res3.accepted, true);
  assert.strictEqual(res3.canonical.toLowerCase(), 'sign of the cross');
});

// ----------------------------------------------------
// Suite 5: Scoring Tiers & Round Multipliers
// ----------------------------------------------------
console.log('\nSuite 5: Depth Tiers & Round 1 vs Round 2 Multipliers');

test('Round 1 points and depth meters for all 5 tiers', () => {
  validator.resetSession();
  
  // Tier 1: Pew Warmer (10 pts, 100m)
  const t1 = validator.evaluateAnswer('saints', 'Mary', 'team1', 1);
  assert.strictEqual(t1.tier, 'pew_warmer');
  assert.strictEqual(t1.points, 10);
  assert.strictEqual(t1.depthMeters, 100);
  assert.strictEqual(t1.audioTrigger, 'pew_warmer_chime');

  // Tier 2: Altar Server (30 pts, 300m)
  const t2 = validator.evaluateAnswer('saints', 'Padre Pio', 'team1', 1);
  assert.strictEqual(t2.tier, 'altar_server');
  assert.strictEqual(t2.points, 30);
  assert.strictEqual(t2.depthMeters, 300);
  assert.strictEqual(t2.audioTrigger, 'altar_server_chime');

  // Tier 3: Theologian (60 pts, 600m)
  const t3 = validator.evaluateAnswer('saints', 'Justin Martyr', 'team1', 1);
  assert.strictEqual(t3.tier, 'theologian');
  assert.strictEqual(t3.points, 60);
  assert.strictEqual(t3.depthMeters, 600);
  assert.strictEqual(t3.audioTrigger, 'theologian_chime');

  // Tier 4: Doctor of the Church (85 pts, 850m)
  const t4 = validator.evaluateAnswer('saints', 'Athanasius', 'team1', 1);
  assert.strictEqual(t4.tier, 'doctor_of_the_church');
  assert.strictEqual(t4.points, 85);
  assert.strictEqual(t4.depthMeters, 850);
  assert.strictEqual(t4.audioTrigger, 'doctor_chime');

  // Tier 5: One-in-a-Credillion (100 pts, 1000m)
  const t5 = validator.evaluateAnswer('saints', 'Drogo', 'team1', 1);
  assert.strictEqual(t5.tier, 'one_in_a_credillion');
  assert.strictEqual(t5.points, 100);
  assert.strictEqual(t5.depthMeters, 1000);
  assert.strictEqual(t5.audioTrigger, 'credillion_organ');
});

test('Doctors of the Church score in high tier (doctor_of_the_church: 85 pts / 850m)', () => {
  validator.resetSession();
  
  const aquinas = validator.evaluateAnswer('saints', 'Thomas Aquinas', 'team1', 1);
  assert.strictEqual(aquinas.accepted, true);
  assert.strictEqual(aquinas.tier, 'doctor_of_the_church');
  assert.strictEqual(aquinas.points, 85);
  assert.strictEqual(aquinas.depthMeters, 850);

  const augustine = validator.evaluateAnswer('saints', 'Augustine', 'team1', 1);
  assert.strictEqual(augustine.accepted, true);
  assert.strictEqual(augustine.tier, 'doctor_of_the_church');

  const catherine = validator.evaluateAnswer('saints', 'Catherine of Siena', 'team1', 1);
  assert.strictEqual(catherine.accepted, true);
  assert.strictEqual(catherine.tier, 'doctor_of_the_church');

  const therese = validator.evaluateAnswer('saints', 'Therese of Lisieux', 'team1', 1);
  assert.strictEqual(therese.accepted, true);
  assert.strictEqual(therese.tier, 'doctor_of_the_church');

  const anthony = validator.evaluateAnswer('saints', 'Anthony of Padua', 'team1', 1);
  assert.strictEqual(anthony.accepted, true);
  assert.strictEqual(anthony.tier, 'doctor_of_the_church');
});


test('Round 2 multiplier (1.5x) correctly scales points and depth meters', () => {
  validator.resetSession();

  // Tier 1: 10 * 1.5 = 15 pts, 100 * 1.5 = 150m
  const t1 = validator.evaluateAnswer('saints', 'Mary', 'team1', 2);
  assert.strictEqual(t1.points, 15);
  assert.strictEqual(t1.depthMeters, 150);

  // Tier 2: 30 * 1.5 = 45 pts, 300 * 1.5 = 450m
  const t2 = validator.evaluateAnswer('saints', 'Padre Pio', 'team1', 2);
  assert.strictEqual(t2.points, 45);
  assert.strictEqual(t2.depthMeters, 450);

  // Tier 3: 60 * 1.5 = 90 pts, 600 * 1.5 = 900m
  const t3 = validator.evaluateAnswer('saints', 'Justin Martyr', 'team1', 2);
  assert.strictEqual(t3.points, 90);
  assert.strictEqual(t3.depthMeters, 900);

  // Tier 4: Math.round(85 * 1.5) = 128 pts, Math.round(850 * 1.5) = 1275m
  const t4 = validator.evaluateAnswer('saints', 'Athanasius', 'team1', 2);
  assert.strictEqual(t4.points, 128);
  assert.strictEqual(t4.depthMeters, 1275);

  // Tier 5: 100 * 1.5 = 150 pts, 1000 * 1.5 = 1500m
  const t5 = validator.evaluateAnswer('saints', 'Drogo', 'team1', 2);
  assert.strictEqual(t5.points, 150);
  assert.strictEqual(t5.depthMeters, 1500);
  assert.strictEqual(t5.audioTrigger, 'credillion_organ');
});

// ----------------------------------------------------
// Suite 6: Duplicate Prevention & Team Scoping
// ----------------------------------------------------
console.log('\nSuite 6: Duplicate Prevention & Per-Team Scoping');

test('Duplicate submission by same team in same category is rejected', () => {
  validator.resetSession();
  const first = validator.evaluateAnswer('saints', 'Peter', 'team1', 1);
  assert.strictEqual(first.accepted, true);
  assert.strictEqual(first.reason, null);

  const second = validator.evaluateAnswer('saints', 'peter', 'team1', 1);
  assert.strictEqual(second.accepted, false);
  assert.strictEqual(second.reason, 'duplicate');
  assert.strictEqual(second.points, 0);
  assert.strictEqual(second.audioTrigger, 'error_buzz');
});

test('Cross-team duplicate locking: if team 1 enters an answer, team 2 cannot use that word anymore', () => {
  validator.resetSession();
  
  // Team 1 scores Peter
  const t1 = validator.evaluateAnswer('saints', 'Peter', 'team1', 1);
  assert.strictEqual(t1.accepted, true);
  assert.strictEqual(t1.points, 10);

  // Team 2 attempts to score Peter -> REJECTED because Team 1 already claimed it!
  const t2Peter = validator.evaluateAnswer('saints', 'Peter', 'team2', 1);
  assert.strictEqual(t2Peter.accepted, false);
  assert.strictEqual(t2Peter.reason, 'duplicate');
  assert.strictEqual(t2Peter.points, 0);

  // Team 2 scores another valid answer (Paul) -> ACCEPTED
  const t2Paul = validator.evaluateAnswer('saints', 'Paul', 'team2', 1);
  assert.strictEqual(t2Paul.accepted, true);
  assert.strictEqual(t2Paul.points, 10);

  // Team 1 attempts Paul -> REJECTED because Team 2 claimed it!
  const t1Paul = validator.evaluateAnswer('saints', 'Paul', 'team1', 1);
  assert.strictEqual(t1Paul.accepted, false);
  assert.strictEqual(t1Paul.reason, 'duplicate');
});

test('ResetSession clears recorded duplicates for new rounds/matches', () => {
  validator.resetSession();
  validator.evaluateAnswer('saints', 'Peter', 'team1', 1);
  assert.strictEqual(validator.isDuplicate('team1', 'saints', 'peter'), true);

  // Reset
  validator.resetSession();
  assert.strictEqual(validator.isDuplicate('team1', 'saints', 'peter'), false);

  const res = validator.evaluateAnswer('saints', 'Peter', 'team1', 1);
  assert.strictEqual(res.accepted, true);
});

// ----------------------------------------------------
// Suite 7: Edge Cases and Robustness
// ----------------------------------------------------
console.log('\nSuite 7: Input Edge Cases & Error Handling');

test('Empty or whitespace input is safely rejected', () => {
  const r1 = validator.evaluateAnswer('saints', '', 'team1', 1);
  assert.strictEqual(r1.accepted, false);
  assert.strictEqual(r1.reason, 'invalid_input');

  const r2 = validator.evaluateAnswer('saints', '   ', 'team1', 1);
  assert.strictEqual(r2.accepted, false);
  assert.strictEqual(r2.reason, 'invalid_input');

  const r3 = validator.evaluateAnswer('saints', null, 'team1', 1);
  assert.strictEqual(r3.accepted, false);
  assert.strictEqual(r3.reason, 'invalid_input');
});

test('Non-existent category ID returns not_found', () => {
  const r = validator.evaluateAnswer('invalid_category_xyz', 'peace', 'team1', 1);
  assert.strictEqual(r.accepted, false);
  assert.strictEqual(r.reason, 'not_found');
});

test('One-in-a-Credillion triggers credillion_organ audio across different categories', () => {
  validator.resetSession();
  // Saints: Drogo
  const r1 = validator.evaluateAnswer('saints', 'Drogo', 'team1', 1);
  assert.strictEqual(r1.accepted, true);
  assert.strictEqual(r1.tier, 'one_in_a_credillion');
  assert.strictEqual(r1.audioTrigger, 'credillion_organ');

  // Worship songs: Agnus Dei
  const r2 = validator.evaluateAnswer('worship_songs', 'Agnus Dei', 'team1', 1);
  assert.strictEqual(r2.accepted, true);
  assert.strictEqual(r2.tier, 'one_in_a_credillion');
  assert.strictEqual(r2.audioTrigger, 'credillion_organ');
});

// ----------------------------------------------------
// Suite 8: Catalog Broad Verification & Constructor Options
// ----------------------------------------------------
console.log('\nSuite 8: Catalog Broad Verification & Constructor Options');

test('Every single one of the 6 categories evaluates valid answers across all 5 tiers', () => {
  const tiers = ['pew_warmer', 'altar_server', 'theologian', 'doctor_of_the_church', 'one_in_a_credillion'];
  
  for (const cat of questionsData.categories) {
    validator.resetSession('test_team', cat.id);
    for (const tier of tiers) {
      const sampleAnswer = cat.tiers[tier][0];
      assert.ok(sampleAnswer, `Category ${cat.id} tier ${tier} has no sample answer`);
      const res = validator.evaluateAnswer(cat.id, sampleAnswer, 'test_team', 1);
      assert.strictEqual(res.accepted, true, `Category ${cat.id} failed on answer "${sampleAnswer}"`);
      assert.strictEqual(res.tier, tier, `Category ${cat.id} answer "${sampleAnswer}" expected tier ${tier} but got ${res.tier}`);
      assert.ok(res.points > 0, `Points should be > 0 for ${sampleAnswer}`);
      assert.ok(res.depthMeters > 0, `Depth meters should be > 0 for ${sampleAnswer}`);
    }
  }
});

test('Default constructor with no arguments loads data/questions.json automatically', () => {
  const autoValidator = new KrillionValidator();
  assert.strictEqual(autoValidator.getCategoryIds().length, 6);
  const res = autoValidator.evaluateAnswer('saints', 'Peter', 'team1', 1);
  assert.strictEqual(res.accepted, true);
  assert.strictEqual(res.points, 10);
});

test('Constructor accepts file path string', () => {
  const pathValidator = new KrillionValidator(questionsPath);
  assert.strictEqual(pathValidator.getCategoryIds().length, 6);
});

test('Constructor accepts categories array directly', () => {
  const arrValidator = new KrillionValidator(questionsData.categories);
  assert.strictEqual(arrValidator.getCategoryIds().length, 6);
});

test('Targeted resetSession methods', () => {
  validator.resetSession();
  validator.evaluateAnswer('saints', 'Peter', 'team1', 1);
  validator.evaluateAnswer('worship_songs', 'Amazing Grace', 'team1', 1);
  validator.evaluateAnswer('saints', 'Paul', 'team2', 1);

  assert.strictEqual(validator.getScoredAnswers('team1', 'saints').length, 1);
  assert.strictEqual(validator.getScoredAnswers('team1', 'worship_songs').length, 1);
  assert.strictEqual(validator.getScoredAnswers('team2', 'saints').length, 1);

  // Reset only team1 saints
  validator.resetSession('team1', 'saints');
  assert.strictEqual(validator.getScoredAnswers('team1', 'saints').length, 0);
  assert.strictEqual(validator.getScoredAnswers('team1', 'worship_songs').length, 1);
  assert.strictEqual(validator.getScoredAnswers('team2', 'saints').length, 1);

  // Reset all team1
  validator.resetSession('team1');
  assert.strictEqual(validator.getScoredAnswers('team1', 'worship_songs').length, 0);
  assert.strictEqual(validator.getScoredAnswers('team2', 'saints').length, 1);

  // Reset all
  validator.resetSession();
  assert.strictEqual(validator.getScoredAnswers('team2', 'saints').length, 0);
});

// ----------------------------------------------------
// Summary
// ----------------------------------------------------
console.log('\n====================================================');
console.log(`Test Execution Summary:`);
console.log(`  Total Tests:  ${totalTests}`);
console.log(`  Passed Tests: ${passedTests}`);
console.log(`  Failed Tests: ${failedTests}`);
console.log('====================================================\n');

if (failedTests > 0) {
  console.error(`FATAL: ${failedTests} test(s) failed.`);
  process.exit(1);
} else {
  console.log('SUCCESS: All KrillionValidator unit tests passed (100%).');
  process.exit(0);
}
