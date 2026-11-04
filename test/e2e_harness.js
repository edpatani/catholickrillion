/**
 * Catholic Krillion ("Credillion") - E2E Headless Multi-Client Test Harness
 * 
 * Simulates Screen 1 (Host/Projector), Screen 2 (Team 1 Controller), and Screen 3 (Team 2 Controller)
 * over real WebSocket connections and HTTP endpoints.
 * 
 * Measures keystroke latency (<100ms requirement), tracks state synchronization,
 * validates game timer ticks, monitors word evaluations, and captures procedural audio events.
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

// Universal WebSocket implementation (native Node.js 22+ WebSocket or 'ws' package)
let WebSocketImpl;
if (typeof globalThis.WebSocket !== 'undefined') {
  WebSocketImpl = globalThis.WebSocket;
} else {
  try {
    WebSocketImpl = require('ws');
  } catch (err) {
    throw new Error('Neither native WebSocket nor "ws" package could be loaded: ' + err.message);
  }
}

/**
 * Headless WebSocket client representing an individual screen role.
 */
class TestClient {
  constructor(role, wsUrl, options = {}) {
    this.role = role; // 'host' | 'team1' | 'team2'
    this.wsUrl = wsUrl;
    this.options = options;
    this.ws = null;
    this.messages = [];
    this.listeners = [];
    this.seq = 0;
    this.isOpen = false;
  }

  /**
   * Connect to the WebSocket server and register role.
   * @param {number} timeoutMs
   * @returns {Promise<TestClient>}
   */
  async connect(timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.ws) {
          try { this.ws.close(); } catch (_) {}
        }
        reject(new Error(`[${this.role}] WebSocket connection timeout after ${timeoutMs}ms to ${this.wsUrl}`));
      }, timeoutMs);

      try {
        this.ws = new WebSocketImpl(this.wsUrl);
      } catch (err) {
        clearTimeout(timer);
        return reject(err);
      }

      this.ws.onopen = () => {
        clearTimeout(timer);
        this.isOpen = true;

        // Register role with server
        this.send({
          type: 'REGISTER',
          role: this.role
        });

        resolve(this);
      };

      this.ws.onmessage = (event) => {
        let text;
        if (typeof event.data === 'string') {
          text = event.data;
        } else if (Buffer.isBuffer(event.data)) {
          text = event.data.toString('utf8');
        } else if (event.data instanceof ArrayBuffer) {
          text = Buffer.from(event.data).toString('utf8');
        } else {
          text = String(event.data);
        }

        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch (e) {
          parsed = { raw: text, parseError: e.message };
        }

        const msgRecord = {
          receivedAt: Date.now(),
          perfNow: performance.now(),
          data: parsed
        };

        this.messages.push(msgRecord);

        // Notify matching waiters
        for (let i = this.listeners.length - 1; i >= 0; i--) {
          const l = this.listeners[i];
          try {
            if (l.predicate(parsed, msgRecord)) {
              clearTimeout(l.timer);
              this.listeners.splice(i, 1);
              l.resolve(parsed);
            }
          } catch (predErr) {
            clearTimeout(l.timer);
            this.listeners.splice(i, 1);
            l.reject(predErr);
          }
        }
      };

      this.ws.onerror = (event) => {
        const errorMsg = event.message || event.error?.message || 'WebSocket encountered an error';
        if (!this.isOpen) {
          clearTimeout(timer);
          reject(new Error(`[${this.role}] Connection error: ${errorMsg}`));
        }
      };

      this.ws.onclose = () => {
        this.isOpen = false;
        // Cleanly cancel pending listeners
        const pending = this.listeners.splice(0, this.listeners.length);
        for (const l of pending) {
          clearTimeout(l.timer);
          l.reject(new Error(`[${this.role}] Socket closed while waiting for message`));
        }
      };
    });
  }

  /**
   * Send JSON payload.
   * @param {object} payload
   */
  send(payload) {
    if (!this.isOpen || !this.ws) {
      throw new Error(`[${this.role}] Cannot send message: socket is not open`);
    }
    const jsonStr = JSON.stringify(payload);
    this.ws.send(jsonStr);
  }

  /**
   * Send live character typing update.
   * @param {string} text
   * @returns {number} Sequence number used
   */
  sendInput(text) {
    this.seq++;
    this.send({
      type: 'INPUT_UPDATE',
      text: text,
      seq: this.seq,
      timestamp: Date.now()
    });
    return this.seq;
  }

  /**
   * Submit an answer word for scoring.
   * @param {string} word
   */
  submitWord(word) {
    this.send({
      type: 'SUBMIT_WORD',
      word: word,
      timestamp: Date.now()
    });
  }

  /**
   * Send Host Control command.
   * @param {'START_MATCH'|'PAUSE'|'RESET'|'SKIP_HALFTIME'} action
   * @param {object} extra
   */
  sendHostControl(action, extra = {}) {
    this.send({
      type: 'HOST_CONTROL',
      action: action,
      ...extra
    });
  }

  /**
   * Wait for a message meeting a predicate. Searches both past received messages and future arrivals.
   * @param {Function} predicate
   * @param {number} timeoutMs
   * @param {boolean} searchHistory
   * @returns {Promise<object>}
   */
  waitForMessage(predicate, timeoutMs = 5000, searchHistory = true) {
    if (searchHistory) {
      // Find latest or first matching historical message
      for (let i = this.messages.length - 1; i >= 0; i--) {
        const item = this.messages[i];
        if (predicate(item.data, item)) {
          return Promise.resolve(item.data);
        }
      }
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        // Remove listener
        const idx = this.listeners.findIndex(l => l.timer === timer);
        if (idx !== -1) this.listeners.splice(idx, 1);
        reject(new Error(`[${this.role}] Timed out after ${timeoutMs}ms waiting for matching message. Recent messages: ` +
          JSON.stringify(this.messages.slice(-5).map(m => m.data))));
      }, timeoutMs);

      this.listeners.push({ predicate, resolve, reject, timer });
    });
  }

  /**
   * Wait for a message of specific 'type'.
   * @param {string} type
   * @param {number} timeoutMs
   * @param {boolean} searchHistory
   * @returns {Promise<object>}
   */
  waitForType(type, timeoutMs = 5000, searchHistory = true) {
    return this.waitForMessage(msg => msg && msg.type === type, timeoutMs, searchHistory);
  }

  /**
   * Clear recorded messages buffer.
   */
  clearMessages() {
    this.messages = [];
  }

  /**
   * Disconnect client cleanly.
   */
  close() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch (_) {}
      this.ws = null;
      this.isOpen = false;
    }
  }
}

/**
 * KrillionTestHarness orchestrates server and 3 client screens.
 */
class KrillionTestHarness {
  constructor(options = {}) {
    this.port = options.port || 3000;
    this.hostUrl = options.hostUrl || `http://127.0.0.1:${this.port}`;
    this.wsUrl = options.wsUrl || `ws://127.0.0.1:${this.port}/ws`;
    this.serverProcess = null;
    this.serverInstance = null;
    this.clients = {
      host: null,
      team1: null,
      team2: null
    };
    this.latencyRecords = [];
  }

  /**
   * Start a test server (either in-process or spawned child process) or attach to an existing running server.
   * @param {number} port
   * @param {object} options
   * @returns {Promise<void>}
   */
  async startServer(port = this.port, options = {}) {
    this.port = port;
    this.hostUrl = `http://127.0.0.1:${this.port}`;
    this.wsUrl = `ws://127.0.0.1:${this.port}/`;

    // First check if server is already responding
    const alreadyRunning = await this.isServerAlive(this.port);
    if (alreadyRunning) {
      return;
    }

    // Set process.env.PORT for both in-process and spawned server
    process.env.PORT = String(this.port);

    // Attempt in-process start if available and not explicitly forced to spawn
    if (!options.spawn) {
      try {
        const serverModule = require('../server.js');
        if (typeof serverModule.createKrillionServer === 'function') {
          this.serverInstance = serverModule.createKrillionServer({ port: this.port });
          await new Promise((resolve, reject) => {
            this.serverInstance.server.once('error', reject);
            this.serverInstance.server.listen(this.port, '127.0.0.1', () => {
              this.serverInstance.server.removeListener('error', reject);
              resolve();
            });
          });
          return;
        }
      } catch (err) {
        // Fall back to spawning child process
      }
    }

    const timeoutMs = options.timeoutMs || 8000;
    const serverScript = path.resolve(__dirname, '../server.js');

    return new Promise((resolve, reject) => {
      let isResolved = false;
      const timer = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          this.stopServer();
          reject(new Error(`Server failed to start within ${timeoutMs}ms on port ${this.port}`));
        }
      }, timeoutMs);

      const env = Object.assign({}, process.env, { PORT: String(this.port) });
      this.serverProcess = spawn('node', [serverScript], {
        cwd: path.resolve(__dirname, '..'),
        env: env,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdoutBuf = '';
      let stderrBuf = '';

      this.serverProcess.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        stdoutBuf += text;
        if (!isResolved && (stdoutBuf.includes('listening') || stdoutBuf.includes('port') || stdoutBuf.includes('Credillion') || stdoutBuf.includes('Active'))) {
          isResolved = true;
          clearTimeout(timer);
          setTimeout(resolve, 150);
        }
      });

      this.serverProcess.stderr.on('data', (chunk) => {
        stderrBuf += chunk.toString();
      });

      this.serverProcess.on('error', (err) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timer);
          reject(new Error(`Failed to spawn server process: ${err.message}`));
        }
      });

      this.serverProcess.on('exit', (code, signal) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timer);
          reject(new Error(`Server process exited prematurely with code ${code} signal ${signal}. Stderr: ${stderrBuf}`));
        }
      });
    });
  }

  /**
   * Check if HTTP server is alive on port.
   * @param {number} port
   * @returns {Promise<boolean>}
   */
  async isServerAlive(port = this.port) {
    try {
      const res = await this.httpGet('/api/info', 800);
      return res.status === 200;
    } catch (_) {
      return false;
    }
  }

  /**
   * Stop the test server cleanly.
   */
  async stopServer() {
    this.disconnectAll();
    if (this.serverInstance) {
      try {
        this.serverInstance.close();
      } catch (_) {}
      this.serverInstance = null;
    }
    if (this.serverProcess) {
      const proc = this.serverProcess;
      this.serverProcess = null;
      try {
        proc.kill('SIGINT');
      } catch (_) {}
      setTimeout(() => {
        try {
          proc.kill('SIGKILL');
        } catch (_) {}
      }, 500);
    }
  }

  /**
   * Connect Host client (Screen 1).
   * @returns {Promise<TestClient>}
   */
  async connectHost(timeoutMs = 5000) {
    if (this.clients.host) this.clients.host.close();
    this.clients.host = new TestClient('host', this.wsUrl);
    await this.clients.host.connect(timeoutMs);
    return this.clients.host;
  }

  /**
   * Connect Team 1 client (Screen 2).
   * @returns {Promise<TestClient>}
   */
  async connectTeam1(timeoutMs = 5000) {
    if (this.clients.team1) this.clients.team1.close();
    this.clients.team1 = new TestClient('team1', this.wsUrl);
    await this.clients.team1.connect(timeoutMs);
    return this.clients.team1;
  }

  /**
   * Connect Team 2 client (Screen 3).
   * @returns {Promise<TestClient>}
   */
  async connectTeam2(timeoutMs = 5000) {
    if (this.clients.team2) this.clients.team2.close();
    this.clients.team2 = new TestClient('team2', this.wsUrl);
    await this.clients.team2.connect(timeoutMs);
    return this.clients.team2;
  }

  /**
   * Connect Host, Team 1, and Team 2 concurrently.
   * @returns {Promise<{host: TestClient, team1: TestClient, team2: TestClient}>}
   */
  async connectAll(timeoutMs = 5000) {
    const [host, team1, team2] = await Promise.all([
      this.connectHost(timeoutMs),
      this.connectTeam1(timeoutMs),
      this.connectTeam2(timeoutMs)
    ]);
    return { host, team1, team2 };
  }

  /**
   * Disconnect all active client connections.
   */
  disconnectAll() {
    for (const role of ['host', 'team1', 'team2']) {
      if (this.clients[role]) {
        this.clients[role].close();
        this.clients[role] = null;
      }
    }
  }

  /**
   * Perform an HTTP GET request to the test server.
   * @param {string} reqPath
   * @param {number} timeoutMs
   * @returns {Promise<{status: number, headers: object, body: string, json: Function}>}
   */
  httpGet(reqPath, timeoutMs = 4000) {
    return new Promise((resolve, reject) => {
      const url = `${this.hostUrl}${reqPath.startsWith('/') ? reqPath : '/' + reqPath}`;
      const req = http.get(url, { timeout: timeoutMs }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body,
            json: () => JSON.parse(body)
          });
        });
      });

      req.on('timeout', () => {
        req.destroy(new Error(`HTTP GET ${reqPath} timed out after ${timeoutMs}ms`));
      });

      req.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Measure roundtrip keystroke latency:
   * Team sends `INPUT_UPDATE` -> Host receives `LIVE_TYPING_RELAY` -> calculate delta.
   * 
   * @param {'team1'|'team2'} teamRole
   * @param {string} text
   * @param {number} timeoutMs
   * @returns {Promise<{latencyMs: number, relayMsg: object}>}
   */
  async measureKeystrokeLatency(teamRole, text, timeoutMs = 2000) {
    const client = this.clients[teamRole];
    const host = this.clients.host;

    if (!client || !host) {
      throw new Error(`Both ${teamRole} and host must be connected to measure latency`);
    }

    const tStart = performance.now();
    const waitPromise = host.waitForMessage(
      msg => msg && msg.type === 'LIVE_TYPING_RELAY' && msg.team === teamRole && msg.text === text,
      timeoutMs,
      false // Do not match older messages
    );

    client.sendInput(text);
    const relayMsg = await waitPromise;
    const tEnd = performance.now();
    const latencyMs = Math.round((tEnd - tStart) * 100) / 100;

    this.latencyRecords.push({ team: teamRole, text, latencyMs });
    return { latencyMs, relayMsg };
  }

  /**
   * Submit a word from a team and wait for evaluation broadcast.
   * @param {'team1'|'team2'} teamRole
   * @param {string} word
   * @param {number} timeoutMs
   * @returns {Promise<object>}
   */
  async submitWordAndWait(teamRole, word, timeoutMs = 2500) {
    const client = this.clients[teamRole];
    const host = this.clients.host;
    if (!client) throw new Error(`${teamRole} is not connected`);

    // Target wait on Host or Team for WORD_EVALUATED
    const targetWaiter = (host || client).waitForMessage(
      msg => msg && msg.type === 'WORD_EVALUATED' && msg.team === teamRole && 
        (msg.word?.toLowerCase() === word.toLowerCase() || !msg.word),
      timeoutMs,
      false
    );

    client.submitWord(word);
    return await targetWaiter;
  }

  /**
   * Expect a procedural audio event on Host.
   * @param {'bell'|'organ'|'error'|'heartbeat'|'fanfare'} expectedSound
   * @param {number} timeoutMs
   * @returns {Promise<object>}
   */
  async expectAudioEvent(expectedSound, timeoutMs = 2500) {
    const host = this.clients.host;
    if (!host) throw new Error('Host client is not connected');

    return await host.waitForMessage(
      msg => msg && msg.type === 'AUDIO_EVENT' && msg.sound === expectedSound,
      timeoutMs,
      false
    );
  }

  /**
   * Compute latency statistics from recorded measurements.
   * @returns {{min: number, max: number, median: number, p95: number, count: number}}
   */
  getLatencyStats() {
    if (this.latencyRecords.length === 0) {
      return { min: 0, max: 0, median: 0, p95: 0, count: 0 };
    }
    const sorted = [...this.latencyRecords.map(r => r.latencyMs)].sort((a, b) => a - b);
    const count = sorted.length;
    const min = sorted[0];
    const max = sorted[count - 1];
    const median = sorted[Math.floor(count / 2)];
    const p95 = sorted[Math.min(count - 1, Math.floor(count * 0.95))];
    return { min, max, median, p95, count };
  }
}

module.exports = {
  TestClient,
  KrillionTestHarness
};
