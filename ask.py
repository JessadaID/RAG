# ask.py
import sys
from rag import RAG

def ask_question(question: str) -> None:
    """
    Convenience CLI tool to run the local RAG asking function.
    """
    print(f"กำลังค้นหาคำตอบสำหรับคำถาม: '{question}'...")
    
    # Instantiate and ask
    rag = RAG()
    response = rag.ask(question)
    
    print("\n=== คำตอบ (Response) ===")
    print(response)
    print("========================\n")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("วิธีใช้งาน: python ask.py \"<คำถามของคุณ>\"")
        sys.exit(1)
        
    user_question = sys.argv[1]
    ask_question(user_question)
