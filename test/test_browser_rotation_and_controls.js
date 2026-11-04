const puppeteer = require('puppeteer-core');
const http = require('http');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:3000';

function resetServer() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:3000/api/reset', res => {
      res.resume();
      resolve();
    }).on('error', reject);
  });
}

async function testRotationAndControls() {
  console.log('=== Catholic Krillion: Testing Host Controls & 20s Category Rotation ===\n');

  console.log('1. Resetting game to clean lobby state...');
  await resetServer();
  await new Promise(r => setTimeout(r, 600));

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // 1. Open Host Screen
    console.log('2. Opening Screen 1 (Host / Projector)...');
    const hostPage = await browser.newPage();
    await hostPage.goto(BASE_URL, { waitUntil: 'networkidle0' });

    // 2. Open Team 1 Controller
    console.log('3. Opening Screen 2 (Team A Laptop)...');
    const team1Page = await browser.newPage();
    await team1Page.goto(`${BASE_URL}/team1`, { waitUntil: 'networkidle0' });

    // 3. Open Team 2 Controller
    console.log('4. Opening Screen 3 (Team B Laptop)...');
    const team2Page = await browser.newPage();
    await team2Page.goto(`${BASE_URL}/team2`, { waitUntil: 'networkidle0' });

    await new Promise(r => setTimeout(r, 1200));

    // Verify initial lobby state
    const initialHostState = await hostPage.evaluate(() => ({
      lobbyActive: document.getElementById('view-lobby').classList.contains('active'),
      startDisabled: document.getElementById('btn-host-start').disabled,
      pauseDisabled: document.getElementById('btn-host-pause').disabled
    }));
    const initialT1State = await team1Page.evaluate(() => ({
      lobbyActive: document.getElementById('lobbyScreen').classList.contains('active'),
      roundActive: document.getElementById('roundScreen').classList.contains('active')
    }));

    console.log('Initial Host Buttons State:', initialHostState);
    console.log('Initial Team 1 Screen State:', initialT1State);

    if (!initialHostState.lobbyActive || initialHostState.startDisabled || !initialHostState.pauseDisabled) {
      throw new Error('Host screen controls did not initialize in expected Lobby state');
    }
    if (!initialT1State.lobbyActive || initialT1State.roundActive) {
      throw new Error('Team 1 did not initialize in Lobby screen');
    }
    console.log('✓ Initial Lobby state & Host buttons verified');

    // 5. Host clicks Start Match
    console.log('\n5. Host clicks "Start Match" (#btn-host-start)...');
    await hostPage.evaluate(() => document.getElementById('btn-host-start').click());
    await new Promise(r => setTimeout(r, 1500));

    const round1HostState = await hostPage.evaluate(() => ({
      gameActive: document.getElementById('view-game').classList.contains('active'),
      categoryTitle: document.getElementById('category-title').textContent.trim(),
      startDisabled: document.getElementById('btn-host-start').disabled,
      pauseDisabled: document.getElementById('btn-host-pause').disabled,
      pauseLabel: document.getElementById('btn-host-pause-label').textContent.trim()
    }));

    const round1T1State = await team1Page.evaluate(() => ({
      roundActive: document.getElementById('roundScreen').classList.contains('active'),
      promptTitle: document.getElementById('promptTitleDisplay').textContent.trim(),
      inputDisabled: document.getElementById('wordInput').disabled
    }));

    console.log('Host state after Start:', round1HostState);
    console.log('Team 1 state after Start:', round1T1State);

    if (!round1HostState.gameActive || !round1HostState.startDisabled || round1HostState.pauseDisabled) {
      throw new Error('Host screen failed to transition to active match');
    }
    if (!round1T1State.roundActive || round1T1State.inputDisabled) {
      throw new Error('Team 1 controller failed to activate or input is disabled');
    }
    if (round1HostState.categoryTitle !== round1T1State.promptTitle) {
      throw new Error(`Category title mismatch! Host: "${round1HostState.categoryTitle}", Team 1: "${round1T1State.promptTitle}"`);
    }
    console.log(`✓ Random category picked and synced to all screens: "${round1HostState.categoryTitle}"`);

    // 6. Test Pause Button
    console.log('\n6. Host clicks "Pause" (#btn-host-pause)...');
    await hostPage.evaluate(() => document.getElementById('btn-host-pause').click());
    await new Promise(r => setTimeout(r, 1000));

    const pausedHostState = await hostPage.evaluate(() => ({
      pauseBannerVisible: document.getElementById('host-paused-banner').style.display !== 'none',
      pauseBtnHasClass: document.getElementById('btn-host-pause').classList.contains('is-paused'),
      pauseLabel: document.getElementById('btn-host-pause-label').textContent.trim()
    }));

    const pausedT1State = await team1Page.evaluate(() => ({
      pauseOverlayVisible: document.getElementById('teamPauseOverlay').style.display !== 'none',
      inputDisabled: document.getElementById('wordInput').disabled
    }));

    console.log('Host state during Pause:', pausedHostState);
    console.log('Team 1 state during Pause:', pausedT1State);

    if (!pausedHostState.pauseBannerVisible || !pausedHostState.pauseBtnHasClass || pausedHostState.pauseLabel !== 'Resume') {
      throw new Error('Host pause UI did not activate correctly');
    }
    if (!pausedT1State.pauseOverlayVisible || !pausedT1State.inputDisabled) {
      throw new Error('Team 1 pause overlay not visible or input not disabled during pause');
    }
    console.log('✓ Pause state confirmed: Host shows banner & Resume button; Team 1 shows overlay & input disabled');

    // 7. Test Resume Button
    console.log('\n7. Host clicks "Resume" (#btn-host-pause)...');
    await hostPage.evaluate(() => document.getElementById('btn-host-pause').click());
    await new Promise(r => setTimeout(r, 1000));

    const resumedHostState = await hostPage.evaluate(() => ({
      pauseBannerVisible: document.getElementById('host-paused-banner').style.display !== 'none',
      pauseBtnHasClass: document.getElementById('btn-host-pause').classList.contains('is-paused'),
      pauseLabel: document.getElementById('btn-host-pause-label').textContent.trim()
    }));

    const resumedT1State = await team1Page.evaluate(() => ({
      pauseOverlayVisible: document.getElementById('teamPauseOverlay').style.display !== 'none',
      inputDisabled: document.getElementById('wordInput').disabled
    }));

    console.log('Host state after Resume:', resumedHostState);
    console.log('Team 1 state after Resume:', resumedT1State);

    if (resumedHostState.pauseBannerVisible || resumedHostState.pauseBtnHasClass || resumedHostState.pauseLabel !== 'Pause') {
      throw new Error('Host resume UI failed');
    }
    if (resumedT1State.pauseOverlayVisible || resumedT1State.inputDisabled) {
      throw new Error('Team 1 resume failed to hide overlay or enable input');
    }
    console.log('✓ Resume state confirmed: Host and Team 1 resumed cleanly');

    // 8. Test 20-second Category Rotation
    console.log('\n8. Waiting for 20-second automatic category rotation...');
    const catBefore = round1HostState.categoryTitle;
    console.log(`Current category: "${catBefore}"`);

    // Let's type something in Team 1 input to verify it gets cleared upon rotation
    await team1Page.type('#wordInput', 'partiallytypedword');

    // Wait 21.5 seconds for rotation to trigger
    let countdownRemaining = 21;
    while (countdownRemaining > 0) {
      process.stdout.write(`  Category rotates in ~${countdownRemaining}s... \r`);
      await new Promise(r => setTimeout(r, 2000));
      countdownRemaining -= 2;
    }
    console.log('\nChecking for category rotation...');
    await new Promise(r => setTimeout(r, 1000));

    const catAfterHost = await hostPage.evaluate(() => document.getElementById('category-title').textContent.trim());
    const catAfterT1 = await team1Page.evaluate(() => document.getElementById('promptTitleDisplay').textContent.trim());
    const t1InputVal = await team1Page.evaluate(() => document.getElementById('wordInput').value);

    console.log(`Category after 20s rotation on Host: "${catAfterHost}"`);
    console.log(`Category after 20s rotation on Team 1: "${catAfterT1}"`);
    console.log(`Team 1 input value after rotation (should be cleared): "${t1InputVal}"`);

    if (catAfterHost === catBefore) {
      throw new Error('Category did not rotate after 20 seconds!');
    }
    if (catAfterHost !== catAfterT1) {
      throw new Error(`Rotated category mismatch! Host: "${catAfterHost}", Team 1: "${catAfterT1}"`);
    }
    if (t1InputVal !== '') {
      throw new Error('Team 1 input was not cleared on category rotation');
    }
    console.log(`🎉 20s CATEGORY ROTATION VERIFIED: Rotated from "${catBefore}" -> "${catAfterHost}"!`);

    // 9. Test Reset Button
    console.log('\n9. Host clicks "Reset" (#btn-host-reset)...');
    await hostPage.evaluate(() => document.getElementById('btn-host-reset').click());
    await new Promise(r => setTimeout(r, 1200));

    const finalHostState = await hostPage.evaluate(() => ({
      lobbyActive: document.getElementById('view-lobby').classList.contains('active'),
      startDisabled: document.getElementById('btn-host-start').disabled
    }));
    const finalT1State = await team1Page.evaluate(() => ({
      lobbyActive: document.getElementById('lobbyScreen').classList.contains('active')
    }));

    console.log('Host state after Reset:', finalHostState);
    console.log('Team 1 state after Reset:', finalT1State);

    if (!finalHostState.lobbyActive || finalHostState.startDisabled || !finalT1State.lobbyActive) {
      throw new Error('Reset failed to return to Lobby state');
    }
    console.log('✓ Reset button successfully returned match to Lobby state on all screens');

    console.log('\n🏆 ALL BROWSER ROTATION AND HOST CONTROLS TESTS PASSED (100% SUCCESS)!\n');

  } finally {
    await resetServer();
    await browser.close();
  }
}

testRotationAndControls().catch(err => {
  console.error('\n❌ Browser Test Failed:', err);
  process.exit(1);
});
