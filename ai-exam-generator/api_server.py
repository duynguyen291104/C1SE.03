"""
API Server cho AI Exam Generator - Tích hợp với Backend
Chạy riêng biệt với backend, expose REST API
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sys
from typing import List, Dict
from loguru import logger
import requests
from sentence_transformers import SentenceTransformer
import numpy as np
import faiss

from src.models import Chunk, GlobalConfig, CognitiveRatios, DifficultyRatios
from exam_pipeline import ExamPipeline

# Setup Flask
app = Flask(__name__)
CORS(app)  # Enable CORS cho frontend

# Global variables
embedder = None
rag_index = None
chunks_store = []
pipeline = None
ollama_base_url = "http://localhost:11434"
ollama_model = "qwen2.5:3b"


class LocalEmbeddings:
    """Embeddings sử dụng sentence-transformers (local)"""
    
    def __init__(self, model_name: str = "paraphrase-multilingual-MiniLM-L12-v2"):
        logger.info(f"🔧 Loading embedding model: {model_name}")
        self.model = SentenceTransformer(model_name)
        logger.info(f"✅ Model loaded")
    
    def encode(self, texts: List[str]) -> np.ndarray:
        """Tạo embeddings cho danh sách text"""
        return self.model.encode(texts, show_progress_bar=False)


def init_models():
    """Initialize AI models"""
    global embedder, rag_index, chunks_store, pipeline
    
    logger.info("🚀 Initializing AI models...")
    embedder = LocalEmbeddings()
    
    # Initialize pipeline
    pipeline = ExamPipeline(
        embedder=embedder.model,
        ollama_url=ollama_base_url,
        ollama_model=ollama_model
    )
    
    logger.info("✅ Models initialized")


def generate_with_ollama(prompt: str, system: str = "") -> str:
    """Generate text từ Ollama"""
    url = f"{ollama_base_url}/api/generate"
    
    payload = {
        "model": ollama_model,
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


def chunk_text(text: str, chunk_size: int = 500) -> List[Chunk]:
    """Chia văn bản thành chunks"""
    chunks = []
    lines = text.strip().split('\n')
    current_chunk = ""
    current_section = ""
    chunk_id = 0
    char_pos = 0
    
    for line in lines:
        if line.startswith("CHƯƠNG") or line.startswith("Chapter"):
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


def build_rag_index(chunks: List[Chunk]):
    """Build FAISS index từ chunks"""
    global rag_index, chunks_store
    
    logger.info(f"🔍 Building RAG index for {len(chunks)} chunks...")
    chunks_store = chunks
    
    # Tạo embeddings
    texts = [c.text for c in chunks]
    embeddings = embedder.encode(texts)
    
    # Build FAISS index
    dimension = embeddings.shape[1]
    rag_index = faiss.IndexFlatL2(dimension)
    rag_index.add(embeddings.astype('float32'))
    
    logger.info(f"✅ RAG index built with {rag_index.ntotal} vectors")


def search_rag(query: str, top_k: int = 3) -> List[Dict]:
    """Tìm kiếm chunks liên quan"""
    if rag_index is None or not chunks_store:
        return []
    
    # Embed query
    query_embedding = embedder.encode([query])
    
    # Search
    distances, indices = rag_index.search(query_embedding.astype('float32'), top_k)
    
    results = []
    for idx, dist in zip(indices[0], distances[0]):
        if 0 <= idx < len(chunks_store):
            chunk = chunks_store[idx]
            results.append({
                "chunk_id": chunk.chunk_id,
                "text": chunk.text,
                "section": chunk.section,
                "distance": float(dist)
            })
    
    return results


# ==================== API ENDPOINTS ====================

@app.route('/', methods=['GET'])
def index():
    """API Documentation - Root endpoint"""
    return jsonify({
        "name": "🎓 AI Exam Generator API",
        "version": "1.0.0",
        "description": "Generate exam questions from PDF documents using 100% local AI (Ollama + sentence-transformers)",
        "status": "running",
        "endpoints": {
            "GET /health": "Health check",
            "POST /upload-document": "Upload and chunk document",
            "POST /generate-blueprint": "Extract blueprint from document",
            "POST /generate-mcq": "Generate MCQ questions",
            "POST /generate-essay": "Generate essay questions",
            "POST /search": "RAG search in document",
            "POST /generate-exam-from-pdf": "🚀 FULL PIPELINE - Generate complete exam from PDF"
        },
        "test_ui": "http://localhost:8080/test_ui.html",
        "server_port": os.getenv('AI_PORT', '5001'),
        "ai_models": {
            "embedder": "paraphrase-multilingual-MiniLM-L12-v2",
            "llm": f"{ollama_model} (Ollama)",
            "ollama_url": ollama_base_url
        },
        "usage": {
            "curl_example": f"curl http://localhost:{os.getenv('AI_PORT', '5001')}/health"
        }
    })


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "embedder_loaded": embedder is not None,
        "rag_index_loaded": rag_index is not None,
        "chunks_count": len(chunks_store),
        "ollama_url": ollama_base_url,
        "ollama_model": ollama_model
    })


@app.route('/upload-document', methods=['POST'])
def upload_document():
    """Upload và xử lý tài liệu"""
    try:
        data = request.get_json()
        content = data.get('content', '')
        
        if not content:
            return jsonify({"error": "Content is required"}), 400
        
        # Chunking
        chunks = chunk_text(content)
        
        # Build RAG index
        build_rag_index(chunks)
        
        return jsonify({
            "success": True,
            "chunks_count": len(chunks),
            "message": "Document processed successfully"
        })
        
    except Exception as e:
        logger.error(f"Error in upload_document: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/generate-blueprint', methods=['POST'])
def generate_blueprint():
    """Sinh ma trận đề thi"""
    try:
        data = request.get_json()
        config = data.get('config', {})
        
        # Search context
        context_chunks = search_rag("ma trận đề kiểm tra", top_k=3)
        context = "\n\n".join([c['text'] for c in context_chunks])
        
        time_minutes = config.get('time_minutes', 45)
        total_points = config.get('total_points', 10.0)
        mcq_ratio = config.get('mcq_ratio', 0.6)
        essay_ratio = config.get('essay_ratio', 0.4)
        
        prompt = f"""Dựa vào tài liệu sau, hãy tạo ma trận đề kiểm tra:

TÀI LIỆU:
{context}

YÊU CẦU:
- Thời gian: {time_minutes} phút
- Tổng điểm: {total_points}
- Tỉ lệ trắc nghiệm: {mcq_ratio*100}%
- Tỉ lệ tự luận: {essay_ratio*100}%

Hãy tạo bảng ma trận chi tiết với các cột:
- Nội dung kiến thức
- Mức độ (Biết, Hiểu, Vận dụng, Vận dụng cao)
- Số câu
- Số điểm

Chỉ trả về bảng ma trận, không giải thích."""

        blueprint = generate_with_ollama(prompt, system="Bạn là chuyên gia giáo dục, tạo ma trận đề thi chính xác.")
        
        return jsonify({
            "success": True,
            "blueprint": blueprint,
            "context_used": len(context_chunks)
        })
        
    except Exception as e:
        logger.error(f"Error in generate_blueprint: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/generate-mcq', methods=['POST'])
def generate_mcq():
    """Sinh câu hỏi trắc nghiệm"""
    try:
        data = request.get_json()
        topic = data.get('topic', '')
        num_questions = data.get('num_questions', 3)
        
        # Search context
        context_chunks = search_rag(topic, top_k=2)
        context = "\n\n".join([c['text'] for c in context_chunks])
        
        prompt = f"""Dựa vào tài liệu:

{context}

Hãy tạo {num_questions} câu hỏi trắc nghiệm về {topic}.

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
        
        mcq = generate_with_ollama(prompt, system="Tạo câu hỏi trắc nghiệm chất lượng cao.")
        
        return jsonify({
            "success": True,
            "questions": mcq,
            "context_used": len(context_chunks)
        })
        
    except Exception as e:
        logger.error(f"Error in generate_mcq: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/generate-essay', methods=['POST'])
def generate_essay():
    """Sinh câu hỏi tự luận"""
    try:
        data = request.get_json()
        topic = data.get('topic', '')
        
        # Search context
        context_chunks = search_rag(topic, top_k=2)
        context = "\n\n".join([c['text'] for c in context_chunks])
        
        prompt = f"""Dựa vào tài liệu:

{context}

Hãy tạo 1 bài toán thực tế về {topic}.

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
        
        essay = generate_with_ollama(prompt, system="Tạo bài toán thực tế hay và phù hợp.")
        
        return jsonify({
            "success": True,
            "question": essay,
            "context_used": len(context_chunks)
        })
        
    except Exception as e:
        logger.error(f"Error in generate_essay: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/search', methods=['POST'])
def search():
    """Tìm kiếm trong tài liệu"""
    try:
        data = request.get_json()
        query = data.get('query', '')
        top_k = data.get('top_k', 5)
        
        results = search_rag(query, top_k=top_k)
        
        return jsonify({
            "success": True,
            "results": results
        })
        
    except Exception as e:
        logger.error(f"Error in search: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/generate-exam-from-pdf', methods=['POST'])
def generate_exam_from_pdf():
    """
    PRODUCTION ENDPOINT: Complete pipeline
    PDF content → Blueprint → Matrix → Questions → Validation → Export
    
    Input:
        {
            "content": "PDF text content",
            "config": {
                "time_minutes": 45,
                "total_points": 10.0,
                "mcq_ratio": 0.6,
                "essay_ratio": 0.4
            },
            "cognitive_ratios": {
                "biet": 0.3,
                "hieu": 0.3,
                "vandung": 0.3,
                "vandungcao": 0.1
            },
            "difficulty_ratios": {
                "de": 0.3,
                "tb": 0.4,
                "kho": 0.3
            }
        }
    
    Output:
        {
            "success": true,
            "blueprint": {...},
            "matrix": {...},
            "exam": {...},
            "validation": {
                "valid": true/false,
                "issues": [...]
            },
            "stats": {...}
        }
    """
    try:
        data = request.get_json()
        
        content = data.get('content', '')
        if not content:
            return jsonify({"error": "Content is required"}), 400
        
        # Parse config
        config_data = data.get('config', {})
        config = GlobalConfig(
            time_minutes=config_data.get('time_minutes', 45),
            total_points=config_data.get('total_points', 10.0),
            mcq_ratio=config_data.get('mcq_ratio', 0.6),
            essay_ratio=config_data.get('essay_ratio', 0.4)
        )
        
        cognitive_data = data.get('cognitive_ratios', {})
        cognitive_ratios = CognitiveRatios(
            biet=cognitive_data.get('biet', 0.3),
            hieu=cognitive_data.get('hieu', 0.3),
            vandung=cognitive_data.get('vandung', 0.3),
            vandungcao=cognitive_data.get('vandungcao', 0.1)
        )
        
        difficulty_data = data.get('difficulty_ratios', {})
        difficulty_ratios = DifficultyRatios(
            de=difficulty_data.get('de', 0.3),
            tb=difficulty_data.get('tb', 0.4),
            kho=difficulty_data.get('kho', 0.3)
        )
        
        # Run pipeline
        logger.info("🚀 Running full exam generation pipeline...")
        result = pipeline.run_full_pipeline(
            pdf_content=content,
            config=config,
            cognitive_ratios=cognitive_ratios,
            difficulty_ratios=difficulty_ratios,
            output_dir="./output"
        )
        
        # Return results
        return jsonify({
            "success": True,
            "blueprint": {
                "topics": [t.model_dump() for t in result['blueprint'].topics],
                "outcomes": [o.model_dump() for o in result['blueprint'].outcomes]
            },
            "matrix": {
                "total_items": len(result['matrix'].items),
                "total_points": sum(item.points_each * item.num_questions for item in result['matrix'].items)
            },
            "exam": {
                "title": result['exam'].title,
                "total_questions": len(result['exam'].questions),
                "total_points": result['exam'].total_points,
                "questions": [q.model_dump() for q in result['exam'].questions]
            },
            "validation": {
                "valid": result['valid']
            },
            "message": "Exam generated successfully! Files saved to ./output/"
        })
        
    except Exception as e:
        logger.error(f"Error in generate_exam_from_pdf: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    # Initialize models
    init_models()
    
    # Start server
    port = int(os.environ.get('AI_PORT', 5001))
    logger.info(f"🚀 Starting AI API Server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
