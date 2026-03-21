#!/bin/bash

# E2Eテスト実行シェルスクリプト
# GUIモードまたはCLIモードでPlaywrightテストを実行

set -e

# 色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  E2Eテスト実行ツール${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# コマンドライン引数の処理
MODE="${1:-gui}"
TEST_FILE="${2:-}"

# ヘルプメッセージ
show_help() {
    echo "使用方法:"
    echo "  ./scripts/run-e2e.sh [mode] [test_file]"
    echo ""
    echo "モード:"
    echo "  gui     Playwright UIモードで実行（デフォルト）"
    echo "  debug   デバッグモードで実行"
    echo "  head    ヘッドモードで実行（ブラウザ表示）"
    echo "  cli     CLIモードで実行（ヘッドレス）"
    echo ""
    echo "テストファイル（オプション）:"
    echo "  home.spec.ts"
    echo "  session.spec.ts"
    echo "  session-flow.spec.ts"
    echo "  meeting.spec.ts"
    echo "  meeting-flow.spec.ts"
    echo "  security.spec.ts"
    echo ""
    echo "例:"
    echo "  ./scripts/run-e2e.sh gui                    # UIモードで全テスト"
    echo "  ./scripts/run-e2e.sh gui session-flow.spec.ts # 特定ファイルのみ"
    echo "  ./scripts/run-e2e.sh debug                  # デバッグモード"
    echo ""
}

# ヘルプを表示
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    show_help
    exit 0
fi

# Playwrightがインストールされているか確認
if ! command -v npx &> /dev/null; then
    echo -e "${RED}エラー: npxが見つかりません${NC}"
    exit 1
fi

# 依存関係の確認
echo -e "${BLUE}[チェック]${NC} Playwrightのインストール状態を確認..."
if [ ! -d "node_modules/playwright" ]; then
    echo -e "${YELLOW}Playwrightをインストールします...${NC}"
    npx playwright install
fi
echo -e "${GREEN}✓${NC} Playwrightはインストールされています"
echo ""

# テストファイルの存在確認
if [ -n "$TEST_FILE" ]; then
    if [ ! -f "e2e/$TEST_FILE" ]; then
        echo -e "${RED}エラー: テストファイルが見つかりません: e2e/$TEST_FILE${NC}"
        exit 1
    fi
fi

# 実行モードによる分岐
case $MODE in
    gui)
        if [ -n "$TEST_FILE" ]; then
            echo -e "${GREEN}起動: UIモード ($TEST_FILE)${NC}"
            npx playwright test "$TEST_FILE" --ui
        else
            echo -e "${GREEN}起動: UIモード（全テスト）${NC}"
            npx playwright test --ui
        fi
        ;;
    debug)
        if [ -n "$TEST_FILE" ]; then
            echo -e "${GREEN}起動: デバッグモード ($TEST_FILE)${NC}"
            npx playwright test "$TEST_FILE" --debug
        else
            echo -e "${GREEN}起動: デバッグモード（全テスト）${NC}"
            npx playwright test --debug
        fi
        ;;
    head)
        if [ -n "$TEST_FILE" ]; then
            echo -e "${GREEN}起動: ヘッドモード ($TEST_FILE)${NC}"
            npx playwright test "$TEST_FILE" --headed
        else
            echo -e "${GREEN}起動: ヘッドモード（全テスト）${NC}"
            npx playwright test --headed
        fi
        ;;
    cli)
        if [ -n "$TEST_FILE" ]; then
            echo -e "${GREEN}起動: CLIモード ($TEST_FILE)${NC}"
            npx playwright test "$TEST_FILE"
        else
            echo -e "${GREEN}起動: CLIモード（全テスト）${NC}"
            npx playwright test
        fi

        # レポートを生成
        if [ -f "playwright-report/index.html" ]; then
            echo ""
            echo -e "${BLUE}レポート: ${NC}file://$(pwd)/playwright-report/index.html"
            echo -e "${BLUE}コマンド: ${NC}npx playwright show-report"
        fi
        ;;
    *)
        echo -e "${RED}エラー: 無効なモード '$MODE'${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}完了！${NC}"
