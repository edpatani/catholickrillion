const puppeteer = require('puppeteer-core');
const http = require('http');
const path = require('path');
const fs = require('fs');
const questionsData = require('../data/questions.json');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const urlFile = path.join(__dirname, '..', '..', 'scratch', 'public_url.txt');
const BASE_URL = fs.existsSync(urlFile) ? fs.readFileSync(urlFile, 'utf8').trim() : 'https://small-may-graduation-beside.trycloudflare.com';

function resetServer() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:3000/api/reset', res => {
      res.resume();
      resolve();
    }).on('error', reject);
  });
}

function getSampleAnswer(categoryId, index = 0) {
  const cat = questionsData.categories.find(c => c.id === categoryId);
  if (cat && cat.tiers && cat.tiers.pew_warmer && cat.tiers.pew_warmer.length > index) {
    return cat.tiers.pew_warmer[index];
  }
  return 'amen';
}

async function testPublicBrowserFlow() {
  console.log('Resetting game to clean lobby state...');
  await resetServer();
  await new Promise(r => setTimeout(r, 600));

  console.log('Testing 3 Browser Windows over Public Cloudflare Tunnel...');
  console.log('Target URL:', BASE_URL);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
  });

  try {
    // 1. Open Host Page
    console.log('1. Opening Public Host Page at', BASE_URL);
    const hostPage = await browser.newPage();
    hostPage.on('console', msg => console.log('  [Public Host]:', msg.text()));
    await hostPage.goto(BASE_URL, { waitUntil: 'networkidle0' });

    // 2. Open Team 1 Page
    console.log('2. Opening Public Team 1 Page at', `${BASE_URL}/team1`);
    const team1Page = await browser.newPage();
    team1Page.on('console', msg => console.log('  [Public Team 1]:', msg.text()));
    await team1Page.goto(`${BASE_URL}/team1`, { waitUntil: 'networkidle0' });

    // 3. Open Team 2 Page
    console.log('3. Opening Public Team 2 Page at', `${BASE_URL}/team2`);
    const team2Page = await browser.newPage();
    team2Page.on('console', msg => console.log('  [Public Team 2]:', msg.text()));
    await team2Page.goto(`${BASE_URL}/team2`, { waitUntil: 'networkidle0' });

    await new Promise(r => setTimeout(r, 1500));

    // Check initial state on Team 1 & 2
    const t1Initial = await team1Page.evaluate(() => ({
      lobby: document.getElementById('lobbyScreen').classList.contains('active'),
      round: document.getElementById('roundScreen').classList.contains('active')
    }));
    const t2Initial = await team2Page.evaluate(() => ({
      lobby: document.getElementById('lobbyScreen').classList.contains('active'),
      round: document.getElementById('roundScreen').classList.contains('active')
    }));
    console.log('Initial Team 1 State (should be lobby: true):', t1Initial);
    console.log('Initial Team 2 State (should be lobby: true):', t2Initial);

    if (!t1Initial.lobby || !t2Initial.lobby) {
      console.error('Teams did not start in lobby state!');
      process.exit(1);
    }

    // 4. Click Start Match on Host
    console.log('\n4. Host clicks "Begin Sacred Contest ☩" (#btn-start-match)...');
    await hostPage.evaluate(() => document.getElementById('btn-start-match').click());

    await new Promise(r => setTimeout(r, 1500));

    // Check state on Team 1 & Team 2 after start
    const t1After = await team1Page.evaluate(() => ({
      lobby: document.getElementById('lobbyScreen').classList.contains('active'),
      round: document.getElementById('roundScreen').classList.contains('active'),
      promptTitle: document.getElementById('promptTitleDisplay').textContent,
      promptTag: document.getElementById('promptCategoryTag').textContent
    }));

    const t2After = await team2Page.evaluate(() => ({
      lobby: document.getElementById('lobbyScreen').classList.contains('active'),
      round: document.getElementById('roundScreen').classList.contains('active'),
      promptTitle: document.getElementById('promptTitleDisplay').textContent
    }));

    console.log('Team 1 State after Host Start:', t1After);
    console.log('Team 2 State after Host Start:', t2After);

    if (t1After.round && !t1After.lobby && t2After.round && !t2After.lobby) {
      console.log('\n🎉 ALL THREE SITES CONNECTED AND TRANSITIONED SEAMLESSLY OVER CLOUDFLARE PUBLIC INTERNET!');
    } else {
      console.error('\n❌ Transition failed over public internet');
      process.exit(1);
    }

    // Find sample valid words for whichever random category was selected
    const catId = t1After.promptTag.replace(/\s+/g, '_');
    const word1 = getSampleAnswer(catId, 0);
    const word2 = getSampleAnswer(catId, 1);
    console.log(`Using sample answers for category "${catId}": Team 1 -> "${word1}", Team 2 -> "${word2}"`);

    // 5. Test entering a word on Team 1 and verifying live typing appears on Host
    console.log(`\n5. Testing Team 1 typing word "${word1}" into input...`);
    await team1Page.type('#wordInput', word1, { delay: 40 });
    await new Promise(r => setTimeout(r, 600));

    const hostSawTyping = await hostPage.evaluate(() => {
      const textElem = document.getElementById('typing-text-team1');
      return textElem ? textElem.textContent : null;
    });
    console.log('Host Live Typing Display for Team 1:', `"${hostSawTyping}"`);

    // 6. Submit word on Team 1
    console.log('6. Submitting word on Team 1...');
    await team1Page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 1000));

    const t1Points = await team1Page.evaluate(() => document.getElementById('currentPointsVal').textContent);
    const hostT1Points = await hostPage.evaluate(() => document.getElementById('points-team1').textContent);

    console.log('Team 1 Points Display on Controller:', t1Points);
    console.log('Team 1 Points Display on Host Screen:', hostT1Points);

    // 7. Test entering a word on Team 2 as well!
    console.log(`\n7. Testing Team 2 typing word "${word2}" into input...`);
    await team2Page.type('#wordInput', word2, { delay: 40 });
    await new Promise(r => setTimeout(r, 600));

    const hostSawTyping2 = await hostPage.evaluate(() => {
      const textElem = document.getElementById('typing-text-team2');
      return textElem ? textElem.textContent : null;
    });
    console.log('Host Live Typing Display for Team 2:', `"${hostSawTyping2}"`);

    // 8. Submit word on Team 2
    console.log('8. Submitting word on Team 2...');
    await team2Page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 1000));

    const t2Points = await team2Page.evaluate(() => document.getElementById('currentPointsVal').textContent);
    const hostT2Points = await hostPage.evaluate(() => document.getElementById('points-team2').textContent);

    console.log('Team 2 Points Display on Controller:', t2Points);
    console.log('Team 2 Points Display on Host Screen:', hostT2Points);

    if (
      hostSawTyping === word1 &&
      t1Points.includes('pts') &&
      !t1Points.startsWith('0') &&
      hostSawTyping2 === word2 &&
      t2Points.includes('pts') &&
      !t2Points.startsWith('0')
    ) {
      console.log('\n🏆 END-TO-END MULTI-DEVICE BROWSER TEST OVER PUBLIC WEB COMPLETELY VERIFIED (100% PASS)!');
    } else {
      console.error('Points or typing verification failed');
      process.exit(1);
    }

  } finally {
    // Reset back to lobby cleanly for the user
    await resetServer();
    console.log('Game state cleanly reset to Lobby for the user.');
    await browser.close();
  }
}

testPublicBrowserFlow().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
