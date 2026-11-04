const https = require('https');
const mqtt = require('../node_modules/mqtt');

const BASE_URL = 'https://catholic-krillion.netlify.app';

function fetchUrl(path) {
  return new Promise((resolve, reject) => {
    https.get(`${BASE_URL}${path}`, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('===============================================================');
  console.log('VERIFYING PERMANENT FREE NETLIFY DEPLOYMENT');
  console.log('Site URL:', BASE_URL);
  console.log('===============================================================\n');

  // 1. Verify all pages and assets return 200 OK
  const endpoints = [
    '/',
    '/team1',
    '/team2',
    '/game-engine.js',
    '/questions-bundle.js',
    '/validator.js',
    '/styles.css',
    '/audio.js',
    '/mqtt.min.js',
    '/qrcode.min.js'
  ];

  console.log('1. Checking HTTP status of all endpoints...');
  for (const ep of endpoints) {
    const res = await fetchUrl(ep);
    if (res.status === 200) {
      console.log(`   [PASS] ${ep.padEnd(22)} -> HTTP 200 OK (${res.body.length} bytes)`);
    } else {
      console.error(`   [FAIL] ${ep} -> HTTP ${res.status}`);
      process.exitCode = 1;
      return;
    }
  }

  // 2. Verify Cloud Relay Pub/Sub between Host, Team 1, and Team 2 over WSS
  console.log('\n2. Verifying Real-Time Cloud Relay on WSS MQTT Broker...');
  const roomId = 'live_verify_' + Math.floor(Math.random() * 100000);
  const inboundTopic = `catholic-krillion/room/${roomId}/inbound`;
  const broadcastTopic = `catholic-krillion/room/${roomId}/broadcast`;

  const host = mqtt.connect('wss://broker.emqx.io:8084/mqtt', { clientId: `host_${roomId}` });
  const team1 = mqtt.connect('wss://broker.emqx.io:8084/mqtt', { clientId: `t1_${roomId}` });
  const team2 = mqtt.connect('wss://broker.emqx.io:8084/mqtt', { clientId: `t2_${roomId}` });

  await Promise.all([
    new Promise(r => host.on('connect', r)),
    new Promise(r => team1.on('connect', r)),
    new Promise(r => team2.on('connect', r))
  ]);
  console.log('   [PASS] Host, Team 1, and Team 2 connected to EMQX global broker!');

  // Subscribe
  await new Promise(r => host.subscribe(inboundTopic, { qos: 0 }, r));
  await new Promise(r => team1.subscribe(broadcastTopic, { qos: 0 }, r));
  await new Promise(r => team2.subscribe(broadcastTopic, { qos: 0 }, r));
  console.log('   [PASS] Subscribed to inbound and broadcast topics!');

  let receivedTeam1Score = false;
  let receivedLiveTyping = false;
  let duplicateRejected = false;

  // Simulate Host Game Engine
  const questionsBundleRes = await fetchUrl('/questions-bundle.js');
  eval(questionsBundleRes.body); // loads window.KRILLION_QUESTIONS or global.KRILLION_QUESTIONS
  const validatorCode = await fetchUrl('/validator.js');
  eval(validatorCode.body); // loads global.KrillionValidator
  const engineCode = await fetchUrl('/game-engine.js');
  eval(engineCode.body); // loads global.ClientGameEngine

  const qData = global.KRILLION_QUESTIONS || window.KRILLION_QUESTIONS;
  const engine = new global.ClientGameEngine(qData, (msg) => {
    host.publish(broadcastTopic, JSON.stringify(msg));
  });

  host.on('message', (topic, payload) => {
    const msg = JSON.parse(payload.toString());
    if (msg.type === 'REGISTER') {
      host.publish(broadcastTopic, JSON.stringify({ type: 'REGISTER_ACK', role: msg.role }));
      engine.broadcastStateSync();
    } else if (msg.type === 'LIVE_TYPING') {
      engine.setLiveTyping(msg.team, msg.text);
    } else if (msg.type === 'SUBMIT_WORD') {
      engine.submitWord(msg.team, msg.word);
    }
  });

  team1.on('message', (topic, payload) => {
    const msg = JSON.parse(payload.toString());
    if (msg.type === 'WORD_EVALUATED') {
      if (msg.result.accepted) {
        receivedTeam1Score = true;
        console.log(`   [PASS] Team 1 scored "${msg.result.word}" (${msg.result.tierName}) -> +${msg.result.points} pts`);
      } else if (msg.result.reason === 'duplicate') {
        duplicateRejected = true;
        console.log(`   [PASS] Team 1 duplicate submission properly rejected!`);
      }
    } else if (msg.type === 'LIVE_TYPING_RELAY') {
      if (msg.text === 'father') {
        receivedLiveTyping = true;
      }
    }
  });

  // Start match
  console.log('\n3. Starting match and testing game actions...');
  engine.startMatch();
  await sleep(1000);

  // Team 1 registers & types
  team1.publish(inboundTopic, JSON.stringify({ type: 'REGISTER', role: 'team1' }));
  team1.publish(inboundTopic, JSON.stringify({ type: 'LIVE_TYPING', team: 'team1', text: 'father' }));
  await sleep(1000);

  // Set category to Our Father
  engine.prompt = {
    id: 'words_in_our_father',
    title: "Words in the Our Father / Lord's Prayer",
    prompt: "Name words that appear in the traditional Catholic Lord's Prayer (Our Father)!"
  };

  // Submit valid word
  team1.publish(inboundTopic, JSON.stringify({ type: 'SUBMIT_WORD', team: 'team1', word: 'father' }));
  await sleep(1500);

  // Submit duplicate word
  team1.publish(inboundTopic, JSON.stringify({ type: 'SUBMIT_WORD', team: 'team1', word: 'father' }));
  await sleep(1500);

  host.end();
  team1.end();
  team2.end();

  if (receivedTeam1Score && duplicateRejected && receivedLiveTyping) {
    console.log('\n===============================================================');
    console.log('ALL VERIFICATIONS PASSED 100%!');
    console.log('The Catholic Krillion webapp is permanently live at:');
    console.log('Projector / Host: https://catholic-krillion.netlify.app');
    console.log('Team 1 Mobile:    https://catholic-krillion.netlify.app/team1');
    console.log('Team 2 Mobile:    https://catholic-krillion.netlify.app/team2');
    console.log('===============================================================\n');
  } else {
    console.error('Verification failed: receivedTeam1Score=', receivedTeam1Score, 'duplicateRejected=', duplicateRejected, 'receivedLiveTyping=', receivedLiveTyping);
    process.exitCode = 1;
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
