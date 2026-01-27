"""
Main application - Entry point cho hệ thống sinh đề kiểm tra
"""
import logging
import sys
import json
from pathlib import Path
from typing import Optional
import argparse
from datetime import datetime

from openai import OpenAI

from .config import get_settings
from .models import GlobalConfig, CognitiveRatios, DifficultyRatios, ExportRequest
from .pdf_parser import PDFParser, TextCleaner
from .rag_indexer import TextChunker, RAGIndexer
from .generators import BlueprintGenerator, MatrixGenerator, QuestionGenerator
from .validator import ExamValidator
from .exporter import DOCXExporter

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('exam_generator.log', encoding='utf-8')
    ]
)

logger = logging.getLogger(__name__)


class ExamGeneratorApp:
    """Main application class"""
    
    def __init__(self):
        self.settings = get_settings()
        self.client = OpenAI(api_key=self.settings.openai_api_key)
        
        # Initialize components
        self.pdf_parser = PDFParser()
        self.text_chunker = TextChunker(
            chunk_size=self.settings.default_chunk_size,
            chunk_overlap=self.settings.default_chunk_overlap
        )
        self.indexer = RAGIndexer(client=self.client)
        self.blueprint_gen = BlueprintGenerator(client=self.client)
        self.matrix_gen = MatrixGenerator(client=self.client)
        self.question_gen = QuestionGenerator(client=self.client, indexer=self.indexer)
        self.validator = ExamValidator()
        self.exporter = DOCXExporter()
        
        # Create output dirs
        Path(self.settings.export_dir).mkdir(parents=True, exist_ok=True)
    
    def generate_exam(
        self,
        pdf_path: str,
        output_name: Optional[str] = None,
        config: Optional[dict] = None
    ) -> str:
        """
        Quy trình hoàn chỉnh: PDF → Blueprint → Matrix → Exam → DOCX
        
        Args:
            pdf_path: Đường dẫn file PDF đề cương
            output_name: Tên file output (không có extension)
            config: Cấu hình custom cho đề (dict)
            
        Returns:
            Đường dẫn file DOCX đã xuất
        """
        logger.info("=" * 80)
        logger.info("🚀 BẮT ĐẦU QUY TRÌNH SINH ĐỀ KIỂM TRA")
        logger.info("=" * 80)
        
        # ========== STEP 1: Parse PDF ==========
        logger.info("\n📖 BƯỚC 1: PARSE PDF")
        document = self.pdf_parser.parse(pdf_path)
        
        # Clean text
        for page in document.pages:
            page.text = TextCleaner.clean(page.text)
        
        # Save document JSON
        doc_json_path = Path(self.settings.export_dir) / f"{document.doc_id}_document.json"
        with open(doc_json_path, 'w', encoding='utf-8') as f:
            json.dump(document.model_dump(), f, ensure_ascii=False, indent=2, default=str)
        logger.info(f"   💾 Saved: {doc_json_path}")
        
        # ========== STEP 2: Chunk & Index ==========
        logger.info("\n📦 BƯỚC 2: CHUNKING VÀ INDEXING")
        chunks = self.text_chunker.chunk_document(document)
        
        # Save chunks
        chunks_json_path = Path(self.settings.export_dir) / f"{document.doc_id}_chunks.json"
        with open(chunks_json_path, 'w', encoding='utf-8') as f:
            json.dump([c.model_dump() for c in chunks], f, ensure_ascii=False, indent=2)
        logger.info(f"   💾 Saved: {chunks_json_path}")
        
        # Build RAG index
        self.indexer.build_index(chunks)
        
        # ========== STEP 3: Generate Blueprint ==========
        logger.info("\n🧠 BƯỚC 3: SINH BLUEPRINT KIẾN THỨC")
        blueprint = self.blueprint_gen.generate(
            chunks,
            subject=document.metadata.subject,
            grade=document.metadata.grade
        )
        
        # Save blueprint
        blueprint_json_path = Path(self.settings.export_dir) / f"{document.doc_id}_blueprint.json"
        with open(blueprint_json_path, 'w', encoding='utf-8') as f:
            json.dump(blueprint.model_dump(), f, ensure_ascii=False, indent=2, default=str)
        logger.info(f"   💾 Saved: {blueprint_json_path}")
        
        # ========== STEP 4: Generate Matrix ==========
        logger.info("\n📊 BƯỚC 4: SINH MA TRẬN ĐỀ")
        
        # Parse config or use defaults
        if config:
            global_config = GlobalConfig(**config.get('global', {}))
            cognitive_ratios = CognitiveRatios(**config.get('cognitive', {}))
            difficulty_ratios = DifficultyRatios(**config.get('difficulty', {}))
        else:
            global_config = GlobalConfig()
            cognitive_ratios = CognitiveRatios()
            difficulty_ratios = DifficultyRatios()
        
        matrix = self.matrix_gen.generate(
            blueprint,
            global_config,
            cognitive_ratios,
            difficulty_ratios
        )
        
        # Save matrix
        matrix_json_path = Path(self.settings.export_dir) / f"{document.doc_id}_matrix.json"
        with open(matrix_json_path, 'w', encoding='utf-8') as f:
            json.dump(matrix.model_dump(), f, ensure_ascii=False, indent=2, default=str)
        logger.info(f"   💾 Saved: {matrix_json_path}")
        
        # ========== STEP 5: Generate Questions ==========
        logger.info("\n📝 BƯỚC 5: SINH CÂU HỎI")
        exam = self.question_gen.generate_exam(
            matrix,
            blueprint,
            title=f"ĐỀ KIỂM TRA {blueprint.subject.upper()}"
        )
        
        # Save exam
        exam_json_path = Path(self.settings.export_dir) / f"{document.doc_id}_exam.json"
        with open(exam_json_path, 'w', encoding='utf-8') as f:
            json.dump(exam.model_dump(), f, ensure_ascii=False, indent=2, default=str)
        logger.info(f"   💾 Saved: {exam_json_path}")
        
        # ========== STEP 6: Validate ==========
        logger.info("\n🔍 BƯỚC 6: KIỂM TRA CHẤT LƯỢNG")
        validation = self.validator.validate(exam)
        
        logger.info(f"   ✅ Valid: {validation.is_valid}")
        logger.info(f"   ⚠️  Issues: {len(validation.issues)}")
        
        for issue in validation.issues:
            level_emoji = {"error": "❌", "warning": "⚠️", "info": "ℹ️"}
            logger.info(f"   {level_emoji.get(issue.severity, '•')} [{issue.question_id}] {issue.message}")
        
        # Save validation
        validation_json_path = Path(self.settings.export_dir) / f"{document.doc_id}_validation.json"
        with open(validation_json_path, 'w', encoding='utf-8') as f:
            json.dump(validation.model_dump(), f, ensure_ascii=False, indent=2)
        
        # ========== STEP 7: Export DOCX ==========
        logger.info("\n📄 BƯỚC 7: XUẤT FILE DOCX")
        
        if not output_name:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_name = f"de_kiem_tra_{blueprint.subject}_{timestamp}"
        
        output_path = Path(self.settings.export_dir) / f"{output_name}.docx"
        
        export_request = ExportRequest(
            exam=exam,
            matrix=matrix,
            blueprint=blueprint,
            format="docx",
            include_answer_key=True,
            include_rubric=True
        )
        
        final_path = self.exporter.export(export_request, str(output_path))
        
        logger.info("\n" + "=" * 80)
        logger.info("✅ HOÀN THÀNH!")
        logger.info(f"📁 File đề: {final_path}")
        logger.info(f"📊 Tổng câu: {len(exam.questions)}")
        logger.info(f"📈 Tổng điểm: {exam.total_points}")
        logger.info("=" * 80)
        
        return final_path


def main():
    """CLI entry point"""
    parser = argparse.ArgumentParser(
        description="Hệ thống sinh đề kiểm tra tự động từ PDF đề cương"
    )
    
    parser.add_argument(
        'pdf_path',
        help='Đường dẫn file PDF đề cương'
    )
    
    parser.add_argument(
        '-o', '--output',
        help='Tên file output (không cần .docx)',
        default=None
    )
    
    parser.add_argument(
        '-c', '--config',
        help='File JSON cấu hình đề (thời gian, tỷ lệ...)',
        default=None
    )
    
    parser.add_argument(
        '--time',
        type=int,
        help='Thời gian làm bài (phút)',
        default=45
    )
    
    parser.add_argument(
        '--points',
        type=float,
        help='Tổng điểm',
        default=10.0
    )
    
    parser.add_argument(
        '--mcq-ratio',
        type=float,
        help='Tỷ lệ trắc nghiệm (0.0-1.0)',
        default=0.6
    )
    
    args = parser.parse_args()
    
    # Load config
    config = None
    if args.config and Path(args.config).exists():
        with open(args.config, 'r', encoding='utf-8') as f:
            config = json.load(f)
    else:
        # Use CLI args
        config = {
            'global': {
                'time_minutes': args.time,
                'total_points': args.points,
                'mcq_ratio': args.mcq_ratio,
                'essay_ratio': 1 - args.mcq_ratio
            }
        }
    
    # Run
    try:
        app = ExamGeneratorApp()
        output_path = app.generate_exam(
            pdf_path=args.pdf_path,
            output_name=args.output,
            config=config
        )
        
        print(f"\n✅ Thành công! File đã lưu tại: {output_path}")
        
    except FileNotFoundError as e:
        logger.error(f"❌ File không tìm thấy: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"❌ Lỗi: {e}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
