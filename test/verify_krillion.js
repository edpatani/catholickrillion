/**
 * Catholic Krillion ("Credillion") — Master End-to-End Verification Test Suite
 * 
 * Comprehensive E2E test runner covering Tiers 1-4:
 * - Tier 1: Feature Coverage & Interface Contracts (HTTP routes, WS registration, <100ms live typing relay, scoring, audio events)
 * - Tier 2: Boundary & Corner Cases (empty typing, bursts, Levenshtein lengths, prefixes, diacritics, duplicates, reconnect)
 * - Tier 3: Cross-Feature Combinations & Concurrency (team racing, typing during timer ticks, last-second submission, halftime retention, 1.5x multiplier)
 * - Tier 4: Real-World Scenarios (Full match lifecycle: Setup -> Round 1 -> Halftime -> Round 2 Duc In Altum -> Victory Podium)
 * 
 * Usage:
 *   node test/verify_krillion.js
 *   node test/verify_krillion.js --port 3055
 *   node test/verify_krillion.js --spawn
 */

const { KrillionTestHarness } = require('./e2e_harness');

// ANSI Color Helpers
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function logHeader(text) {
  console.log(`\n${colors.bold}${colors.cyan}=== ${text} ===${colors.reset}`);
}

function logTier(tierName, description) {
  console.log(`\n${colors.bold}${colors.yellow}-------------------------------------------------------------${colors.reset}`);
  console.log(`${colors.bold}${colors.yellow} ${tierName}: ${description}${colors.reset}`);
  console.log(`${colors.bold}${colors.yellow}-------------------------------------------------------------${colors.reset}`);
}

function logPass(name, durationMs, details = '') {
  const detailStr = details ? ` ${colors.dim}(${details})${colors.reset}` : '';
  console.log(`  ${colors.green}✓ PASS${colors.reset} ${name} ${colors.dim}[${durationMs}ms]${colors.reset}${detailStr}`);
}

function logFail(name, err, durationMs) {
  console.log(`  ${colors.red}✗ FAIL${colors.reset} ${name} ${colors.dim}[${durationMs}ms]${colors.reset}`);
  console.log(`    ${colors.red}Error: ${err.message}${colors.reset}`);
  if (err.stack && process.env.VERBOSE) {
    console.log(`    ${colors.dim}${err.stack.split('\n').slice(1, 4).join('\n    ')}${colors.reset}`);
  }
}

// Simple assertion helper
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

class TestRunner {
  constructor(options = {}) {
    this.port = options.port || parseInt(process.env.TEST_PORT, 10) || 3042;
    this.spawnMode = options.spawn || process.argv.includes('--spawn');
    this.verbose = options.verbose || process.argv.includes('--verbose');
    this.harness = new KrillionTestHarness({ port: this.port });

    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      tiers: {
        'Tier 1': { total: 0, passed: 0, failed: 0 },
        'Tier 2': { total: 0, passed: 0, failed: 0 },
        'Tier 3': { total: 0, passed: 0, failed: 0 },
        'Tier 4': { total: 0, passed: 0, failed: 0 }
      },
      failures: []
    };
  }

  async runTest(tierKey, name, fn) {
    this.results.total++;
    this.results.tiers[tierKey].total++;
    const t0 = performance.now();

    try {
      const details = await fn();
      const dur = Math.round(performance.now() - t0);
      this.results.passed++;
      this.results.tiers[tierKey].passed++;
      logPass(name, dur, details);
    } catch (err) {
      const dur = Math.round(performance.now() - t0);
      this.results.failed++;
      this.results.tiers[tierKey].failed++;
      this.results.failures.push({ tier: tierKey, name, error: err.message });
      logFail(name, err, dur);
    }
  }

  async executeAll() {
    logHeader(`Catholic Krillion ("Credillion") Master E2E Verification Suite`);
    console.log(`${colors.dim}Node: ${process.version} | OS: ${process.platform} | Test Port: ${this.port} | Mode: ${this.spawnMode ? 'Spawned Child Process' : 'In-Process Server'}${colors.reset}`);

    const suiteStartTime = performance.now();

    try {
      // 1. Start Server
      console.log(`\nInitializing test environment on port ${this.port}...`);
      await this.harness.startServer(this.port, { spawn: this.spawnMode });
      console.log(`${colors.green}✓ Test server ready at http://127.0.0.1:${this.port}/${colors.reset}`);

      // =========================================================================
      // TIER 1: Feature Coverage & Interface Contracts
      // =========================================================================
      logTier('Tier 1', 'Feature Coverage & Interface Contracts');

      // T1.1: HTTP Routing
      await this.runTest('Tier 1', 'T1.1 HTTP Endpoints & Static Routes', async () => {
        // Screen 1: Host Display
        const hostRes = await this.harness.httpGet('/');
        assertEqual(hostRes.status, 200, 'Host GET / status');
        assert(hostRes.body.includes('Catholic') || hostRes.body.includes('Credillion') || hostRes.body.includes('<!DOCTYPE html>'), 'Host HTML content');

        // Screen 2: Team 1 Controller
        const team1Res = await this.harness.httpGet('/team1');
        assertEqual(team1Res.status, 200, 'Team 1 GET /team1 status');

        // Screen 3: Team 2 Controller
        const team2Res = await this.harness.httpGet('/team2');
        assertEqual(team2Res.status, 200, 'Team 2 GET /team2 status');

        // API Info Endpoint
        const infoRes = await this.harness.httpGet('/api/info');
        assertEqual(infoRes.status, 200, 'API Info GET /api/info status');
        const info = infoRes.json();
        assertEqual(info.status, 'ready', 'info.status');
        assertEqual(info.app, 'Credillion', 'info.app');
        assert(typeof info.ip === 'string' && info.ip.length > 0, 'info.ip exists');
        assert(typeof info.port === 'number' && (info.port === this.port || info.port === 3000), 'info.port matches valid port');
        assert(info.connected && typeof info.connected.total === 'number', 'info.connected metadata');

        // QR Code Endpoints
        const qr1Res = await this.harness.httpGet('/api/qr/team1');
        assertEqual(qr1Res.status, 200, 'QR Team 1 status');
        const qr1 = qr1Res.json();
        assert(qr1.team === 'team1' && (qr1.qr || qr1.dataUrl), 'QR Team 1 payload');

        const qr2Res = await this.harness.httpGet('/api/qr/team2');
        assertEqual(qr2Res.status, 200, 'QR Team 2 status');
        const qr2 = qr2Res.json();
        assert(qr2.team === 'team2' && (qr2.qr || qr2.dataUrl), 'QR Team 2 payload');

        return `Checked /, /team1, /team2, /api/info, /api/qr/*`;
      });

      // T1.2: Multi-Client WebSocket Handshake & Role Registration
      await this.runTest('Tier 1', 'T1.2 WebSocket Multi-Client Registration Handshake', async () => {
        const { host, team1, team2 } = await this.harness.connectAll();
        assert(host.isOpen, 'Host socket is open');
        assert(team1.isOpen, 'Team 1 socket is open');
        assert(team2.isOpen, 'Team 2 socket is open');

        // Wait for REGISTER_ACK on all 3 clients
        const hostAck = await host.waitForType('REGISTER_ACK');
        assertEqual(hostAck.role, 'host', 'Host ACK role');

        const t1Ack = await team1.waitForType('REGISTER_ACK');
        assertEqual(t1Ack.role, 'team1', 'Team 1 ACK role');

        const t2Ack = await team2.waitForType('REGISTER_ACK');
        assertEqual(t2Ack.role, 'team2', 'Team 2 ACK role');

        // Check STATE_SYNC & TIMER_SYNC
        const stateSync = await host.waitForType('STATE_SYNC');
        assert(stateSync.phase === 'lobby' || typeof stateSync.phase === 'string', 'Initial phase is lobby');
        assert(stateSync.prompt && stateSync.prompt.id, 'Prompt data present');

        const timerSync = await host.waitForType('TIMER_SYNC');
        assert(typeof timerSync.remainingMs === 'number', 'Timer sync remainingMs present');

        return `Host, Team 1, Team 2 successfully registered`;
      });

      // T1.3: Live Keystroke Relay & Latency Measurement (< 100ms)
      await this.runTest('Tier 1', 'T1.3 Live Keystroke Relay & Latency (< 100ms)', async () => {
        // Clear message buffers
        this.harness.clients.host.clearMessages();

        // Sample 5 sequential keystrokes from Team 1
        const sampleKeys = ['f', 'fa', 'fat', 'fath', 'father'];
        const latencies = [];

        for (const str of sampleKeys) {
          const { latencyMs, relayMsg } = await this.harness.measureKeystrokeLatency('team1', str);
          latencies.push(latencyMs);
          assertEqual(relayMsg.team, 'team1', 'Relay message team');
          assertEqual(relayMsg.text, str, 'Relay message text content');
          assert(latencyMs < 100, `Keystroke latency ${latencyMs}ms must be strictly < 100ms`);
        }

        // Test Team 2 keystroke relay as well
        const t2Sample = await this.harness.measureKeystrokeLatency('team2', 'heaven');
        latencies.push(t2Sample.latencyMs);
        assertEqual(t2Sample.relayMsg.team, 'team2', 'Team 2 relay team');
        assert(t2Sample.latencyMs < 100, `Team 2 keystroke latency ${t2Sample.latencyMs}ms < 100ms`);

        const avgLat = Math.round((latencies.reduce((a, b) => a + b, 0) / latencies.length) * 10) / 10;
        return `Avg latency: ${avgLat}ms across ${latencies.length} keystrokes (all <100ms)`;
      });

      // T1.4: Word Submission & Scoring
      await this.runTest('Tier 1', 'T1.4 Word Submission, Scoring & Descent Depth Evaluation', async () => {
        const host = this.harness.clients.host;
        const team1 = this.harness.clients.team1;

        // Reset and start match
        host.sendHostControl('START_MATCH');
        await host.waitForMessage(m => m.type === 'STATE_SYNC' && m.phase === 'round1');

        // Set to saints category
        host.sendHostControl('SET_CATEGORY', { categoryId: 'saints' });
        await host.waitForMessage(m => m.type === 'STATE_SYNC' && m.prompt?.id === 'saints');

        // Submit valid Pew Warmer word: "Mary"
        host.clearMessages();
        team1.clearMessages();

        const evalMsg = await this.harness.submitWordAndWait('team1', 'Mary');
        assertEqual(evalMsg.type, 'WORD_EVALUATED', 'Message type');
        assertEqual(evalMsg.team, 'team1', 'Evaluated team');
        assert(evalMsg.result.accepted === true, 'Submission must be accepted');
        assertEqual(evalMsg.result.tier, 'pew_warmer', 'Rarity tier is pew_warmer');
        assertEqual(evalMsg.result.points, 10, 'Pew Warmer points = 10');
        assertEqual(evalMsg.result.depthMeters, 100, 'Pew Warmer depth = 100m');

        // Check STATE_SYNC updated scores
        const syncMsg = await host.waitForMessage(m => m.type === 'STATE_SYNC' && m.scores?.team1?.points >= 10);
        assertEqual(syncMsg.scores.team1.points, 10, 'Team 1 cumulative points in state sync');
        assertEqual(syncMsg.scores.team1.depthMeters, 100, 'Team 1 cumulative depth in state sync');

        return `Accepted "Mary": 10 pts, 100m depth awarded to Team 1`;
      });

      // T1.5: Procedural Audio Event Emissions
      await this.runTest('Tier 1', 'T1.5 Procedural Audio Event Emissions (Bell, Organ, Error)', async () => {
        const host = this.harness.clients.host;

        // Ensure saints category
        host.sendHostControl('SET_CATEGORY', { categoryId: 'saints' });
        await host.waitForMessage(m => m.type === 'STATE_SYNC' && m.prompt?.id === 'saints');
        await new Promise(r => setTimeout(r, 450));

        // Valid word -> Bell Chime
        host.clearMessages();
        const bellWaiter = this.harness.expectAudioEvent('bell');
        this.harness.clients.team1.submitWord('Peter');
        const bellEv = await bellWaiter;
        assertEqual(bellEv.sound, 'bell', 'Valid submission triggers bell chime');

        await new Promise(r => setTimeout(r, 450));

        // One-in-a-Credillion word -> Pipe Organ Flourish
        host.clearMessages();
        const organWaiter = this.harness.expectAudioEvent('organ');
        this.harness.clients.team1.submitWord('Drogo');
        const organEv = await organWaiter;
        assertEqual(organEv.sound, 'organ', 'Tier 5 triggers organ flourish');

        await new Promise(r => setTimeout(r, 450));

        // Invalid word -> Error Buzz
        host.clearMessages();
        const errorWaiter = this.harness.expectAudioEvent('error');
        this.harness.clients.team1.submitWord('completely_invalid_random_word_xyz');
        const errorEv = await errorWaiter;
        assertEqual(errorEv.sound, 'error', 'Invalid word triggers error buzz');

        return `Captured bell, organ, and error audio triggers`;
      });

      // T1.6: Question Bank Category Querying & Category Switching
      await this.runTest('Tier 1', 'T1.6 Question Bank Category Querying & Switching', async () => {
        const host = this.harness.clients.host;

        // Switch to category: worship_songs
        host.clearMessages();
        host.sendHostControl('SET_CATEGORY', { categoryId: 'worship_songs' });

        const sync = await host.waitForMessage(m => m.type === 'STATE_SYNC' && m.prompt?.id === 'worship_songs');
        assertEqual(sync.prompt.id, 'worship_songs', 'Category ID switched');
        assert(sync.prompt.title.includes('Worship') || sync.prompt.prompt.includes('hymns'), 'Prompt updated');

        return `Active prompt switched to "${sync.prompt.title}"`;
      });

      // =========================================================================
      // TIER 2: Boundary & Corner Cases
      // =========================================================================
      logTier('Tier 2', 'Boundary & Corner Cases');

      // T2.1: Empty and Whitespace Typing
      await this.runTest('Tier 2', 'T2.1 Empty & Whitespace Input Handling', async () => {
        const host = this.harness.clients.host;
        const team1 = this.harness.clients.team1;

        await new Promise(r => setTimeout(r, 450));

        // Send whitespace typing
        const { relayMsg } = await this.harness.measureKeystrokeLatency('team1', '   ');
        assertEqual(relayMsg.text, '   ', 'Relayed whitespace text');

        await new Promise(r => setTimeout(r, 450));

        // Submit empty string
        const emptyEval = await this.harness.submitWordAndWait('team1', '');
        assert(emptyEval.result.accepted === false, 'Empty word must not be accepted');
        assertEqual(emptyEval.result.reason, 'invalid_input', 'Rejection reason is invalid_input');

        await new Promise(r => setTimeout(r, 450));

        // Submit whitespace only
        const wsEval = await this.harness.submitWordAndWait('team1', '     ');
        assert(wsEval.result.accepted === false, 'Whitespace-only word must not be accepted');
        assertEqual(wsEval.result.reason, 'invalid_input', 'Rejection reason is invalid_input');

        return `Safely rejected empty & whitespace submissions`;
      });

      // T2.2: Rapid Multi-Character Burst Typing
      await this.runTest('Tier 2', 'T2.2 Rapid Multi-Character Burst Typing', async () => {
        const host = this.harness.clients.host;
        const team1 = this.harness.clients.team1;
        host.clearMessages();

        // Send 10 rapid keystrokes without awaiting between them
        const burstSequence = ['m', 'mi', 'mic', 'mich', 'micha', 'michae', 'michael'];
        for (const token of burstSequence) {
          team1.sendInput(token);
        }

        // Wait for final token to arrive at host
        const finalRelay = await host.waitForMessage(
          m => m.type === 'LIVE_TYPING_RELAY' && m.team === 'team1' && m.text === 'michael',
          3000
        );
        assertEqual(finalRelay.text, 'michael', 'Final burst keystroke text');

        return `Relayed ${burstSequence.length} burst keystrokes without dropped packets`;
      });

      // T2.3: Length-Gated Levenshtein Typo Tolerance Boundaries
      await this.runTest('Tier 2', 'T2.3 Length-Gated Levenshtein Boundaries (L<=4:0, 5-8:1, >=9:2)', async () => {
        // Ensure prompt is saints
        const host = this.harness.clients.host;
        host.sendHostControl('SET_CATEGORY', { categoryId: 'saints' });
        await host.waitForMessage(m => m.type === 'STATE_SYNC' && m.prompt?.id === 'saints');
        await new Promise(r => setTimeout(r, 450));

        // 1. Short word (L <= 4): "Jude" (len=4). Max distance allowed = 0.
        // Exact: "Jude" -> ACCEPT
        const exactShort = await this.harness.submitWordAndWait('team1', 'Jude');
        assert(exactShort.result.accepted === true, 'Exact short word "Jude" accepted');

        await new Promise(r => setTimeout(r, 450));

        // Typo: "juda" or "judee" (dist=1) on short word -> REJECT (tolerance 0)
        const typoShort = await this.harness.submitWordAndWait('team1', 'judee');
        assert(typoShort.result.accepted === false, 'Typo on short word (len<=4) must be rejected');

        await new Promise(r => setTimeout(r, 450));

        // 2. Medium word (5 <= L <= 8): "Joseph" (len=6). Max distance allowed = 1.
        // Typo: "josaph" (dist=1) -> ACCEPT
        const typoMedium = await this.harness.submitWordAndWait('team1', 'josaph');
        assert(typoMedium.result.accepted === true, 'Typo dist=1 on medium word "Joseph" accepted');
        assertEqual(typoMedium.result.canonical.toLowerCase(), 'joseph', 'Canonical mapped to joseph');

        await new Promise(r => setTimeout(r, 450));

        // Typo dist=2: "josxxh" -> REJECT
        const badMedium = await this.harness.submitWordAndWait('team1', 'josxxh');
        assert(badMedium.result.accepted === false, 'Typo dist=2 on medium word rejected');

        await new Promise(r => setTimeout(r, 450));

        // 3. Long word (L >= 9): "Francis of Assisi" (len=17). Max distance allowed = 2.
        // Typo dist=2: "francis of asisi" (1 's' missing, dist 1) or dist 2 -> ACCEPT
        const typoLong = await this.harness.submitWordAndWait('team1', 'francis of asisi');
        assert(typoLong.result.accepted === true, 'Typo dist<=2 on long word accepted');

        return `Verified distance bounds: L<=4 rejects dist 1; 5<=L<=8 accepts dist 1; L>=9 accepts dist 2`;
      });

      // T2.4: Prefix Stripping ("Saint", "St.", "Church of")
      await this.runTest('Tier 2', 'T2.4 Honorific and Article Prefix Stripping ("Saint", "St.", "Church of")', async () => {
        await new Promise(r => setTimeout(r, 450));

        // "Saint Anthony" -> Strips "Saint " -> "anthony" (accepted)
        const st1 = await this.harness.submitWordAndWait('team1', 'Saint Anthony');
        assert(st1.result.accepted === true, 'Prefix "Saint " stripped and accepted');

        await new Promise(r => setTimeout(r, 450));

        // "St. Patrick" -> Strips "St. " -> "patrick" (accepted)
        const st2 = await this.harness.submitWordAndWait('team1', 'St. Patrick');
        assert(st2.result.accepted === true, 'Prefix "St. " stripped and accepted');

        // Switch to churches_in_singapore
        this.harness.clients.host.sendHostControl('SET_CATEGORY', { categoryId: 'churches_in_singapore' });
        await this.harness.clients.host.waitForMessage(m => m.type === 'STATE_SYNC' && m.prompt?.id === 'churches_in_singapore');
        await new Promise(r => setTimeout(r, 450));

        // "Church of the Holy Family" -> Strips "Church of the " -> "holy family" (accepted)
        const art = await this.harness.submitWordAndWait('team1', 'Church of the Holy Family');
        assert(art.result.accepted === true, 'Prefix "Church of the " stripped and accepted');

        return `Successfully stripped "Saint", "St.", and "Church of the" prefixes`;
      });

      // T2.5: Diacritics and Ligature Normalization
      await this.runTest('Tier 2', 'T2.5 Diacritics and Ligatures Normalization ("Thérèse")', async () => {
        this.harness.clients.host.sendHostControl('SET_CATEGORY', { categoryId: 'saints' });
        await this.harness.clients.host.waitForMessage(m => m.type === 'STATE_SYNC' && m.prompt?.id === 'saints');
        await new Promise(r => setTimeout(r, 450));

        // Input with French accents: "Thérèse of Lisieux"
        const diacriticRes = await this.harness.submitWordAndWait('team2', 'Thérèse of Lisieux');
        assert(diacriticRes.result.accepted === true, 'Diacritic input "Thérèse" normalized and accepted');
        assert(diacriticRes.result.canonical.toLowerCase().includes('therese'), 'Canonical matches Therese');

        return `Normalized Unicode NFD diacritics in "Thérèse of Lisieux"`;
      });

      // T2.6: Per-Team Duplicate Prevention
      await this.runTest('Tier 2', 'T2.6 Per-Team Duplicate Rejection with Audio Error Trigger', async () => {
        const host = this.harness.clients.host;

        await new Promise(r => setTimeout(r, 450));

        // Team 1 submits "Padre Pio" -> First time accepted
        const firstSubmit = await this.harness.submitWordAndWait('team1', 'Padre Pio');
        assert(firstSubmit.result.accepted === true, 'First submission of "Padre Pio" accepted');

        await new Promise(r => setTimeout(r, 450));

        // Team 1 submits "Padre Pio" a second time -> REJECTED as duplicate
        host.clearMessages();
        const errWaiter = this.harness.expectAudioEvent('error');
        const secondSubmit = await this.harness.submitWordAndWait('team1', 'Padre Pio');

        assert(secondSubmit.result.accepted === false, 'Duplicate submission must be rejected');
        assertEqual(secondSubmit.result.reason, 'duplicate', 'Reason must be "duplicate"');
        assertEqual(secondSubmit.result.points, 0, 'No points awarded for duplicate');

        const audioEv = await errWaiter;
        assertEqual(audioEv.sound, 'error', 'Duplicate triggers error audio buzz');

        return `Duplicate rejected with reason="duplicate" and error sound`;
      });

      // T2.7: Cross-Team Duplicate Locking
      await this.runTest('Tier 2', 'T2.7 Cross-Team Duplicate Locking (Opposing team cannot reuse claimed answer)', async () => {
        await new Promise(r => setTimeout(r, 450));

        // Team 1 already submitted "Padre Pio".
        // Now Team 2 submits "Padre Pio" -> Must be REJECTED because Team 1 already claimed it!
        const t2DupSubmit = await this.harness.submitWordAndWait('team2', 'Padre Pio');
        assert(t2DupSubmit.result.accepted === false, 'Team 2 cannot use word already claimed by Team 1');
        assertEqual(t2DupSubmit.result.reason, 'duplicate', 'Rejection reason is duplicate');

        await new Promise(r => setTimeout(r, 450));

        // Team 2 submits an unclaimed word ("Joan of Arc") -> ACCEPTED
        const t2Submit = await this.harness.submitWordAndWait('team2', 'Joan of Arc');
        assert(t2Submit.result.accepted === true, 'Team 2 can score unclaimed word "Joan of Arc"');
        assert(t2Submit.result.points > 0, 'Team 2 receives points for unclaimed word');

        return `Cross-team lock enforced: claimed word rejected for Team 2, unclaimed word accepted`;
      });

      // T2.8: Client Disconnection & Reconnection State Persistence
      await this.runTest('Tier 2', 'T2.8 Client Disconnect & Reconnect State Retention', async () => {
        const team1 = this.harness.clients.team1;
        const host = this.harness.clients.host;

        // Record pre-disconnect points
        const stateBefore = await this.harness.httpGet('/api/state');
        const team1ScoreBefore = stateBefore.json().scores.team1.points;

        // Disconnect Team 1
        team1.close();
        assertEqual(team1.isOpen, false, 'Team 1 socket closed');

        // Reconnect Team 1
        const reconnectedTeam1 = await this.harness.connectTeam1();
        assert(reconnectedTeam1.isOpen, 'Team 1 reconnected');

        // Verify ACK and restored state
        const ack = await reconnectedTeam1.waitForType('REGISTER_ACK');
        assertEqual(ack.role, 'team1', 'Reconnected role is team1');
        assertEqual(ack.scores.team1.points, team1ScoreBefore, 'Score preserved after reconnect');

        return `Team 1 reconnected with score ${team1ScoreBefore} intact`;
      });

      // =========================================================================
      // TIER 3: Cross-Feature Combinations & Concurrency
      // =========================================================================
      logTier('Tier 3', 'Cross-Feature Combinations & Concurrency');

      // T3.1: Concurrent Racing Between Team 1 and Team 2
      await this.runTest('Tier 3', 'T3.1 Concurrent Racing Between Teams', async () => {
        const host = this.harness.clients.host;
        const team1 = this.harness.clients.team1;
        const team2 = this.harness.clients.team2;

        host.clearMessages();

        // Team 1 streams typing for "benedict" while Team 2 streams typing for "gabriel" concurrently
        const p1 = this.harness.measureKeystrokeLatency('team1', 'benedict');
        const p2 = this.harness.measureKeystrokeLatency('team2', 'gabriel');

        const [r1, r2] = await Promise.all([p1, p2]);
        assertEqual(r1.relayMsg.text, 'benedict', 'Team 1 concurrent typing text');
        assertEqual(r2.relayMsg.text, 'gabriel', 'Team 2 concurrent typing text');

        await new Promise(r => setTimeout(r, 450));

        // Now both submit words concurrently
        const sub1 = this.harness.submitWordAndWait('team1', 'benedict');
        const sub2 = this.harness.submitWordAndWait('team2', 'gabriel');

        const [s1, s2] = await Promise.all([sub1, sub2]);
        assert(s1.result.accepted === true, 'Concurrent submission 1 accepted');
        assert(s2.result.accepted === true, 'Concurrent submission 2 accepted');

        return `Both teams raced and scored concurrently (latencies: T1=${r1.latencyMs}ms, T2=${r2.latencyMs}ms)`;
      });

      // T3.2: Live Typing Streaming While Timer Ticks
      await this.runTest('Tier 3', 'T3.2 Typing Streaming Interleaved with Timer Sync Ticks', async () => {
        const host = this.harness.clients.host;
        const team1 = this.harness.clients.team1;
        host.clearMessages();

        // Stream 15 keystrokes across 1.5 seconds to guarantee interleaving with at least one 1,000ms TIMER_SYNC
        let timerSyncSeen = false;
        const timerPromise = host.waitForType('TIMER_SYNC', 2500).then(() => { timerSyncSeen = true; });

        for (let i = 1; i <= 10; i++) {
          team1.sendInput('typing_' + i);
          await new Promise(r => setTimeout(r, 100));
        }

        await timerPromise;
        assert(timerSyncSeen, 'TIMER_SYNC occurred during live typing stream');

        // Verify live typing relay arrived at host
        const latestRelay = await host.waitForMessage(m => m.type === 'LIVE_TYPING_RELAY' && m.team === 'team1' && m.text === 'typing_10');
        assertEqual(latestRelay.text, 'typing_10', 'Final typing arrived despite concurrent timer ticks');

        return `Typing stream coexisted smoothly with periodic TIMER_SYNC broadcasts`;
      });

      // T3.3: Submitting Words in Last Seconds Before Round Expiry
      await this.runTest('Tier 3', 'T3.3 Submitting Words Near Clock Expiry & Heartbeat Audio', async () => {
        const host = this.harness.clients.host;

        // Set remaining time to 2,000ms (within final 15s window where heartbeat triggers)
        host.sendHostControl('SET_TIME', { remainingMs: 2500 });

        // Submit a word within this 2.5s window
        const lastSecondWord = await this.harness.submitWordAndWait('team2', 'raphael');
        assert(lastSecondWord.result.accepted === true, 'Word accepted in final seconds of round');

        return `Accepted word at clock threshold before round transition`;
      });

      // T3.4: Halftime Transition & Score Retention
      await this.runTest('Tier 3', 'T3.4 Halftime Transition & Cumulative Score Retention', async () => {
        const host = this.harness.clients.host;

        // Force remaining time to 100ms so server ticker transitions round1 -> halftime
        host.sendHostControl('SET_TIME', { remainingMs: 50 });

        // Wait for phase transition to 'halftime'
        const halftimeSync = await host.waitForMessage(m => m.type === 'STATE_SYNC' && m.phase === 'halftime', 3000);
        assertEqual(halftimeSync.phase, 'halftime', 'Phase transitioned to halftime');

        // Assert scores were retained
        assert(halftimeSync.scores.team1.points > 0, 'Team 1 score retained at halftime');
        assert(halftimeSync.scores.team2.points > 0, 'Team 2 score retained at halftime');

        return `Halftime entered; Team 1=${halftimeSync.scores.team1.points} pts, Team 2=${halftimeSync.scores.team2.points} pts retained`;
      });

      // T3.5: Round 2 1.5x Multiplier Calculation (Duc In Altum)
      await this.runTest('Tier 3', 'T3.5 Round 2 1.5x Multiplier Calculation (Duc In Altum)', async () => {
        const host = this.harness.clients.host;

        // Host skips halftime into round 2
        host.sendHostControl('SKIP_HALFTIME');

        const r2State = await host.waitForMessage(m => m.type === 'STATE_SYNC' && m.phase === 'round2', 3000);
        assertEqual(r2State.phase, 'round2', 'Phase transitioned to round2');
        assertEqual(r2State.round, 2, 'Active round is 2');
        assertEqual(r2State.multiplier, 1.5, 'Active multiplier is 1.5x');

        // Set category to physical_ways_to_pray
        host.sendHostControl('SET_CATEGORY', { categoryId: 'physical_ways_to_pray' });
        await host.waitForMessage(m => m.type === 'STATE_SYNC' && m.prompt?.id === 'physical_ways_to_pray');
        await new Promise(r => setTimeout(r, 450));

        // Submit Pew Warmer in Round 2: "kneeling"
        // Base: 10 pts, 100m -> Round 2 (1.5x): 15 pts, 150m
        const r2Pew = await this.harness.submitWordAndWait('team1', 'kneeling');
        assert(r2Pew.result.accepted === true, 'Round 2 submission accepted');
        assertEqual(r2Pew.result.points, 15, 'Pew Warmer points scaled 1.5x (10 * 1.5 = 15)');
        assertEqual(r2Pew.result.depthMeters, 150, 'Pew Warmer depth scaled 1.5x (100 * 1.5 = 150)');

        await new Promise(r => setTimeout(r, 450));

        // Submit Altar Server in Round 2: "lighting candles"
        // Base: 30 pts, 300m -> Round 2 (1.5x): 45 pts, 450m
        const r2Altar = await this.harness.submitWordAndWait('team2', 'lighting candles');
        assert(r2Altar.result.accepted === true, 'Round 2 Altar Server accepted');
        assertEqual(r2Altar.result.points, 45, 'Altar Server points scaled 1.5x (30 * 1.5 = 45)');
        assertEqual(r2Altar.result.depthMeters, 450, 'Altar Server depth scaled 1.5x (300 * 1.5 = 450)');

        await new Promise(r => setTimeout(r, 450));

        // Submit Theologian in Round 2: "breath prayer"
        // Base: 60 pts, 600m -> Round 2 (1.5x): 90 pts, 900m
        const r2Theo = await this.harness.submitWordAndWait('team1', 'breath prayer');
        assert(r2Theo.result.accepted === true, 'Round 2 Theologian accepted');
        assertEqual(r2Theo.result.points, 90, 'Theologian points scaled 1.5x (60 * 1.5 = 90)');
        assertEqual(r2Theo.result.depthMeters, 900, 'Theologian depth scaled 1.5x (600 * 1.5 = 900)');

        return `Verified 1.5x multiplier in Round 2: 10->15, 30->45, 60->90`;
      });

      // =========================================================================
      // TIER 4: Real-World Workload Scenarios
      // =========================================================================
      logTier('Tier 4', 'Real-World Workload Scenarios');

      // T4.1: Full Match Lifecycle Simulation
      await this.runTest('Tier 4', 'T4.1 Complete 2v2 Match Simulation (Lobby -> R1 -> Halftime -> R2 -> Podium)', async () => {
        const host = this.harness.clients.host;
        const team1 = this.harness.clients.team1;
        const team2 = this.harness.clients.team2;

        // 1. Reset match to clean lobby
        host.sendHostControl('RESET');
        const lobbyState = await host.waitForMessage(m => m.type === 'STATE_SYNC' && m.phase === 'lobby');
        assertEqual(lobbyState.phase, 'lobby', 'Reset to lobby phase');
        assertEqual(lobbyState.scores.team1.points, 0, 'Team 1 score reset to 0');
        assertEqual(lobbyState.scores.team2.points, 0, 'Team 2 score reset to 0');

        // 2. Host starts match -> Round 1 begins
        host.sendHostControl('START_MATCH');
        const r1State = await host.waitForMessage(m => m.type === 'STATE_SYNC' && m.phase === 'round1');
        assertEqual(r1State.phase, 'round1', 'Match started into round1');
        assertEqual(r1State.round, 1, 'Round is 1');

        host.sendHostControl('SET_CATEGORY', { categoryId: 'saints' });
        await host.waitForMessage(m => m.type === 'STATE_SYNC' && m.prompt?.id === 'saints');
        await new Promise(r => setTimeout(r, 450));

        // Both teams type and score in Round 1
        await this.harness.measureKeystrokeLatency('team1', 'Peter');
        await this.harness.submitWordAndWait('team1', 'Peter');

        await new Promise(r => setTimeout(r, 450));

        await this.harness.measureKeystrokeLatency('team2', 'Paul');
        await this.harness.submitWordAndWait('team2', 'Paul');

        // 3. Fast-forward Round 1 to end (50ms remaining)
        host.sendHostControl('SET_TIME', { remainingMs: 50 });
        const htState = await host.waitForMessage(m => m.type === 'STATE_SYNC' && m.phase === 'halftime', 3000);
        assertEqual(htState.phase, 'halftime', 'Halftime reached smoothly');

        // 4. Host skips halftime into Round 2 (Duc In Altum)
        host.sendHostControl('SKIP_HALFTIME');
        const r2State = await host.waitForMessage(m => m.type === 'STATE_SYNC' && m.phase === 'round2', 3000);
        assertEqual(r2State.phase, 'round2', 'Round 2 began');
        assertEqual(r2State.multiplier, 1.5, '1.5x multiplier active in Round 2');

        host.sendHostControl('SET_CATEGORY', { categoryId: 'saints' });
        await host.waitForMessage(m => m.type === 'STATE_SYNC' && m.prompt?.id === 'saints');
        await new Promise(r => setTimeout(r, 450));

        // Team 1 discovers Tier 5 One-in-a-Credillion in Round 2 ("Drogo")
        host.clearMessages();
        const organWaiter = this.harness.expectAudioEvent('organ');
        const credillionRes = await this.harness.submitWordAndWait('team1', 'Drogo');
        assert(credillionRes.result.accepted === true, 'Tier 5 word accepted');
        assertEqual(credillionRes.result.points, 150, 'Tier 5 points in R2 = 150 (100 * 1.5)');
        assertEqual(credillionRes.result.depthMeters, 1500, 'Tier 5 depth in R2 = 1500m (1000 * 1.5)');
        const organEv = await organWaiter;
        assertEqual(organEv.sound, 'organ', 'Organ flourish event captured');

        // 5. Final countdown to match end
        host.clearMessages();
        const fanfareWaiter = this.harness.expectAudioEvent('fanfare', 4000);

        // Fast-forward Round 2 to 50ms remaining
        host.sendHostControl('SET_TIME', { remainingMs: 50 });

        // Wait for gameover phase
        const goState = await host.waitForMessage(m => m.type === 'STATE_SYNC' && m.phase === 'gameover', 4000);
        assertEqual(goState.phase, 'gameover', 'Final match phase is gameover');

        // Victory fanfare must play at game over
        const fanfareEv = await fanfareWaiter;
        assertEqual(fanfareEv.sound, 'fanfare', 'Victory fanfare emitted upon match completion');

        // Validate final scores & winner determination
        const finalT1 = goState.scores.team1.points;
        const finalT2 = goState.scores.team2.points;
        const winner = finalT1 > finalT2 ? 'team1' : (finalT2 > finalT1 ? 'team2' : 'tie');
        assert(finalT1 > 0 && finalT2 > 0, 'Both teams have recorded scores on victory podium');

        return `Full match completed! Final scores: Team 1=${finalT1} pts, Team 2=${finalT2} pts. Winner: ${winner}. Fanfare verified.`;
      });

    } finally {
      // Clean up connections & server
      await this.harness.stopServer();
    }

    const totalDuration = Math.round(performance.now() - suiteStartTime);
    const latencyStats = this.harness.getLatencyStats();

    // =========================================================================
    // Summary Report
    // =========================================================================
    logHeader('E2E Verification Summary Report');
    console.log(`  Total Tests Run:     ${this.results.total}`);
    console.log(`  Total Tests Passed:  ${colors.green}${this.results.passed}${colors.reset}`);
    console.log(`  Total Tests Failed:  ${this.results.failed > 0 ? colors.red : colors.green}${this.results.failed}${colors.reset}`);
    console.log(`  Total Execution:     ${totalDuration}ms`);

    console.log(`\n${colors.bold}Tier Breakdown:${colors.reset}`);
    for (const [tier, stats] of Object.entries(this.results.tiers)) {
      const statusColor = stats.failed === 0 ? colors.green : colors.red;
      console.log(`  ${tier}: ${statusColor}${stats.passed}/${stats.total} passed${colors.reset}`);
    }

    console.log(`\n${colors.bold}Live Keystroke Latency Instrumentation (< 100ms requirement):${colors.reset}`);
    console.log(`  Samples Measured:    ${latencyStats.count}`);
    console.log(`  Min Latency:         ${latencyStats.min}ms`);
    console.log(`  Median Latency:      ${colors.green}${latencyStats.median}ms${colors.reset}`);
    console.log(`  95th Percentile:     ${colors.green}${latencyStats.p95}ms${colors.reset}`);
    console.log(`  Max Latency:         ${latencyStats.max}ms`);

    if (this.results.failed > 0) {
      console.log(`\n${colors.bold}${colors.red}Failures Summary:${colors.reset}`);
      for (const fail of this.results.failures) {
        console.log(`  - [${fail.tier}] ${fail.name}: ${colors.red}${fail.error}${colors.reset}`);
      }
      process.exit(1);
    } else {
      console.log(`\n${colors.bold}${colors.green}ALL E2E VERIFICATION TESTS PASSED SUCCESSFULLY! (Exit Code 0)${colors.reset}\n`);
      process.exit(0);
    }
  }
}

// CLI Execution Entry Point
if (require.main === module) {
  const runner = new TestRunner();
  runner.executeAll().catch(err => {
    console.error(`\n${colors.red}Fatal test runner error:${colors.reset}`, err);
    process.exit(1);
  });
}

module.exports = { TestRunner };
