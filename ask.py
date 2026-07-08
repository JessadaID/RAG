# ask.py
import sys
import asyncio
from rag import RAG

async def ask_question(question: str) -> None:
    """
    Convenience CLI tool to run the local RAG asking function with streaming.
    """
    print(f"กำลังค้นหาคำตอบสำหรับคำถาม: '{question}'...")
    
    # Instantiate and ask
    rag = RAG()
    
    print("\n=== คำตอบ (Response) ===")
    try:
        async for token in rag.ask_stream(question):
            print(token, end="", flush=True)
    except Exception as e:
        print(f"\n❌ เกิดข้อผิดพลาดในการดึงข้อมูล: {e}")
    print("\n========================\n")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("วิธีใช้งาน: python ask.py \"<คำถามของคุณ>\"")
        sys.exit(1)
        
    user_question = sys.argv[1]
    asyncio.run(ask_question(user_question))
