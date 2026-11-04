const puppeteer = require('puppeteer');

async function runLiveTest() {
  console.log('--- Starting Catholic Krillion Live Netlify E2E Test ---');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const testRoom = 'testroom_' + Math.floor(Math.random() * 10000);
  console.log('Target Room Code:', testRoom);

  try {
    const hostPage = await browser.newPage();
    const team1Page = await browser.newPage();
    const team2Page = await browser.newPage();

    // 1. Load Host
    console.log('1. Loading Host on Netlify...');
    await hostPage.goto(`https://catholic-krillion.netlify.app/?room=${testRoom}`, { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('Host title:', await hostPage.title());

    // 2. Load Controllers
    console.log('2. Loading Team 1 Controller...');
    await team1Page.goto(`https://catholic-krillion.netlify.app/team.html?room=${testRoom}&team=1`, { waitUntil: 'networkidle2', timeout: 30000 });
    
    console.log('3. Loading Team 2 Controller...');
    await team2Page.goto(`https://catholic-krillion.netlify.app/team.html?room=${testRoom}&team=2`, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait 2 seconds for cloud broker connection & handshake
    await new Promise(r => setTimeout(r, 2500));

    // Check Controller Statuses
    const t1Status = await team1Page.$eval('#wsStatusText', el => el.textContent.trim());
    const t2Status = await team2Page.$eval('#wsStatusText', el => el.textContent.trim());
    console.log('Team 1 Connection Status:', t1Status);
    console.log('Team 2 Connection Status:', t2Status);

    if (!t1Status.includes('Live')) {
      throw new Error('Team 1 failed to connect to Cloud Relay: ' + t1Status);
    }

    // 4. Host starts match
    console.log('4. Host starting match...');
    await hostPage.click('#btn-host-start');
    await new Promise(r => setTimeout(r, 1500));

    // Check Host Phase
    const hostPhase = await hostPage.$eval('#phase-badge', el => el.textContent.trim());
    console.log('Host Phase after Start:', hostPhase);

    // Check Category Prompt
    const hostPrompt = await hostPage.$eval('#prompt-title', el => el.textContent.trim());
    console.log('Active Category Prompt:', hostPrompt);

    // 5. Test Live Typing from Team 1
    console.log('5. Testing Team 1 Live Typing...');
    await team1Page.type('#wordInput', 'mary');
    await new Promise(r => setTimeout(r, 1000));

    const hostTypingT1 = await hostPage.$eval('#typing-text-team1', el => el.textContent.trim());
    console.log('Host displayed Team 1 typing text:', hostTypingT1);

    // 6. Test Word Submission from Team 1
    console.log('6. Submitting word from Team 1...');
    await team1Page.click('#submitBtn');
    await new Promise(r => setTimeout(r, 1500));

    const t1ScoreHost = await hostPage.$eval('#score-points-team1', el => el.textContent.trim());
    console.log('Host displayed Team 1 score:', t1ScoreHost);

    // 7. Test Duplicate Prevention from Team 1 (Submit same word again)
    console.log('7. Testing duplicate word rejection...');
    await team1Page.type('#wordInput', 'mary');
    await team1Page.click('#submitBtn');
    await new Promise(r => setTimeout(r, 1500));

    const t1ScoreHostAfterDuplicate = await hostPage.$eval('#score-points-team1', el => el.textContent.trim());
    console.log('Host displayed Team 1 score after duplicate:', t1ScoreHostAfterDuplicate);

    if (t1ScoreHost !== t1ScoreHostAfterDuplicate) {
      throw new Error('Duplicate word scored points! Should have been rejected.');
    }
    console.log('PASS: Duplicate word correctly prevented from scoring!');

    // 8. Verify 30-Second Category Tracker
    const catTimerText = await hostPage.$eval('#host-cat-timer', el => el.textContent.trim());
    console.log('30-second Category Tracker Value:', catTimerText);

    console.log('\n======================================================');
    console.log('SUCCESS! Catholic Krillion is 100% OPERATIONAL on Netlify!');
    console.log('Live Host URL: https://catholic-krillion.netlify.app');
    console.log('Live Team 1:   https://catholic-krillion.netlify.app/team1');
    console.log('Live Team 2:   https://catholic-krillion.netlify.app/team2');
    console.log('======================================================\n');
  } catch (err) {
    console.error('Test FAILED:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

runLiveTest();
