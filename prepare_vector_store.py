# prepare_vector_store.py
import os
import sys
import glob
from pdf_utils import extract_text_from_pdf
from chunk_utils import split_text
from rag import RAG

UPLOAD_DIR = "upload"

def main() -> None:
    """
    Main script execution path to scan upload folder, chunk all PDFs, 
    and ingest them to Qdrant.
    """
    # 1. ตรวจสอบและสร้างโฟลเดอร์ upload
    if not os.path.exists(UPLOAD_DIR):
        os.makedirs(UPLOAD_DIR)
        print(f"📁 สร้างโฟลเดอร์ '{UPLOAD_DIR}/' เรียบร้อยแล้ว กรุณานำไฟล์ PDF มาวางและรันใหม่อีกครั้ง")
        return

    # ค้นหาไฟล์ PDF ทั้งหมดในโฟลเดอร์ upload
    pdf_files = glob.glob(os.path.join(UPLOAD_DIR, "*.pdf"))

    if not pdf_files:
        print(f"❌ Error: ไม่พบไฟล์ PDF ใด ๆ ในโฟลเดอร์ '{UPLOAD_DIR}/'")
        print("กรุณานำไฟล์ PDF ที่ต้องการมาใส่ไว้ในโฟลเดอร์นี้และลองรันอีกครั้ง")
        return

    print(f"📚 พบไฟล์ PDF ทั้งหมด {len(pdf_files)} ไฟล์สำหรับทำ RAG:")
    for pdf in pdf_files:
        print(f"  - {os.path.basename(pdf)}")

    # 2. ทำการเชื่อมต่อ RAG Controller
    try:
        rag = RAG()
    except Exception as e:
        print(f"❌ ไม่สามารถเชื่อมต่อกับ Qdrant DB ได้: {e}")
        return

    # 3. ตรวจสอบ Option ล้างฐานข้อมูลเก่า (ถ้าพิมพ์คำสั่งมี --clear หรือ -c)
    if "--clear" in sys.argv or "-c" in sys.argv:
        print("\n🧹 กำลังเคลียร์ฐานข้อมูลคอลเลกชันเดิมตามคำสั่ง...")
        try:
            rag.clear_db()
        except Exception as e:
            print(f"❌ เกิดข้อผิดพลาดในการล้างคอลเลกชัน: {e}")
            return

    # 4. ประมวลผลและนำเข้าไฟล์ทีละไฟล์
    print("\n⚡ เริ่มต้นนำเข้าข้อมูล...")
    for pdf_path in pdf_files:
        filename = os.path.basename(pdf_path)
        print(f"\n📖 [1/3] กำลังแกะข้อความจากไฟล์: {filename} ...")
        
        try:
            text = extract_text_from_pdf(pdf_path)
            if not text.strip():
                print(f"⚠️ คำเตือน: ไฟล์ {filename} ไม่มีข้อความที่แกะได้ ข้ามไฟล์นี้...")
                continue
            print(f"  ดึงข้อความสำเร็จ! (ความยาว {len(text)} ตัวอักษร)")
        except Exception as e:
            print(f"❌ ข้ามไฟล์ {filename} เนื่องจากเกิดข้อผิดพลาดในการแกะ PDF: {e}")
            continue

        print(f"✂️ [2/3] กำลังแบ่งข้อความเป็นท่อนย่อย (Chunking)...")
        chunks = split_text(text, chunk_size=500, chunk_overlap=50)
        print(f"  แบ่งข้อความได้ {len(chunks)} ชิ้น")

        print(f"💾 [3/3] กำลังแปลงเป็น Vector และบันทึกลง Qdrant...")
        # ใช้ชื่อไฟล์เป็น category (เช่น 2607.06565v1.pdf) เพื่อเป็นแหล่งอ้างอิงให้คำตอบ
        category = filename
        
        success_count = 0
        for i, chunk in enumerate(chunks):
            try:
                rag.ingest_chunk(chunk, category=category)
                success_count += 1
                if success_count % 20 == 0 or success_count == len(chunks):
                    print(f"  บันทึกเวกเตอร์สำเร็จ: {success_count}/{len(chunks)} ชิ้น")
            except Exception as e:
                print(f"❌ ข้อผิดพลาดในการบันทึกชิ้นที่ {i+1}: {e}")
                break

    print("\n🎉 ดำเนินการนำเข้าข้อมูล RAG เสร็จสมบูรณ์แล้ว!")

if __name__ == "__main__":
    main()
