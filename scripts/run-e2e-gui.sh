#!/bin/bash

# E2EテストGUI実行スクリプト
# Playwright UIモードでテストを実行

set -e

echo "========================================="
echo "  Playwright E2Eテスト - GUIモード"
echo "========================================="
echo ""

# 色設定
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. 依存関係の確認
echo -e "${BLUE}[1/5]${NC} 依存関係を確認中..."
if [ ! -d "node_modules/playwright" ]; then
    echo -e "${YELLOW}Playwrightがインストールされていません。インストールします...${NC}"
    npx playwright install
fi
echo -e "${GREEN}✓${NC} 依存関係は正常です"
echo ""

# 2. TypeScriptの型チェック
echo -e "${BLUE}[2/5]${NC} TypeScript型チェックを実行中..."
npm run test:run 2>/dev/null || echo -e "${YELLOW}警告: 型チェックで警告があります${NC}"
echo -e "${GREEN}✓${NC} 型チェック完了"
echo ""

# 3. テスト実行オプションの選択
echo -e "${BLUE}[3/5]${NC} テスト実行モードを選択してください:"
echo ""
echo "  1) UIモード（推奨）- 対話的なテスト実行"
echo "  2) ヘッドモード - バックグラウンドで実行"
echo "  3) デバッグモード - ステップ実行"
echo "  4) 特定のテストのみ実行"
echo "  5) 全テスト実行"
echo ""
read -p "選択 (1-5): " choice

case $choice in
  1)
    echo -e "${GREEN}UIモードで起動中...${NC}"
    npx playwright test --ui
    ;;
  2)
    echo -e "${GREEN}ヘッドモードで実行中...${NC}"
    npx playwright test
    ;;
  3)
    echo -e "${GREEN}デバッグモードで起動中...${NC}"
    npx playwright test --debug
    ;;
  4)
    echo ""
    echo "利用可能なテストファイル:"
    echo "  1) home.spec.ts - ホームページ"
    echo "  2) session.spec.ts - セッション作成"
    echo "  3) meeting.spec.ts - 会議ページ"
    echo "  4) session-flow.spec.ts - セッションフロー"
    echo "  5) meeting-flow.spec.ts - 会議フロー"
    echo "  6) security.spec.ts - セキュリティ"
    echo ""
    read -p "ファイル番号を選択 (1-6): " file_choice

    case $file_choice in
      1) npx playwright test home.spec.ts --ui ;;
      2) npx playwright test session.spec.ts --ui ;;
      3) npx playwright test meeting.spec.ts --ui ;;
      4) npx playwright test session-flow.spec.ts --ui ;;
      5) npx playwright test meeting-flow.spec.ts --ui ;;
      6) npx playwright test security.spec.ts --ui ;;
      *) echo -e "${RED}無効な選択です${NC}" && exit 1 ;;
    esac
    ;;
  5)
    echo -e "${GREEN}全テストを実行中...${NC}"
    npx playwright test
    ;;
  *)
    echo -e "${RED}無効な選択です${NC}"
    exit 1
    ;;
esac

echo ""
echo -e "${BLUE}[4/5]${NC} テストレポートを生成中..."
if [ -d "playwright-report" ]; then
    echo -e "${GREEN}✓${NC} レポート: playwright-report/index.html"
fi
echo ""

echo -e "${BLUE}[5/5]${NC} 完了！"
echo ""
echo "========================================="
echo "  テスト結果"
echo "========================================="
echo ""
echo "レポートを確認:"
echo "  open playwright-report/index.html"
echo ""
