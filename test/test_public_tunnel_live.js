/**
 * Comprehensive Public Tunnel Live E2E Test
 * Tests Host + Team 1 + Team 2 communicating entirely through:
 * wss://side-rna-printed-bought.trycloudflare.com
 */

const WebSocket = require('../node_modules/ws');
const https = require('https');

const BASE_URL = 'https://side-rna-printed-bought.trycloudflare.com';
const WS_URL = 'wss://side-rna-printed-bought.trycloudflare.com';

console.log('===============================================================');
console.log('Testing Credillion Public Cloudflare Tunnel Real-Time Match');
console.log('Target:', WS_URL);
console.log('===============================================================\n');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runTest() {
  // Step 1: Verify HTTP endpoints over public internet
  console.log('1. Checking Public HTTP Endpoints...');
  await new Promise((resolve, reject) => {
    https.get(`${BASE_URL}/api/info`, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const info = JSON.parse(data);
        console.log(`   ✓ /api/info responded (status: ${info.status}, phase: ${info.phase})`);
        console.log(`   ✓ Team 1 Public URL: ${info.team1Url}`);
        console.log(`   ✓ Team 2 Public URL: ${info.team2Url}`);
        resolve();
      });
    }).on('error', reject);
  });

  // Step 2: Connect Host and Teams over Public WSS
  console.log('\n2. Establishing 3-Screen WebSocket Connections over Public Internet...');
  const hostWs = new WebSocket(WS_URL);
  const team1Ws = new WebSocket(WS_URL);
  const team2Ws = new WebSocket(WS_URL);

  await Promise.all([
    new Promise(res => hostWs.on('open', res)),
    new Promise(res => team1Ws.on('open', res)),
    new Promise(res => team2Ws.on('open', res))
  ]);
  console.log('   ✓ Host Screen connected to public WSS');
  console.log('   ✓ Team 1 Controller connected to public WSS');
  console.log('   ✓ Team 2 Controller connected to public WSS');

  // Step 3: Register roles & Start Match
  console.log('\n3. Performing Registration Handshake...');
  hostWs.send(JSON.stringify({ type: 'REGISTER', role: 'host' }));
  team1Ws.send(JSON.stringify({ type: 'REGISTER', role: 'team1', team: 'team1' }));
  team2Ws.send(JSON.stringify({ type: 'REGISTER', role: 'team2', team: 'team2' }));
  await sleep(300);

  // Setup single master listener on team1Ws and hostWs
  let receivedT1Typing = false;
  let receivedT2Typing = false;
  let t1Scored = false;
  let t2Scored = false;
  let rareTriggered = false;
  let dupRejected = false;

  hostWs.on('message', data => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'LIVE_TYPING_RELAY') {
        if (msg.team === 'team1' && msg.text === 'heaven') {
          receivedT1Typing = true;
          console.log(`   ✓ Host received live typing for Team 1: "${msg.text}"`);
        }
        if (msg.team === 'team2' && msg.text === 'kingdom') {
          receivedT2Typing = true;
          console.log(`   ✓ Host received live typing for Team 2: "${msg.text}"`);
        }
      }
      if (msg.type === 'WORD_EVALUATED') {
        const res = msg.result || {};
        if (msg.team === 'team1' && res.accepted) {
          t1Scored = true;
          console.log(`   ✓ Team 1 word "${res.canonical || msg.word}" accepted: +${res.points} pts, +${res.depthMeters}m depth [${res.tierName || res.tier}]`);
        }
        if (msg.team === 'team2' && res.accepted) {
          t2Scored = true;
          console.log(`   ✓ Team 2 word "${res.canonical || msg.word}" accepted: +${res.points} pts, +${res.depthMeters}m depth [${res.tierName || res.tier}]`);
        }
        if (res.tier === 'one_in_a_credillion') {
          rareTriggered = true;
          console.log(`   ✨ ONE IN A CREDILLION! Word: "${res.canonical || msg.word}", Depth: +${res.depthMeters}m`);
        }
      }
    } catch (e) {}
  });

  team1Ws.on('message', data => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'WORD_EVALUATED') {
        const res = msg.result || {};
        if (!res.accepted && res.reason === 'duplicate') {
          dupRejected = true;
          console.log(`   ✓ Duplicate correctly rejected for team1: "${msg.word}" (reason: duplicate)`);
        }
      }
    } catch (e) {}
  });

  console.log('   ✓ Resetting & Starting Match (transitioning to Round 1)...');
  hostWs.send(JSON.stringify({ type: 'HOST_CONTROL', action: 'RESET' }));
  await sleep(200);
  hostWs.send(JSON.stringify({ type: 'HOST_CONTROL', action: 'START_MATCH' }));
  await sleep(400);

  // Step 4: Stream Keystrokes
  console.log('\n4. Testing Live Character-by-Character Keystroke Streaming...');
  for (let i = 1; i <= 'heaven'.length; i++) {
    team1Ws.send(JSON.stringify({
      type: 'INPUT_UPDATE',
      team: 'team1',
      text: 'heaven'.slice(0, i),
      seq: i,
      timestamp: Date.now()
    }));
    await sleep(25);
  }

  for (let i = 1; i <= 'kingdom'.length; i++) {
    team2Ws.send(JSON.stringify({
      type: 'INPUT_UPDATE',
      team: 'team2',
      text: 'kingdom'.slice(0, i),
      seq: i,
      timestamp: Date.now()
    }));
    await sleep(25);
  }
  await sleep(400);

  // Step 5: Submit words (use words that haven't been submitted yet in this session)
  console.log('\n5. Testing Word Submissions & Depth Scoring...');
  team1Ws.send(JSON.stringify({ type: 'SUBMIT_WORD', team: 'team1', word: 'father' }));
  await sleep(300);
  team2Ws.send(JSON.stringify({ type: 'SUBMIT_WORD', team: 'team2', word: 'bread' }));
  await sleep(400);

  // Step 6: Submit Rare Gem
  console.log('\n6. Testing Rare Gem "One-in-a-Credillion"...');
  team1Ws.send(JSON.stringify({ type: 'SUBMIT_WORD', team: 'team1', word: 'supersubstantial' }));
  await sleep(400);

  // Step 7: Submit Duplicate
  console.log('\n7. Testing Duplicate Rejection...');
  team1Ws.send(JSON.stringify({ type: 'SUBMIT_WORD', team: 'team1', word: 'father' }));
  await sleep(400);

  // Clean close
  hostWs.close();
  team1Ws.close();
  team2Ws.close();

  console.log('\n===============================================================');
  console.log('E2E Public Internet Verification Summary:');
  console.log(`  Live Keystroke Sync:   ${receivedT1Typing && receivedT2Typing ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log(`  Word Submission:       ${t1Scored && t2Scored ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log(`  One-in-a-Credillion:   ${rareTriggered ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log(`  Duplicate Rejection:   ${dupRejected ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log('===============================================================');

  if (receivedT1Typing && receivedT2Typing && t1Scored && t2Scored && rareTriggered && dupRejected) {
    console.log('🎉 ALL PUBLIC CLOUDFLARE TUNNEL TESTS PASSED 100%!');
    process.exit(0);
  } else {
    console.error('Some tests failed.');
    process.exit(1);
  }
}

runTest().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
