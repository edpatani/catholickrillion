/**
 * Full 2-Round Match Lifecycle Test over Public Cloudflare Tunnel
 */

const WebSocket = require('../node_modules/ws');

const WS_URL = 'wss://side-rna-printed-bought.trycloudflare.com';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('Testing Full 2-Round Match Lifecycle over Public Internet (WSS)...');

  const hostWs = new WebSocket(WS_URL);
  const t1Ws = new WebSocket(WS_URL);
  const t2Ws = new WebSocket(WS_URL);

  await Promise.all([
    new Promise(res => hostWs.on('open', res)),
    new Promise(res => t1Ws.on('open', res)),
    new Promise(res => t2Ws.on('open', res))
  ]);

  hostWs.send(JSON.stringify({ type: 'REGISTER', role: 'host' }));
  t1Ws.send(JSON.stringify({ type: 'REGISTER', role: 'team1' }));
  t2Ws.send(JSON.stringify({ type: 'REGISTER', role: 'team2' }));
  await sleep(200);

  // 1. Reset and Start Round 1
  console.log('1. Starting Round 1...');
  hostWs.send(JSON.stringify({ type: 'HOST_CONTROL', action: 'RESET' }));
  await sleep(200);
  hostWs.send(JSON.stringify({ type: 'HOST_CONTROL', action: 'START_MATCH' }));
  await sleep(300);

  // Submit in Round 1 (1.0x multiplier)
  t1Ws.send(JSON.stringify({ type: 'SUBMIT_WORD', team: 'team1', word: 'heaven' }));
  await sleep(200);
  t2Ws.send(JSON.stringify({ type: 'SUBMIT_WORD', team: 'team2', word: 'earth' }));
  await sleep(200);

  // 2. Transition to Halftime
  console.log('2. Fast-forwarding Round 1 to Halftime...');
  hostWs.send(JSON.stringify({ type: 'HOST_CONTROL', action: 'SET_TIME', remainingMs: 1000 }));
  await sleep(1500); // Ticker triggers halftime

  // 3. Skip Halftime into Round 2 (Duc in Altum, 1.5x)
  console.log('3. Transitioning into Round 2 (1.5x multiplier)...');
  hostWs.send(JSON.stringify({ type: 'HOST_CONTROL', action: 'SKIP_HALFTIME' }));
  await sleep(300);

  let round2Accepted = false;
  hostWs.on('message', data => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'WORD_EVALUATED') {
        const res = msg.result || {};
        if (msg.team === 'team1' && res.accepted) {
          // Verify 1.5x multiplier in Round 2: base 10 -> 15 pts, 100m -> 150m
          console.log(`   ✓ Round 2 Scored: "${res.canonical}", Points: ${res.points} (1.5x scaled from base 10), Depth: ${res.depthMeters}m`);
          if (res.points === 15 && res.depthMeters === 150) {
            round2Accepted = true;
          }
        }
      }
      if (msg.type === 'AUDIO_EVENT' && msg.sound === 'fanfare') {
        console.log('   🎉 Podium Victory Fanfare Audio Triggered!');
      }
    } catch (e) {}
  });

  t1Ws.send(JSON.stringify({ type: 'SUBMIT_WORD', team: 'team1', word: 'name' }));
  await sleep(400);

  // 4. Fast-forward Round 2 to Game Over
  console.log('4. Concluding Round 2 -> Victory Podium...');
  hostWs.send(JSON.stringify({ type: 'HOST_CONTROL', action: 'SET_TIME', remainingMs: 1000 }));
  await sleep(1500);

  // Reset to clean lobby for user
  console.log('5. Resetting to lobby for user trial run...');
  hostWs.send(JSON.stringify({ type: 'HOST_CONTROL', action: 'RESET' }));
  await sleep(300);

  hostWs.close();
  t1Ws.close();
  t2Ws.close();

  if (round2Accepted) {
    console.log('✓ Full match lifecycle verified successfully over public Cloudflare Tunnel!');
    process.exit(0);
  } else {
    console.error('Round 2 multiplier verification failed.');
    process.exit(1);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
