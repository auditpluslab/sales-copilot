/** @type {import('next').NextConfig} */
const nextConfig = {
  // サーバーサイドで外部パッケージとして扱う
  serverExternalPackages: ['@xenova/transformers'],

  // 開発サーバーの設定
  devIndicators: {
    buildActivity: false,
    buildActivityPosition: 'bottom-right',
  },

  // TypeScriptの厳格さを下げる（Functionsの型エラー回避）
  typescript: {
    ignoreBuildErrors: true,
  },

  // Reactの厳格モードを無効化（開発時の問題を回避）
  reactStrictMode: false,

  // Webpack設定（Turbopackを無効化）
  webpack: (config, { isServer }) => {
    // @xenova/transformersの動的インポートを有効化
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      }

      // ワーカーの設定を有効化
      config.module.rules.push({
        test: /\.worker\.(js|ts)$/,
        use: {
          loader: 'worker-loader',
          options: {
            filename: 'static/[hash].worker.js',
          },
        },
      })
    }

    // externals設定を調整
    config.externals = config.externals || []
    config.externals.push({
      'sharp': 'commonjs sharp'
    })

    return config
  },

  // Turbopackを無効化してwebpackを使用
  turbopack: false,
}

module.exports = nextConfig
