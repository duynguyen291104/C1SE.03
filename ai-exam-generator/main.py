#!/usr/bin/env python3
"""
AI Exam Generator - Main Pipeline
Hệ thống sinh đề kiểm tra tự động từ PDF đề cương
"""
import sys
import json
from pathlib import Path
from loguru import logger

from src.config import get_config
from src.pdf_parser import PDFParser, TextCleaner
from src.rag_indexer import TextChunker, RAGIndexer
from src.generators import BlueprintGenerator, MatrixGenerator, QuestionGenerator
from src.validator import ExamValidator
from src.exporter import DOCXExporter
from src.models import (
    GlobalConfig, CognitiveRatios, DifficultyRatios, 
    ExportRequest, ExamMetadata
)


def setup_logging():
    """Cấu hình logging"""
    logger.remove()  # Remove default handler
    logger.add(
        sys.stderr,
        format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <level>{message}</level>",
        level="INFO"
    )
    logger.add(
        "logs/exam_generator_{time}.log",
        rotation="1 day",
        retention="7 days",
        level="DEBUG"
    )


def main(pdf_path: str, config_path: str = "config.json"):
    """
    Pipeline chính: PDF → Blueprint → Matrix → Exam → DOCX
    
    Args:
        pdf_path: Đường dẫn file PDF đề cương
        config_path: Đường dẫn file config
    """
    setup_logging()
    
    logger.info("=" * 80)
    logger.info("🚀 BẮT ĐẦU PIPELINE SINH ĐỀ KIỂM TRA")
    logger.info("=" * 80)
    
    try:
        # 1. Load config
        logger.info("\n📋 BƯỚC 1: Load cấu hình")
        config = get_config(config_path)
        logger.info(f"   ✓ Model: {config.openai_model}")
        logger.info(f"   ✓ Output dir: {config.output_dir}")
        
        # 2. Parse PDF
        logger.info("\n📄 BƯỚC 2: Parse PDF đề cương")
        parser = PDFParser()
        document = parser.parse(pdf_path)
        logger.info(f"   ✓ Tên file: {document.file_name}")
        logger.info(f"   ✓ Số trang: {len(document.pages)}")
        logger.info(f"   ✓ Môn học: {document.metadata.subject or 'N/A'}")
        logger.info(f"   ✓ Khối: {document.metadata.grade or 'N/A'}")
        
        # Clean text
        cleaner = TextCleaner()
        for page in document.pages:
            page.text = cleaner.clean(page.text)
        
        # Save document
        doc_path = Path(config.output_dir) / "document.json"
        with open(doc_path, 'w', encoding='utf-8') as f:
            json.dump(document.model_dump(), f, ensure_ascii=False, indent=2, default=str)
        logger.info(f"   💾 Đã lưu: {doc_path}")
        
        # 3. Chunking
        logger.info("\n📦 BƯỚC 3: Chia text thành chunks")
        chunker = TextChunker(
            chunk_size=config.chunk_size,
            chunk_overlap=config.chunk_overlap
        )
        chunks = chunker.chunk_document(document)
        logger.info(f"   ✓ Số chunks: {len(chunks)}")
        
        # Save chunks
        chunks_path = Path(config.output_dir) / "chunks.json"
        with open(chunks_path, 'w', encoding='utf-8') as f:
            chunks_data = [c.model_dump(exclude={'embedding'}) for c in chunks]
            json.dump(chunks_data, f, ensure_ascii=False, indent=2)
        logger.info(f"   💾 Đã lưu: {chunks_path}")
        
        # 4. Build RAG index
        logger.info("\n🔍 BƯỚC 4: Xây dựng RAG index")
        indexer = RAGIndexer()
        indexer.build_index(chunks)
        
        # Save index
        index_path = str(Path(config.output_dir) / "index.faiss")
        chunks_meta_path = str(Path(config.output_dir) / "chunks_meta.pkl")
        indexer.save(index_path, chunks_meta_path)
        logger.info(f"   💾 Đã lưu index: {index_path}")
        
        # 5. Generate Blueprint
        logger.info("\n🧠 BƯỚC 5: Sinh Blueprint")
        blueprint_gen = BlueprintGenerator()
        blueprint = blueprint_gen.generate(
            chunks=chunks[:10],  # Chỉ dùng 10 chunks đầu (thường chứa tóm tắt)
            subject=document.metadata.subject,
            grade=document.metadata.grade
        )
        logger.info(f"   ✓ Môn: {blueprint.subject}")
        logger.info(f"   ✓ Số chủ đề: {len(blueprint.topics)}")
        for topic in blueprint.topics:
            logger.info(f"      • {topic.name} ({len(topic.outcomes)} outcomes)")
        
        # Save blueprint
        blueprint_path = Path(config.output_dir) / "blueprint.json"
        with open(blueprint_path, 'w', encoding='utf-8') as f:
            json.dump(blueprint.model_dump(), f, ensure_ascii=False, indent=2, default=str)
        logger.info(f"   💾 Đã lưu: {blueprint_path}")
        
        # 6. Generate Matrix
        logger.info("\n📊 BƯỚC 6: Sinh Ma trận đề")
        
        # Lấy config từ file hoặc dùng mặc định
        exam_config = config.get('exam_config', {})
        global_cfg = GlobalConfig(**exam_config.get('global', {}))
        cognitive_cfg = CognitiveRatios(**exam_config.get('cognitive', {}))
        difficulty_cfg = DifficultyRatios(**exam_config.get('difficulty', {}))
        
        matrix_gen = MatrixGenerator()
        matrix = matrix_gen.generate(
            blueprint=blueprint,
            global_config=global_cfg,
            cognitive_ratios=cognitive_cfg,
            difficulty_ratios=difficulty_cfg
        )
        logger.info(f"   ✓ Số dòng ma trận: {len(matrix.items_plan)}")
        logger.info(f"   ✓ Tổng số câu: {sum(item.n_questions for item in matrix.items_plan)}")
        logger.info(f"   ✓ Tổng điểm: {sum(item.n_questions * item.points_each for item in matrix.items_plan):.1f}")
        
        # Save matrix
        matrix_path = Path(config.output_dir) / "matrix.json"
        with open(matrix_path, 'w', encoding='utf-8') as f:
            json.dump(matrix.model_dump(), f, ensure_ascii=False, indent=2)
        logger.info(f"   💾 Đã lưu: {matrix_path}")
        
        # 7. Generate Questions
        logger.info("\n📝 BƯỚC 7: Sinh câu hỏi")
        question_gen = QuestionGenerator(indexer=indexer)
        exam = question_gen.generate_exam(matrix, blueprint)
        
        # Set metadata
        exam.title = f"ĐỀ KIỂM TRA {blueprint.subject.upper()}"
        exam.subject = blueprint.subject
        exam.grade = blueprint.grade
        exam.time_minutes = global_cfg.time_minutes
        exam.total_points = global_cfg.total_points
        exam.metadata = ExamMetadata(
            created_by="AI Exam Generator",
            source_file=Path(pdf_path).name
        )
        
        logger.info(f"   ✓ Số câu hỏi: {len(exam.questions)}")
        logger.info(f"   ✓ Tổng điểm: {sum(q.points for q in exam.questions):.1f}")
        
        # Save exam
        exam_path = Path(config.output_dir) / "exam.json"
        with open(exam_path, 'w', encoding='utf-8') as f:
            json.dump(exam.model_dump(), f, ensure_ascii=False, indent=2, default=str)
        logger.info(f"   💾 Đã lưu: {exam_path}")
        
        # 8. Validate
        logger.info("\n✅ BƯỚC 8: Kiểm tra chất lượng")
        validator = ExamValidator()
        validation_result = validator.validate(exam)
        
        logger.info(f"   ✓ Hợp lệ: {validation_result.is_valid}")
        logger.info(f"   ✓ Số vấn đề: {len(validation_result.issues)}")
        
        if validation_result.issues:
            for issue in validation_result.issues[:10]:  # Show first 10
                icon = "❌" if issue.severity == "error" else "⚠️" if issue.severity == "warning" else "ℹ️"
                logger.warning(f"      {icon} [{issue.question_id}] {issue.message}")
        
        # Save validation
        validation_path = Path(config.output_dir) / "validation.json"
        with open(validation_path, 'w', encoding='utf-8') as f:
            json.dump(validation_result.model_dump(), f, ensure_ascii=False, indent=2)
        logger.info(f"   💾 Đã lưu: {validation_path}")
        
        # 9. Export DOCX
        logger.info("\n📄 BƯỚC 9: Xuất file DOCX")
        exporter = DOCXExporter()
        
        export_request = ExportRequest(
            exam=exam,
            matrix=matrix,
            blueprint=blueprint,
            include_answer_key=True,
            include_rubric=True,
            include_source_trace=True
        )
        
        docx_path = Path(config.output_dir) / f"{blueprint.subject.replace(' ', '_')}_exam.docx"
        exporter.export(export_request, str(docx_path))
        logger.info(f"   ✓ File DOCX: {docx_path}")
        
        # 10. Summary
        logger.info("\n" + "=" * 80)
        logger.info("✨ HOÀN THÀNH PIPELINE")
        logger.info("=" * 80)
        logger.info(f"📁 Thư mục output: {config.output_dir}")
        logger.info(f"📝 Đề thi: {docx_path}")
        logger.info(f"📊 Số câu hỏi: {len(exam.questions)}")
        logger.info(f"💯 Tổng điểm: {exam.total_points}")
        logger.info(f"⏱️  Thời gian: {exam.time_minutes} phút")
        
        if not validation_result.is_valid:
            logger.warning("⚠️  LƯU Ý: Đề có một số vấn đề cần kiểm tra lại!")
            logger.warning(f"   Xem chi tiết tại: {validation_path}")
        
        logger.info("=" * 80)
        
        return True
        
    except Exception as e:
        logger.exception(f"❌ LỖI: {e}")
        return False


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Cách dùng: python main.py <pdf_path> [config_path]")
        print("\nVí dụ:")
        print("  python main.py de_cuong_toan_9.pdf")
        print("  python main.py de_cuong_van_11.pdf custom_config.json")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    config_path = sys.argv[2] if len(sys.argv) > 2 else "config.json"
    
    if not Path(pdf_path).exists():
        print(f"❌ Không tìm thấy file: {pdf_path}")
        sys.exit(1)
    
    success = main(pdf_path, config_path)
    sys.exit(0 if success else 1)
