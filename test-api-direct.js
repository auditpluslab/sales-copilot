const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🚀 API直接テスト開始...');

    // ログイン処理
    console.log('\n🔐 ログイン処理...');
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');

    // テスト用アカウントでログイン（新規登録）
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'Test1234';

    await page.fill('#email', testEmail);
    await page.fill('input[type="password"]', testPassword);

    // 新規登録モードに切り替え
    await page.click('text=アカウントを作成');
    await page.waitForTimeout(500);

    // フォームを再入力
    await page.fill('#email', testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button[type="submit"]');

    // 登録完了を待機
    await page.waitForTimeout(3000);

    // ログインページに戻る場合はログイン実行
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      console.log('🔄 ログイン実行...');
      await page.fill('#email', testEmail);
      await page.fill('input[type="password"]', testPassword);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);
    }

    console.log('✅ 認証完了');

    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    console.log('✅ ページ読み込み完了');

    // 1. クライアント作成APIテスト
    console.log('\n📡 テスト1: クライアント作成');

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
      return { status: response.status, data };
    });

    console.log(`✅ クライアント作成: ${JSON.stringify(clientResponse, null, 2)}`);

    if (clientResponse.status !== 201) {
      console.log('⚠️  クライアント作成失敗、既存クライアントを取得します');

      // 既存クライアントを取得
      const getClientsResponse = await page.evaluate(async () => {
        const response = await fetch(`/api/clients`);
        const data = await response.json();
        return { status: response.status, data };
      });

      console.log(`📋 既存クライアント一覧: ${JSON.stringify(getClientsResponse, null, 2)}`);

      if (getClientsResponse.data.clients && getClientsResponse.data.clients.length > 0) {
        clientResponse.data = { client: getClientsResponse.data.clients[0] };
      }
    }

    const clientId = clientResponse.data?.client?.id;
    if (!clientId) {
      throw new Error('クライアントIDが取得できませんでした');
    }
    console.log(`📌 クライアントID: ${clientId}`);

    // 2. セッション作成APIテスト
    console.log('\n📡 テスト2: セッション作成（クライアント紐付け）');

    const sessionResponse = await page.evaluate(async ({ clientId }) => {
      const response = await fetch(`/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: 'テスト株式会社',
          client_id: clientId,
          meeting_title: '導入相談会議'
        })
      });
      const data = await response.json();
      return { status: response.status, data };
    }, { clientId });

    console.log(`✅ セッション作成: ${JSON.stringify(sessionResponse, null, 2)}`);

    const sessionId = sessionResponse.data?.session?.id;
    if (!sessionId) {
      throw new Error('セッションIDが取得できませんでした');
    }
    console.log(`📌 セッションID: ${sessionId}`);

    // 3. インサイト生成APIテスト
    console.log('\n📡 テスト3: インサイト生成');

    const testTranscript = `予算の枠は300万円程度で検討しています。
まずは〇〇部門だけで試したいと思います。
3ヶ月以内に効果を見たいです。
既存システムとの連携は必須です。
来週にも決定会議があります。`;

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
      return { status: response.status, data };
    }, { sessionId, transcript: testTranscript });

    console.log(`✅ インサイト生成: ${JSON.stringify(insightResponse, null, 2)}`);

    const insight = insightResponse.data?.insight;

    // 4. 提案生成APIテスト（クライアント履歴なし）
    console.log('\n📡 テスト4: 提案生成（クライアント履歴なし）');

    const suggestionsResponse1 = await page.evaluate(async ({ sessionId, insight, transcript }) => {
      const response = await fetch(`/api/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          insight: insight,
          transcript_text: transcript
        })
      });
      const data = await response.json();
      return { status: response.status, data };
    }, { sessionId, insight, transcript: testTranscript });

    console.log(`✅ 提案生成（履歴なし）: ${JSON.stringify(suggestionsResponse1, null, 2)}`);

    // 5. 提案生成APIテスト（クライアント履歴あり）
    console.log('\n📡 テスト5: 提案生成（クライアント履歴あり）');

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
      return { status: response.status, data };
    }, { sessionId, clientId, insight, transcript: testTranscript });

    console.log(`✅ 提案生成（履歴あり）: ${JSON.stringify(suggestionsResponse2, null, 2)}`);

    // 6. GET版提案生成APIテスト
    console.log('\n📡 テスト6: GET版提案生成');

    const getResponse = await page.evaluate(async ({ sessionId, clientId, transcript }) => {
      const params = new URLSearchParams({
        session_id: sessionId,
        client_id: clientId,
        transcript: transcript
      });
      const response = await fetch(`/api/suggestions?${params}`);
      const data = await response.json();
      return { status: response.status, data };
    }, { sessionId, clientId, transcript: testTranscript });

    console.log(`✅ GET版提案生成: ${JSON.stringify(getResponse, null, 2)}`);

    // 7. クライアント詳細取得APIテスト
    console.log('\n📡 テスト7: クライアント詳細取得');

    const clientDetailResponse = await page.evaluate(async ({ clientId }) => {
      const response = await fetch(`/api/clients/${clientId}`);
      const data = await response.json();
      return { status: response.status, data };
    }, { clientId });

    console.log(`✅ クライアント詳細: ${JSON.stringify(clientDetailResponse, null, 2)}`);

    // 結果サマリー
    console.log('\n' + '='.repeat(60));
    console.log('🎉 テスト完了サマリー');
    console.log('='.repeat(60));
    console.log(`✅ クライアント作成API: ${clientResponse.status === 201 ? 'OK' : 'NG'}`);
    console.log(`✅ セッション作成API: ${sessionResponse.status === 200 ? 'OK' : 'NG'}`);
    console.log(`✅ インサイト生成API: ${insightResponse.status === 200 ? 'OK' : 'NG'}`);
    console.log(`✅ 提案生成API（履歴なし）: ${suggestionsResponse1.status === 200 ? 'OK' : 'NG'}`);
    console.log(`✅ 提案生成API（履歴あり）: ${suggestionsResponse2.status === 200 ? 'OK' : 'NG'}`);
    console.log(`✅ GET版提案生成: ${getResponse.status === 200 ? 'OK' : 'NG'}`);
    console.log(`✅ クライアント詳細取得: ${clientDetailResponse.status === 200 ? 'OK' : 'NG'}`);
    console.log('='.repeat(60));

    // スクリーンショット
    await page.screenshot({ path: 'test-api-result.png', fullPage: true });
    console.log('📸 スクリーンショット保存: test-api-result.png');

    console.log('\n⏸️  5秒間待機...');
    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('❌ テストエラー:', error.message);
    await page.screenshot({ path: 'test-api-error.png' });
    console.log('📸 エラースクリーンショット保存: test-api-error.png');
  } finally {
    await browser.close();
    console.log('🔚 ブラウザを閉じました');
  }
})();
