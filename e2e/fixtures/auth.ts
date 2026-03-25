import { test as base, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// 認証付きテストのフィクスチャ
// グローバルセットアップで認証済みのストレージステートを使用するため、
// ここでは単純に標準のtestとexpectを再エクスポートする

export const test = base.extend<{
  page: Page
}>({
  page: async ({ page }, use) => {
    // Next.js DevToolsによるエラーを防ぐ
    await page.addInitScript(() => {
      // DevToolsオーバーレイを非表示にする
      const style = document.createElement('style')
      style.textContent = `
        nextjs-portal,
        [data-nextjs-overlay],
        [data-nextjs-error-overlay],
        [data-nextjs-dev-tools],
        .nextjs-overlay,
        .nextjs-error-overlay {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `
      document.head.appendChild(style)

      // DevToolsの初期化をブロックしてエラーを防ぐ
      const originalAppendChild = Node.prototype.appendChild
      Node.prototype.appendChild = function(child) {
        // DevTools関連の要素が追加されないように
        if (child && typeof child === 'object') {
          const element = child as Element
          if (element.tagName === 'NEXTJS-PORTAL' ||
              element.hasAttribute?.('data-nextjs-overlay') ||
              element.hasAttribute?.('data-nextjs-dev-tools')) {
            return child
          }
        }
        return originalAppendChild.call(this, child)
      }

      // appendChildエラーを無視
      window.addEventListener('error', (event) => {
        if (event.message?.includes('appendChild') ||
            event.message?.includes('DevTools') ||
            event.message?.includes('nextjs')) {
          event.stopPropagation()
          event.preventDefault()
        }
      }, true)
    })

    await use(page)
  },
})

export { expect }
export type { Page } from '@playwright/test'

