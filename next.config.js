/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack設定
  turbopack: {},

  // サーバーサイドで外部パッケージとして扱う
  serverExternalPackages: ['@xenova/transformers'],
}

module.exports = nextConfig
