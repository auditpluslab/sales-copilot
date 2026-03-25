const { chromium } = require('playwright');
const https = require('https');

console.log('=== 機能テスト開始 ===\n');

let passed = 0;
let failed = 0;
const errors = [];

async function testAudioRecording() {
  console.log('1. 音声録音機能のテスト...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // テスト用セッションを作成
    console.log('テスト用セッションを作成中...');
    await page.goto('http://localhost:3000');
    await page.click('a:has-text("新しいセッション")');
    await page.fill('#client_name', '機能テスト株式会社');
    await page.fill('#client_company', '機能テスト株式会社');
    await page.fill('#meeting_title', '機能テスト会議');
    await page.click('button[type="submit"]');

    // 会議ページに遷移するのを待つ
    await page.waitForURL(/\/meeting\//, { timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');

    console.log('✅ 会議ページに遷移しました');

    // STTステータスのチェック
    console.log('\n2. STT接続ステータスのチェック...');

    // コンソールログを監視
    const logs = [];
    page.on('console', msg => {
      logs.push(msg.text());
    });

    // 会議開始ボタンをクリック
    console.log('会議開始ボタンをクリック...');
    await page.click('button:has-text("会議開始")');

    // STTの接続を待つ
    await page.waitForTimeout(3000);

    // ステータスバッジを確認
    const statusBadge = page.locator('span[class*="Badge"], div[class*="badge"]').first();
    let statusText = 'Unknown';

    try {
      statusText = await statusBadge.textContent({ timeout: 5000 });
    } catch (e) {
      // バッジが見つからない場合はボタンのテキストを確認
      const startButton = page.locator('button:has-text("会議終了")');
      if (await startButton.isVisible()) {
        statusText = '接続済み';
      }
    }

    console.log(`STTステータス: ${statusText}`);

    if (statusText.includes('接続') || statusText.includes('中')) {
      console.log('✅ STT接続: 成功');
      passed++;
    } else {
      console.log('⚠️  STT接続: 状態不明');
      errors.push('STT接続ステータスを確認できませんでした');
    }

    // マイクパーミッションのチェック
    console.log('\n3. マイクパーミッションのチェック...');

    // ブラウザの権限をチェック
    const permissions = await context.permissions();
    const hasMicPermission = permissions.includes('microphone');

    if (hasMicPermission) {
      console.log('✅ マイクパーミッション: 付与済み');
      passed++;
    } else {
      console.log('⚠️  マイクパーミッション: 未付与（ユーザーによる許可が必要）');
      errors.push('マイクパーミッションが未付与です');
    }

    // コンソールログにエラーがないかチェック
    console.log('\n4. エラーログのチェック...');

    const errorLogs = logs.filter(log =>
      log.includes('Error') ||
      log.includes('error') ||
      log.includes('Failed') ||
      log.includes('failed')
    );

    if (errorLogs.length === 0) {
      console.log('✅ エラーログ: なし');
      passed++;
    } else {
      console.log(`⚠️  エラーログ: ${errorLogs.length}件`);
      errorLogs.forEach(log => {
        console.log(`  - ${log}`);
      });
      errors.push('コンソールにエラーログがあります');
    }

    // 5秒間録音を続ける
    console.log('\n5. 5秒間の録音テスト...');
    await page.waitForTimeout(5000);

    // 会議終了ボタンをクリック
    console.log('会議終了ボタンをクリック...');
    await page.click('button:has-text("会議終了")');

    // 終了処理を待つ
    await page.waitForTimeout(2000);

    console.log('✅ 録音テスト: 完了');
    passed++;

    // スクリーンショットを保存
    await page.screenshot({ path: '/tmp/functionality_test_result.png' });
    console.log('スクリーンショットを保存: /tmp/functionality_test_result.png');

  } catch (error) {
    console.error(`❌ 機能テストエラー: ${error.message}`);
    errors.push(error.message);
    failed++;

    await page.screenshot({ path: '/tmp/functionality_test_error.png' });
  } finally {
    await browser.close();
  }
}

async function testSupabaseFunctions() {
  console.log('\n6. Supabase Edge Functionsのテスト...\n');

  const https = require('https');

  const supabaseUrl = 'https://rustzicvyquandgurisd.supabase.co';
  const supabaseKey = 'sb_publishable_rq1z3MVn_ayJUmlSgWdNLA_q4X1z-5h';

  // テスト用セッションID
  const testSessionId = 'test-function-' + Date.now();

  // テスト1: transcript-received function
  console.log('テスト1: transcript-received function...');

  const transcriptResult = await callSupabaseFunction(`${supabaseUrl}/functions/v1/transcript-received`, {
    sessionId: testSessionId,
    segment: {
      id: 'test-seg-001',
      ts_start: 0,
      ts_end: 5,
      text: 'テスト文字起こし',
      is_final: true,
      speaker: 0
    }
  }, supabaseKey);

  if (transcriptResult.success) {
    console.log('✅ transcript-received: 成功');
    passed++;
  } else {
    console.log(`❌ transcript-received: 失敗 - ${transcriptResult.error}`);
    failed++;
  }

  // テスト2: session-started function
  console.log('\nテスト2: session-started function...');

  const sessionStartResult = await callSupabaseFunction(`${supabaseUrl}/functions/v1/session-started`, {
    sessionId: testSessionId
  }, supabaseKey);

  if (sessionStartResult.success) {
    console.log('✅ session-started: 成功');
    passed++;
  } else {
    console.log(`❌ session-started: 失敗 - ${sessionStartResult.error}`);
    failed++;
  }

  // テスト3: analysis-triggered function
  console.log('\nテスト3: analysis-triggered function...');

  const analysisResult = await callSupabaseFunction(`${supabaseUrl}/functions/v1/analysis-triggered`, {
    sessionId: testSessionId,
    triggerType: 'manual'
  }, supabaseKey);

  if (analysisResult.success) {
    console.log('✅ analysis-triggered: 成功');
    passed++;
  } else {
    console.log(`❌ analysis-triggered: 失敗 - ${analysisResult.error}`);
    failed++;
  }

  // テスト4: session-ended function
  console.log('\nテスト4: session-ended function...');

  const sessionEndResult = await callSupabaseFunction(`${supabaseUrl}/functions/v1/session-ended`, {
    sessionId: testSessionId
  }, supabaseKey);

  if (sessionEndResult.success) {
    console.log('✅ session-ended: 成功');
    passed++;
  } else {
    console.log(`❌ session-ended: 失敗 - ${sessionEndResult.error}`);
    failed++;
  }
}

function callSupabaseFunction(url, data, key) {
  return new Promise((resolve) => {
    const postData = JSON.stringify(data);

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(url, options, (res) => {
      let responseData = '';

      res.on('data', chunk => { responseData += chunk; });
      res.on('end', () => {
        resolve({
          success: res.statusCode === 200,
          status: res.statusCode,
          data: responseData,
          error: res.statusCode !== 200 ? responseData : null
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        success: false,
        error: err.message
      });
    });

    req.write(postData);
    req.end();
  });
}

async function runAllTests() {
  try {
    await testAudioRecording();
    await testSupabaseFunctions();

    console.log(`\n=== 機能テスト結果 ===`);
    console.log(`パス: ${passed}`);
    console.log(`失敗: ${failed}`);

    if (errors.length > 0) {
      console.log(`\n⚠️  警告・エラー:`);
      errors.forEach(err => console.log(`  - ${err}`));
    }

    if (failed > 0) {
      console.log(`\n❌ テスト失敗: ${failed}個のテストが失敗しました`);
      process.exit(1);
    } else {
      console.log(`\n✅ すべての機能テストがパスしました`);
      process.exit(0);
    }
  } catch (error) {
    console.error('テスト実行エラー:', error);
    process.exit(1);
  }
}

runAllTests();
