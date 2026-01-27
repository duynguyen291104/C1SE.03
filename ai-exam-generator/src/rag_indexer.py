"""
Module chia text thành chunks và tạo RAG index
"""
import re
import uuid
from typing import List, Tuple
from loguru import logger
import numpy as np
import faiss
from openai import OpenAI
import pickle
from pathlib import Path

from .models import Document, Chunk, SourceTrace
from .config import get_config


class TextChunker:
    """Chia text thành chunks có ngữ nghĩa"""
    
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        """
        Args:
            chunk_size: Kích thước chunk (ký tự)
            chunk_overlap: Độ chồng lấn giữa các chunks
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
    
    def chunk_document(self, document: Document) -> List[Chunk]:
        """
        Chia document thành chunks
        
        Args:
            document: Document đã parse
            
        Returns:
            List of chunks
        """
        logger.info(f"📦 Chunking document: {document.file_name}")
        
        chunks = []
        
        for page in document.pages:
            # Detect sections (CHƯƠNG, BÀI, MỤC)
            sections = self._detect_sections(page.text)
            
            if sections:
                # Chunk theo sections
                for section_title, section_text in sections:
                    section_chunks = self._chunk_text(
                        section_text,
                        page.page,
                        section_title
                    )
                    chunks.extend(section_chunks)
            else:
                # Chunk theo sliding window
                page_chunks = self._chunk_text(
                    page.text,
                    page.page,
                    None
                )
                chunks.extend(page_chunks)
        
        logger.info(f"✅ Created {len(chunks)} chunks")
        return chunks
    
    def _detect_sections(self, text: str) -> List[Tuple[str, str]]:
        """
        Phát hiện các section (CHƯƠNG, BÀI, MỤC)
        
        Returns:
            List of (section_title, section_text)
        """
        sections = []
        
        # Pattern để tìm tiêu đề
        pattern = r'(?:^|\n)((?:CHƯƠNG|BÀI|MỤC|PHẦN)\s+[IVXLCDM\d]+[:\.]?\s*[^\n]+)'
        
        matches = list(re.finditer(pattern, text, re.IGNORECASE | re.MULTILINE))
        
        if not matches:
            return []
        
        for i, match in enumerate(matches):
            title = match.group(1).strip()
            start = match.end()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            content = text[start:end].strip()
            
            if content:
                sections.append((title, content))
        
        return sections
    
    def _chunk_text(
        self,
        text: str,
        page: int,
        section: str = None
    ) -> List[Chunk]:
        """Chia text thành chunks bằng sliding window"""
        chunks = []
        text_length = len(text)
        start = 0
        
        while start < text_length:
            end = start + self.chunk_size
            
            # Tìm điểm ngắt tự nhiên (dấu câu)
            if end < text_length:
                # Tìm dấu câu gần nhất
                for sep in ['\n\n', '.\n', '. ', '\n']:
                    last_sep = text.rfind(sep, start, end)
                    if last_sep != -1:
                        end = last_sep + len(sep)
                        break
            
            chunk_text = text[start:end].strip()
            
            if chunk_text:
                chunk = Chunk(
                    chunk_id=f"p{page}_c{len(chunks):03d}",
                    page=page,
                    section=section,
                    text=chunk_text,
                    char_start=start,
                    char_end=end
                )
                chunks.append(chunk)
            
            start = end - self.chunk_overlap
        
        return chunks


class RAGIndexer:
    """Tạo embedding và index cho RAG"""
    
    def __init__(self, client: OpenAI = None):
        """
        Args:
            client: OpenAI client (nếu không có sẽ tạo mới)
        """
        config = get_config()
        self.client = client or OpenAI()
        self.embedding_model = config.openai_embedding_model
        self.index = None
        self.chunks = []
    
    def build_index(self, chunks: List[Chunk]) -> None:
        """
        Tạo FAISS index từ chunks
        
        Args:
            chunks: List of chunks
        """
        logger.info(f"🔍 Building RAG index for {len(chunks)} chunks...")
        
        self.chunks = chunks
        
        # Get embeddings
        embeddings = self._get_embeddings([c.text for c in chunks])
        
        # Store embeddings in chunks
        for chunk, emb in zip(chunks, embeddings):
            chunk.embedding = emb
        
        # Build FAISS index
        embeddings_array = np.array(embeddings, dtype='float32')
        dimension = embeddings_array.shape[1]
        
        # Use L2 distance
        self.index = faiss.IndexFlatL2(dimension)
        self.index.add(embeddings_array)
        
        logger.info(f"✅ Index built with {self.index.ntotal} vectors")
    
    def search(self, query: str, top_k: int = 5) -> List[Chunk]:
        """
        Tìm kiếm chunks liên quan
        
        Args:
            query: Query text
            top_k: Số lượng chunks trả về
            
        Returns:
            List of relevant chunks
        """
        if not self.index:
            raise RuntimeError("Index chưa được build. Gọi build_index() trước.")
        
        # Get query embedding
        query_emb = self._get_embeddings([query])[0]
        query_vector = np.array([query_emb], dtype='float32')
        
        # Search
        distances, indices = self.index.search(query_vector, top_k)
        
        # Return chunks
        results = []
        for idx in indices[0]:
            if idx < len(self.chunks):
                results.append(self.chunks[idx])
        
        logger.debug(f"Found {len(results)} chunks for query: {query[:50]}...")
        return results
    
    def save(self, index_path: str, chunks_path: str):
        """Lưu index và chunks ra file"""
        # Save FAISS index
        faiss.write_index(self.index, index_path)
        
        # Save chunks (không lưu embedding để giảm dung lượng)
        chunks_data = [c.model_dump(exclude={'embedding'}) for c in self.chunks]
        with open(chunks_path, 'wb') as f:
            pickle.dump(chunks_data, f)
        
        logger.info(f"💾 Đã lưu index: {index_path}")
        logger.info(f"💾 Đã lưu chunks: {chunks_path}")
    
    def load(self, index_path: str, chunks_path: str):
        """Load index và chunks từ file"""
        # Load FAISS index
        self.index = faiss.read_index(index_path)
        
        # Load chunks
        with open(chunks_path, 'rb') as f:
            chunks_data = pickle.load(f)
        self.chunks = [Chunk(**c) for c in chunks_data]
        
        logger.info(f"📂 Đã load index: {index_path}")
        logger.info(f"📂 Đã load {len(self.chunks)} chunks")
    
    def _get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """
        Lấy embeddings từ OpenAI
        
        Args:
            texts: List of texts
            
        Returns:
            List of embedding vectors
        """
        try:
            response = self.client.embeddings.create(
                model=self.embedding_model,
                input=texts
            )
            return [item.embedding for item in response.data]
        except Exception as e:
            logger.error(f"❌ Error getting embeddings: {e}")
            raise
    
    def get_source_traces(self, chunks: List[Chunk]) -> List[SourceTrace]:
        """Tạo source traces từ chunks"""
        traces = []
        seen = set()
        
        for chunk in chunks:
            key = f"{chunk.chunk_id}_{chunk.page}"
            if key not in seen:
                traces.append(SourceTrace(
                    chunk_id=chunk.chunk_id,
                    page=chunk.page,
                    section=chunk.section
                ))
                seen.add(key)
        
        return traces
