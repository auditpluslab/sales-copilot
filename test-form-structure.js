const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🚀 フォーム構造確認...');
    await page.goto('http://localhost:3000');
    await page.click('text=新しいセッション');
    await page.waitForLoadState('networkidle');

    // フォーム要素を取得
    const formElements = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input, textarea, select'));
      return inputs.map(input => ({
        tag: input.tagName,
        type: input.getAttribute('type'),
        name: input.getAttribute('name'),
        id: input.getAttribute('id'),
        placeholder: input.getAttribute('placeholder'),
        required: input.hasAttribute('required')
      }));
    });

    console.log('\n📝 フォーム要素:');
    formElements.forEach(elem => {
      console.log(`  - ${elem.tag} (name="${elem.name}", type="${elem.type}", required=${elem.required})`);
    });

    // スクリーンショット
    await page.screenshot({ path: 'form-structure.png', fullPage: true });
    console.log('\n📸 スクリーンショット保存: form-structure.png');

    console.log('\n⏸️  10秒間待機...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('❌ エラー:', error.message);
  } finally {
    await browser.close();
  }
})();
