"""
Module sinh blueprint, matrix và câu hỏi bằng OpenAI
"""
import json
from typing import List, Dict, Any
from loguru import logger
from openai import OpenAI

from .models import (
    Blueprint, Topic, LearningOutcome, SourceTrace,
    ExamMatrix, MatrixItem, GlobalConfig, CognitiveRatios, DifficultyRatios,
    Question, QuestionRubric, Exam, Chunk
)
from .config import get_config
from .rag_indexer import RAGIndexer


class BlueprintGenerator:
    """Sinh blueprint kiến thức từ đề cương"""
    
    def __init__(self, client: OpenAI = None):
        config = get_config()
        self.client = client or OpenAI()
        self.model = config.openai_model
        self.temperature = config.temperature
    
    def generate(
        self,
        chunks: List[Chunk],
        subject: str = None,
        grade: int = None
    ) -> Blueprint:
        """
        Sinh blueprint từ chunks
        
        Args:
            chunks: Các chunks chứa nội dung đề cương
            subject: Môn học
            grade: Khối
            
        Returns:
            Blueprint object
        """
        logger.info("🧠 Đang sinh blueprint từ đề cương...")
        
        # Combine text from chunks
        full_text = "\n\n".join([f"[Trang {c.page}] {c.text}" for c in chunks])
        
        # Create prompt
        prompt = self._create_blueprint_prompt(full_text, subject, grade)
        
        # Call OpenAI
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "Bạn là chuyên gia phân tích đề cương giáo dục Việt Nam. Trả về JSON đúng format, không giải thích thêm."
                    },
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.3
            )
            
            # Parse response
            result = json.loads(response.choices[0].message.content)
            blueprint = self._parse_blueprint_response(result, subject, grade, chunks)
            
            logger.info(f"✅ Đã sinh blueprint với {len(blueprint.topics)} chủ đề")
            return blueprint
            
        except Exception as e:
            logger.error(f"❌ Lỗi khi sinh blueprint: {e}")
            raise
    
    def _create_blueprint_prompt(
        self,
        text: str,
        subject: str = None,
        grade: int = None
    ) -> str:
        """Tạo prompt để sinh blueprint"""
        
        prompt = f"""Phân tích đề cương/kế hoạch kiểm tra sau và trích xuất:

1. **Các chương/chủ đề chính** được đề cập
2. **Yêu cầu cần đạt (learning outcomes)** cho mỗi chủ đề
3. **Từ khóa** và khái niệm quan trọng
4. **Mức độ nhận thức** gợi ý cho mỗi outcome

ĐỀ CƯƠNG:
{text[:8000]}

HƯỚNG DẪN OUTPUT:
- Mỗi outcome phải có **động từ hành động** rõ ràng (VD: nhận biết, giải thích, giải, phân tích, vận dụng...)
- Gợi ý mức độ theo Bloom: biet (biết), hieu (hiểu), vandung (vận dụng), vandungcao (vận dụng cao)
- Trích xuất chính xác từ đề cương, không bịa

Trả về JSON theo format sau:

{{
  "subject": "{subject or 'Tên môn học'}",
  "grade": {grade if grade else 'null'},
  "term": "Học kỳ I hoặc II (nếu có trong đề cương)",
  "topics": [
    {{
      "topic_id": "T1",
      "name": "Tên chương/chủ đề chính",
      "outcomes": [
        {{
          "outcome_id": "O1",
          "verb": "giải",
          "statement": "Giải hệ phương trình bậc nhất hai ẩn bằng phương pháp thế",
          "cognitive_level_hint": ["biet", "hieu"]
        }},
        {{
          "outcome_id": "O2",
          "verb": "vận dụng",
          "statement": "Vận dụng giải bài toán thực tế",
          "cognitive_level_hint": ["vandung"]
        }}
      ],
      "keywords": ["hệ phương trình", "phương pháp thế", "phương pháp cộng"],
      "subtopics": ["Hệ phương trình tương đương", "Giải hệ bằng đồ thị"]
    }}
  ]
}}
"""
        return prompt
    
    def _parse_blueprint_response(
        self,
        result: Dict[str, Any],
        subject: str,
        grade: int,
        chunks: List[Chunk]
    ) -> Blueprint:
        """Parse response thành Blueprint object"""
        
        topics = []
        for topic_data in result.get("topics", []):
            outcomes = []
            for outcome_data in topic_data.get("outcomes", []):
                # Tạo source trace đơn giản (sẽ cải thiện sau với RAG)
                source_trace = [
                    SourceTrace(
                        chunk_id=chunks[0].chunk_id if chunks else "unknown",
                        page=chunks[0].page if chunks else 1
                    )
                ]
                
                outcomes.append(LearningOutcome(
                    outcome_id=outcome_data.get("outcome_id", ""),
                    verb=outcome_data.get("verb", ""),
                    statement=outcome_data.get("statement", ""),
                    cognitive_level_hint=outcome_data.get("cognitive_level_hint", []),
                    source_trace=source_trace
                ))
            
            topics.append(Topic(
                topic_id=topic_data.get("topic_id", ""),
                name=topic_data.get("name", ""),
                outcomes=outcomes,
                keywords=topic_data.get("keywords", []),
                subtopics=topic_data.get("subtopics", [])
            ))
        
        return Blueprint(
            subject=result.get("subject", subject or ""),
            grade=result.get("grade", grade),
            term=result.get("term"),
            topics=topics
        )


class MatrixGenerator:
    """Sinh ma trận đề kiểm tra theo CV 7991"""
    
    def __init__(self, client: OpenAI = None):
        config = get_config()
        self.client = client or OpenAI()
        self.model = config.openai_model
        self.temperature = config.temperature
    
    def generate(
        self,
        blueprint: Blueprint,
        global_config: GlobalConfig,
        cognitive_ratios: CognitiveRatios,
        difficulty_ratios: DifficultyRatios
    ) -> ExamMatrix:
        """
        Sinh ma trận từ blueprint
        
        Args:
            blueprint: Blueprint kiến thức
            global_config: Cấu hình chung (thời gian, tổng điểm...)
            cognitive_ratios: Tỷ lệ mức độ nhận thức
            difficulty_ratios: Tỷ lệ độ khó
            
        Returns:
            ExamMatrix object
        """
        logger.info("📊 Đang sinh ma trận đề kiểm tra...")
        
        # Create prompt
        prompt = self._create_matrix_prompt(
            blueprint,
            global_config,
            cognitive_ratios,
            difficulty_ratios
        )
        
        try:
            # Call OpenAI
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "Bạn là chuyên gia thiết kế ma trận đề kiểm tra theo quy định của Bộ GD&ĐT Việt Nam. Trả về JSON đúng format."
                    },
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.3
            )
            
            result = json.loads(response.choices[0].message.content)
            matrix = self._parse_matrix_response(result, global_config, cognitive_ratios, difficulty_ratios)
            
            # Validate
            self._validate_matrix(matrix)
            
            logger.info(f"✅ Đã sinh ma trận với {len(matrix.items_plan)} dòng")
            return matrix
            
        except Exception as e:
            logger.error(f"❌ Lỗi khi sinh ma trận: {e}")
            raise
    
    def _create_matrix_prompt(
        self,
        blueprint: Blueprint,
        global_config: GlobalConfig,
        cognitive_ratios: CognitiveRatios,
        difficulty_ratios: DifficultyRatios
    ) -> str:
        """Tạo prompt sinh ma trận"""
        
        # Tổng hợp topics
        topics_detail = []
        for t in blueprint.topics:
            outcomes_str = "\n    ".join([
                f"+ {o.outcome_id}: {o.statement} (mức độ gợi ý: {', '.join(o.cognitive_level_hint)})"
                for o in t.outcomes
            ])
            topics_detail.append(f"  {t.topic_id}: {t.name}\n    {outcomes_str}")
        
        topics_summary = "\n".join(topics_detail)
        
        prompt = f"""Thiết kế ma trận đề kiểm tra (Matrix + Bảng đặc tả) cho đề kiểm tra {blueprint.subject} lớp {blueprint.grade}.

CÁC CHỦ ĐỀ VÀ YÊU CẦU CẦN ĐẠT:
{topics_summary}

YÊU CẦU CHUNG:
- Thời gian: {global_config.time_minutes} phút
- Tổng điểm: {global_config.total_points} điểm
- Tỷ lệ trắc nghiệm: {global_config.mcq_ratio * 100:.0f}%
- Tỷ lệ tự luận: {global_config.essay_ratio * 100:.0f}%

TỶ LỆ MỨC ĐỘ NHẬN THỨC (Bloom):
- Biết (biet): {cognitive_ratios.biet * 100:.0f}%
- Hiểu (hieu): {cognitive_ratios.hieu * 100:.0f}%
- Vận dụng (vandung): {cognitive_ratios.vandung * 100:.0f}%
- Vận dụng cao (vandungcao): {cognitive_ratios.vandungcao * 100:.0f}%

TỶ LỆ ĐỘ KHÓ:
- Dễ (de): {difficulty_ratios.de * 100:.0f}%
- Trung bình (tb): {difficulty_ratios.tb * 100:.0f}%
- Khó (kho): {difficulty_ratios.kho * 100:.0f}%

LOẠI CÂU HỎI:
- mcq_single: Trắc nghiệm 1 đáp án đúng (4 lựa chọn A/B/C/D)
- mcq_multiple: Trắc nghiệm nhiều đáp án đúng
- true_false: Đúng/Sai
- short_answer: Tự luận ngắn (1-3 câu)
- essay: Tự luận dài (có rubric chi tiết)

Trả về JSON theo format:
{{
  "items_plan": [
    {{
      "row_id": "R1",
      "topic_id": "T1",
      "outcome_ids": ["O1"],
      "cognitive_level": "biet",
      "difficulty": "de",
      "type": "mcq_single",
      "n_questions": 4,
      "points_each": 0.25
    }},
    {{
      "row_id": "R2",
      "topic_id": "T1",
      "outcome_ids": ["O2", "O3"],
      "cognitive_level": "vandung",
      "difficulty": "kho",
      "type": "essay",
      "n_questions": 1,
      "points_each": 2.0
    }}
  ]
}}

YÊU CẦU:
1. Tổng điểm các câu PHẢI BẰNG {global_config.total_points}
2. Phân bổ đều các topic
3. Tỷ lệ mức độ và độ khó gần đúng yêu cầu
4. Câu trắc nghiệm thường 0.25-0.5 điểm/câu
5. Câu tự luận 1-3 điểm/câu
"""
        return prompt
    
    def _parse_matrix_response(
        self,
        result: Dict[str, Any],
        global_config: GlobalConfig,
        cognitive_ratios: CognitiveRatios,
        difficulty_ratios: DifficultyRatios
    ) -> ExamMatrix:
        """Parse response thành ExamMatrix"""
        
        items = []
        for item_data in result.get("items_plan", []):
            items.append(MatrixItem(
                row_id=item_data.get("row_id", ""),
                topic_id=item_data.get("topic_id", ""),
                outcome_ids=item_data.get("outcome_ids", []),
                cognitive_level=item_data.get("cognitive_level", "biet"),
                difficulty=item_data.get("difficulty", "tb"),
                type=item_data.get("type", "mcq_single"),
                n_questions=item_data.get("n_questions", 1),
                points_each=item_data.get("points_each", 0.25),
                source_trace=[]
            ))
        
        return ExamMatrix(
            global_config=global_config,
            cognitive_ratios=cognitive_ratios,
            difficulty_ratios=difficulty_ratios,
            items_plan=items
        )
    
    def _validate_matrix(self, matrix: ExamMatrix):
        """Kiểm tra tính hợp lệ của ma trận"""
        total_points = sum(item.n_questions * item.points_each for item in matrix.items_plan)
        
        if abs(total_points - matrix.global_config.total_points) > 0.5:
            logger.warning(
                f"⚠️ Tổng điểm ({total_points}) không khớp với yêu cầu ({matrix.global_config.total_points})"
            )


class QuestionGenerator:
    """Sinh câu hỏi từ ma trận + RAG"""
    
    def __init__(self, client: OpenAI = None, indexer: RAGIndexer = None):
        config = get_config()
        self.client = client or OpenAI()
        self.model = config.openai_model
        self.temperature = config.temperature
        self.top_k = config.top_k
        self.indexer = indexer
    
    def generate_exam(
        self,
        matrix: ExamMatrix,
        blueprint: Blueprint
    ) -> Exam:
        """
        Sinh đề thi từ ma trận
        
        Args:
            matrix: Ma trận đề
            blueprint: Blueprint kiến thức
            
        Returns:
            Exam object
        """
        logger.info(f"📝 Đang sinh {sum(item.n_questions for item in matrix.items_plan)} câu hỏi...")
        
        all_questions = []
        
        for item in matrix.items_plan:
            # Lấy topic và outcomes
            topic = self._get_topic(blueprint, item.topic_id)
            outcomes = [self._get_outcome(topic, oid) for oid in item.outcome_ids if topic]
            
            # Generate N questions cho item này
            for i in range(item.n_questions):
                question = self._generate_single_question(item, topic, outcomes, i + 1)
                all_questions.append(question)
        
        exam = Exam(questions=all_questions)
        logger.info(f"✅ Đã sinh {len(all_questions)} câu hỏi")
        return exam
    
    def _generate_single_question(
        self,
        item: MatrixItem,
        topic: Topic,
        outcomes: List[LearningOutcome],
        question_number: int
    ) -> Question:
        """Sinh 1 câu hỏi"""
        
        # Retrieve context từ RAG
        context_chunks = []
        if self.indexer:
            query = f"{topic.name if topic else ''} {' '.join([o.statement for o in outcomes if o])}"
            context_chunks = self.indexer.search(query, top_k=self.top_k)
        
        context_text = "\n\n".join([f"[Trang {c.page}] {c.text[:500]}" for c in context_chunks[:3]])
        
        # Create prompt
        prompt = self._create_question_prompt(item, topic, outcomes, context_text)
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "Bạn là chuyên gia ra đề kiểm tra giáo dục Việt Nam. Sinh câu hỏi chất lượng cao, trả về JSON."
                    },
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=self.temperature
            )
            
            result = json.loads(response.choices[0].message.content)
            question = self._parse_question_response(result, item, context_chunks)
            
            return question
            
        except Exception as e:
            logger.error(f"❌ Lỗi sinh câu {item.row_id}: {e}")
            # Return fallback question
            return self._create_fallback_question(item)
    
    def _create_question_prompt(
        self,
        item: MatrixItem,
        topic: Topic,
        outcomes: List[LearningOutcome],
        context: str
    ) -> str:
        """Tạo prompt sinh câu hỏi"""
        
        outcomes_str = "\n".join([f"- {o.statement}" for o in outcomes if o])
        
        type_instructions = {
            "mcq_single": "Trắc nghiệm 1 đáp án đúng, 4 lựa chọn A/B/C/D. Các đáp án sai phải hợp lý, không rõ ràng sai.",
            "essay": "Tự luận có rubric chi tiết (tiêu chí chấm điểm).",
            "short_answer": "Tự luận ngắn, đáp án 1-3 câu."
        }
        
        prompt = f"""Sinh câu hỏi kiểm tra với yêu cầu sau:

CHỦ ĐỀ: {topic.name if topic else 'Không rõ'}
YÊU CẦU CẦN ĐẠT:
{outcomes_str}

LOẠI CÂU HỎI: {item.type}
MỨC ĐỘ: {item.cognitive_level}
ĐỘ KHÓ: {item.difficulty}
ĐIỂM: {item.points_each}

HƯỚNG DẪN: {type_instructions.get(item.type, '')}

NGỮ LIỆU THAM KHẢO:
{context[:2000] if context else '(Không có ngữ liệu)'}

Trả về JSON:
{{
  "stem": "Nội dung câu hỏi (rõ ràng, đầy đủ ngữ cảnh)",
  "options": ["A. ...", "B. ...", "C. ...", "D. ..."],  // Chỉ cho MCQ
  "answer": "B",  // Hoặc đáp án đúng cho tự luận
  "explanation": "Giải thích tại sao đáp án này đúng",
  "rubric": null  // Hoặc object {{criteria: [...], max_score: ...}} cho essay
}}

YÊU CẦU:
- Câu hỏi phải dựa vào ngữ liệu (không bịa)
- Đúng mức độ nhận thức: {item.cognitive_level}
- Rõ ràng, không mơ hồ
- Phù hợp học sinh lớp này
"""
        return prompt
    
    def _parse_question_response(
        self,
        result: Dict[str, Any],
        item: MatrixItem,
        context_chunks: List[Chunk]
    ) -> Question:
        """Parse response thành Question"""
        
        # Tạo source trace
        source_trace = []
        if context_chunks:
            source_trace = [
                SourceTrace(chunk_id=c.chunk_id, page=c.page, section=c.section)
                for c in context_chunks[:2]
            ]
        
        # Parse rubric nếu có
        rubric = None
        if result.get("rubric") and isinstance(result["rubric"], dict):
            rubric = QuestionRubric(
                criteria=result["rubric"].get("criteria", []),
                max_score=result["rubric"].get("max_score", item.points_each)
            )
        
        return Question(
            id=f"{item.row_id}_Q1",
            type=item.type,
            topic_id=item.topic_id,
            cognitive_level=item.cognitive_level,
            difficulty=item.difficulty,
            stem=result.get("stem", ""),
            options=result.get("options", []),
            answer=result.get("answer", ""),
            explanation=result.get("explanation", ""),
            points=item.points_each,
            rubric=rubric,
            source_trace=source_trace
        )
    
    def _create_fallback_question(self, item: MatrixItem) -> Question:
        """Tạo câu hỏi dự phòng nếu AI fail"""
        return Question(
            id=f"{item.row_id}_Q1",
            type=item.type,
            topic_id=item.topic_id,
            cognitive_level=item.cognitive_level,
            difficulty=item.difficulty,
            stem="[Câu hỏi chưa sinh được - cần review]",
            options=[],
            answer="",
            explanation="",
            points=item.points_each,
            source_trace=[]
        )
    
    def _get_topic(self, blueprint: Blueprint, topic_id: str) -> Topic:
        """Lấy topic theo ID"""
        for topic in blueprint.topics:
            if topic.topic_id == topic_id:
                return topic
        return None
    
    def _get_outcome(self, topic: Topic, outcome_id: str) -> LearningOutcome:
        """Lấy outcome theo ID"""
        if not topic:
            return None
        for outcome in topic.outcomes:
            if outcome.outcome_id == outcome_id:
                return outcome
        return None
