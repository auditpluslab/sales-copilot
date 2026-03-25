import sys
import modal

def main():
    print("=" * 60)
    print("🚀 クラウド上の無検閲AIに接続しています...")
    
    # 【修正箇所】lookup ではなく最新の from_name を使用します
    QwenModel = modal.Cls.from_name("qwen-27b-uncensored-native-gpu", "QwenModel")
    model = QwenModel()

    print("✅ 接続完了！ (終了するには 'exit' または 'quit' と入力)")
    print("=" * 60 + "\n")

    while True:
        try:
            user_input = input("あなた: ")
            if user_input.strip().lower() in ['exit', 'quit']:
                print("\n終了します。お疲れ様でした！")
                break
            if not user_input.strip():
                continue

            print("AI: ", end="", flush=True)
            
            for chunk in model.generate.remote_gen(user_input):
                sys.stdout.buffer.write(chunk.encode('utf-8'))
                sys.stdout.buffer.flush()
                
            print("\n\n" + "-" * 60 + "\n")

        except KeyboardInterrupt:
            print("\n強制終了します。")
            break

if __name__ == "__main__":
    main()
