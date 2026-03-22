# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - heading "会議" [level=1] [ref=e5]
        - paragraph
      - generic [ref=e6]:
        - generic [ref=e7]: 未接続
        - button "会議開始" [ref=e8] [cursor=pointer]
    - generic [ref=e9]:
      - generic [ref=e10]:
        - heading "文字起こし" [level=2] [ref=e12]
        - paragraph [ref=e16]: 会議を開始すると文字起こしが表示されます
      - generic [ref=e18]:
        - tablist [ref=e20]:
          - tab "インサイト" [selected] [ref=e21] [cursor=pointer]
          - tab "提案" [ref=e22] [cursor=pointer]
        - tabpanel "インサイト" [ref=e23]:
          - generic [ref=e27]:
            - paragraph [ref=e28]: インサイトが生成されると表示されます
            - paragraph [ref=e29]: 会議開始から約2分後に自動生成されます
  - region "Notifications (F8)":
    - list
  - generic [ref=e34] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e35]:
      - img [ref=e36]
    - generic [ref=e39]:
      - button "Open issues overlay" [ref=e40]:
        - generic [ref=e41]:
          - generic [ref=e42]: "0"
          - generic [ref=e43]: "1"
        - generic [ref=e44]: Issue
      - button "Collapse issues badge" [ref=e45]:
        - img [ref=e46]
  - alert [ref=e48]
```