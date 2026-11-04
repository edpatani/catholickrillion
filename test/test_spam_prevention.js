const assert = require('assert');
const { GameStateManager } = require('../server.js');
const { KrillionValidator } = require('../engine/validator.js');
const questions = require('../data/questions.json');

async function testSpamPrevention() {
  console.log('=== Catholic Krillion: Testing Word Spamming & One-Word-at-a-Time Prevention ===\n');

  // --- Test Suite A: Direct Validator Engine Tests ---
  console.log('Suite A: Validator Engine Duplicate & Multi-Word Tests');
  const val = new KrillionValidator(questions, { matchWideUnique: true });

  // 1. Same word in same category
  const cat1 = questions.categories[0].id;
  const word1 = questions.categories[0].tiers.pew_warmer[0];
  console.log(`1. Testing same category duplicate for "${word1}" in ${cat1}`);

  val.resetSession();
  const sub1 = val.evaluateAnswer(cat1, word1, 'team1', 1);
  assert.strictEqual(sub1.accepted, true, 'First submission must be accepted');
  assert.ok(sub1.points > 0, 'First submission must award points');

  const sub2 = val.evaluateAnswer(cat1, word1, 'team1', 1);
  assert.strictEqual(sub2.accepted, false, 'Duplicate in same category must be rejected');
  assert.strictEqual(sub2.points, 0, 'Duplicate must award 0 points');
  assert.strictEqual(sub2.reason, 'duplicate', 'Reason must be duplicate');
  console.log('   ✓ Rejected duplicate in same prompt (+0 pts)');

  // 2. Cross-category match-wide duplicate prevention
  // "peter" appears in both saints and biblical_characters
  const catA = 'saints';
  const catB = 'biblical_characters';
  val.resetSession();
  console.log(`2. Testing cross-category match-wide duplicate for "peter" across ${catA} and ${catB}`);
  const subA = val.evaluateAnswer(catA, 'peter', 'team1', 1);
  assert.strictEqual(subA.accepted, true, 'First submission in cat A must be accepted');

  const subB = val.evaluateAnswer(catB, 'peter', 'team1', 1);
  assert.strictEqual(subB.accepted, false, 'Word already scored in match must be rejected even in another category where it is also valid');
  assert.strictEqual(subB.points, 0, 'Cross-category duplicate must award 0 points');
  assert.strictEqual(subB.reason, 'duplicate', 'Reason must be duplicate');
  console.log('   ✓ Rejected same word in different category (+0 pts, match-wide unique)');

  // 3. Multi-word answers are valid and accepted
  console.log('3. Testing multi-word answer acceptance');
  val.resetSession();
  const multiWordAnswer = 'sign of the cross';
  const catDevotions = 'physical_ways_to_pray';
  const multiSub = val.evaluateAnswer(catDevotions, multiWordAnswer, 'team1', 1);
  assert.strictEqual(multiSub.accepted, true, 'Multi-word answers like "sign of the cross" must be accepted');
  assert.ok(multiSub.points > 0, 'Multi-word answer must award points');
  console.log(`   ✓ Multi-word answer "${multiWordAnswer}" accepted (+${multiSub.points} pts)`);

  // Submitting the same multi-word answer again should be rejected as duplicate
  const multiSubDup = val.evaluateAnswer(catDevotions, multiWordAnswer, 'team1', 1);
  assert.strictEqual(multiSubDup.accepted, false, 'Duplicate multi-word answer must be rejected');
  assert.strictEqual(multiSubDup.reason, 'duplicate');
  console.log(`   ✓ Duplicate multi-word answer rejected (+0 pts, duplicate)`);

  // --- Test Suite B: Authoritative GameStateManager Server Tests ---
  console.log('\nSuite B: Authoritative GameStateManager Server Tests');
  const g = new GameStateManager();
  g.startMatch();

  const activePromptId = g.prompt.id;
  const activeCat = questions.categories.find(c => c.id === activePromptId);
  const sampleWord = Object.values(activeCat.tiers)[0][0];
  console.log(`Active Category: "${activeCat.title}", Word: "${sampleWord}"`);

  // Initial score
  assert.strictEqual(g.scores.team1.points, 0);
  assert.strictEqual(g.scores.team1.wordsScored.length, 0);

  // Submit valid word
  const res1 = g.submitWord('team1', sampleWord);
  assert.strictEqual(res1.accepted, true, 'First submit must be accepted');
  const scoreAfter1 = g.scores.team1.points;
  assert.ok(scoreAfter1 > 0, 'Score must increase');
  assert.strictEqual(g.scores.team1.wordsScored.length, 1);
  console.log(`   ✓ Submission 1 accepted: +${res1.points} pts (Total: ${scoreAfter1})`);

  // Immediately spam the same word again
  const res2 = g.submitWord('team1', sampleWord);
  assert.strictEqual(res2.accepted, false, 'Spamming same word must be rejected');
  assert.strictEqual(res2.points, 0, 'Duplicate submission must award 0 points');
  assert.strictEqual(g.scores.team1.points, scoreAfter1, 'Score must NOT increase');
  assert.strictEqual(g.scores.team1.wordsScored.length, 1, 'wordsScored list must NOT grow');
  console.log(`   ✓ Duplicate rejected: +0 pts (Total remained ${g.scores.team1.points})`);

  // Rapid burst rate-limiting test (submit another word within 50ms)
  const anotherWord = Object.values(activeCat.tiers)[1][0];
  const rapidBurst = g.submitWord('team1', anotherWord);
  assert.strictEqual(rapidBurst.accepted, false, 'Burst submission within 350ms must be rate-limited');
  assert.strictEqual(rapidBurst.reason, 'rate_limited');
  assert.strictEqual(rapidBurst.points, 0);
  assert.strictEqual(g.scores.team1.points, scoreAfter1, 'Rate-limited word must award 0 points');
  console.log(`   ✓ Rapid burst rate-limited: +0 pts (Total remained ${g.scores.team1.points})`);

  // Wait 400ms to clear cooldown
  await new Promise(r => setTimeout(r, 450));

  // Now submit the second word after cooldown
  const res3 = g.submitWord('team1', anotherWord);
  assert.strictEqual(res3.accepted, true, 'Submission after cooldown must be accepted');
  assert.strictEqual(g.scores.team1.wordsScored.length, 2);
  const scoreAfter3 = g.scores.team1.points;
  assert.ok(scoreAfter3 > scoreAfter1);
  console.log(`   ✓ Submission after cooldown accepted: +${res3.points} pts (Total: ${scoreAfter3})`);

  // Change category to one where sampleWord might be valid, or test with 'peter'
  console.log('\n4. Testing cross-category duplicate in GameStateManager');
  g.setCategory(catA);
  await new Promise(r => setTimeout(r, 450));
  const resPeter1 = g.submitWord('team1', 'peter');
  assert.strictEqual(resPeter1.accepted, true);

  // Switch to Cat B where 'peter' is also valid, try submitting 'peter' again
  g.setCategory(catB);
  await new Promise(r => setTimeout(r, 450));
  const resPeter2 = g.submitWord('team1', 'peter');
  assert.strictEqual(resPeter2.accepted, false, 'Previously scored word cannot be reused across categories in same match');
  assert.strictEqual(resPeter2.points, 0);
  assert.strictEqual(resPeter2.reason, 'duplicate');
  console.log('   ✓ Cross-category spam rejected on server: +0 pts (duplicate)');

  console.log('\n🎉 ALL SPAM PREVENTION & ONE-WORD-AT-A-TIME TESTS PASSED!\n');
}

testSpamPrevention().catch(err => {
  console.error('\n❌ Test Failed:', err);
  process.exit(1);
});
