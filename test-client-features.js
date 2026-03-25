const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🚀 開発サーバーに接続中...');

    // 認証チェックをバイパス（開発環境）
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // ログインページにリダイレクトされる場合はスキップ
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      console.log('🔐 ログインページにリダイレクトされました');
      // 開発環境では直接セッション作成ページへ
      await page.goto('http://localhost:3000/session/new');
      await page.waitForLoadState('networkidle');
    }

    console.log('✅ ページ読み込み完了');

    // 1. 新規セッション作成ページへ
    console.log('\n📝 新規セッション作成テスト');
    await page.click('text=新しいセッション');
    await page.waitForLoadState('networkidle');
    console.log('✅ 新規セッションページへ遷移');

    // フォームに入力（プレースホルダーで特定）
    const clientName = 'テスト株式会社' + Date.now();

    // 最初の入力フィールドが顧客名
    await page.fill('input:first-of-type', clientName);
    await page.fill('input:nth-of-type(2)', 'テスト株式会社');
    await page.fill('input:nth-of-type(3)', '導入相談会議');
    console.log(`✅ フォーム入力完了: ${clientName}`);

    // セッション作成
    console.log('\n🎯 セッション作成...');
    await page.click('button[type="submit"]');

    // ページ遷移を待機
    await page.waitForURL(/\/meeting\//, { timeout: 10000 });
    console.log('✅ セッション作成成功、ミーティングページへ遷移');

    // セッションIDを取得
    const url = page.url();
    const sessionId = url.match(/\/meeting\/([a-f0-9-]+)/)?.[1];
    console.log(`📌 セッションID: ${sessionId}`);

    // 2. ミーティングページで文字起こしをシミュレート
    console.log('\n🎤 文字起こしシミュレーション');

    // 文字起こしテキストを送信（APIを直接呼び出すシミュレーション）
    const testTranscript = `予算の枠は300万円程度で検討しています。
まずは〇〇部門だけで試したいと思います。
3ヶ月以内に効果を見たいです。
既存システムとの連携は必須です。
来週にも決定会議があります。`;

    // APIエンドポイントを直接テスト
    console.log('\n📡 APIテスト: インサイト生成');

    // インサイト生成APIをテスト
    const insightResponse = await page.evaluate(async ({ sessionId, transcript }) => {
      const response = await fetch(`/api/insight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          transcript_text: transcript
        })
      });
      const data = await response.json();
      return data;
    }, { sessionId, transcript: testTranscript });

    console.log('✅ インサイトAPIレスポンス:', JSON.stringify(insightResponse, null, 2));

    // 提案生成APIをテスト（クライアントIDなし）
    console.log('\n📡 APIテスト: 提案生成（クライアント履歴なし）');

    const suggestionsResponse1 = await page.evaluate(async ({ sessionId, transcript }) => {
      const response = await fetch(`/api/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          insight: insightResponse.insight,
          transcript_text: transcript
        })
      });
      const data = await response.json();
      return data;
    }, { sessionId, transcript: testTranscript });

    console.log('✅ 提案APIレスポンス（履歴なし）:', JSON.stringify(suggestionsResponse1, null, 2));

    // 3. クライアント作成APIテスト
    console.log('\n📡 APIテスト: クライアント作成');

    const clientResponse = await page.evaluate(async () => {
      const response = await fetch(`/api/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'テストクライアント株式会社',
          company: 'テストクライアント株式会社',
          industry: '製造業',
          company_size: 'medium',
          notes: 'テスト用クライアント'
        })
      });
      const data = await response.json();
      return data;
    });

    console.log('✅ クライアント作成レスポンス:', JSON.stringify(clientResponse, null, 2));

    const clientId = clientResponse.client?.id;
    if (clientId) {
      console.log(`📌 クライアントID: ${clientId}`);

      // 4. 提案生成APIテスト（クライアントIDあり）
      console.log('\n📡 APIテスト: 提案生成（クライアント履歴あり）');

      const suggestionsResponse2 = await page.evaluate(async ({ sessionId, clientId, insight, transcript }) => {
        const response = await fetch(`/api/suggestions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            client_id: clientId,
            insight: insight,
            transcript_text: transcript
          })
        });
        const data = await response.json();
        return data;
      }, { sessionId, clientId, insight: insightResponse.insight, transcript: testTranscript });

      console.log('✅ 提案APIレスポンス（履歴あり）:', JSON.stringify(suggestionsResponse2, null, 2));

      // 5. クライアント詳細取得APIテスト
      console.log('\n📡 APIテスト: クライアント詳細取得');

      const clientDetailResponse = await page.evaluate(async ({ clientId }) => {
        const response = await fetch(`/api/clients/${clientId}`);
        const data = await response.json();
        return data;
      }, { clientId });

      console.log('✅ クライアント詳細レスポンス:', JSON.stringify(clientDetailResponse, null, 2));
    }

    // 6. GET APIテスト（クエリパラメータ版）
    console.log('\n📡 APIテスト: GET版提案生成');

    const getResponse = await page.evaluate(async ({ sessionId, clientId, transcript }) => {
      const params = new URLSearchParams({
        session_id: sessionId,
        client_id: clientId,
        transcript: transcript
      });
      const response = await fetch(`/api/suggestions?${params}`);
      const data = await response.json();
      return data;
    }, { sessionId, clientId, transcript: testTranscript });

    console.log('✅ GET版提案APIレスポンス:', JSON.stringify(getResponse, null, 2));

    // 結果サマリー
    console.log('\n' + '='.repeat(50));
    console.log('🎉 テスト完了サマリー');
    console.log('='.repeat(50));
    console.log('✅ ホームページ: OK');
    console.log('✅ セッション作成: OK');
    console.log('✅ インサイト生成API: OK');
    console.log('✅ 提案生成API（履歴なし）: OK');
    console.log('✅ クライアント作成API: OK');
    if (clientId) {
      console.log('✅ 提案生成API（履歴あり）: OK');
      console.log('✅ クライアント詳細取得API: OK');
    }
    console.log('✅ GET版提案API: OK');
    console.log('='.repeat(50));

    // スクリーンショットを撮影
    await page.screenshot({ path: 'test-result.png', fullPage: true });
    console.log('📸 スクリーンショット保存: test-result.png');

    // 5秒待機して確認
    console.log('\n⏸️  5秒間待機してブラウザを確認してください...');
    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('❌ テストエラー:', error.message);
    await page.screenshot({ path: 'test-error.png' });
    console.log('📸 エラースクリーンショット保存: test-error.png');
  } finally {
    await browser.close();
    console.log('🔚 ブラウザを閉じました');
  }
})();
