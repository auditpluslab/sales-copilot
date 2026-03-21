from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    # ホームページに移動
    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle')

    # スクリーンショットを撮影
    page.screenshot(path='/tmp/homepage.png', full_page=True)
    print("Screenshot saved to /tmp/homepage.png")

    # ページタイトルを確認
    title = page.locator('h1').text_content()
    print(f"Page title: {title}")

    # 機能カードを確認
    features = page.locator('[class*="Card"]').all()
    print(f"Found {len(features)} feature cards")

    # 新しいセッションページへ移動
    page.click('a:has-text("新しいセッション")')
    page.wait_for_load_state('networkidle')

    # セッション作成ページのスクリーンショット
    page.screenshot(path='/tmp/session_new.png', full_page=True)
    print("Screenshot saved to /tmp/session_new.png")

    # フォーム要素を確認
    client_name = page.locator('input[name="client_name"], #client_name')
    meeting_title = page.locator('input[name="meeting_title"], #meeting_title')

    print(f"Client name input visible: {client_name.is_visible()}")
    print(f"Meeting title input visible: {meeting_title.is_visible()}")

    browser.close()
    print("Test completed successfully!")
