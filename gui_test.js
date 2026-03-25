const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('1. ホームページを開きます...');
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: '/tmp/gui_test_01_homepage.png' });
    console.log('✅ ホームページのスクリーンショットを保存: /tmp/gui_test_01_homepage.png');

    // h1タグのテキストを確認
    const h1Text = await page.locator('h1').textContent();
    console.log(`✅ h1タグ: ${h1Text}`);

    // 「新しいセッション」ボタンをクリック
    console.log('\n2. 新しいセッションボタンをクリックします...');
    await page.click('a:has-text("新しいセッション")');
    await page.waitForURL(/\/session\/new/);
    await page.screenshot({ path: '/tmp/gui_test_02_new_session.png' });
    console.log('✅ 新規セッションページのスクリーンショットを保存: /tmp/gui_test_02_new_session.png');

    // フォームを入力
    console.log('\n3. フォームを入力します...');
    await page.fill('#client_name', 'GUIテスト株式会社');
    await page.fill('#client_company', 'GUIテスト株式会社');
    await page.fill('#meeting_title', 'GUIテスト会議');
    console.log('✅ フォーム入力完了');
    await page.screenshot({ path: '/tmp/gui_test_03_form_filled.png' });
    console.log('✅ フォーム入力後のスクリーンショットを保存: /tmp/gui_test_03_form_filled.png');

    // 送信
    console.log('\n4. セッションを作成します...');
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // 会議ページに遷移するのを待つ
    await page.waitForURL(/\/meeting\//, { timeout: 5000 });
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: '/tmp/gui_test_04_meeting_page.png' });
    console.log('✅ 会議ページのスクリーンショットを保存: /tmp/gui_test_04_meeting_page.png');

    // 会議ページの要素を確認
    console.log('\n5. 会議ページの要素を確認します...');

    const headerVisible = await page.locator('header').isVisible();
    console.log(`✅ ヘッダー表示: ${headerVisible}`);

    const h1TextMeeting = await page.locator('header h1').textContent();
    console.log(`✅ 会議タイトル: ${h1TextMeeting}`);

    const clientName = await page.locator('header p').textContent();
    console.log(`✅ クライアント名: ${clientName}`);

    const startButtonVisible = await page.locator('button:has-text("会議開始")').isVisible();
    console.log(`✅ 会議開始ボタン表示: ${startButtonVisible}`);

    // インサイトタブをクリック
    console.log('\n6. インサイトタブをクリックします...');
    await page.click('button:has-text("インサイト")');
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/gui_test_05_insight_tab.png' });
    console.log('✅ インサイトタブのスクリーンショットを保存: /tmp/gui_test_05_insight_tab.png');

    // 提案タブをクリック
    console.log('\n7. 提案タブをクリックします...');
    await page.click('button:has-text("提案")');
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/gui_test_06_suggestions_tab.png' });
    console.log('✅ 提案タブのスクリーンショットを保存: /tmp/gui_test_06_suggestions_tab.png');

    console.log('\n✅ GUIテスト完了！すべてのスクリーンショットは /tmp/ に保存されました。');

    // ブラウザを少し開いたままにする
    console.log('\n5秒間ブラウザを開いたままにします...');
    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
    await page.screenshot({ path: '/tmp/gui_test_error.png' });
    console.log('エラー時のスクリーンショットを保存: /tmp/gui_test_error.png');
  } finally {
    await browser.close();
  }
})();
