import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // ホームページに移動
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  // スクリーンショットを撮影
  await page.screenshot({ path: '/tmp/homepage.png', fullPage: true });
  console.log("Screenshot saved to /tmp/homepage.png");

  // ページタイトルを確認
  const title = await page.locator('h1').textContent();
  console.log(`Page title: ${title}`);

  // 機能カードを確認
  const features = await page.locator('[class*="Card"]').all();
  console.log(`Found ${features.length} feature cards`);

  // 新しいセッションページへ移動
  await page.click('a:has-text("新しいセッション")');
  await page.waitForLoadState('networkidle');

  // セッション作成ページのスクリーンショット
  await page.screenshot({ path: '/tmp/session_new.png', fullPage: true });
  console.log("Screenshot saved to /tmp/session_new.png");

  // フォーム要素を確認
  const clientNameVisible = await page.locator('input[name="client_name"], #client_name').isVisible();
  const meetingTitleVisible = await page.locator('input[name="meeting_title"], #meeting_title').isVisible();

  console.log(`Client name input visible: ${clientNameVisible}`);
  console.log(`Meeting title input visible: ${meetingTitleVisible}`);

  await browser.close();
  console.log("Test completed successfully!");
}

test().catch(console.error);
