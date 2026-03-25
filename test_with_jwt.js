const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rustzicvyquandgurisd.supabase.co';
const anonKey = 'sb_publishable_rq1z3MVn_ayJUmlSgWdNLA_q4X1z-5h';

console.log('=== Supabase Edge Functionsのテスト（JWT生成）===\n');

// Supabaseクライアントを作成してJWTを取得
const supabase = createClient(supabaseUrl, anonKey);

async function getAccessToken() {
  // 匿名ユーザーとしてサインイン
  const { data, error } = await supabase.auth.signInAnonymously();

  if (error) {
    console.error('サインインエラー:', error);
    return null;
  }

  return data.session.access_token;
}

async function testFunction(functionName, payload, accessToken) {
  return new Promise((resolve) => {
    const url = `${supabaseUrl}/functions/v1/${functionName}`;
    const postData = JSON.stringify(payload);

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log(`\nテスト: ${functionName}`);

    const req = https.request(url, options, (res) => {
      let responseData = '';

      res.on('data', chunk => { responseData += chunk; });
      res.on('end', () => {
        const success = res.statusCode === 200 || res.statusCode === 201;

        if (success) {
          console.log(`✅ ${functionName}: 成功 (ステータス ${res.statusCode})`);
        } else {
          console.log(`❌ ${functionName}: 失敗 (ステータス ${res.statusCode})`);
          console.log(`   エラー: ${responseData}`);
        }

        resolve({
          success,
          status: res.statusCode,
          data: responseData,
          error: !success ? responseData : null
        });
      });
    });

    req.on('error', (err) => {
      console.log(`❌ ${functionName}: ネットワークエラー - ${err.message}`);
      resolve({
        success: false,
        error: err.message
      });
    });

    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('JWTトークンを取得中...');

  const accessToken = await getAccessToken();

  if (!accessToken) {
    console.error('JWTトークンの取得に失敗しました');
    process.exit(1);
  }

  console.log('JWTトークンを取得しました');

  const tests = [
    {
      name: 'transcript-received',
      payload: {
        sessionId: '00000000-0000-0000-0000-000000000001',
        segment: {
          id: 'test-seg-001',
          ts_start: 0,
          ts_end: 5,
          text: 'テスト文字起こし',
          is_final: true,
          speaker: 0
        }
      }
    },
    {
      name: 'session-started',
      payload: {
        sessionId: '00000000-0000-0000-0000-000000000001'
      }
    },
    {
      name: 'analysis-triggered',
      payload: {
        sessionId: '00000000-0000-0000-0000-000000000001',
        triggerType: 'manual'
      }
    },
    {
      name: 'session-ended',
      payload: {
        sessionId: '00000000-0000-0000-0000-000000000001'
      }
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result = await testFunction(test.name, test.payload, accessToken);

    if (result.success) {
      passed++;
    } else {
      failed++;
    }

    // レート制限を避けるため少し待つ
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n=== テスト結果 ===`);
  console.log(`パス: ${passed}/${tests.length}`);
  console.log(`失敗: ${failed}/${tests.length}`);

  if (failed > 0) {
    console.log(`\n❌ 一部のFunctionsが動作していません`);
    process.exit(1);
  } else {
    console.log(`\n✅ すべてのFunctionsが正常に動作しています`);
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('エラー:', err);
  process.exit(1);
});
