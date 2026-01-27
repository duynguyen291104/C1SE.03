"""
Demo sử dụng AI Local - KHÔNG CẦN OPENAI
Sử dụng Ollama cho LLM và sentence-transformers cho embeddings
"""
import os
import sys
import json
from pathlib import Path
from typing import List, Dict
from loguru import logger
import requests

# Sentence transformers cho embeddings
from sentence_transformers import SentenceTransformer
import numpy as np
import faiss

from src.models import (
    Document, DocumentPage, DocumentMetadata, Chunk, 
    GlobalConfig, CognitiveRatios, DifficultyRatios
)


def create_sample_content() -> str:
    """Tạo nội dung mẫu về Toán 9"""
    logger.info("📄 Tạo document mẫu...")
    return """
CHƯƠNG 1: HỆ PHƯƠNG TRÌNH BẬC NHẤT HAI ẨN

I. MỤC TIÊU
- Học sinh biết khái niệm phương trình bậc nhất hai ẩn, hệ phương trình bậc nhất hai ẩn
- Học sinh biết cách giải hệ phương trình bằng phương pháp thế và phương pháp cộng đại số
- Vận dụng giải bài toán thực tế

II. NỘI DUNG

1. Phương trình bậc nhất hai ẩn
- Dạng tổng quát: ax + by = c
- Nghiệm của phương trình
- Tập nghiệm

2. Hệ phương trình bậc nhất hai ẩn
- Hệ có nghiệm duy nhất
- Hệ vô nghiệm
- Hệ vô số nghiệm

3. Phương pháp giải
- Phương pháp thế
- Phương pháp cộng đại số
- Phương pháp đồ thị

CHƯƠNG 2: HÀM SỐ BẬC NHẤT

I. Khái niệm
- Hàm số y = ax + b (a ≠ 0)
- Tính chất đồng biến, nghịch biến

II. Đồ thị hàm số bậc nhất
- Đồ thị là đường thẳng
- Vẽ đồ thị
- Vị trí tương đối của hai đường thẳng
"""


def chunk_text(text: str, chunk_size: int = 500) -> List[Chunk]:
    """Chia văn bản thành chunks"""
    chunks = []
    lines = text.strip().split('\n')
    current_chunk = ""
    current_section = ""
    chunk_id = 0
    char_pos = 0
    
    for line in lines:
        if line.startswith("CHƯƠNG"):
            current_section = line
        
        if len(current_chunk) + len(line) > chunk_size and current_chunk:
            chunk_text_val = current_chunk.strip()
            chunks.append(Chunk(
                chunk_id=f"c{chunk_id:03d}",
                page=1,
                section=current_section,
                text=chunk_text_val,
                char_start=char_pos,
                char_end=char_pos + len(chunk_text_val)
            ))
            char_pos += len(chunk_text_val)
            chunk_id += 1
            current_chunk = line + "\n"
        else:
            current_chunk += line + "\n"
    
    if current_chunk.strip():
        chunk_text_val = current_chunk.strip()
        chunks.append(Chunk(
            chunk_id=f"c{chunk_id:03d}",
            page=1,
            section=current_section,
            text=chunk_text_val,
            char_start=char_pos,
            char_end=char_pos + len(chunk_text_val)
        ))
    
    logger.info(f"✅ Created {len(chunks)} chunks")
    return chunks


class LocalEmbeddings:
    """Embeddings sử dụng sentence-transformers (local)"""
    
    def __init__(self, model_name: str = "paraphrase-multilingual-MiniLM-L12-v2"):
        logger.info(f"🔧 Loading embedding model: {model_name}")
        self.model = SentenceTransformer(model_name)
        logger.info(f"✅ Model loaded")
    
    def encode(self, texts: List[str]) -> np.ndarray:
        """Tạo embeddings cho danh sách text"""
        return self.model.encode(texts, show_progress_bar=True)


class LocalRAG:
    """RAG sử dụng FAISS và local embeddings"""
    
    def __init__(self):
        self.embedder = LocalEmbeddings()
        self.index = None
        self.chunks = []
    
    def build_index(self, chunks: List[Chunk]):
        """Build FAISS index từ chunks"""
        logger.info(f"🔍 Building RAG index for {len(chunks)} chunks...")
        self.chunks = chunks
        
        # Tạo embeddings
        texts = [c.text for c in chunks]
        embeddings = self.embedder.encode(texts)
        
        # Build FAISS index
        dimension = embeddings.shape[1]
        self.index = faiss.IndexFlatL2(dimension)
        self.index.add(embeddings.astype('float32'))
        
        logger.info(f"✅ RAG index built with {self.index.ntotal} vectors")
    
    def search(self, query: str, top_k: int = 3) -> List[Chunk]:
        """Tìm kiếm chunks liên quan"""
        if self.index is None:
            return []
        
        # Embed query
        query_embedding = self.embedder.encode([query])
        
        # Search
        distances, indices = self.index.search(query_embedding.astype('float32'), top_k)
        
        results = []
        for idx in indices[0]:
            if 0 <= idx < len(self.chunks):
                results.append(self.chunks[idx])
        
        return results


class OllamaLLM:
    """LLM sử dụng Ollama (local)"""
    
    def __init__(self, model: str = "qwen2.5:3b", base_url: str = "http://localhost:11434"):
        self.model = model
        self.base_url = base_url
        logger.info(f"🤖 Using Ollama model: {model}")
    
    def generate(self, prompt: str, system: str = "") -> str:
        """Generate text từ prompt"""
        url = f"{self.base_url}/api/generate"
        
        payload = {
            "model": self.model,
            "prompt": prompt,
            "system": system,
            "stream": False
        }
        
        try:
            response = requests.post(url, json=payload, timeout=120)
            response.raise_for_status()
            return response.json()['response']
        except Exception as e:
            logger.error(f"❌ Ollama error: {e}")
            return ""


def generate_exam_local(rag: LocalRAG, llm: OllamaLLM, config: GlobalConfig):
    """Sinh đề kiểm tra sử dụng AI local"""
    
    logger.info("\n" + "="*80)
    logger.info("🎯 BƯỚC 1: SINH MA TRẬN ĐỀ")
    logger.info("="*80)
    
    # Search context
    context_chunks = rag.search("ma trận đề kiểm tra toán 9 hệ phương trình", top_k=3)
    context = "\n\n".join([c.text for c in context_chunks])
    
    matrix_prompt = f"""Dựa vào tài liệu sau, hãy tạo ma trận đề kiểm tra Toán 9:

TÀI LIỆU:
{context}

YÊU CẦU:
- Thời gian: {config.time_minutes} phút
- Tổng điểm: {config.total_points}
- Tỉ lệ trắc nghiệm: {config.mcq_ratio*100}%
- Tỉ lệ tự luận: {config.essay_ratio*100}%

Hãy tạo bảng ma trận chi tiết với các cột:
- Nội dung kiến thức
- Mức độ (Biết, Hiểu, Vận dụng, Vận dụng cao)
- Số câu
- Số điểm

Chỉ trả về bảng ma trận, không giải thích."""

    matrix = llm.generate(matrix_prompt, system="Bạn là chuyên gia giáo dục, tạo ma trận đề thi chính xác.")
    logger.info(f"\n{matrix}\n")
    
    logger.info("\n" + "="*80)
    logger.info("📝 BƯỚC 2: SINH CÂU HỎI TRẮC NGHIỆM")
    logger.info("="*80)
    
    mcq_context = rag.search("hệ phương trình bậc nhất phương pháp thế", top_k=2)
    mcq_ctx = "\n\n".join([c.text for c in mcq_context])
    
    mcq_prompt = f"""Dựa vào tài liệu:

{mcq_ctx}

Hãy tạo 3 câu hỏi trắc nghiệm về hệ phương trình bậc nhất hai ẩn.

Mỗi câu gồm:
- Đề bài
- 4 đáp án A, B, C, D
- Đáp án đúng
- Giải thích ngắn

Format:
Câu 1: [đề bài]
A. [đáp án A]
B. [đáp án B]
C. [đáp án C]
D. [đáp án D]
Đáp án: [A/B/C/D]
Giải thích: [lý do]
"""
    
    mcq_questions = llm.generate(mcq_prompt, system="Tạo câu hỏi trắc nghiệm chất lượng cao.")
    logger.info(f"\n{mcq_questions}\n")
    
    logger.info("\n" + "="*80)
    logger.info("✍️ BƯỚC 3: SINH CÂU HỎI TỰ LUẬN")
    logger.info("="*80)
    
    essay_context = rag.search("vận dụng giải bài toán thực tế hệ phương trình", top_k=2)
    essay_ctx = "\n\n".join([c.text for c in essay_context])
    
    essay_prompt = f"""Dựa vào tài liệu:

{essay_ctx}

Hãy tạo 1 bài toán thực tế về hệ phương trình bậc nhất hai ẩn.

Yêu cầu:
- Đề bài gắn liền thực tế
- Hướng dẫn giải chi tiết
- Đáp số rõ ràng

Format:
Bài toán: [đề bài]
Hướng dẫn giải:
[các bước giải]
Đáp số: [kết quả]
"""
    
    essay_question = llm.generate(essay_prompt, system="Tạo bài toán thực tế hay và phù hợp.")
    logger.info(f"\n{essay_question}\n")
    
    logger.info("\n" + "="*80)
    logger.info("✅ HOÀN THÀNH!")
    logger.info("="*80)


def main():
    """Main function"""
    try:
        logger.info("="*80)
        logger.info("🎯 DEMO HỆ THỐNG AI LOCAL - KHÔNG CẦN OPENAI")
        logger.info("="*80)
        
        # 1. Tạo nội dung mẫu
        content = create_sample_content()
        logger.info(f"✓ Tạo nội dung mẫu")
        
        # 2. Chunking
        logger.info("\n📦 Chunking...")
        chunks = chunk_text(content, chunk_size=500)
        logger.info(f"✓ Tạo {len(chunks)} chunks")
        
        # 3. Build RAG index
        logger.info("\n🔍 Build RAG index với embeddings local...")
        rag = LocalRAG()
        rag.build_index(chunks)
        
        # 4. Initialize Ollama LLM
        logger.info("\n🤖 Initialize Ollama LLM...")
        llm = OllamaLLM(model="qwen2.5:3b")
        
        # 5. Config đề thi
        config = GlobalConfig(
            time_minutes=45,
            total_points=10.0,
            mcq_ratio=0.6,
            essay_ratio=0.4
        )
        
        # 6. Generate exam
        logger.info("\n🎓 Bắt đầu sinh đề kiểm tra...")
        generate_exam_local(rag, llm, config)
        
        logger.info("\n✅ DEMO HOÀN THÀNH!")
        logger.info("💡 Hệ thống đã sử dụng AI local hoàn toàn, không cần OpenAI API!")
        
    except Exception as e:
        logger.error(f"❌ Lỗi: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
