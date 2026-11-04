const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:3000';

async function testBrowserFlow() {
  console.log('Launching Headless Chrome with 3 tabs...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // 1. Open Host Page
    console.log('1. Opening Host Page at', BASE_URL);
    const hostPage = await browser.newPage();
    hostPage.on('console', msg => console.log('  [Host Console]:', msg.type(), msg.text()));
    hostPage.on('pageerror', err => console.error('  [Host Error]:', err.message));
    await hostPage.goto(BASE_URL, { waitUntil: 'networkidle0' });

    // 2. Open Team 1 Page
    console.log('2. Opening Team 1 Page at', `${BASE_URL}/team1`);
    const team1Page = await browser.newPage();
    team1Page.on('console', msg => console.log('  [Team 1 Console]:', msg.type(), msg.text()));
    team1Page.on('pageerror', err => console.error('  [Team 1 Error]:', err.message));
    await team1Page.goto(`${BASE_URL}/team1`, { waitUntil: 'networkidle0' });

    // 3. Open Team 2 Page
    console.log('3. Opening Team 2 Page at', `${BASE_URL}/team2`);
    const team2Page = await browser.newPage();
    team2Page.on('console', msg => console.log('  [Team 2 Console]:', msg.type(), msg.text()));
    team2Page.on('pageerror', err => console.error('  [Team 2 Error]:', err.message));
    await team2Page.goto(`${BASE_URL}/team2`, { waitUntil: 'networkidle0' });

    await new Promise(r => setTimeout(r, 1000));

    // Check initial state on Team 1
    const t1LobbyActive = await team1Page.evaluate(() => {
      const lobby = document.getElementById('lobbyScreen');
      const round = document.getElementById('roundScreen');
      return {
        lobbyActive: lobby.classList.contains('active'),
        roundActive: round.classList.contains('active')
      };
    });
    console.log('Initial Team 1 State:', t1LobbyActive);

    // 4. Click Start Match on Host
    console.log('\n4. Host clicks "Begin Sacred Contest ☩" button (#btn-start-match)...');
    await hostPage.evaluate(() => document.getElementById('btn-start-match').click());

    await new Promise(r => setTimeout(r, 1000));

    // Check state on Team 1 & Team 2 after start
    const t1AfterStart = await team1Page.evaluate(() => {
      const lobby = document.getElementById('lobbyScreen');
      const round = document.getElementById('roundScreen');
      const title = document.getElementById('promptTitleDisplay');
      return {
        lobbyActive: lobby.classList.contains('active'),
        roundActive: round.classList.contains('active'),
        promptTitle: title ? title.textContent : null
      };
    });

    const t2AfterStart = await team2Page.evaluate(() => {
      const lobby = document.getElementById('lobbyScreen');
      const round = document.getElementById('roundScreen');
      return {
        lobbyActive: lobby.classList.contains('active'),
        roundActive: round.classList.contains('active')
      };
    });

    console.log('Team 1 State after Host Start:', t1AfterStart);
    console.log('Team 2 State after Host Start:', t2AfterStart);

    if (t1AfterStart.roundActive && !t1AfterStart.lobbyActive) {
      console.log('🎉 SUCCESS: Team 1 successfully transitioned to active round screen!');
    } else {
      console.error('❌ BUG CONFIRMED: Team 1 remained on lobby screen!');
    }

  } finally {
    await browser.close();
  }
}

testBrowserFlow().catch(console.error);
