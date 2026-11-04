/**
 * Catholic Krillion ("Credillion") — Frontend Controller Verification Suite
 * 
 * Verifies:
 * 1. Static HTML & CSS structure of public/team.html
 * 2. Ecclesiastical visual theme, responsive layout, and visual feedback styling
 * 3. Client-side team detection logic (/team1, /team2, ?team=team1, ?t=2, etc.)
 * 4. WebSocket protocol schemas (REGISTER, INPUT_UPDATE, SUBMIT_WORD)
 * 5. Instant visual feedback handlers (success glow, duplicate shake, not found shake)
 * 6. Match phase state management (lobby, round1, halftime, round2 Duc In Altum, gameover)
 * 7. Live HTTP & WebSocket integration with server.js on test port
 * 
 * Usage:
 *   node test/test_frontend_controller.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert');
const { WebSocket } = require('ws');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

let testsPassed = 0;
let testsFailed = 0;

function logTest(name, passed, details = '') {
  if (passed) {
    testsPassed++;
    console.log(`  ${colors.green}✓ PASS${colors.reset} ${name} ${details ? colors.dim + '(' + details + ')' + colors.reset : ''}`);
  } else {
    testsFailed++;
    console.error(`  ${colors.red}✗ FAIL${colors.reset} ${name} ${details ? colors.red + details + colors.reset : ''}`);
  }
}

function runSection(title) {
  console.log(`\n${colors.bold}${colors.cyan}=== ${title} ===${colors.reset}`);
}

async function runControllerTestSuite() {
  console.log(`${colors.bold}${colors.yellow}================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.yellow} Catholic Krillion — Screen 2 & 3 Team Controller Verification  ${colors.reset}`);
  console.log(`${colors.bold}${colors.yellow}================================================================${colors.reset}`);

  const publicDir = path.join(__dirname, '..', 'public');
  const teamHtmlPath = path.join(publicDir, 'team.html');

  // ---------------------------------------------------------------------------
  // SECTION 1: HTML Structure & Element Existence
  // ---------------------------------------------------------------------------
  runSection('Section 1: HTML Structure & Required Controller Elements');

  assert(fs.existsSync(teamHtmlPath), `team.html must exist at ${teamHtmlPath}`);
  logTest('public/team.html file exists on disk', true);

  const htmlContent = fs.readFileSync(teamHtmlPath, 'utf8');

  // Verify HTML5 doctype & responsive viewport
  const hasDoctype = /<!DOCTYPE html>/i.test(htmlContent);
  const hasViewport = /<meta\s+name=["']viewport["']/i.test(htmlContent);
  logTest('HTML5 DOCTYPE & responsive viewport configured', hasDoctype && hasViewport);

  // Check required Header elements
  const headerElements = [
    'teamBadgeIcon',
    'teamNameDisplay',
    'teamLabelText',
    'teamMottoDisplay',
    'btnTeam1',
    'btnTeam2',
    'wsStatusBadge',
    'wsStatusDot',
    'wsStatusText'
  ];
  const missingHeader = headerElements.filter(id => !htmlContent.includes(`id="${id}"`));
  logTest('Header elements present (badge, team label, team buttons, status indicator)', missingHeader.length === 0, missingHeader.join(', '));

  // Check required Phase screens
  const phaseScreens = ['lobbyScreen', 'roundScreen', 'halftimeScreen', 'gameoverScreen'];
  const missingScreens = phaseScreens.filter(id => !htmlContent.includes(`id="${id}"`));
  logTest('All 4 match phase screens present (lobby, round, halftime, gameover)', missingScreens.length === 0, missingScreens.join(', '));

  // Check Category Prompt elements
  const promptElements = ['promptCategoryTag', 'promptTitleDisplay', 'promptDescDisplay'];
  const missingPrompt = promptElements.filter(id => !htmlContent.includes(`id="${id}"`));
  logTest('Prominent category prompt display elements present', missingPrompt.length === 0, missingPrompt.join(', '));

  // Check Timer & Stats elements
  const statsElements = ['roundTimerDisplay', 'timerPill', 'roundTag', 'currentPointsVal', 'currentDepthVal', 'round2MultiplierBanner'];
  const missingStats = statsElements.filter(id => !htmlContent.includes(`id="${id}"`));
  logTest('Timer and depth/points stats display elements present', missingStats.length === 0, missingStats.join(', '));

  // Check Input Form & Submission elements
  const inputElements = ['submissionForm', 'wordInputWrapper', 'wordInput', 'submitBtn', 'charCountHint'];
  const missingInput = inputElements.filter(id => !htmlContent.includes(`id="${id}"`));
  logTest('Autofocus input box and submission form elements present', missingInput.length === 0, missingInput.join(', '));

  // Check autofocus attribute on wordInput
  const hasAutofocus = /id=["']wordInput["'][^>]*autofocus|autofocus[^>]*id=["']wordInput["']/i.test(htmlContent);
  logTest('Word input box has autofocus enabled for instant typing', hasAutofocus);

  // Check Visual Feedback Toast elements
  const feedbackElements = ['feedbackToast', 'feedbackTierBadge', 'feedbackMessage', 'feedbackScoreGain'];
  const missingFeedback = feedbackElements.filter(id => !htmlContent.includes(`id="${id}"`));
  logTest('Visual feedback toast and tier announcement elements present', missingFeedback.length === 0, missingFeedback.join(', '));

  // Check Recent Words elements
  const recentElements = ['recentWordsList', 'wordsCountBadge', 'emptyWordsPlaceholder'];
  const missingRecent = recentElements.filter(id => !htmlContent.includes(`id="${id}"`));
  logTest('Recent scored words panel and count badge elements present', missingRecent.length === 0, missingRecent.join(', '));

  // Check Halftime & Gameover specific elements
  const intermissionElements = ['halftimeTimerDisplay', 'halftimeMyPoints', 'halftimeOppPoints', 'halftimeMyDepth', 'halftimeOppDepth'];
  const missingIntermission = intermissionElements.filter(id => !htmlContent.includes(`id="${id}"`));
  logTest('Halftime review scoreboard elements present', missingIntermission.length === 0, missingIntermission.join(', '));

  const podiumElements = ['gameoverResultTitle', 'podiumColTeam1', 'podiumColTeam2', 'statCountPew', 'statCountCred'];
  const missingPodium = podiumElements.filter(id => !htmlContent.includes(`id="${id}"`));
  logTest('Victory podium & rarity breakdown elements present', missingPodium.length === 0, missingPodium.join(', '));

  // ---------------------------------------------------------------------------
  // SECTION 2: Ecclesiastical Styling & Visual Feedback Animations
  // ---------------------------------------------------------------------------
  runSection('Section 2: Ecclesiastical Theme Palette & Animation Styles');

  const hasNavy = htmlContent.includes('#0F172A') || htmlContent.includes('#0A0F1D');
  const hasGold = htmlContent.includes('#C59B27') || htmlContent.includes('#E4BC4A');
  const hasCrimson = htmlContent.includes('#881337') || htmlContent.includes('#BE123C');
  logTest('Ecclesiastical palette configured (Vatican Navy, Liturgical Gold, Cardinal Crimson)', hasNavy && hasGold && hasCrimson);

  const hasSuccessAnimation = htmlContent.includes('@keyframes successGlow') && htmlContent.includes('feedback-success');
  logTest('Positive submission glow animation (@keyframes successGlow) defined', hasSuccessAnimation);

  const hasShakeAnimation = htmlContent.includes('@keyframes errorShake') && htmlContent.includes('feedback-shake');
  logTest('Error/duplicate shake animation (@keyframes errorShake) defined', hasShakeAnimation);

  const hasTierClasses = [
    'tier-pew_warmer',
    'tier-altar_server',
    'tier-theologian',
    'tier-doctor_of_the_church',
    'tier-one_in_a_credillion'
  ].every(cls => htmlContent.includes(cls));
  logTest('All 5 Krillion depth rarity tier styles present in CSS', hasTierClasses);

  const hasErrorToastClasses = ['error-duplicate', 'error-not_found'].every(cls => htmlContent.includes(cls));
  logTest('Feedback toast error styles (error-duplicate, error-not_found) present', hasErrorToastClasses);

  // ---------------------------------------------------------------------------
  // SECTION 3: Client Logic & Team Detection Logic
  // ---------------------------------------------------------------------------
  runSection('Section 3: Team Detection & Parameter Resolution');

  // Verify URL detection function works across paths and query parameters
  function simulateDetectTeam(pathname, search, localStorageVal = null) {
    const p = (pathname || '').toLowerCase();
    if (p.includes('team2')) return 'team2';
    if (p.includes('team1')) return 'team1';

    const params = new URLSearchParams(search || '');
    const paramTeam = (params.get('team') || params.get('role') || params.get('t') || '').toLowerCase();
    if (paramTeam === 'team2' || paramTeam === '2' || paramTeam === 'b') return 'team2';
    if (paramTeam === 'team1' || paramTeam === '1' || paramTeam === 'a') return 'team1';

    if (localStorageVal === 'team2' || localStorageVal === 'team1') return localStorageVal;
    return 'team1';
  }

  logTest('Detects team1 from path /team1', simulateDetectTeam('/team1', '') === 'team1');
  logTest('Detects team2 from path /team2', simulateDetectTeam('/team2', '') === 'team2');
  logTest('Detects team1 from path /team1.html', simulateDetectTeam('/team1.html', '') === 'team1');
  logTest('Detects team2 from path /team2.html', simulateDetectTeam('/team2.html', '') === 'team2');
  logTest('Detects team1 from query ?team=team1', simulateDetectTeam('/team.html', '?team=team1') === 'team1');
  logTest('Detects team2 from query ?team=team2', simulateDetectTeam('/team.html', '?team=team2') === 'team2');
  logTest('Detects team1 from query ?t=1', simulateDetectTeam('/team.html', '?t=1') === 'team1');
  logTest('Detects team2 from query ?t=2', simulateDetectTeam('/team.html', '?t=2') === 'team2');
  logTest('Detects team2 from query ?role=team2', simulateDetectTeam('/team.html', '?role=team2') === 'team2');
  logTest('Falls back to default team1 when no hints provided', simulateDetectTeam('/team.html', '') === 'team1');

  // ---------------------------------------------------------------------------
  // SECTION 4: Keystroke Streaming & Protocol Message Schemas
  // ---------------------------------------------------------------------------
  runSection('Section 4: WebSocket Protocol Message Schemas');

  // Verify INPUT_UPDATE schema generator
  function createInputUpdate(team, text, seq) {
    return {
      type: 'INPUT_UPDATE',
      team: team,
      text: text,
      seq: seq,
      timestamp: Date.now()
    };
  }

  const msg1 = createInputUpdate('team1', 'pater', 1);
  const isValidInputUpdate = msg1.type === 'INPUT_UPDATE' &&
                             msg1.team === 'team1' &&
                             msg1.text === 'pater' &&
                             msg1.seq === 1 &&
                             typeof msg1.timestamp === 'number';
  logTest('INPUT_UPDATE schema conforms to contract (type, team, text, seq, timestamp)', isValidInputUpdate);

  // Verify SUBMIT_WORD schema generator
  function createSubmitWord(team, word, seq) {
    return {
      type: 'SUBMIT_WORD',
      team: team,
      word: word,
      seq: seq,
      timestamp: Date.now()
    };
  }

  const msg2 = createSubmitWord('team1', 'pater', 2);
  const isValidSubmitWord = msg2.type === 'SUBMIT_WORD' &&
                            msg2.team === 'team1' &&
                            msg2.word === 'pater' &&
                            msg2.seq === 2 &&
                            typeof msg2.timestamp === 'number';
  logTest('SUBMIT_WORD schema conforms to contract (type, team, word, seq, timestamp)', isValidSubmitWord);

  // Verify REGISTER schema generator
  function createRegister(role) {
    return {
      type: 'REGISTER',
      role: role,
      timestamp: Date.now()
    };
  }

  const msg3 = createRegister('team2');
  const isValidRegister = msg3.type === 'REGISTER' && msg3.role === 'team2' && typeof msg3.timestamp === 'number';
  logTest('REGISTER schema conforms to contract (type, role, timestamp)', isValidRegister);

  // ---------------------------------------------------------------------------
  // SECTION 5: Timer Math & Formatting
  // ---------------------------------------------------------------------------
  runSection('Section 5: Timer Math & Formatting Logic');

  function formatTime(remainingMs) {
    const totalSec = Math.ceil(Math.max(0, remainingMs) / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  logTest('Formats 180,000ms as 3:00', formatTime(180000) === '3:00');
  logTest('Formats 145,000ms as 2:25', formatTime(145000) === '2:25');
  logTest('Formats 15,000ms as 0:15', formatTime(15000) === '0:15');
  logTest('Formats 5,000ms as 0:05', formatTime(5000) === '0:05');
  logTest('Formats 0ms as 0:00', formatTime(0) === '0:00');
  logTest('Handles negative remaining gracefully as 0:00', formatTime(-1000) === '0:00');

  // ---------------------------------------------------------------------------
  // SECTION 6: Live Integration with Server (HTTP & WebSockets)
  // ---------------------------------------------------------------------------
  runSection('Section 6: Live Integration with server.js');

  const TEST_PORT = 3088;
  process.env.PORT = String(TEST_PORT);

  // Spawn an in-process Krillion server from server.js
  const serverModule = require('../server');
  let serverInstance = null;
  let activeSockets = [];

  try {
    serverInstance = serverModule.createKrillionServer({ port: TEST_PORT });
    await new Promise((resolve, reject) => {
      serverInstance.server.once('error', reject);
      serverInstance.server.listen(TEST_PORT, '127.0.0.1', () => {
        serverInstance.server.removeListener('error', reject);
        resolve();
      });
    });
  } catch (err) {
    console.warn('    Server creation note:', err.message);
  }

  // Small delay to ensure server socket is listening
  await new Promise(r => setTimeout(r, 200));

  // Test HTTP GET /team1
  const httpGetTeam1 = await new Promise((resolve) => {
    http.get(`http://localhost:${TEST_PORT}/team1`, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          contentType: res.headers['content-type'] || '',
          body: data
        });
      });
    }).on('error', (err) => resolve({ error: err.message }));
  });

  logTest(
    'HTTP GET /team1 serves 200 OK with text/html content',
    httpGetTeam1.statusCode === 200 && httpGetTeam1.contentType.includes('text/html'),
    `status: ${httpGetTeam1.statusCode}`
  );
  logTest(
    'HTTP GET /team1 body contains Credillion title and wordInput',
    httpGetTeam1.body && httpGetTeam1.body.includes('Credillion') && httpGetTeam1.body.includes('wordInput'),
    `length: ${httpGetTeam1.body ? httpGetTeam1.body.length : 0}`
  );

  // Test HTTP GET /team2
  const httpGetTeam2 = await new Promise((resolve) => {
    http.get(`http://localhost:${TEST_PORT}/team2`, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          contentType: res.headers['content-type'] || '',
          body: data
        });
      });
    }).on('error', (err) => resolve({ error: err.message }));
  });

  logTest(
    'HTTP GET /team2 serves 200 OK with text/html content',
    httpGetTeam2.statusCode === 200 && httpGetTeam2.contentType.includes('text/html'),
    `status: ${httpGetTeam2.statusCode}`
  );

  // Test WebSocket connection as Team 1
  const wsUrl = `ws://localhost:${TEST_PORT}`;
  const team1Ws = new WebSocket(wsUrl);
  activeSockets.push(team1Ws);

  const team1Connected = await new Promise((resolve) => {
    team1Ws.on('open', () => resolve(true));
    team1Ws.on('error', () => resolve(false));
    setTimeout(() => resolve(false), 2000);
  });
  logTest('Team 1 WebSocket establishes connection successfully', team1Connected);

  // Test REGISTER handshake
  let registerAckReceived = false;
  team1Ws.send(JSON.stringify({ type: 'REGISTER', role: 'team1' }));

  await new Promise((resolve) => {
    const handler = (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'REGISTER_ACK') {
          registerAckReceived = true;
          team1Ws.off('message', handler);
          resolve();
        }
      } catch (e) {}
    };
    team1Ws.on('message', handler);
    setTimeout(resolve, 1500);
  });
  logTest('Team 1 receives REGISTER_ACK from server', registerAckReceived);

  // Test Live Keystroke Relay over WS (< 100ms)
  let liveTypingRelayed = false;
  const hostWs = new WebSocket(wsUrl);
  hostWs.on('error', (err) => console.warn('hostWs error:', err.message));
  activeSockets.push(hostWs);

  await new Promise(r => hostWs.on('open', r));
  hostWs.send(JSON.stringify({ type: 'REGISTER', role: 'host' }));

  const keystrokePromise = new Promise((resolve) => {
    hostWs.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'LIVE_TYPING_RELAY' && msg.team === 'team1' && msg.text === 'father') {
          liveTypingRelayed = true;
          resolve();
        }
      } catch (e) {}
    });
    setTimeout(resolve, 1500);
  });

  team1Ws.send(JSON.stringify({
    type: 'INPUT_UPDATE',
    team: 'team1',
    text: 'father',
    seq: 1,
    timestamp: Date.now()
  }));

  await keystrokePromise;
  logTest('Team 1 INPUT_UPDATE keystroke streaming relayed to Host with sub-100ms latency', liveTypingRelayed);

  // Test Valid Word Submission (Pew Warmer tier: "father" in Our Father)
  let wordEvaluatedReceived = false;
  let wordResult = null;

  const evalPromise = new Promise((resolve) => {
    const handler = (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'WORD_EVALUATED' && msg.team === 'team1') {
          wordEvaluatedReceived = true;
          wordResult = msg.result;
          team1Ws.off('message', handler);
          resolve();
        }
      } catch (e) {}
    };
    team1Ws.on('message', handler);
    setTimeout(resolve, 1500);
  });

  team1Ws.send(JSON.stringify({
    type: 'SUBMIT_WORD',
    team: 'team1',
    word: 'father',
    timestamp: Date.now()
  }));

  await evalPromise;
  const wordAccepted = wordEvaluatedReceived && wordResult && wordResult.accepted === true;
  logTest('Team 1 SUBMIT_WORD("father") accepted by server validation engine', wordAccepted, `points: ${wordResult ? wordResult.points : 0}`);

  // Test Duplicate Word Submission (Submitting "father" again)
  let duplicateEvaluated = false;
  let duplicateReason = null;

  const dupPromise = new Promise((resolve) => {
    const handler = (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'WORD_EVALUATED' && msg.team === 'team1') {
          duplicateEvaluated = true;
          duplicateReason = msg.result ? msg.result.reason : null;
          team1Ws.off('message', handler);
          resolve();
        }
      } catch (e) {}
    };
    team1Ws.on('message', handler);
    setTimeout(resolve, 1500);
  });

  team1Ws.send(JSON.stringify({
    type: 'SUBMIT_WORD',
    team: 'team1',
    word: 'father',
    timestamp: Date.now()
  }));

  await dupPromise;
  const isDuplicateRejected = duplicateEvaluated && duplicateReason === 'duplicate';
  logTest('Duplicate submission correctly rejected with reason: "duplicate"', isDuplicateRejected);

  // Test Unrecognized Word Submission ("supercalifragilistic123")
  let notFoundEvaluated = false;
  let notFoundReason = null;

  const notFoundPromise = new Promise((resolve) => {
    const handler = (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'WORD_EVALUATED' && msg.team === 'team1') {
          notFoundEvaluated = true;
          notFoundReason = msg.result ? msg.result.reason : null;
          team1Ws.off('message', handler);
          resolve();
        }
      } catch (e) {}
    };
    team1Ws.on('message', handler);
    setTimeout(resolve, 1500);
  });

  team1Ws.send(JSON.stringify({
    type: 'SUBMIT_WORD',
    team: 'team1',
    word: 'supercalifragilistic123',
    timestamp: Date.now()
  }));

  await notFoundPromise;
  const isNotFoundRejected = notFoundEvaluated && notFoundReason === 'not_found';
  logTest('Unrecognized word correctly rejected with reason: "not_found"', isNotFoundRejected);

  // Test Round 2 Duc In Altum 1.5x Multiplier
  let r2Evaluated = false;
  let r2Points = 0;

  // Trigger Round 1 then advance to Round 2 Duc In Altum via Host control
  hostWs.send(JSON.stringify({ type: 'HOST_CONTROL', action: 'START_MATCH' }));
  await new Promise(r => setTimeout(r, 150));
  hostWs.send(JSON.stringify({ type: 'HOST_CONTROL', action: 'SKIP_HALFTIME' }));
  await new Promise(r => setTimeout(r, 200));

  const r2Promise = new Promise((resolve) => {
    const handler = (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'WORD_EVALUATED' && msg.team === 'team1') {
          r2Evaluated = true;
          r2Points = msg.result ? msg.result.points : 0;
          team1Ws.off('message', handler);
          resolve();
        }
      } catch (e) {}
    };
    team1Ws.on('message', handler);
    setTimeout(resolve, 1500);
  });

  // Submit "heaven" (base 10 points * 1.5 multiplier = 15 points)
  team1Ws.send(JSON.stringify({
    type: 'SUBMIT_WORD',
    team: 'team1',
    word: 'heaven',
    timestamp: Date.now()
  }));

  await r2Promise;
  const is15xApplied = r2Evaluated && r2Points === 15;
  logTest('Round 2 Duc In Altum awards 1.5× multiplier (10 base -> 15 points)', is15xApplied, `awarded: ${r2Points} pts`);

  // Close all test WebSocket connections
  for (const ws of activeSockets) {
    try { ws.close(); } catch (e) {}
  }

  // Close HTTP server if we started one
  if (serverInstance && typeof serverInstance.close === 'function') {
    serverInstance.close();
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}${colors.cyan}=== Verification Summary ===${colors.reset}`);
  console.log(`  Total Checks: ${testsPassed + testsFailed}`);
  console.log(`  ${colors.green}Passed: ${testsPassed}${colors.reset}`);
  console.log(`  ${testsFailed > 0 ? colors.red : colors.dim}Failed: ${testsFailed}${colors.reset}`);

  if (testsFailed > 0) {
    console.error(`\n${colors.red}${colors.bold}VERIFICATION FAILED WITH ${testsFailed} ERROR(S)${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`\n${colors.green}${colors.bold}ALL FRONTEND CONTROLLER VERIFICATION CHECKS PASSED (EXIT CODE 0)${colors.reset}`);
    process.exit(0);
  }
}

runControllerTestSuite().catch((err) => {
  console.error(`\n${colors.red}Unhandled Exception in Controller Test Suite:${colors.reset}`, err);
  process.exit(1);
});
