const assert = require('assert');
const { createKrillionServer, GameStateManager } = require('../server.js');

async function runEngineTests() {
  console.log('=== Running Engine & Rotation Unit Tests ===\n');

  const mgr = new GameStateManager();

  // Test 1: Initial state is lobby and not paused
  console.log('Test 1: Initial State is Lobby');
  assert.strictEqual(mgr.phase, 'lobby');
  assert.strictEqual(mgr.paused, false);
  assert.strictEqual(mgr.categoryRemainingMs, 60000);
  console.log('✓ Initial state is lobby (60s category window)');

  // Test 2: Starting match picks a random category
  console.log('\nTest 2: Starting match picks a random category');
  const catSamples = new Set();
  for (let i = 0; i < 15; i++) {
    mgr.startMatch();
    assert.strictEqual(mgr.phase, 'round1');
    assert.strictEqual(mgr.round, 1);
    assert.ok(mgr.prompt.id, 'Prompt must have an id');
    assert.ok(mgr.prompt.title, 'Prompt must have a title');
    catSamples.add(mgr.prompt.id);
  }
  console.log(`✓ 15 matches started picked ${catSamples.size} distinct random categories:`, Array.from(catSamples));
  assert.ok(catSamples.size > 1, 'Random categories must produce variety');

  // Test 3: Pause and Resume
  console.log('\nTest 3: Pause and Resume');
  mgr.startMatch();
  assert.strictEqual(mgr.paused, false);

  mgr.pause();
  assert.strictEqual(mgr.paused, true);

  // Submissions should be rejected when paused
  const rej = mgr.submitWord('team1', 'amen');
  assert.strictEqual(rej.accepted, false);
  assert.strictEqual(rej.reason, 'game_not_active');
  console.log('✓ Submissions rejected while paused');

  // Ticking while paused should not advance remaining time or category time
  const catTimeBefore = mgr.categoryRemainingMs;
  const tickRes = mgr.tick();
  assert.strictEqual(tickRes.phaseChanged, false);
  assert.strictEqual(tickRes.categoryChanged, false);
  assert.strictEqual(mgr.categoryRemainingMs, catTimeBefore);
  console.log('✓ Timers frozen while paused');

  mgr.resume();
  assert.strictEqual(mgr.paused, false);
  console.log('✓ Successfully resumed');

  // Test 4: 60s Category Rotation
  console.log('\nTest 4: Automatic Category Rotation every 60s (1 minute)');
  mgr.startMatch();
  const cat1 = mgr.prompt.id;
  console.log('Starting category:', mgr.prompt.title, `(${cat1})`);

  let rotatedCat = null;
  // Simulate 60 ticks (60 seconds)
  for (let sec = 1; sec <= 60; sec++) {
    mgr.endTime -= 1000; // simulate clock time passing
    const res = mgr.tick();
    if (res.categoryChanged) {
      rotatedCat = mgr.prompt.id;
      console.log(`✓ Rotated at second ${sec} to:`, mgr.prompt.title, `(${rotatedCat})`);
    }
  }

  assert.ok(rotatedCat, 'Category must rotate after 60 seconds');
  assert.notStrictEqual(rotatedCat, cat1, 'New category must be different from previous');
  assert.strictEqual(mgr.categoryRemainingMs, 60000, 'Category timer resets to 60s');

  // Test 5: Reset
  console.log('\nTest 5: Reset');
  mgr.reset();
  assert.strictEqual(mgr.phase, 'lobby');
  assert.strictEqual(mgr.scores.team1.points, 0);
  assert.strictEqual(mgr.scores.team2.points, 0);
  assert.strictEqual(mgr.paused, false);
  console.log('✓ Successfully reset back to Lobby');

  console.log('\n🎉 ALL ENGINE & ROTATION TESTS PASSED (5/5)!\n');
}

runEngineTests().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
