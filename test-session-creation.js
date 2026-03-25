// 簡単なセッション作成テスト
async function testSessionCreation() {
  try {
    // CSRFトークンを取得
    const csrfResponse = await fetch('http://localhost:3000/api/auth/csrf');
    console.log('CSRF Response Status:', csrfResponse.status);
    console.log('CSRF Response OK:', csrfResponse.ok);

    const csrfData = await csrfResponse.json();
    console.log('CSRF Data:', JSON.stringify(csrfData, null, 2));
    console.log('CSRF Token:', csrfData.csrf_token ? 'OK' : 'FAIL');

    if (!csrfData.csrf_token) {
      console.error('CSRF Token is missing');
      return;
    }

    // セッションを作成
    const response = await fetch('http://localhost:3000/api/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfData.csrf_token,
      },
      body: JSON.stringify({
        client_name: 'テストクライアント',
        client_company: 'テスト株式会社',
        meeting_title: 'テスト会議',
        meeting_date: new Date().toISOString(),
      }),
    });

    console.log('Response Status:', response.status);
    console.log('Response OK:', response.ok);

    if (response.ok) {
      const data = await response.json();
      console.log('Session Created:', data);
      console.log('Session ID:', data.session?.id);
    } else {
      const error = await response.json();
      console.error('Error:', error);
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testSessionCreation();
