# pdf_utils.py
import fitz  # PyMuPDF

def extract_text_from_pdf(pdf_path: str) -> str:
    """
    Extracts text content from all pages of the specified PDF file using PyMuPDF.
    Provides significantly faster and more accurate Thai text extraction.
    """
    try:
        doc = fitz.open(pdf_path)
        text_content = []
        for page in doc:
            page_text = page.get_text()
            if page_text:
                text_content.append(page_text)
        doc.close()
        return "\n".join(text_content)
    except Exception as e:
        raise RuntimeError(f"Error reading PDF file at {pdf_path} using PyMuPDF: {e}")

def extract_pages_from_pdf(pdf_path: str) -> list:
    """
    Extracts text page-by-page along with the 1-based page number.
    Returns a list of dicts: [{"page_num": int, "text": str}]
    """
    try:
        doc = fitz.open(pdf_path)
        pages_data = []
        for page in doc:
            page_text = page.get_text()
            if page_text.strip():
                pages_data.append({
                    "page_num": page.number + 1,
                    "text": page_text
                })
        doc.close()
        return pages_data
    except Exception as e:
        raise RuntimeError(f"Error reading PDF pages at {pdf_path} using PyMuPDF: {e}")
