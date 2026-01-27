#!/usr/bin/env python3
"""
Script demo/test hệ thống với data mẫu
Không cần PDF thật, tự tạo data giả lập
"""
import json
from pathlib import Path
from loguru import logger

from src.models import (
    Document, DocumentPage, DocumentMetadata,
    GlobalConfig, CognitiveRatios, DifficultyRatios,
    Blueprint, Topic, LearningOutcome, SourceTrace
)
from src.config import get_config
from src.rag_indexer import TextChunker, RAGIndexer
from src.generators import MatrixGenerator, QuestionGenerator
from src.validator import ExamValidator
from src.exporter import DOCXExporter, ExportRequest


def create_sample_document():
    """Tạo document mẫu (giả lập PDF đã parse)"""
    logger.info("📄 Tạo document mẫu...")
    
    sample_text = """
CHƯƠNG 1: HỆ PHƯƠNG TRÌNH BẬC NHẤT HAI ẨN

I. MỤC TIÊU
- Học sinh biết khái niệm hệ phương trình bậc nhất hai ẩn
- Học sinh hiểu và giải hệ phương trình bằng phương pháp thế
- Học sinh hiểu và giải hệ phương trình bằng phương pháp cộng đại số
- Vận dụng giải bài toán bằng cách lập hệ phương trình

II. YÊU CẦU CẦN ĐẠT
1. Nhận biết được hệ phương trình bậc nhất hai ẩn
2. Giải thích được nghiệm của hệ phương trình
3. Giải hệ phương trình bằng phương pháp thế
4. Giải hệ phương trình bằng phương pháp cộng đại số
5. Vận dụng giải bài toán thực tế bằng cách lập hệ phương trình

III. NỘI DUNG
- Khái niệm hệ phương trình bậc nhất hai ẩn
- Nghiệm của hệ phương trình
- Phương pháp giải: phương pháp thế, phương pháp cộng đại số
- Ứng dụng: giải bài toán bằng cách lập hệ phương trình

CHƯƠNG 2: HÀM SỐ BẬC NHẤT

I. MỤC TIÊU
- Học sinh biết khái niệm hàm số bậc nhất
- Học sinh hiểu tính chất của hàm số bậc nhất
- Vẽ đồ thị hàm số bậc nhất

II. YÊU CẦU CẦN ĐẠT
1. Nhận biết hàm số bậc nhất
2. Xác định tính đồng biến, nghịch biến của hàm số bậc nhất
3. Vẽ đồ thị hàm số y = ax + b
4. Vận dụng giải bài toán liên quan đến hàm số bậc nhất
"""
    
    doc = Document(
        doc_id="demo-001",
        file_name="de_cuong_toan_9_demo.pdf",
        metadata=DocumentMetadata(
            subject="Toán",
            grade=9,
            term="I",
            school_year="2024-2025"
        ),
        pages=[
            DocumentPage(page=1, text=sample_text, tables=[], images=[])
        ]
    )
    
    return doc


def create_sample_blueprint():
    """Tạo blueprint mẫu (có thể dùng khi không có OpenAI)"""
    logger.info("🧠 Tạo blueprint mẫu...")
    
    return Blueprint(
        subject="Toán",
        grade=9,
        term="I",
        topics=[
            Topic(
                topic_id="T1",
                name="Hệ phương trình bậc nhất hai ẩn",
                outcomes=[
                    LearningOutcome(
                        outcome_id="O1",
                        verb="nhận biết",
                        statement="Nhận biết được hệ phương trình bậc nhất hai ẩn",
                        cognitive_level_hint=["biet"],
                        source_trace=[SourceTrace(chunk_id="p1_c001", page=1)]
                    ),
                    LearningOutcome(
                        outcome_id="O2",
                        verb="giải",
                        statement="Giải hệ phương trình bằng phương pháp thế",
                        cognitive_level_hint=["hieu", "vandung"],
                        source_trace=[SourceTrace(chunk_id="p1_c002", page=1)]
                    ),
                    LearningOutcome(
                        outcome_id="O3",
                        verb="vận dụng",
                        statement="Vận dụng giải bài toán thực tế bằng cách lập hệ phương trình",
                        cognitive_level_hint=["vandung", "vandungcao"],
                        source_trace=[SourceTrace(chunk_id="p1_c003", page=1)]
                    )
                ],
                keywords=["hệ phương trình", "phương pháp thế", "phương pháp cộng"],
                subtopics=["Khái niệm", "Giải hệ", "Ứng dụng"]
            ),
            Topic(
                topic_id="T2",
                name="Hàm số bậc nhất",
                outcomes=[
                    LearningOutcome(
                        outcome_id="O4",
                        verb="nhận biết",
                        statement="Nhận biết hàm số bậc nhất",
                        cognitive_level_hint=["biet"],
                        source_trace=[SourceTrace(chunk_id="p1_c004", page=1)]
                    ),
                    LearningOutcome(
                        outcome_id="O5",
                        verb="vẽ",
                        statement="Vẽ đồ thị hàm số y = ax + b",
                        cognitive_level_hint=["hieu", "vandung"],
                        source_trace=[SourceTrace(chunk_id="p1_c005", page=1)]
                    )
                ],
                keywords=["hàm số bậc nhất", "đồ thị", "tính đồng biến"],
                subtopics=["Khái niệm", "Đồ thị", "Tính chất"]
            )
        ]
    )


def main():
    """Chạy demo"""
    logger.info("=" * 80)
    logger.info("🎯 DEMO HỆ THỐNG - KHÔNG CẦN PDF")
    logger.info("=" * 80)
    
    try:
        # Load config
        config = get_config()
        output_dir = Path("outputs/demo")
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # 1. Tạo document mẫu
        document = create_sample_document()
        logger.info(f"✓ Tạo document: {document.file_name}")
        
        # 2. Chunking
        logger.info("\n📦 Chunking...")
        chunker = TextChunker(chunk_size=500, chunk_overlap=100)
        chunks = chunker.chunk_document(document)
        logger.info(f"✓ Tạo {len(chunks)} chunks")
        
        # 3. RAG Index
        logger.info("\n🔍 Build RAG index...")
        indexer = RAGIndexer()
        indexer.build_index(chunks)
        logger.info("✓ Index hoàn tất")
        
        # 4. Blueprint (dùng mẫu thay vì gọi AI)
        logger.info("\n🧠 Load blueprint mẫu...")
        blueprint = create_sample_blueprint()
        logger.info(f"✓ Blueprint: {len(blueprint.topics)} topics")
        
        # 5. Ma trận (gọi AI)
        logger.info("\n📊 Sinh ma trận...")
        global_cfg = GlobalConfig(
            time_minutes=45,
            total_points=10.0,
            mcq_ratio=0.6,
            essay_ratio=0.4
        )
        cognitive_cfg = CognitiveRatios(biet=0.3, hieu=0.3, vandung=0.3, vandungcao=0.1)
        difficulty_cfg = DifficultyRatios(de=0.3, tb=0.4, kho=0.3)
        
        matrix_gen = MatrixGenerator()
        matrix = matrix_gen.generate(blueprint, global_cfg, cognitive_cfg, difficulty_cfg)
        logger.info(f"✓ Ma trận: {len(matrix.items_plan)} rows")
        
        # 6. Sinh câu hỏi
        logger.info("\n📝 Sinh câu hỏi...")
        question_gen = QuestionGenerator(indexer=indexer)
        exam = question_gen.generate_exam(matrix, blueprint)
        exam.title = "ĐỀ KIỂM TRA TOÁN 9 (DEMO)"
        exam.subject = "Toán"
        exam.grade = 9
        exam.time_minutes = 45
        exam.total_points = 10.0
        logger.info(f"✓ Đã sinh {len(exam.questions)} câu hỏi")
        
        # 7. Validate
        logger.info("\n✅ Validation...")
        validator = ExamValidator()
        result = validator.validate(exam)
        logger.info(f"✓ Valid: {result.is_valid}, Issues: {len(result.issues)}")
        
        # 8. Export
        logger.info("\n📄 Export DOCX...")
        exporter = DOCXExporter()
        export_request = ExportRequest(
            exam=exam,
            matrix=matrix,
            blueprint=blueprint,
            include_answer_key=True,
            include_rubric=True
        )
        
        docx_path = output_dir / "demo_exam.docx"
        exporter.export(export_request, str(docx_path))
        logger.info(f"✓ File: {docx_path}")
        
        # Save JSON
        with open(output_dir / "blueprint.json", 'w', encoding='utf-8') as f:
            json.dump(blueprint.model_dump(), f, ensure_ascii=False, indent=2, default=str)
        
        with open(output_dir / "matrix.json", 'w', encoding='utf-8') as f:
            json.dump(matrix.model_dump(), f, ensure_ascii=False, indent=2)
        
        with open(output_dir / "exam.json", 'w', encoding='utf-8') as f:
            json.dump(exam.model_dump(), f, ensure_ascii=False, indent=2, default=str)
        
        logger.info("\n" + "=" * 80)
        logger.info("✨ DEMO HOÀN TẤT!")
        logger.info("=" * 80)
        logger.info(f"📁 Output: {output_dir}")
        logger.info(f"📝 Đề thi: {docx_path}")
        logger.info("=" * 80)
        
    except Exception as e:
        logger.exception(f"❌ Lỗi: {e}")


if __name__ == "__main__":
    main()
