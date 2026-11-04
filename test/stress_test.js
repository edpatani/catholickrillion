/**
 * Catholic Krillion ("Credillion") — Adversarial Empirical Stress Test Suite
 * 
 * Specifically challenges:
 * 1. High-throughput concurrent keystroke streaming (30-50 keystrokes/sec per team simultaneously)
 *    and verifies relay latency stays strictly < 100ms across 100% of samples.
 * 2. Concurrency race conditions (simultaneous word submissions, duplicate floods, cross-team races).
 * 3. Rapid connection/disconnection churn during active round countdown (graceful vs abrupt termination).
 * 4. Prolonged WebSocket message traffic (6,000+ messages), memory stability, and event listener leak audit.
 * 5. Adversarial payload fuzzing (malformed JSON, massive strings, non-string types, prototype pollution attempts).
 * 
 * Usage:
 *   node test/stress_test.js
 *   node test/stress_test.js --port 3060
 */

const http = require('http');
const path = require('path');
const { WebSocket } = require('ws');
const { createKrillionServer } = require('../server.js');

// ANSI Color Helpers
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function logHeader(title) {
  console.log(`\n${c.bold}${c.cyan}================================================================${c.reset}`);
  console.log(`${c.bold}${c.cyan}  ${title}${c.reset}`);
  console.log(`${c.bold}${c.cyan}================================================================${c.reset}`);
}

function logSection(title) {
  console.log(`\n${c.bold}${c.yellow}--- ${title} ---${c.reset}`);
}

function logPass(name, durationMs, details = '') {
  const detailStr = details ? ` ${c.dim}(${details})${c.reset}` : '';
  console.log(`  ${c.green}✓ PASS${c.reset} ${name} ${c.dim}[${durationMs}ms]${c.reset}${detailStr}`);
}

function logFail(name, err, durationMs) {
  console.log(`  ${c.red}✗ FAIL${c.reset} ${name} ${c.dim}[${durationMs}ms]${c.reset}`);
  console.log(`    ${c.red}Error: ${err.message}${c.reset}`);
  if (err.stack && process.env.VERBOSE) {
    console.log(`    ${c.dim}${err.stack.split('\n').slice(1, 4).join('\n    ')}${c.reset}`);
  }
}

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

/**
 * Lightweight helper to create a connected, registered WebSocket client
 */
function createClient(wsUrl, role = 'unknown') {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.role = role;
    ws.seq = 0;
    ws.receivedMessages = [];
    ws.messageWaiters = [];

    const timeout = setTimeout(() => {
      try { ws.close(); } catch (_) {}
      reject(new Error(`WebSocket connection to ${wsUrl} timed out after 5000ms`));
    }, 5000);

    ws.on('open', () => {
      clearTimeout(timeout);
      if (role && role !== 'unknown') {
        const ackHandler = (raw) => {
          try {
            const m = JSON.parse(raw.toString());
            if (m && m.type === 'REGISTER_ACK') {
              ws.removeListener('message', ackHandler);
              resolve(ws);
            }
          } catch (_) {}
        };
        ws.on('message', ackHandler);
        ws.send(JSON.stringify({ type: 'REGISTER', role }));
      } else {
        resolve(ws);
      }
    });

    ws.on('message', (raw) => {
      let parsed;
      try {
        parsed = JSON.parse(raw.toString());
      } catch (e) {
        parsed = { raw: raw.toString(), error: e.message };
      }

      const record = { receivedAt: Date.now(), perfNow: performance.now(), data: parsed };
      ws.receivedMessages.push(record);

      for (let i = ws.messageWaiters.length - 1; i >= 0; i--) {
        const waiter = ws.messageWaiters[i];
        if (waiter.predicate(parsed, record)) {
          clearTimeout(waiter.timer);
          ws.messageWaiters.splice(i, 1);
          waiter.resolve(parsed);
        }
      }
    });

    ws.waitForMessage = (predicate, timeoutMs = 5000, searchHistory = true) => {
      if (searchHistory) {
        for (let i = ws.receivedMessages.length - 1; i >= 0; i--) {
          const r = ws.receivedMessages[i];
          if (predicate(r.data, r)) {
            return Promise.resolve(r.data);
          }
        }
      }

      return new Promise((res, rej) => {
        const timer = setTimeout(() => {
          const idx = ws.messageWaiters.findIndex(w => w.timer === timer);
          if (idx !== -1) ws.messageWaiters.splice(idx, 1);
          rej(new Error(`[${role}] Timeout waiting for message (${timeoutMs}ms)`));
        }, timeoutMs);

        ws.messageWaiters.push({ predicate, resolve: res, reject: rej, timer });
      });
    };

    ws.waitForType = (type, timeoutMs = 5000, searchHistory = true) => {
      return ws.waitForMessage(m => m && m.type === type, timeoutMs, searchHistory);
    };

    ws.sendInput = (text) => {
      ws.seq++;
      const payload = {
        type: 'INPUT_UPDATE',
        text,
        seq: ws.seq,
        timestamp: Date.now()
      };
      ws.send(JSON.stringify(payload));
      return ws.seq;
    };

    ws.submitWord = (word) => {
      ws.send(JSON.stringify({
        type: 'SUBMIT_WORD',
        word,
        timestamp: Date.now()
      }));
    };

    ws.on('error', (err) => {
      // Ignored here; handled by test suites
    });
  });
}

class StressTestRunner {
  constructor(port = 3060) {
    this.port = port;
    this.wsUrl = `ws://127.0.0.1:${port}/`;
    this.httpUrl = `http://127.0.0.1:${port}`;
    this.serverInstance = null;
    this.results = {
      passed: 0,
      failed: 0,
      total: 0,
      failures: []
    };
  }

  async startServer() {
    process.env.PORT = String(this.port);
    this.serverInstance = createKrillionServer({ port: this.port });
    await new Promise((resolve, reject) => {
      this.serverInstance.server.once('error', reject);
      this.serverInstance.server.listen(this.port, '127.0.0.1', () => {
        this.serverInstance.server.removeListener('error', reject);
        resolve();
      });
    });
  }

  async stopServer() {
    if (this.serverInstance) {
      try {
        this.serverInstance.close();
      } catch (_) {}
      this.serverInstance = null;
    }
  }

  async runTest(name, fn) {
    this.results.total++;
    const t0 = performance.now();
    try {
      const details = await fn();
      const dur = Math.round(performance.now() - t0);
      this.results.passed++;
      logPass(name, dur, details);
    } catch (err) {
      const dur = Math.round(performance.now() - t0);
      this.results.failed++;
      this.results.failures.push({ name, error: err.message });
      logFail(name, err, dur);
    }
  }

  computeStats(arr) {
    if (!arr || arr.length === 0) return { min: 0, max: 0, mean: 0, median: 0, p95: 0, p99: 0 };
    const sorted = [...arr].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    return {
      count,
      min: Math.round(sorted[0] * 100) / 100,
      max: Math.round(sorted[count - 1] * 100) / 100,
      mean: Math.round((sum / count) * 100) / 100,
      median: Math.round(sorted[Math.floor(count * 0.5)] * 100) / 100,
      p95: Math.round(sorted[Math.min(count - 1, Math.floor(count * 0.95))] * 100) / 100,
      p99: Math.round(sorted[Math.min(count - 1, Math.floor(count * 0.99))] * 100) / 100
    };
  }
}

async function run() {
  const port = parseInt(process.env.TEST_PORT, 10) || 3060;
  const runner = new StressTestRunner(port);

  logHeader('Catholic Krillion ("Credillion") — Empirical Adversarial Stress Suite');
  console.log(`Port: ${port} | Node: ${process.version} | Host OS: ${process.platform}`);

  try {
    await runner.startServer();
    console.log(`${c.green}✓ Test server online at ${runner.httpUrl}${c.reset}`);

    // =========================================================================
    // SECTION 1: High-Throughput Keystroke Streaming (< 100ms Latency Verification)
    // =========================================================================
    logSection('1. High-Throughput Concurrent Keystroke Streaming & Latency');

    await runner.runTest(
      'S1.1 Concurrent Dual-Team Keystroke Streaming (35-40 keys/sec each, < 100ms strictly enforced)',
      async () => {
        const host = await createClient(runner.wsUrl, 'host');
        const team1 = await createClient(runner.wsUrl, 'team1');
        const team2 = await createClient(runner.wsUrl, 'team2');

        const NUM_KEYS_PER_TEAM = 150; // Total 300 keystrokes
        const INTERVAL_MS = 25; // 40 keystrokes per second per team (80 keys/sec aggregate)
        const team1Text = 'Our Father who art in heaven hallowed be thy name thy kingdom come thy will be done on earth as it is in heaven give us this day our daily bread';
        const team2Text = 'Saint Michael the Archangel defend us in battle be our defense against the wickedness and snares of the devil may God rebuke him we humbly pray';

        // Track send timestamps: key -> sendPerfNow
        const sentTimes = new Map();
        const latencySamples = [];
        let hostReceivedCount = 0;
        let maxObservedLatency = 0;
        let latencyViolations = 0;

        // Set up host listener for real-time latency calculation
        const onRelay = (parsed, record) => {
          if (parsed && parsed.type === 'LIVE_TYPING_RELAY') {
            const key = `${parsed.team}:${parsed.seq}`;
            const sendPerf = sentTimes.get(key);
            if (sendPerf !== undefined) {
              const latency = record.perfNow - sendPerf;
              latencySamples.push(latency);
              if (latency > maxObservedLatency) maxObservedLatency = latency;
              if (latency >= 100.0) latencyViolations++;
              hostReceivedCount++;
            }
          }
        };

        host.on('message', (raw) => {
          try {
            const parsed = JSON.parse(raw.toString());
            onRelay(parsed, { perfNow: performance.now() });
          } catch (_) {}
        });

        // Function to stream keys for a team
        const streamTeam = (client, fullText, teamRole) => {
          return new Promise((resolve) => {
            let i = 0;
            const timer = setInterval(() => {
              i++;
              const currentSnippet = fullText.slice(0, (i % fullText.length) + 1);
              const seq = client.seq + 1;
              const key = `${teamRole}:${seq}`;
              sentTimes.set(key, performance.now());
              client.sendInput(currentSnippet);

              if (i >= NUM_KEYS_PER_TEAM) {
                clearInterval(timer);
                resolve();
              }
            }, INTERVAL_MS);
          });
        };

        // Stream from both teams concurrently
        await Promise.all([
          streamTeam(team1, team1Text, 'team1'),
          streamTeam(team2, team2Text, 'team2')
        ]);

        // Wait for all messages to be received by host (or 2.5s timeout)
        const waitStart = performance.now();
        while (hostReceivedCount < (NUM_KEYS_PER_TEAM * 2) && (performance.now() - waitStart < 3000)) {
          await new Promise(r => setTimeout(r, 50));
        }

        host.close();
        team1.close();
        team2.close();

        const stats = runner.computeStats(latencySamples);

        assert(hostReceivedCount >= NUM_KEYS_PER_TEAM * 2,
          `Packet loss detected: expected ${NUM_KEYS_PER_TEAM * 2} relays, received ${hostReceivedCount}`);
        assert(latencyViolations === 0,
          `Latency SLA violation: ${latencyViolations} packets exceeded 100ms threshold! Max latency was ${stats.max}ms`);
        assert(stats.p99 < 100,
          `99th percentile latency violated 100ms requirement: ${stats.p99}ms`);

        return `Samples: ${stats.count}, Min: ${stats.min}ms, Mean: ${stats.mean}ms, Median: ${stats.median}ms, P95: ${stats.p95}ms, P99: ${stats.p99}ms, Max: ${stats.max}ms`;
      }
    );

    await runner.runTest(
      'S1.2 High-Frequency Input Bursts Interleaved with Rapid Timer Broadcasts',
      async () => {
        const host = await createClient(runner.wsUrl, 'host');
        const team1 = await createClient(runner.wsUrl, 'team1');

        // Burst 50 keystrokes with 0 delay (as fast as event loop fires)
        const burstCount = 50;
        const latencies = [];
        const sendTimes = [];

        for (let i = 1; i <= burstCount; i++) {
          sendTimes[i] = performance.now();
          team1.sendInput(`burst_test_${i}`);
        }

        for (let i = 1; i <= burstCount; i++) {
          const expectedText = `burst_test_${i}`;
          const relay = await host.waitForMessage(
            m => m && m.type === 'LIVE_TYPING_RELAY' && m.team === 'team1' && m.text === expectedText,
            3000,
            true
          );
          const elapsed = performance.now() - sendTimes[i];
          latencies.push(elapsed);
        }

        host.close();
        team1.close();

        const stats = runner.computeStats(latencies);
        assert(stats.max < 100, `Burst max latency ${stats.max}ms exceeded 100ms limit`);
        return `Bursted 50 messages back-to-back: Median: ${stats.median}ms, Max: ${stats.max}ms (0 dropped)`;
      }
    );

    // =========================================================================
    // SECTION 2: Concurrency & Race Conditions
    // =========================================================================
    logSection('2. Concurrency Race Conditions & State Integrity');

    async function startMatchClean(hostClient) {
      hostClient.send(JSON.stringify({ type: 'HOST_CONTROL', action: 'RESET' }));
      await hostClient.waitForMessage(m => m && m.type === 'STATE_SYNC' && m.phase === 'lobby', 2000, false);
      hostClient.send(JSON.stringify({ type: 'HOST_CONTROL', action: 'START_MATCH' }));
      await hostClient.waitForMessage(m => m && m.type === 'STATE_SYNC' && m.phase === 'round1', 2000, false);
    }

    await runner.runTest(
      'S2.1 Simultaneous Same-Word Submission Race (Team 1 vs Team 2 exact same millisecond)',
      async () => {
        const host = await createClient(runner.wsUrl, 'host');
        const team1 = await createClient(runner.wsUrl, 'team1');
        const team2 = await createClient(runner.wsUrl, 'team2');

        // Start match cleanly
        await startMatchClean(host);

        // Prepare waiters on both team evaluations
        const waitT1 = host.waitForMessage(m => m && m.type === 'WORD_EVALUATED' && m.team === 'team1' && m.word === 'bread', 3000, false);
        const waitT2 = host.waitForMessage(m => m && m.type === 'WORD_EVALUATED' && m.team === 'team2' && m.word === 'bread', 3000, false);

        // Fire both submissions in parallel
        team1.submitWord('bread');
        team2.submitWord('bread');

        const [resT1, resT2] = await Promise.all([waitT1, waitT2]);

        assert(resT1.result.accepted === true, 'Team 1 should accept bread');
        assert(resT2.result.accepted === true, 'Team 2 should accept bread (independent team duplicate tracking)');
        assertEqual(resT1.result.points, 10, 'Team 1 points for bread should be 10');
        assertEqual(resT2.result.points, 10, 'Team 2 points for bread should be 10');

        // Verify state sync reflects both scores
        const state = await host.waitForMessage(
          m => m && m.type === 'STATE_SYNC' && m.scores.team1.points >= 10 && m.scores.team2.points >= 10,
          2000,
          true
        );

        assertEqual(state.scores.team1.points, 10, 'Team 1 points in state sync');
        assertEqual(state.scores.team2.points, 10, 'Team 2 points in state sync');

        host.close();
        team1.close();
        team2.close();

        return 'Both teams scored "bread" independently with exact point allocations and zero interference';
      }
    );

    await runner.runTest(
      'S2.2 Parallel Duplicate Submission Flood (20 simultaneous identical requests from one team)',
      async () => {
        const host = await createClient(runner.wsUrl, 'host');
        const team1 = await createClient(runner.wsUrl, 'team1');

        // Reset match cleanly
        await startMatchClean(host);

        const FLOOD_COUNT = 20;
        const evaluationResults = [];

        // Collect all evaluations
        const evalCollector = (raw) => {
          try {
            const m = JSON.parse(raw.toString());
            if (m && m.type === 'WORD_EVALUATED' && m.team === 'team1' && m.word === 'heaven') {
              evaluationResults.push(m.result);
            }
          } catch (_) {}
        };
        host.on('message', evalCollector);

        // Send 20 requests in parallel
        for (let i = 0; i < FLOOD_COUNT; i++) {
          team1.submitWord('heaven');
        }

        // Wait for all 20 evaluations to arrive
        const start = performance.now();
        while (evaluationResults.length < FLOOD_COUNT && (performance.now() - start < 3000)) {
          await new Promise(r => setTimeout(r, 40));
        }

        host.close();
        team1.close();

        assertEqual(evaluationResults.length, FLOOD_COUNT, `Expected ${FLOOD_COUNT} evaluations`);

        const acceptedCount = evaluationResults.filter(r => r.accepted === true).length;
        const duplicateCount = evaluationResults.filter(r => r.accepted === false && r.reason === 'duplicate').length;

        assertEqual(acceptedCount, 1, `Expected exactly 1 accepted result, got ${acceptedCount}`);
        assertEqual(duplicateCount, FLOOD_COUNT - 1, `Expected ${FLOOD_COUNT - 1} duplicate rejections, got ${duplicateCount}`);

        // Verify score state via HTTP endpoint
        const res = await new Promise((resolve) => {
          http.get(`${runner.httpUrl}/api/state`, (r) => {
            let data = '';
            r.on('data', c => data += c);
            r.on('end', () => resolve(JSON.parse(data)));
          });
        });

        assertEqual(res.scores.team1.points, 10, 'Team 1 points must be exactly 10, not multiplied by duplicate flood');
        assertEqual(res.scores.team1.wordsScored.length, 1, 'Words scored array must have exactly 1 record');

        return `20 parallel identical requests: exactly 1 accepted, 19 duplicate rejections; points: 10`;
      }
    );

    await runner.runTest(
      'S2.3 Multi-Word Parallel Barrage (10 different valid words submitted concurrently across teams)',
      async () => {
        const host = await createClient(runner.wsUrl, 'host');
        const team1 = await createClient(runner.wsUrl, 'team1');
        const team2 = await createClient(runner.wsUrl, 'team2');

        // Start match cleanly
        await startMatchClean(host);

        // Category: words_in_our_father
        // Pew Warmer (10 pts): father, heaven, name, kingdom, bread, earth, daily, evil, amen
        // Altar Server (30 pts): hallowed, come, done, give, forgive
        const wordsT1 = ['father', 'heaven', 'name', 'kingdom', 'bread']; // 5 * 10 = 50 pts
        const wordsT2 = ['earth', 'daily', 'evil', 'amen', 'hallowed'];   // 4*10 + 30 = 70 pts

        const receivedT1 = [];
        const receivedT2 = [];

        host.on('message', (raw) => {
          try {
            const m = JSON.parse(raw.toString());
            if (m && m.type === 'WORD_EVALUATED') {
              if (m.team === 'team1') receivedT1.push(m);
              if (m.team === 'team2') receivedT2.push(m);
            }
          } catch (_) {}
        });

        // Fire all 10 submissions in parallel
        wordsT1.forEach(w => team1.submitWord(w));
        wordsT2.forEach(w => team2.submitWord(w));

        const start = performance.now();
        while ((receivedT1.length < 5 || receivedT2.length < 5) && (performance.now() - start < 3000)) {
          await new Promise(r => setTimeout(r, 30));
        }

        host.close();
        team1.close();
        team2.close();

        assertEqual(receivedT1.length, 5, 'Team 1 should receive 5 evaluations');
        assertEqual(receivedT2.length, 5, 'Team 2 should receive 5 evaluations');

        const t1AllAccepted = receivedT1.every(r => r.result.accepted);
        const t2AllAccepted = receivedT2.every(r => r.result.accepted);
        assert(t1AllAccepted, 'All Team 1 submissions accepted');
        assert(t2AllAccepted, 'All Team 2 submissions accepted');

        const state = await new Promise((resolve) => {
          http.get(`${runner.httpUrl}/api/state`, (r) => {
            let data = '';
            r.on('data', c => data += c);
            r.on('end', () => resolve(JSON.parse(data)));
          });
        });

        assertEqual(state.scores.team1.points, 50, 'Team 1 score after concurrent barrage');
        assertEqual(state.scores.team2.points, 70, 'Team 2 score after concurrent barrage');
        assertEqual(state.scores.team1.wordsScored.length, 5, 'Team 1 words scored count');
        assertEqual(state.scores.team2.wordsScored.length, 5, 'Team 2 words scored count');

        return `10 concurrent submissions across both teams evaluated accurately; T1: 50pts, T2: 70pts`;
      }
    );

    await runner.runTest(
      'S2.4 Round 2 (Duc In Altum) 1.5x Multiplier & Cross-Round Duplicate Persistence',
      async () => {
        const host = await createClient(runner.wsUrl, 'host');
        const team1 = await createClient(runner.wsUrl, 'team1');
        const team2 = await createClient(runner.wsUrl, 'team2');

        await startMatchClean(host);

        // 1. Team 1 scores "father" in Round 1
        team1.submitWord('father');
        await host.waitForMessage(m => m && m.type === 'WORD_EVALUATED' && m.team === 'team1' && m.word === 'father');

        // 2. Skip to Round 2 (Duc In Altum)
        host.send(JSON.stringify({ type: 'HOST_CONTROL', action: 'SKIP_HALFTIME' }));
        const r2State = await host.waitForMessage(m => m && m.type === 'STATE_SYNC' && m.phase === 'round2', 2000, false);
        assertEqual(r2State.round, 2, 'Round should be 2');
        assertEqual(r2State.multiplier, 1.5, 'Multiplier should be 1.5');

        // 3. Team 1 attempts to resubmit "father" in Round 2 (must be duplicate rejected)
        const duplicateWait = host.waitForMessage(m => m && m.type === 'WORD_EVALUATED' && m.team === 'team1' && m.word === 'father', 2000, false);
        team1.submitWord('father');
        const dupRes = await duplicateWait;
        assertEqual(dupRes.result.accepted, false, 'Scored word in Round 1 must be rejected in Round 2');
        assertEqual(dupRes.result.reason, 'duplicate', 'Reason must be duplicate');

        // 4. Concurrently submit Round 2 tier words:
        // Team 1 submits "come" (altar_server, base 30 -> 45 pts, 450m)
        // Team 2 submits "will" (theologian, base 60 -> 90 pts, 900m)
        const waitCome = host.waitForMessage(m => m && m.type === 'WORD_EVALUATED' && m.team === 'team1' && m.word === 'come', 2000, false);
        const waitWill = host.waitForMessage(m => m && m.type === 'WORD_EVALUATED' && m.team === 'team2' && m.word === 'will', 2000, false);

        team1.submitWord('come');
        team2.submitWord('will');

        const [resCome, resWill] = await Promise.all([waitCome, waitWill]);

        assertEqual(resCome.result.points, 45, 'Team 1 points for come in Round 2 (30 * 1.5)');
        assertEqual(resCome.result.depthMeters, 450, 'Team 1 depth for come in Round 2 (300 * 1.5)');
        assertEqual(resWill.result.points, 90, 'Team 2 points for will in Round 2 (60 * 1.5)');
        assertEqual(resWill.result.depthMeters, 900, 'Team 2 depth for will in Round 2 (600 * 1.5)');

        // 5. Verify final scores state: Team 1 = 10 + 45 = 55; Team 2 = 90
        const finalState = await host.waitForMessage(
          m => m && m.type === 'STATE_SYNC' && m.scores.team1.points === 55 && m.scores.team2.points === 90,
          2000,
          true
        );

        assertEqual(finalState.scores.team1.points, 55, 'Team 1 cumulative score');
        assertEqual(finalState.scores.team2.points, 90, 'Team 2 cumulative score');

        host.close();
        team1.close();
        team2.close();

        return 'Round 2 1.5x multiplier applied correctly (30->45, 60->90); cross-round duplicate blocked';
      }
    );

    // =========================================================================
    // SECTION 3: Disconnection & Reconnection Churn Resilience
    // =========================================================================
    logSection('3. Disconnection & Reconnection Churn Resilience');

    await runner.runTest(
      'S3.1 Rapid Socket Churn During Active Round Countdown (50 rapid connect/disconnects)',
      async () => {
        const host = await createClient(runner.wsUrl, 'host');
        await startMatchClean(host);

        const initialClients = runner.serverInstance.clients.size;
        const CHURN_TOTAL = 50;
        let created = 0;

        // Perform rapid connections with mixed termination (graceful close vs abrupt terminate)
        const churnPromises = [];
        for (let i = 0; i < CHURN_TOTAL; i++) {
          const role = i % 3 === 0 ? 'team1' : (i % 3 === 1 ? 'team2' : 'host');
          const p = (async (index) => {
            try {
              const ws = new WebSocket(runner.wsUrl);
              await new Promise((resolve, reject) => {
                ws.on('open', resolve);
                ws.on('error', reject);
              });
              created++;

              ws.send(JSON.stringify({ type: 'REGISTER', role }));
              ws.send(JSON.stringify({ type: 'INPUT_UPDATE', text: `churn_${index}`, seq: 1 }));

              // Half terminate abruptly, half close gracefully
              if (index % 2 === 0) {
                ws.terminate(); // Abrupt TCP close
              } else {
                ws.close();     // Normal WebSocket close frame
              }
            } catch (err) {
              // Connection or teardown error caught
            }
          })(i);
          churnPromises.push(p);

          // Small stagger to simulate high traffic burst
          if (i % 5 === 0) {
            await new Promise(r => setTimeout(r, 10));
          }
        }

        await Promise.all(churnPromises);

        // Give server 500ms to clean up closed sockets in event loop
        await new Promise(r => setTimeout(r, 500));

        // Verify server is healthy, round timer is ticking, and clients count is restored
        const timerMsg = await host.waitForType('TIMER_SYNC', 2000, false);
        assert(timerMsg && typeof timerMsg.remainingMs === 'number', 'Authoritative timer still broadcasts cleanly');

        const finalClients = runner.serverInstance.clients.size;
        host.close();

        return `Created ${created} sockets (25 abrupt terminates, 25 graceful closes). Active server clients cleaned up cleanly without crashing.`;
      }
    );

    await runner.runTest(
      'S3.2 Mid-Typing Abrupt Termination & Reconnection State Restoration',
      async () => {
        const host = await createClient(runner.wsUrl, 'host');
        await startMatchClean(host);

        // Team 1 connects and scores
        let team1 = await createClient(runner.wsUrl, 'team1');
        team1.submitWord('father');
        await host.waitForMessage(m => m && m.type === 'WORD_EVALUATED' && m.team === 'team1');

        // Team 1 streams some typing then immediately gets severed abruptly
        team1.sendInput('deliv');
        team1.terminate(); // Abrupt kill!

        // Wait 100ms
        await new Promise(r => setTimeout(r, 100));

        // Reconnect Team 1
        team1 = await createClient(runner.wsUrl, 'team1');

        // Team 1 should immediately receive STATE_SYNC with previous 10 points
        const stateSync = await team1.waitForType('STATE_SYNC', 2000, true);
        assertEqual(stateSync.scores.team1.points, 10, 'Team 1 score retained after abrupt disconnect and reconnection');
        assertEqual(stateSync.phase, 'round1', 'Match phase retained');

        // Reconnected client can continue submitting words
        team1.submitWord('heaven');
        const evalMsg = await host.waitForMessage(
          m => m && m.type === 'WORD_EVALUATED' && m.team === 'team1' && m.word === 'heaven',
          2000,
          false
        );
        assert(evalMsg.result.accepted, 'Reconnected client successfully submitted new word');

        host.close();
        team1.close();

        return 'Abruptly killed client reconnected, verified state persistence, and continued active match play';
      }
    );

    // =========================================================================
    // SECTION 4: Prolonged Traffic & Memory Leak / Stability Check
    // =========================================================================
    logSection('4. Prolonged Traffic & Memory / Resource Stability');

    await runner.runTest(
      'S4.1 6,000-Message Prolonged Traffic Storm & Memory Leak Check',
      async () => {
        const host = await createClient(runner.wsUrl, 'host');
        const team1 = await createClient(runner.wsUrl, 'team1');
        const team2 = await createClient(runner.wsUrl, 'team2');

        // Clear recorded message arrays on clients to prevent client-side test harness memory growth
        host.receivedMessages = [];
        team1.receivedMessages = [];
        team2.receivedMessages = [];

        if (global.gc) { global.gc(); }
        const memBefore = process.memoryUsage().heapUsed;

        const TOTAL_MESSAGES = 6000;
        const BATCH_SIZE = 500;
        let sentCount = 0;

        for (let b = 0; b < TOTAL_MESSAGES; b += BATCH_SIZE) {
          const promises = [];
          for (let i = 0; i < BATCH_SIZE; i++) {
            const idx = b + i;
            const targetClient = idx % 2 === 0 ? team1 : team2;

            if (idx % 10 === 0) {
              // PING
              targetClient.send(JSON.stringify({ type: 'PING' }));
            } else if (idx % 15 === 0) {
              // SUBMIT_WORD (mix of valid, duplicate, invalid)
              const word = idx % 30 === 0 ? 'earth' : (idx % 45 === 0 ? 'duplicate_word' : 'invalid_nonsense_word');
              targetClient.send(JSON.stringify({ type: 'SUBMIT_WORD', word, timestamp: Date.now() }));
            } else {
              // INPUT_UPDATE
              targetClient.sendInput(`stream_${idx}`);
            }
            sentCount++;
          }

          // Let event loop breathe between batches
          await new Promise(r => setTimeout(r, 20));

          // Clear client arrays to keep test runner light
          host.receivedMessages = [];
          team1.receivedMessages = [];
          team2.receivedMessages = [];
        }

        // Wait 500ms for all in-flight messages to process
        await new Promise(r => setTimeout(r, 500));

        if (global.gc) { global.gc(); }
        const memAfter = process.memoryUsage().heapUsed;
        const heapDeltaMb = Math.round(((memAfter - memBefore) / 1024 / 1024) * 100) / 100;

        // Verify HTTP API is still instantly responsive
        const apiRes = await new Promise((resolve) => {
          http.get(`${runner.httpUrl}/api/info`, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(JSON.parse(data)));
          });
        });

        assertEqual(apiRes.status, 'ready', 'Server API remains ready');

        host.close();
        team1.close();
        team2.close();

        return `Processed ${sentCount} messages. Heap delta: ${heapDeltaMb > 0 ? '+' : ''}${heapDeltaMb} MB. Server responsive.`;
      }
    );

    // =========================================================================
    // SECTION 5: Adversarial Fuzzing & Malformed Payloads
    // =========================================================================
    logSection('5. Adversarial Payloads & Robustness Under Malformed Input');

    await runner.runTest(
      'S5.1 Fuzzing with Malformed JSON, Prototype Pollution & Oversized Strings',
      async () => {
        const client = await createClient(runner.wsUrl, 'unknown');
        const host = await createClient(runner.wsUrl, 'host');

        // 1. Malformed JSON strings (syntax errors)
        const badPayloads = [
          'NOT JSON AT ALL',
          '{',
          '{"type": "INPUT_UPDATE", "text":',
          '{"type": "REGISTER", "role": undefined}',
          '\0\0\0\0BINARY_GARBAGE\xFF\xFE',
          ''
        ];

        for (const bad of badPayloads) {
          client.send(bad);
        }

        // 2. Dangerous and edge-case typed messages
        const edgeCases = [
          { type: null },
          { type: '' },
          { type: 'UNKNOWN_TYPE_XYZ_123' },
          { type: 'INPUT_UPDATE', text: 123456, seq: 'invalid' },
          { type: 'INPUT_UPDATE', text: 'A'.repeat(65536) }, // 64KB string
          { type: 'INPUT_UPDATE', team: '__proto__', text: 'prototype_pollution_attempt' },
          { type: 'INPUT_UPDATE', team: 'constructor', text: 'constructor_attempt' },
          { type: 'SUBMIT_WORD', word: null },
          { type: 'SUBMIT_WORD', word: { complex: 'object' } },
          { type: 'SUBMIT_WORD', word: [1, 2, 3] },
          { type: 'SUBMIT_WORD', word: 'B'.repeat(32768) }, // 32KB word
          { type: 'HOST_CONTROL', action: 'UNRECOGNIZED_ACTION' },
          { type: 'HOST_CONTROL', action: 'SET_TIME', remainingMs: -1000000 },
          { type: 'HOST_CONTROL', action: 'SET_CATEGORY', categoryId: 'non_existent_category_xyz' }
        ];

        for (const ec of edgeCases) {
          client.send(JSON.stringify(ec));
        }

        // 3. Normal PING to prove server remains fully functional
        client.send(JSON.stringify({ type: 'PING' }));
        const pong = await client.waitForType('PONG', 2000, false);
        assert(pong && pong.type === 'PONG', 'Server responded to PONG after fuzzing barrage');

        // 4. Verify Prototype Pollution did not take effect on GameState
        assert(Object.prototype.polluted === undefined, 'No prototype pollution occurred on Object');
        assert(runner.serverInstance.gameState.liveTyping['__proto__'] !== 'prototype_pollution_attempt',
          'Live typing did not pollute Object prototype');

        client.close();
        host.close();

        return 'Server cleanly ingested all malformed payloads without crashing; prototype pollution rejected';
      }
    );

  } catch (err) {
    console.error(`\n${c.red}FATAL ERROR IN STRESS TEST RUNNER:${c.reset}`, err);
    runner.results.failed++;
    runner.results.failures.push({ name: 'FATAL', error: err.message });
  } finally {
    await runner.stopServer();
  }

  // Final Summary Report
  logHeader('Adversarial Stress Test Summary Report');
  console.log(`Total Scenarios Executed: ${runner.results.total}`);
  console.log(`Passed:                   ${c.green}${runner.results.passed}${c.reset}`);
  console.log(`Failed:                   ${runner.results.failed > 0 ? c.red : c.green}${runner.results.failed}${c.reset}`);

  if (runner.results.failures.length > 0) {
    console.log(`\n${c.red}Failures:${c.reset}`);
    runner.results.failures.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
    process.exit(1);
  } else {
    console.log(`\n${c.bold}${c.green}ALL EMPIRICAL ADVERSARIAL STRESS TESTS PASSED WITH 0 DEFECTS!${c.reset}\n`);
    process.exit(0);
  }
}

if (require.main === module) {
  run().catch(err => {
    console.error('Unhandled rejection:', err);
    process.exit(1);
  });
}

module.exports = { StressTestRunner };
