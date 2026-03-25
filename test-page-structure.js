const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🚀 ページ構造確認...');
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // ページのHTMLを取得
    const html = await page.content();
    console.log('📄 ページタイトル:', await page.title());

    // リンクとボタンを取得
    const links = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.map(link => ({
        text: link.textContent.trim(),
        href: link.getAttribute('href')
      }));
    });

    const buttons = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.map(button => ({
        text: button.textContent.trim(),
        type: button.getAttribute('type')
      }));
    });

    console.log('\n🔗 リンク:');
    links.forEach(link => {
      if (link.text) console.log(`  - ${link.text} -> ${link.href}`);
    });

    console.log('\n🔘 ボタン:');
    buttons.forEach(button => {
      if (button.text) console.log(`  - ${button.text} (type: ${button.type})`);
    });

    // スクリーンショット
    await page.screenshot({ path: 'page-structure.png', fullPage: true });
    console.log('\n📸 スクリーンショット保存: page-structure.png');

    console.log('\n⏸️  10秒間待機...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('❌ エラー:', error.message);
  } finally {
    await browser.close();
  }
})();
