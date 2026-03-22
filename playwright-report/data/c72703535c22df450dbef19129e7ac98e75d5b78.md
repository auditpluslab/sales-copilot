# Page snapshot

```yaml
- generic [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - heading "新しいセッション" [level=3] [ref=e6]
        - paragraph [ref=e7]: 会議情報を入力してセッションを開始します
      - generic [ref=e9]:
        - generic [ref=e10]:
          - text: 顧客担当者名
          - textbox "顧客担当者名" [ref=e11]:
            - /placeholder: 山田 太郎
            - text: クライアントA
        - generic [ref=e12]:
          - text: 顧客会社名
          - textbox "顧客会社名" [active] [ref=e13]:
            - /placeholder: 株式会社サンプル
        - generic [ref=e14]:
          - text: 会議タイトル
          - textbox "会議タイトル" [ref=e15]:
            - /placeholder: DX推進プロジェクトキックオフ
            - text: 1回目の会議
        - generic [ref=e16]:
          - text: 会議日時
          - textbox "会議日時" [ref=e17]: 2026-03-22T04:49
        - generic [ref=e18]:
          - text: メモ（任意）
          - textbox "メモ（任意）" [ref=e19]:
            - /placeholder: 事前情報や注意事項など
        - generic [ref=e20]:
          - button "キャンセル" [ref=e21] [cursor=pointer]
          - button "セッション開始" [ref=e22] [cursor=pointer]
  - region "Notifications (F8)":
    - list
  - button "Open Next.js Dev Tools" [ref=e28] [cursor=pointer]:
    - img [ref=e29]
  - alert [ref=e32]
```