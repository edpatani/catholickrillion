/**
 * Catholic Krillion ("Credillion") — Screen 1 Frontend & Web Audio Synthesizer Verification Suite
 *
 * Validates:
 * 1. File integrity of public/index.html, public/audio.js, and public/styles.css
 * 2. Pure Web Audio synthesizer (EcclesiasticalAudioSynthesizer) exports, methods, and math
 * 3. Mock Web Audio synthesis execution for all 5 procedural sounds (Bell, Organ, Error, Heartbeat, Fanfare)
 * 4. Ecclesiastical visual theme styles, Vatican palette (#0F172A, #C59B27, #881337), animations, and badges
 * 5. Screen 1 HTML structure, circular SVG timer, dual Vatican Vault meters, live typing displays, and test drawer
 * 6. Live HTTP server static routing & content-type compliance
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function logHeader(msg) {
  console.log(`\n${colors.bold}${colors.cyan}=== ${msg} ===${colors.reset}`);
}

function logPass(name, details = '') {
  console.log(`  ${colors.green}✓ PASS${colors.reset} ${name} ${colors.dim}${details}${colors.reset}`);
}

function logFail(name, err) {
  console.log(`  ${colors.red}✗ FAIL${colors.reset} ${name}`);
  console.log(`    ${colors.red}Error: ${err.message}${colors.reset}`);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// Mock Web Audio API for Node.js environment testing
function createMockAudioContext() {
  const nodes = [];

  class MockAudioNode {
    constructor(type) {
      this.nodeType = type;
      this.type = type;
      this.connectedTo = [];
      nodes.push(this);
    }
    connect(target) {
      this.connectedTo.push(target);
      return target;
    }
    disconnect() {}
  }

  class MockAudioParam {
    constructor(defaultVal = 0) {
      this.value = defaultVal;
      this.events = [];
    }
    setValueAtTime(val, t) {
      this.events.push({ action: 'setValueAtTime', val, t });
      this.value = val;
    }
    linearRampToValueAtTime(val, t) {
      this.events.push({ action: 'linearRampToValueAtTime', val, t });
      this.value = val;
    }
    exponentialRampToValueAtTime(val, t) {
      this.events.push({ action: 'exponentialRampToValueAtTime', val, t });
      this.value = val;
    }
  }

  class MockGainNode extends MockAudioNode {
    constructor() {
      super('gain');
      this.gain = new MockAudioParam(1);
    }
  }

  class MockOscillatorNode extends MockAudioNode {
    constructor() {
      super('oscillator');
      this.type = 'sine';
      this.frequency = new MockAudioParam(440);
      this.detune = new MockAudioParam(0);
      this.started = false;
      this.stopped = false;
    }
    start(t) { this.started = true; this.startTime = t; }
    stop(t) { this.stopped = true; this.stopTime = t; }
  }

  class MockBiquadFilterNode extends MockAudioNode {
    constructor() {
      super('biquadFilter');
      this.type = 'lowpass';
      this.frequency = new MockAudioParam(350);
      this.Q = new MockAudioParam(1);
    }
  }

  return {
    currentTime: 0.1,
    state: 'running',
    destination: new MockAudioNode('destination'),
    createGain() { return new MockGainNode(); },
    createOscillator() { return new MockOscillatorNode(); },
    createBiquadFilter() { return new MockBiquadFilterNode(); },
    resume: async () => {},
    suspend: async () => {},
    nodes
  };
}

async function runAllTests() {
  logHeader('Worker M3: Screen 1 Frontend & Web Audio Verification Suite');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      const details = await fn();
      passed++;
      logPass(name, details ? `(${details})` : '');
    } catch (err) {
      failed++;
      logFail(name, err);
    }
  }

  const publicDir = path.join(__dirname, '..', 'public');
  const indexHtmlPath = path.join(publicDir, 'index.html');
  const audioJsPath = path.join(publicDir, 'audio.js');
  const stylesCssPath = path.join(publicDir, 'styles.css');

  // =========================================================================
  // Section 1: File Existence & Basic Sanity
  // =========================================================================
  console.log(`\n${colors.yellow}--- Section 1: Frontend Files & Path Integrity ---${colors.reset}`);

  await test('File Existence: index.html, audio.js, styles.css', () => {
    assert(fs.existsSync(indexHtmlPath), 'index.html must exist');
    assert(fs.existsSync(audioJsPath), 'audio.js must exist');
    assert(fs.existsSync(stylesCssPath), 'styles.css must exist');

    const htmlSize = fs.statSync(indexHtmlPath).size;
    const audioSize = fs.statSync(audioJsPath).size;
    const cssSize = fs.statSync(stylesCssPath).size;

    assert(htmlSize > 500, `index.html too small (${htmlSize} bytes)`);
    assert(audioSize > 500, `audio.js too small (${audioSize} bytes)`);
    assert(cssSize > 500, `styles.css too small (${cssSize} bytes)`);

    return `HTML: ${htmlSize}B, Audio: ${audioSize}B, CSS: ${cssSize}B`;
  });

  // =========================================================================
  // Section 2: Web Audio Synthesizer (audio.js)
  // =========================================================================
  console.log(`\n${colors.yellow}--- Section 2: Pure Procedural Web Audio Synthesizer (audio.js) ---${colors.reset}`);

  const { EcclesiasticalAudioSynthesizer } = require(audioJsPath);

  await test('Synthesizer Class & Methods Export Verification', () => {
    assert(typeof EcclesiasticalAudioSynthesizer === 'function', 'Class EcclesiasticalAudioSynthesizer must be exported');

    const synth = new EcclesiasticalAudioSynthesizer({ autoUnlock: false });
    assert(typeof synth.unlockAudio === 'function', 'unlockAudio must be a function');
    assert(typeof synth.isUnlocked === 'function', 'isUnlocked must be a function');
    assert(typeof synth.playBellChime === 'function', 'playBellChime must be a function');
    assert(typeof synth.playOrganFlourish === 'function', 'playOrganFlourish must be a function');
    assert(typeof synth.playErrorBuzz === 'function', 'playErrorBuzz must be a function');
    assert(typeof synth.playHeartbeat === 'function', 'playHeartbeat must be a function');
    assert(typeof synth.playVictoryFanfare === 'function', 'playVictoryFanfare must be a function');
    assert(typeof synth.handleAudioEvent === 'function', 'handleAudioEvent must be a function');
    assert(typeof synth.toggleMute === 'function', 'toggleMute must be a function');

    return 'All 9 required audio API methods verified';
  });

  await test('Procedural Sound 1: Bell Chimes (Harmonic Additive Synthesis)', () => {
    const synth = new EcclesiasticalAudioSynthesizer({ autoUnlock: false });
    const mockCtx = createMockAudioContext();
    synth.ctx = mockCtx;
    synth.masterGain = mockCtx.createGain();

    // Test Pew Warmer (Silver handbell)
    mockCtx.nodes.length = 0;
    synth.playBellChime('pew_warmer');
    const oscs = mockCtx.nodes.filter(n => n.nodeType === 'oscillator');
    assert(oscs.length >= 4, 'Pew Warmer chime must synthesize at least 4 harmonic partials');
    assert(oscs.every(o => o.started && o.stopped), 'All partial oscillators must be scheduled');

    // Test Altar Server (Dual tone)
    mockCtx.nodes.length = 0;
    synth.playBellChime('altar_server');
    const altarOscs = mockCtx.nodes.filter(n => n.nodeType === 'oscillator');
    assert(altarOscs.length >= 2, 'Altar Server must synthesize dual tones');

    // Test Theologian (Cathedral Bronze)
    mockCtx.nodes.length = 0;
    synth.playBellChime('theologian');
    const theoOscs = mockCtx.nodes.filter(n => n.nodeType === 'oscillator');
    assert(theoOscs.length >= 4, 'Theologian chime must synthesize multi-harmonic partials');

    // Test Doctor of Church (Westminster double bell)
    mockCtx.nodes.length = 0;
    synth.playBellChime('doctor_of_the_church');
    const docOscs = mockCtx.nodes.filter(n => n.nodeType === 'oscillator');
    assert(docOscs.length >= 4, 'Doctor of Church must synthesize sequenced strikes');

    return 'Verified Pew Warmer, Altar Server, Theologian, and Doctor of the Church bells';
  });

  await test('Procedural Sound 2: Pipe Organ Flourish (One-in-a-Credillion)', () => {
    const synth = new EcclesiasticalAudioSynthesizer({ autoUnlock: false });
    const mockCtx = createMockAudioContext();
    synth.ctx = mockCtx;
    synth.masterGain = mockCtx.createGain();

    mockCtx.nodes.length = 0;
    synth.playOrganFlourish();

    const oscs = mockCtx.nodes.filter(n => n.nodeType === 'oscillator');
    const filters = mockCtx.nodes.filter(n => n.nodeType === 'biquadFilter');

    // D Major Cathedral Chord has 6 voices * 4 drawbars = 24 oscillators
    assert(oscs.length >= 16, `Organ flourish must synthesize rich multi-drawbar chord (found ${oscs.length} oscillators)`);
    assert(filters.length >= 1, 'Organ flourish must pass through acoustic lowpass filter swell');
    assert(oscs.every(o => o.started), 'All organ pipe oscillators must be started');

    return `Synthesized ${oscs.length} organ pipe oscillators across multi-octave chord`;
  });

  await test('Procedural Sound 3: Error Buzz (Dissonant Sawtooth Minor Second)', () => {
    const synth = new EcclesiasticalAudioSynthesizer({ autoUnlock: false });
    const mockCtx = createMockAudioContext();
    synth.ctx = mockCtx;
    synth.masterGain = mockCtx.createGain();

    mockCtx.nodes.length = 0;
    synth.playErrorBuzz();

    const oscs = mockCtx.nodes.filter(n => n.nodeType === 'oscillator');
    const filters = mockCtx.nodes.filter(n => n.nodeType === 'biquadFilter');

    assert(oscs.length === 2, 'Error buzz must use dual oscillators for minor-second beat dissonance');
    assert(oscs.every(o => o.type === 'sawtooth'), 'Error buzz oscillators must be sawtooth waves');
    assert(filters.length >= 1, 'Error buzz must filter harsh highs via lowpass filter');

    // Check detuned frequencies (around C3 130.81Hz and C#3 138.59Hz)
    const f1 = oscs[0].frequency.value;
    const f2 = oscs[1].frequency.value;
    assert(Math.abs(f1 - 130.81) < 1, `f1 should be ~130.81Hz (got ${f1})`);
    assert(Math.abs(f2 - 138.59) < 1, `f2 should be ~138.59Hz (got ${f2})`);

    return `Dissonant minor second pair: ${f1}Hz vs ${f2}Hz with lowpass filter`;
  });

  await test('Procedural Sound 4: Ticking Heartbeat Countdown', () => {
    const synth = new EcclesiasticalAudioSynthesizer({ autoUnlock: false });
    const mockCtx = createMockAudioContext();
    synth.ctx = mockCtx;
    synth.masterGain = mockCtx.createGain();

    mockCtx.nodes.length = 0;
    synth.playHeartbeat(10);

    const oscs = mockCtx.nodes.filter(n => n.nodeType === 'oscillator');
    // Dual impact: Lub (pulse + click) and Dub (pulse + click) = 4 oscillators
    assert(oscs.length >= 4, `Heartbeat must synthesize dual-impact lub-dub transients (found ${oscs.length})`);
    assert(oscs.every(o => o.started), 'All heartbeat oscillators must start');

    return `Lub-dub acoustic heartbeat verified with ${oscs.length} transient oscillators`;
  });

  await test('Procedural Sound 5: Victory Fanfare (Brass Trumpet Fanfare)', () => {
    const synth = new EcclesiasticalAudioSynthesizer({ autoUnlock: false });
    const mockCtx = createMockAudioContext();
    synth.ctx = mockCtx;
    synth.masterGain = mockCtx.createGain();

    mockCtx.nodes.length = 0;
    synth.playVictoryFanfare();

    const oscs = mockCtx.nodes.filter(n => n.nodeType === 'oscillator');
    const filters = mockCtx.nodes.filter(n => n.nodeType === 'biquadFilter');

    // Brass notes + chord + pedal
    assert(oscs.length >= 8, `Fanfare must synthesize trumpet sequence and chord (found ${oscs.length})`);
    assert(filters.length >= 4, 'Trumpet notes must be shaped with resonant lowpass filters');

    return `Brass fanfare arpeggio and sustained chord verified with ${oscs.length} oscillators`;
  });

  await test('Server AUDIO_EVENT Message Dispatching', () => {
    const synth = new EcclesiasticalAudioSynthesizer({ autoUnlock: false });
    const mockCtx = createMockAudioContext();
    synth.ctx = mockCtx;
    synth.masterGain = mockCtx.createGain();

    const sounds = ['bell', 'organ', 'error', 'heartbeat', 'fanfare'];
    for (const sound of sounds) {
      mockCtx.nodes.length = 0;
      synth.handleAudioEvent({ type: 'AUDIO_EVENT', sound });
      assert(mockCtx.nodes.length > 0, `AUDIO_EVENT sound="${sound}" must generate audio nodes`);
    }

    return 'All 5 server audio event types successfully handled and dispatched';
  });

  // =========================================================================
  // Section 3: Ecclesiastical Stylesheet (styles.css)
  // =========================================================================
  console.log(`\n${colors.yellow}--- Section 3: Ecclesiastical Visual Styling (styles.css) ---${colors.reset}`);

  const cssContent = fs.readFileSync(stylesCssPath, 'utf8');

  await test('Vatican Color Palette & Ecclesiastical Theme Variables', () => {
    assert(cssContent.includes('#0F172A'), 'CSS must define Vatican Navy (#0F172A)');
    assert(cssContent.includes('#C59B27'), 'CSS must define Liturgical Gold (#C59B27)');
    assert(cssContent.includes('#881337'), 'CSS must define Cardinal Crimson (#881337)');
    assert(cssContent.includes('Cinzel'), 'CSS must specify Cinzel font');
    assert(cssContent.includes('Inter'), 'CSS must specify Inter font');

    return 'Deep Vatican Navy, Liturgical Gold, Cardinal Crimson & Serifs verified';
  });

  await test('UI Component Styles & Keyframe Animations', () => {
    const requiredSelectors = [
      '.host-header',
      '.phase-badge',
      '.multiplier-badge',
      '.prompt-banner',
      '.arena-grid',
      '.vault-meter-card',
      '.meter-fill',
      '.timer-container',
      '.circular-timer-svg',
      '.timer-progress-circle',
      '.timer-display',
      '.live-typing-container',
      '.typing-card',
      '.typing-box',
      '.typing-cursor',
      '.tier-badge',
      '.badge-pew_warmer',
      '.badge-altar_server',
      '.badge-theologian',
      '.badge-doctor_of_the_church',
      '.badge-one_in_a_credillion',
      '.halftime-container',
      '.victory-container',
      '.podium-stage',
      '.podium-1st',
      '.podium-2nd',
      '.test-drawer',
      '.virtual-controller'
    ];

    for (const sel of requiredSelectors) {
      assert(cssContent.includes(sel), `styles.css must define selector ${sel}`);
    }

    // Check keyframe animations
    assert(cssContent.includes('@keyframes blink'), 'Cursor blink animation must exist');
    assert(cssContent.includes('@keyframes flash-green'), 'Flash success animation must exist');
    assert(cssContent.includes('@keyframes shake'), 'Shake error animation must exist');
    assert(cssContent.includes('@keyframes pulse-ring'), 'Timer pulse animation must exist');

    return `Verified ${requiredSelectors.length} essential UI selectors and keyframe animations`;
  });

  // =========================================================================
  // Section 4: Screen 1 HTML Structure (index.html)
  // =========================================================================
  console.log(`\n${colors.yellow}--- Section 4: Screen 1 Host / Projector HTML Structure (index.html) ---${colors.reset}`);

  const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

  await test('HTML Head & Asset Linkage', () => {
    assert(htmlContent.includes('<!DOCTYPE html>'), 'HTML5 DOCTYPE present');
    assert(htmlContent.includes('<link rel="stylesheet" href="/styles.css">') || htmlContent.includes('styles.css'), 'styles.css linked');
    assert(htmlContent.includes('<script src="/audio.js"></script>') || htmlContent.includes('audio.js'), 'audio.js linked');
    assert(htmlContent.includes('Cinzel'), 'Cinzel Google font linked');
    return 'HTML5 Doctype, CSS, audio.js and fonts linked';
  });

  await test('Required Screen 1 Element IDs', () => {
    const requiredIds = [
      // Header
      'phase-badge', 'multiplier-badge', 'audio-toggle-btn', 'btn-fullscreen', 'btn-toggle-test-mode',
      // Lobby View
      'view-lobby', 'qr-team1-img', 'qr-team2-img', 'qr-team1-url', 'qr-team2-url', 'status-team1', 'status-team2', 'btn-start-match',
      // Game View
      'view-game', 'category-title', 'category-prompt', 'category-description',
      // Vatican Vault Meters
      'meter-team1', 'points-team1', 'depth-team1', 'gauge-fill-team1',
      'meter-team2', 'points-team2', 'depth-team2', 'gauge-fill-team2',
      // Circular SVG Timer
      'timer-container', 'timer-svg-progress', 'timer-display', 'timer-round-label',
      // Side-by-Side Live Typing Displays (<100ms)
      'live-typing-team1', 'box-typing-team1', 'typing-text-team1', 'cursor-team1',
      'live-typing-team2', 'box-typing-team2', 'typing-text-team2', 'cursor-team2',
      // Scored Words
      'words-list-team1', 'words-list-team2',
      // Halftime View
      'view-halftime', 'halftime-timer-display', 'halftime-score-team1', 'halftime-score-team2', 'btn-skip-halftime',
      // Victory View
      'view-victory', 'podium-winner', 'podium-runnerup', 'btn-victory-new-match',
      // Standalone Test Drawer
      'test-drawer', 'test-drawer-handle', 'test-input-team1', 'test-submit-team1',
      'test-input-team2', 'test-submit-team2', 'btn-ctrl-start', 'btn-ctrl-pause', 'btn-ctrl-resume', 'btn-ctrl-reset', 'btn-toggle-bots'
    ];

    for (const id of requiredIds) {
      assert(htmlContent.includes(`id="${id}"`), `index.html must contain element with id="${id}"`);
    }

    return `All ${requiredIds.length} required element IDs verified in index.html`;
  });

  await test('WebSocket Event Handlers in Client Script', () => {
    const expectedEvents = [
      'REGISTER_ACK',
      'STATE_SYNC',
      'TIMER_SYNC',
      'LIVE_TYPING_RELAY',
      'WORD_EVALUATED',
      'AUDIO_EVENT'
    ];

    for (const evt of expectedEvents) {
      assert(htmlContent.includes(evt), `Client script must handle WebSocket event ${evt}`);
    }

    assert(htmlContent.includes('requestAnimationFrame'), 'Client script must use requestAnimationFrame for 60fps timer');
    return 'All 6 WebSocket message types handled in client script';
  });

  // =========================================================================
  // Section 5: HTTP Server Integration Test
  // =========================================================================
  console.log(`\n${colors.yellow}--- Section 5: HTTP Server Serving & Content-Type Test ---${colors.reset}`);

  await test('Static Asset HTTP Serving via server.js', async () => {
    const { createKrillionServer } = require('../server.js');
    const testPort = 3088;
    const srvInstance = createKrillionServer({ port: testPort });

    await new Promise((resolve) => srvInstance.server.listen(testPort, resolve));

    function fetchEndpoint(urlPath) {
      return new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${testPort}${urlPath}`, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
        }).on('error', reject);
      });
    }

    try {
      // 1. Host Screen 1 (GET / and GET /index.html)
      const rootRes = await fetchEndpoint('/');
      assertEqual(rootRes.status, 200, 'GET / status');
      assert(rootRes.headers['content-type'].includes('text/html'), 'GET / Content-Type');
      assert(rootRes.body.includes('Credillion'), 'GET / contains Credillion');

      // 2. Audio Synthesizer (GET /audio.js)
      const audioRes = await fetchEndpoint('/audio.js');
      assertEqual(audioRes.status, 200, 'GET /audio.js status');
      assert(audioRes.headers['content-type'].includes('application/javascript'), 'GET /audio.js Content-Type');
      assert(audioRes.body.includes('EcclesiasticalAudioSynthesizer'), 'GET /audio.js contains EcclesiasticalAudioSynthesizer');

      // 3. Stylesheet (GET /styles.css)
      const cssRes = await fetchEndpoint('/styles.css');
      assertEqual(cssRes.status, 200, 'GET /styles.css status');
      assert(cssRes.headers['content-type'].includes('text/css'), 'GET /styles.css Content-Type');
      assert(cssRes.body.includes('#0F172A'), 'GET /styles.css contains Vatican Navy');

      return `Served /, /audio.js, /styles.css with correct MIME types and status 200`;
    } finally {
      srvInstance.close();
    }
  });

  // =========================================================================
  // Summary
  // =========================================================================
  logHeader('Frontend Screen 1 & Web Audio Test Summary');
  console.log(`Total tests run:    ${passed + failed}`);
  console.log(`Passed:             ${colors.green}${passed}${colors.reset}`);
  console.log(`Failed:             ${failed > 0 ? colors.red : colors.dim}${failed}${colors.reset}`);

  if (failed > 0) {
    console.error(`\n${colors.red}VERIFICATION FAILED: ${failed} test(s) failed.${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`\n${colors.bold}${colors.green}ALL FRONTEND SCREEN 1 VERIFICATION TESTS PASSED SUCCESSFULLY!${colors.reset}`);
    process.exit(0);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
