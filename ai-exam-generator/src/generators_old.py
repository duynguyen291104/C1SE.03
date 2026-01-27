"""
Module sinh blueprint, matrix và câu hỏi bằng AI
"""
import json
import logging
from typing import List, Optional
from openai import OpenAI

from .models import (
    Blueprint, Topic, LearningOutcome, SourceTrace,
    ExamMatrix, MatrixItem, GlobalConfig, CognitiveRatios, DifficultyRatios,
    Question, QuestionRubric, Exam, Chunk
)
from .config import get_settings
from .rag_indexer import RAGIndexer

logger = logging.getLogger(__name__)


class BlueprintGenerator:
    """Sinh blueprint kiến thức từ đề cương"""
    
    def __init__(self, client: OpenAI = None):
        settings = get_settings()
        self.client = client or OpenAI(api_key=settings.openai_api_key)
        self.model = settings.openai_model
    
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
        logger.info("🧠 Generating blueprint from syllabus...")
        
        # Combine text from chunks
        full_text = "\n\n".join([c.text for c in chunks])
        
        # Create prompt
        prompt = self._create_blueprint_prompt(full_text, subject, grade)
        
        # Call AI
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "Bạn là chuyên gia phân tích đề cương giáo dục. Trả về JSON đúng format."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.3
        )
        
        # Parse response
        result = json.loads(response.choices[0].message.content)
        
        # Create Blueprint object
        topics = []
        for topic_data in result.get("topics", []):
            outcomes = []
            for outcome_data in topic_data.get("outcomes", []):
                outcomes.append(LearningOutcome(
                    outcome_id=outcome_data.get("outcome_id", ""),
                    verb=outcome_data.get("verb", ""),
                    statement=outcome_data.get("statement", ""),
                    cognitive_level_hint=outcome_data.get("cognitive_level_hint", []),
                    source_trace=[]  # Will be filled later
                ))
            
            topics.append(Topic(
                topic_id=topic_data.get("topic_id", ""),
                name=topic_data.get("name", ""),
                outcomes=outcomes,
                keywords=topic_data.get("keywords", []),
                subtopics=topic_data.get("subtopics", [])
            ))
        
        blueprint = Blueprint(
            subject=result.get("subject", subject or ""),
            grade=result.get("grade", grade),
            term=result.get("term"),
            topics=topics
        )
        
        logger.info(f"✅ Generated blueprint with {len(topics)} topics")
        return blueprint
    
    def _create_blueprint_prompt(
        self,
        text: str,
        subject: str = None,
        grade: int = None
    ) -> str:
        """Tạo prompt để sinh blueprint"""
        
        prompt = f"""Phân tích đề cương sau và trích xuất:
1. Các chương/chủ đề chính
2. Yêu cầu cần đạt (outcomes) cho mỗi chủ đề
3. Từ khóa và khái niệm quan trọng

ĐỀ CƯƠNG:
{text[:4000]}  # Limit token

HƯỚNG DẪN:
- Mỗi outcome phải có động từ rõ ràng (nhận biết, giải thích, vận dụng...)
- Gợi ý mức độ nhận thức: ["biet", "hieu", "vandung", "vandungcao"]
- Trả về JSON theo format:

{{
  "subject": "{subject or 'Môn học'}",
  "grade": {grade or 'null'},
  "term": "Học kỳ I/II (nếu có)",
  "topics": [
    {{
      "topic_id": "T1",
      "name": "Tên chương/chủ đề",
      "outcomes": [
        {{
          "outcome_id": "O1",
          "verb": "giải",
          "statement": "Giải hệ phương trình bậc nhất hai ẩn",
          "cognitive_level_hint": ["biet", "hieu"]
        }}
      ],
      "keywords": ["từ khóa 1", "từ khóa 2"],
      "subtopics": ["chủ đề con 1", "chủ đề con 2"]
    }}
  ]
}}
"""
        return prompt


class MatrixGenerator:
    """Sinh ma trận đề kiểm tra"""
    
    def __init__(self, client: OpenAI = None):
        settings = get_settings()
        self.client = client or OpenAI(api_key=settings.openai_api_key)
        self.model = settings.openai_model
    
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
        logger.info("📊 Generating exam matrix...")
        
        # Create prompt
        prompt = self._create_matrix_prompt(
            blueprint,
            global_config,
            cognitive_ratios,
            difficulty_ratios
        )
        
        # Call AI
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "Bạn là chuyên gia thiết kế ma trận đề kiểm tra. Trả về JSON đúng format."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.3
        )
        
        result = json.loads(response.choices[0].message.content)
        
        # Parse items_plan
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
        
        matrix = ExamMatrix(
            global_config=global_config,
            cognitive_ratios=cognitive_ratios,
            difficulty_ratios=difficulty_ratios,
            items_plan=items
        )
        
        logger.info(f"✅ Generated matrix with {len(items)} rows")
        return matrix
    
    def _create_matrix_prompt(
        self,
        blueprint: Blueprint,
        global_config: GlobalConfig,
        cognitive_ratios: CognitiveRatios,
        difficulty_ratios: DifficultyRatios
    ) -> str:
        """Tạo prompt sinh ma trận"""
        
        # Summarize blueprint
        topics_summary = "\n".join([
            f"- {t.topic_id}: {t.name} ({len(t.outcomes)} outcomes)"
            for t in blueprint.topics
        ])
        
        prompt = f"""Thiết kế ma trận đề kiểm tra theo yêu cầu:

CÁC CHỦ ĐỀ:
{topics_summary}

YÊU CẦU:
- Thời gian: {global_config.time_minutes} phút
- Tổng điểm: {global_config.total_points}
- Tỷ lệ trắc nghiệm: {global_config.mcq_ratio * 100}%
- Tỷ lệ tự luận: {global_config.essay_ratio * 100}%

TỶ LỆ MỨC ĐỘ NHẬN THỨC:
- Biết: {cognitive_ratios.biet * 100}%
- Hiểu: {cognitive_ratios.hieu * 100}%
- Vận dụng: {cognitive_ratios.vandung * 100}%
- Vận dụng cao: {cognitive_ratios.vandungcao * 100}%

TỶ LỆ ĐỘ KHÓ:
- Dễ: {difficulty_ratios.de * 100}%
- Trung bình: {difficulty_ratios.tb * 100}%
- Khó: {difficulty_ratios.kho * 100}%

LOẠI CÂU HỎI:
- mcq_single: Trắc nghiệm 1 đáp án
- mcq_multiple: Trắc nghiệm nhiều đáp án
- true_false: Đúng/Sai
- fill_blank: Điền khuyết
- short_answer: Tự luận ngắn
- essay: Tự luận

Trả về JSON:
{{
  "items_plan": [
    {{
      "row_id": "R1",
      "topic_id": "T1",
      "outcome_ids": ["O1", "O2"],
      "cognitive_level": "biet|hieu|vandung|vandungcao",
      "difficulty": "de|tb|kha|kho",
      "type": "mcq_single|essay|...",
      "n_questions": 2,
      "points_each": 0.25
    }}
  ]
}}

ĐẢM BẢO:
- Tổng điểm = {global_config.total_points}
- Tỷ lệ các mức độ gần đúng yêu cầu
- Phân bổ đều các chủ đề
"""
        return prompt


class QuestionGenerator:
    """Sinh câu hỏi từ ma trận"""
    
    def __init__(self, client: OpenAI = None, indexer: RAGIndexer = None):
        settings = get_settings()
        self.client = client or OpenAI(api_key=settings.openai_api_key)
        self.model = settings.openai_model
        self.indexer = indexer
    
    def generate_exam(
        self,
        matrix: ExamMatrix,
        blueprint: Blueprint,
        title: str = "Đề kiểm tra"
    ) -> Exam:
        """
        Sinh đề kiểm tra từ ma trận
        
        Args:
            matrix: Ma trận đề
            blueprint: Blueprint kiến thức
            title: Tiêu đề đề thi
            
        Returns:
            Exam object
        """
        logger.info("📝 Generating exam questions...")
        
        all_questions = []
        question_counter = 1
        
        for item in matrix.items_plan:
            # Find topic info
            topic = next((t for t in blueprint.topics if t.topic_id == item.topic_id), None)
            
            # Generate questions for this matrix item
            questions = self._generate_questions_for_item(
                item,
                topic,
                start_id=question_counter
            )
            
            all_questions.extend(questions)
            question_counter += len(questions)
        
        exam = Exam(
            exam_id=f"exam_{blueprint.subject}_{blueprint.grade or 'X'}",
            title=title,
            subject=blueprint.subject,
            grade=blueprint.grade,
            time_minutes=matrix.global_config.time_minutes,
            total_points=matrix.global_config.total_points,
            questions=all_questions
        )
        
        logger.info(f"✅ Generated {len(all_questions)} questions")
        return exam
    
    def _generate_questions_for_item(
        self,
        item: MatrixItem,
        topic: Optional[Topic],
        start_id: int
    ) -> List[Question]:
        """Sinh câu hỏi cho một item trong ma trận"""
        
        questions = []
        
        # Get context from RAG
        context = ""
        if self.indexer and topic:
            search_query = f"{topic.name} {' '.join(topic.keywords[:3])}"
            relevant_chunks = self.indexer.search(search_query, top_k=3)
            context = "\n\n".join([c.text for c in relevant_chunks])
            source_trace = self.indexer.get_source_traces(relevant_chunks)
        else:
            source_trace = []
        
        # Create prompt
        prompt = self._create_question_prompt(item, topic, context)
        
        # Call AI
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "Bạn là chuyên gia ra đề kiểm tra. Sinh câu hỏi chất lượng cao, rõ ràng, không mơ hồ."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.7
            )
            
            result = json.loads(response.choices[0].message.content)
            
            # Parse questions
            for i, q_data in enumerate(result.get("questions", [])[:item.n_questions]):
                rubric = None
                if item.type in ["short_answer", "essay"] and "rubric" in q_data:
                    rubric = QuestionRubric(
                        max_points=item.points_each,
                        criteria=q_data["rubric"].get("criteria", [])
                    )
                
                question = Question(
                    id=f"Q{start_id + i}",
                    type=item.type,
                    topic_id=item.topic_id,
                    cognitive_level=item.cognitive_level,
                    difficulty=item.difficulty,
                    stem=q_data.get("stem", ""),
                    options=q_data.get("options"),
                    answer=q_data.get("answer", ""),
                    explanation=q_data.get("explanation"),
                    rubric=rubric,
                    source_trace=source_trace,
                    points=item.points_each
                )
                questions.append(question)
        
        except Exception as e:
            logger.error(f"❌ Error generating questions: {e}")
        
        return questions
    
    def _create_question_prompt(
        self,
        item: MatrixItem,
        topic: Optional[Topic],
        context: str
    ) -> str:
        """Tạo prompt sinh câu hỏi"""
        
        topic_name = topic.name if topic else "Chủ đề"
        
        type_instructions = {
            "mcq_single": "4 lựa chọn A/B/C/D, chỉ 1 đáp án đúng",
            "mcq_multiple": "4 lựa chọn, có thể nhiều đáp án đúng",
            "true_false": "Đúng hoặc Sai",
            "fill_blank": "Điền từ/cụm từ vào chỗ trống",
            "short_answer": "Trả lời ngắn 2-3 câu",
            "essay": "Tự luận chi tiết"
        }
        
        prompt = f"""Sinh {item.n_questions} câu hỏi cho:
- Chủ đề: {topic_name}
- Mức độ: {item.cognitive_level}
- Độ khó: {item.difficulty}
- Loại: {item.type} ({type_instructions.get(item.type, '')})
- Điểm mỗi câu: {item.points_each}

NGỮ LIỆU THAM KHẢO:
{context[:2000] if context else 'Không có'}

YÊU CẦU:
- Câu hỏi rõ ràng, không mơ hồ
- Đáp án chính xác, có căn cứ
- Với tự luận: cung cấp rubric chi tiết

Trả về JSON:
{{
  "questions": [
    {{
      "stem": "Câu hỏi...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],  # nếu là MCQ
      "answer": "B",  # hoặc text với tự luận
      "explanation": "Giải thích...",
      "rubric": {{  # chỉ cho tự luận
        "criteria": [
          {{"description": "Trình bày đúng công thức", "points": 0.5}},
          {{"description": "Tính toán chính xác", "points": 0.5}}
        ]
      }}
    }}
  ]
}}
"""
        return prompt
