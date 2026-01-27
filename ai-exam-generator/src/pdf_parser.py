"""
Module parse PDF và trích xuất text/OCR
"""
import pdfplumber
import fitz  # PyMuPDF
import pytesseract
import cv2
import numpy as np
from PIL import Image
from pathlib import Path
from typing import List, Optional, Tuple
from loguru import logger
import uuid
import re
import json

from .models import Document, DocumentPage, DocumentMetadata


class PDFParser:
    """Parser để đọc và trích xuất nội dung PDF"""
    
    def __init__(self, ocr_threshold: float = 0.3):
        """
        Args:
            ocr_threshold: Tỷ lệ text tối thiểu để coi là text-based PDF
        """
        self.ocr_threshold = ocr_threshold
    
    def parse(self, pdf_path: str) -> Document:
        """
        Parse PDF thành Document
        
        Args:
            pdf_path: Đường dẫn file PDF
            
        Returns:
            Document object
        """
        logger.info(f"📖 Parsing PDF: {pdf_path}")
        
        pdf_path_obj = Path(pdf_path)
        if not pdf_path_obj.exists():
            raise FileNotFoundError(f"File không tồn tại: {pdf_path}")
        
        # Extract metadata
        metadata = self._extract_metadata(pdf_path)
        
        # Extract pages
        pages = self._extract_pages(pdf_path)
        
        doc = Document(
            doc_id=str(uuid.uuid4()),
            file_name=pdf_path_obj.name,
            metadata=metadata,
            pages=pages
        )
        
        logger.info(f"✅ Parsed {len(pages)} pages")
        return doc
    
    def _extract_metadata(self, pdf_path: str) -> DocumentMetadata:
        """Trích xuất metadata từ PDF"""
        try:
            with pdfplumber.open(pdf_path) as pdf:
                info = pdf.metadata or {}
                
                # Cố gắng đoán subject/grade từ title/filename
                title = info.get('Title', '') or Path(pdf_path).stem
                subject, grade = self._infer_subject_grade(title)
                
                return DocumentMetadata(
                    subject=subject,
                    grade=grade,
                    author=info.get('Author')
                )
        except Exception as e:
            logger.warning(f"⚠️ Không extract được metadata: {e}")
            return DocumentMetadata()
    
    def _infer_subject_grade(self, text: str) -> Tuple[Optional[str], Optional[int]]:
        """Đoán môn học và khối từ text"""
        text_lower = text.lower()
        
        # Detect subject
        subject_map = {
            'toán': 'Toán',
            'math': 'Toán',
            'văn': 'Ngữ văn',
            'van': 'Ngữ văn',
            'literature': 'Ngữ văn',
            'anh': 'Tiếng Anh',
            'english': 'Tiếng Anh',
            'lý': 'Vật lý',
            'physics': 'Vật lý',
            'hóa': 'Hóa học',
            'chemistry': 'Hóa học',
            'sinh': 'Sinh học',
            'biology': 'Sinh học',
            'sử': 'Lịch sử',
            'history': 'Lịch sử',
            'địa': 'Địa lý',
            'geography': 'Địa lý'
        }
        
        subject = None
        for key, val in subject_map.items():
            if key in text_lower:
                subject = val
                break
        
        # Detect grade
        grade_match = re.search(r'(?:lớp|khối|grade)\s*(\d{1,2})', text_lower)
        grade = int(grade_match.group(1)) if grade_match else None
        
        return subject, grade
    
    def _extract_pages(self, pdf_path: str) -> List[DocumentPage]:
        """Trích xuất text từ tất cả các trang"""
        pages = []
        
        # Try text-based extraction first
        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages, start=1):
                text = page.extract_text() or ""
                tables = page.extract_tables() or []
                
                # Check if page needs OCR
                if len(text.strip()) < 50:  # Very little text
                    logger.info(f"   Page {i}: Text quá ít, thử OCR...")
                    text = self._ocr_page(pdf_path, i - 1)  # 0-indexed
                
                pages.append(DocumentPage(
                    page=i,
                    text=text,
                    tables=[{"data": t} for t in tables]
                ))
                
                logger.debug(f"   Page {i}: {len(text)} chars")
        
        return pages
    
    def _ocr_page(self, pdf_path: str, page_index: int) -> str:
        """OCR một trang PDF (nếu scan)"""
        try:
            # Render page to image using PyMuPDF
            doc = fitz.open(pdf_path)
            page = doc[page_index]
            
            # Render at 300 DPI for better OCR
            mat = fitz.Matrix(300/72, 300/72)
            pix = page.get_pixmap(matrix=mat)
            
            # Convert to PIL Image
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            
            # Convert to OpenCV format for preprocessing
            img_cv = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
            
            # Preprocess: grayscale + threshold
            gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
            _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            
            # OCR
            text = pytesseract.image_to_string(Image.fromarray(thresh), lang='vie+eng')
            
            doc.close()
            return text.strip()
            
        except Exception as e:
            logger.error(f"❌ OCR failed for page {page_index + 1}: {e}")
            return ""


class TextCleaner:
    """Làm sạch text sau khi parse"""
    
    @staticmethod
    def clean(text: str) -> str:
        """Chuẩn hóa text"""
        # Remove multiple newlines
        text = re.sub(r'\n{3,}', '\n\n', text)
        
        # Remove multiple spaces
        text = re.sub(r' {2,}', ' ', text)
        
        # Remove page numbers patterns
        text = re.sub(r'(?:^|\n)\s*(?:Trang|Page)\s+\d+\s*(?:\n|$)', '\n', text)
        
        # Remove header/footer repetitions (simple heuristic)
        lines = text.split('\n')
        if len(lines) > 10:
            # Remove first/last 2 lines if they look like headers
            if len(lines[0]) < 50 and len(lines[1]) < 50:
                lines = lines[2:]
            if len(lines[-1]) < 50 and len(lines[-2]) < 50:
                lines = lines[:-2]
        
        return '\n'.join(lines).strip()
