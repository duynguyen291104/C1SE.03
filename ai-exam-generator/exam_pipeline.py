"""
Complete Exam Generation Pipeline - Production Ready
PDF → Blueprint → Matrix → Questions → Validation → Export
"""
import json
import os
from typing import List, Dict, Any, Optional
from pathlib import Path
from loguru import logger
import requests
from sentence_transformers import SentenceTransformer
import numpy as np
import faiss

from src.models import (
    Document, DocumentPage, DocumentMetadata, Chunk,
    Blueprint, Topic, LearningOutcome, SourceTrace,
    ExamMatrix, MatrixItem, CognitiveRatios, DifficultyRatios,
    Exam, Question, GlobalConfig
)
from src.validator import ExamValidator


class ExamPipeline:
    """
    Production-grade exam generation pipeline
    """
    
    def __init__(
        self,
        embedder: SentenceTransformer,
        ollama_url: str = "http://localhost:11434",
        ollama_model: str = "qwen2.5:3b"
    ):
        self.embedder = embedder
        self.ollama_url = ollama_url
        self.ollama_model = ollama_model
        self.validator = ExamValidator()
        
        # RAG components
        self.chunks: List[Chunk] = []
        self.index: Optional[faiss.Index] = None
        
    # ==================== STEP 1: DOCUMENT PROCESSING ====================
    
    def parse_pdf_text(self, content: str) -> Document:
        """Parse PDF text content into structured document"""
        logger.info("📄 Parsing document...")
        
        # Simple parsing - split by sections
        lines = content.strip().split('\n')
        pages = []
        current_page_text = []
        
        for line in lines:
            current_page_text.append(line)
            if len(current_page_text) > 50:  # Simulate page breaks
                pages.append(DocumentPage(
                    page=len(pages) + 1,
                    text='\n'.join(current_page_text),
                    tables=[],
                    images=[]
                ))
                current_page_text = []
        
        if current_page_text:
            pages.append(DocumentPage(
                page=len(pages) + 1,
                text='\n'.join(current_page_text),
                tables=[],
                images=[]
            ))
        
        doc = Document(
            doc_id=f"doc_{hash(content) % 10000}",
            file_name="uploaded.pdf",
            metadata=DocumentMetadata(),
            pages=pages
        )
        
        logger.info(f"✅ Parsed document: {len(pages)} pages")
        return doc
    
    def chunk_document(self, document: Document, chunk_size: int = 500) -> List[Chunk]:
        """Chunk document with section detection"""
        logger.info("📦 Chunking document...")
        
        chunks = []
        full_text = '\n'.join([p.text for p in document.pages])
        lines = full_text.split('\n')
        
        current_chunk = ""
        current_section = ""
        chunk_id = 0
        char_pos = 0
        current_page = 1
        
        for line in lines:
            # Detect sections
            if any(keyword in line.upper() for keyword in ["CHƯƠNG", "BÀI", "MỤC TIÊU", "NỘI DUNG"]):
                current_section = line.strip()
            
            if len(current_chunk) + len(line) > chunk_size and current_chunk:
                text = current_chunk.strip()
                chunks.append(Chunk(
                    chunk_id=f"chunk_{chunk_id:04d}",
                    page=current_page,
                    section=current_section,
                    text=text,
                    char_start=char_pos,
                    char_end=char_pos + len(text)
                ))
                char_pos += len(text)
                chunk_id += 1
                current_chunk = line + "\n"
            else:
                current_chunk += line + "\n"
        
        # Last chunk
        if current_chunk.strip():
            text = current_chunk.strip()
            chunks.append(Chunk(
                chunk_id=f"chunk_{chunk_id:04d}",
                page=current_page,
                section=current_section,
                text=text,
                char_start=char_pos,
                char_end=char_pos + len(text)
            ))
        
        logger.info(f"✅ Created {len(chunks)} chunks")
        return chunks
    
    def build_rag_index(self, chunks: List[Chunk]):
        """Build FAISS index for retrieval"""
        logger.info(f"🔍 Building RAG index for {len(chunks)} chunks...")
        
        self.chunks = chunks
        
        # Create embeddings
        texts = [c.text for c in chunks]
        embeddings = self.embedder.encode(texts, show_progress_bar=False)
        
        # Build FAISS index
        dimension = embeddings.shape[1]
        self.index = faiss.IndexFlatL2(dimension)
        self.index.add(embeddings.astype('float32'))
        
        logger.info(f"✅ RAG index built with {self.index.ntotal} vectors")
    
    def retrieve_chunks(self, query: str, top_k: int = 3) -> List[Chunk]:
        """Retrieve relevant chunks"""
        if self.index is None or not self.chunks:
            return []
        
        query_embedding = self.embedder.encode([query])
        distances, indices = self.index.search(query_embedding.astype('float32'), top_k)
        
        results = []
        for idx in indices[0]:
            if 0 <= idx < len(self.chunks):
                results.append(self.chunks[idx])
        
        return results
    
    # ==================== STEP 2: BLUEPRINT EXTRACTION ====================
    
    def extract_blueprint(self, document: Document) -> Blueprint:
        """
        Extract blueprint with REAL source tracing
        CRITICAL: Each outcome must have actual trace to relevant chunks
        """
        logger.info("🎯 Extracting blueprint with source tracing...")
        
        # Retrieve context about objectives/outcomes
        context_chunks = self.retrieve_chunks("mục tiêu yêu cầu cần đạt nội dung kiến thức", top_k=5)
        context_text = "\n\n".join([f"[{c.chunk_id}] {c.text}" for c in context_chunks])
        
        prompt = f"""Phân tích đề cương sau và trích xuất blueprint.

TÀI LIỆU (mỗi đoạn có ID):
{context_text}

Trả về JSON với cấu trúc:
{{
  "topics": [
    {{
      "id": "topic_1",
      "name": "Tên chủ đề",
      "description": "Mô tả ngắn"
    }}
  ],
  "outcomes": [
    {{
      "id": "outcome_1",
      "topic_id": "topic_1",
      "statement": "Học sinh biết/hiểu/vận dụng...",
      "cognitive_level": "biet|hieu|vandung|vandungcao",
      "keywords": ["từ khóa 1", "từ khóa 2"]
    }}
  ]
}}

LƯU Ý: Chỉ trích xuất từ tài liệu, không bịa."""

        response = self._generate_with_ollama(prompt, system="Bạn là chuyên gia phân tích đề cương. Chỉ trả về JSON.")
        
        # Parse JSON
        try:
            # Clean response
            json_str = response.strip()
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0]
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0]
            
            data = json.loads(json_str)
            
            # Create topics
            topics = []
            for t in data.get('topics', []):
                topics.append(Topic(
                    topic_id=t.get('id', t.get('topic_id', '')),
                    name=t['name'],
                    keywords=t.get('keywords', []),
                    subtopics=t.get('subtopics', [])
                ))
            
            # Create outcomes WITH REAL TRACE
            outcomes = []
            for o in data.get('outcomes', []):
                # CRITICAL: Retrieve relevant chunk for THIS outcome
                outcome_query = f"{o['statement']} {' '.join(o.get('keywords', []))}"
                relevant_chunks = self.retrieve_chunks(outcome_query, top_k=1)
                
                # Build real source trace
                source_trace = []
                if relevant_chunks:
                    chunk = relevant_chunks[0]
                    source_trace.append(SourceTrace(
                        chunk_id=chunk.chunk_id,
                        page=chunk.page,
                        section=chunk.section
                    ))
                
                outcomes.append(LearningOutcome(
                    outcome_id=o.get('id', o.get('outcome_id', '')),
                    verb=o.get('verb', 'nhận biết'),
                    statement=o['statement'],
                    cognitive_level_hint=o.get('cognitive_level_hint', [o.get('cognitive_level', 'biet')]),
                    source_trace=source_trace  # REAL trace!
                ))
            
            blueprint = Blueprint(
                subject="Toán học",
                topics=topics,
                outcomes=outcomes
            )
            
            logger.info(f"✅ Extracted blueprint: {len(topics)} topics, {len(outcomes)} outcomes")
            return blueprint
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse blueprint JSON: {e}")
            logger.error(f"Response: {response}")
            # Return minimal blueprint
            return Blueprint(topics=[], outcomes=[])
    
    # ==================== STEP 3: MATRIX PLANNING (HYBRID) ====================
    
    def plan_matrix(
        self,
        blueprint: Blueprint,
        config: GlobalConfig,
        cognitive_ratios: CognitiveRatios,
        difficulty_ratios: DifficultyRatios
    ) -> ExamMatrix:
        """
        Plan exam matrix - HYBRID approach:
        - CODE locks: total points, ratios, counts
        - LLM suggests: question types, distribution per outcome
        """
        logger.info("📊 Planning exam matrix (hybrid)...")
        
        total_points = config.total_points
        mcq_ratio = config.mcq_ratio
        essay_ratio = config.essay_ratio
        
        # Calculate counts (CODE LOCKED)
        points_per_mcq = 0.25  # Standard
        points_per_essay = 2.0  # Standard
        
        num_mcq = int(total_points * mcq_ratio / points_per_mcq)
        num_essay = int(total_points * essay_ratio / points_per_essay)
        
        # Adjust to match total points exactly
        mcq_points = num_mcq * points_per_mcq
        essay_points = num_essay * points_per_essay
        
        if abs((mcq_points + essay_points) - total_points) > 0.01:
            # Adjust essay to match
            essay_points = total_points - mcq_points
            num_essay = int(essay_points / points_per_essay)
        
        logger.info(f"📐 Calculated: {num_mcq} MCQ ({mcq_points} pts), {num_essay} Essay ({essay_points} pts)")
        
        # Distribute MCQ by cognitive level (CODE LOCKED)
        mcq_by_level = {
            'biet': int(num_mcq * cognitive_ratios.biet),
            'hieu': int(num_mcq * cognitive_ratios.hieu),
            'van_dung': int(num_mcq * cognitive_ratios.van_dung),
            'van_dung_cao': int(num_mcq * cognitive_ratios.van_dung_cao)
        }
        
        # Adjust rounding
        diff = num_mcq - sum(mcq_by_level.values())
        if diff > 0:
            mcq_by_level['hieu'] += diff
        
        # Distribute Essay by cognitive level
        essay_by_level = {
            'biet': 0,
            'hieu': 0,
            'van_dung': int(num_essay * 0.6),
            'van_dung_cao': int(num_essay * 0.4)
        }
        diff = num_essay - sum(essay_by_level.values())
        if diff > 0:
            essay_by_level['van_dung'] += diff
        
        # Create matrix items
        items = []
        item_id = 0
        
        # Helper to extract cognitive level from outcome
        def get_cognitive_level(outcome: LearningOutcome) -> str:
            """Extract first cognitive level hint or default to 'biet'"""
            if outcome.cognitive_level_hint and len(outcome.cognitive_level_hint) > 0:
                hint = outcome.cognitive_level_hint[0].lower()
                if 'hiểu' in hint or 'hieu' in hint:
                    return 'hieu'
                elif 'vận dụng cao' in hint or 'van_dung_cao' in hint:
                    return 'van_dung_cao'
                elif 'vận dụng' in hint or 'van_dung' in hint:
                    return 'van_dung'
                else:
                    return 'biet'
            return 'biet'
        
        # MCQ items
        for level, count in mcq_by_level.items():
            if count > 0:
                # Distribute across outcomes of this level
                relevant_outcomes = [o for o in blueprint.outcomes if get_cognitive_level(o) == level]
                if not relevant_outcomes:
                    relevant_outcomes = blueprint.outcomes[:1]  # Fallback
                
                outcomes_per_item = min(2, len(relevant_outcomes))
                for i in range(count):
                    outcome_ids = [relevant_outcomes[i % len(relevant_outcomes)].outcome_id]
                    
                    items.append(MatrixItem(
                        item_id=f"item_{item_id:03d}",
                        topic_id="topic_001",  # Fixed for now
                        outcome_ids=outcome_ids,
                        cognitive_level=level,
                        difficulty='de' if level in ['biet', 'hieu'] else 'trung_binh' if level == 'van_dung' else 'kho',
                        question_type='mcq_single',
                        num_questions=1,
                        points_each=points_per_mcq
                    ))
                    item_id += 1
        
        # Essay items
        for level, count in essay_by_level.items():
            if count > 0:
                relevant_outcomes = [o for o in blueprint.outcomes if get_cognitive_level(o) == level]
                if not relevant_outcomes:
                    relevant_outcomes = blueprint.outcomes[:1]
                
                for i in range(count):
                    outcome_ids = [relevant_outcomes[i % len(relevant_outcomes)].outcome_id]
                    
                    items.append(MatrixItem(
                        item_id=f"item_{item_id:03d}",
                        topic_id="topic_001",  # Fixed for now
                        outcome_ids=outcome_ids,
                        cognitive_level=level,
                        difficulty='trung_binh' if level == 'van_dung' else 'kho',
                        question_type='essay',
                        num_questions=1,
                        points_each=points_per_essay
                    ))
                    item_id += 1
        
        matrix = ExamMatrix(
            global_config=config,
            cognitive_ratios=cognitive_ratios,
            difficulty_ratios=difficulty_ratios,
            items=items
        )
        
        logger.info(f"✅ Matrix planned: {len(items)} items")
        return matrix
    
    # ==================== STEP 4: QUESTION GENERATION (RAG LOCKED) ====================
    
    def generate_questions(self, matrix: ExamMatrix, blueprint: Blueprint) -> Exam:
        """
        Generate questions per matrix item - RAG LOCKED
        Each question MUST have source trace
        """
        logger.info(f"📝 Generating questions for {len(matrix.items)} matrix items...")
        
        questions = []
        
        for item in matrix.items:
            logger.info(f"Generating for {item.item_id}: {item.question_type}, level={item.cognitive_level}")
            
            # Get outcomes for this item
            outcomes = [o for o in blueprint.outcomes if o.outcome_id in item.outcome_ids]
            if not outcomes:
                logger.warning(f"No outcomes found for {item.item_id}")
                continue
            
            # Build retrieval query
            outcome_texts = [o.statement for o in outcomes]
            keywords = []
            for o in outcomes:
                if hasattr(o, 'keywords') and o.keywords:
                    keywords.extend(o.keywords)
            
            query = f"{' '.join(outcome_texts)} {' '.join(keywords)}"
            
            # Retrieve context - CRITICAL for source trace
            context_chunks = self.retrieve_chunks(query, top_k=2)
            if not context_chunks:
                logger.warning(f"No context found for {item.item_id}")
                continue
            
            context_text = "\n\n".join([f"[Nguồn: {c.chunk_id}, trang {c.page}]\n{c.text}" for c in context_chunks])
            
            # Generate based on type
            if item.question_type == 'mcq_single':
                question = self._generate_mcq_question(item, outcomes, context_text, context_chunks)
            elif item.question_type == 'essay':
                question = self._generate_essay_question(item, outcomes, context_text, context_chunks)
            else:
                continue
            
            if question:
                questions.append(question)
        
        # Generate exam ID from timestamp
        import datetime
        exam_id = f"exam_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        exam = Exam(
            exam_id=exam_id,
            title=f"Đề kiểm tra - {matrix.global_config.time_minutes} phút",
            subject="Toán học",
            grade=9,
            time_minutes=matrix.global_config.time_minutes,
            total_points=matrix.global_config.total_points,
            questions=questions
        )
        
        logger.info(f"✅ Generated {len(questions)} questions")
        return exam
    
    def _generate_mcq_question(
        self,
        item: MatrixItem,
        outcomes: List[LearningOutcome],
        context: str,
        context_chunks: List[Chunk]
    ) -> Optional[Question]:
        """Generate single MCQ question with JSON output"""
        
        prompt = f"""Dựa vào tài liệu sau, tạo 1 câu hỏi trắc nghiệm.

YÊU CẦU CẦN ĐẠT:
{chr(10).join(['- ' + o.statement for o in outcomes])}

MỨC ĐỘ NHẬN THỨC: {item.cognitive_level}

TÀI LIỆU:
{context}

Trả về JSON:
{{
  "stem": "Câu hỏi...",
  "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
  "answer": "A",
  "explanation": "Giải thích tại sao đáp án đúng"
}}

CHỈ sử dụng thông tin từ tài liệu. Không bịa."""

        response = self._generate_with_ollama(prompt, system="Tạo câu hỏi trắc nghiệm chất lượng cao.")
        
        try:
            # Parse JSON
            json_str = response.strip()
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0]
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0]
            
            data = json.loads(json_str)
            
            # Build source trace from context chunks
            source_trace = [SourceTrace(
                chunk_id=c.chunk_id,
                page=c.page,
                section=c.section
            ) for c in context_chunks[:1]]  # Top 1 chunk
            
            question = Question(
                question_id=item.item_id,
                question_type='mcq_single',
                statement=data['stem'],
                options=data['options'],
                correct_answer=data['answer'],
                explanation=data.get('explanation', ''),
                points=item.points_each,
                cognitive_level=item.cognitive_level,
                difficulty=item.difficulty,
                source_trace=source_trace
            )
            
            return question
            
        except Exception as e:
            logger.error(f"Failed to parse MCQ JSON: {e}")
            return None
    
    def _generate_essay_question(
        self,
        item: MatrixItem,
        outcomes: List[LearningOutcome],
        context: str,
        context_chunks: List[Chunk]
    ) -> Optional[Question]:
        """Generate essay question with rubric"""
        
        prompt = f"""Tạo 1 bài toán tự luận thực tế.

YÊU CẦU: {outcomes[0].statement}
MỨC ĐỘ: {item.cognitive_level}
ĐIỂM: {item.points_each}

TÀI LIỆU:
{context}

Trả về JSON:
{{
  "stem": "Đề bài...",
  "answer": "Đáp án/Hướng dẫn giải",
  "rubric": "Rubric chấm điểm"
}}"""

        response = self._generate_with_ollama(prompt)
        
        try:
            json_str = response.strip()
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0]
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0]
            
            data = json.loads(json_str)
            
            source_trace = [SourceTrace(
                chunk_id=c.chunk_id,
                page=c.page,
                section=c.section
            ) for c in context_chunks[:1]]
            
            question = Question(
                question_id=item.item_id,
                question_type='essay',
                statement=data['stem'],
                suggested_answer=data.get('answer', ''),
                rubric=QuestionRubric(
                    max_points=item.points_each,
                    criteria=[]
                ),
                points=item.points_each,
                cognitive_level=item.cognitive_level,
                difficulty=item.difficulty,
                source_trace=source_trace
            )
            
            return question
            
        except Exception as e:
            logger.error(f"Failed to parse Essay JSON: {e}")
            return None
    
    # ==================== STEP 5: VALIDATION ====================
    
    def validate_exam(self, exam: Exam, blueprint: Blueprint) -> bool:
        """
        Validate exam with 2 layers:
        1. Rule-based (structure, format)
        2. Content-based (alignment with blueprint)
        """
        logger.info("🔍 Validating exam...")
        
        # Layer 1: Rule-based validation
        result = self.validator.validate(exam)
        
        if not result.is_valid:
            logger.error(f"❌ Validation failed: {len(result.issues)} issues")
            for issue in result.issues[:5]:  # Show first 5
                logger.error(f"  - [{issue.severity}] {issue.question_id}: {issue.message}")
            return False
        
        # Layer 2: Content alignment check
        for q in exam.questions:
            if not q.source_trace:
                logger.warning(f"Question {q.question_id} has no source trace")
                return False
        
        logger.info("✅ Validation passed")
        return True
    
    # ==================== UTILITIES ====================
    
    def _generate_with_ollama(self, prompt: str, system: str = "") -> str:
        """Generate with Ollama"""
        url = f"{self.ollama_url}/api/generate"
        
        payload = {
            "model": self.ollama_model,
            "prompt": prompt,
            "system": system,
            "stream": False
        }
        
        try:
            response = requests.post(url, json=payload, timeout=120)
            response.raise_for_status()
            return response.json()['response']
        except Exception as e:
            logger.error(f"Ollama error: {e}")
            return ""
    
    # ==================== FULL PIPELINE ====================
    
    def run_full_pipeline(
        self,
        pdf_content: str,
        config: GlobalConfig,
        cognitive_ratios: CognitiveRatios,
        difficulty_ratios: DifficultyRatios,
        output_dir: str = "./output"
    ) -> Dict[str, Any]:
        """
        Run complete pipeline: PDF → Blueprint → Matrix → Questions → Validate
        
        Returns:
            {
                'document': Document,
                'blueprint': Blueprint,
                'matrix': ExamMatrix,
                'exam': Exam,
                'valid': bool
            }
        """
        logger.info("🚀 Starting full exam generation pipeline...")
        
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        
        # Step 1: Parse document
        document = self.parse_pdf_text(pdf_content)
        with open(f"{output_dir}/document.json", 'w', encoding='utf-8') as f:
            json.dump(document.model_dump(mode='json'), f, ensure_ascii=False, indent=2)
        
        # Step 2: Chunk & Index
        chunks = self.chunk_document(document)
        self.build_rag_index(chunks)
        with open(f"{output_dir}/chunks.json", 'w', encoding='utf-8') as f:
            json.dump([c.model_dump(mode='json') for c in chunks], f, ensure_ascii=False, indent=2)
        
        # Step 3: Extract blueprint
        blueprint = self.extract_blueprint(document)
        with open(f"{output_dir}/blueprint.json", 'w', encoding='utf-8') as f:
            json.dump(blueprint.model_dump(mode='json'), f, ensure_ascii=False, indent=2)
        
        # Step 4: Plan matrix
        matrix = self.plan_matrix(blueprint, config, cognitive_ratios, difficulty_ratios)
        with open(f"{output_dir}/matrix.json", 'w', encoding='utf-8') as f:
            json.dump(matrix.model_dump(mode='json'), f, ensure_ascii=False, indent=2)
        
        # Step 5: Generate questions
        exam = self.generate_questions(matrix, blueprint)
        with open(f"{output_dir}/exam.json", 'w', encoding='utf-8') as f:
            json.dump(exam.model_dump(mode='json'), f, ensure_ascii=False, indent=2)
        
        # Step 6: Validate
        is_valid = self.validate_exam(exam, blueprint)
        
        logger.info("✅ Pipeline completed!")
        
        return {
            'document': document,
            'blueprint': blueprint,
            'matrix': matrix,
            'exam': exam,
            'valid': is_valid
        }
