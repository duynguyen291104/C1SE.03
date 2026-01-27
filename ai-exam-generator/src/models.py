"""
Data models cho hệ thống sinh đề kiểm tra
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime


# ===================== DOCUMENT MODELS =====================

class DocumentPage(BaseModel):
    """Một trang trong PDF"""
    page: int
    text: str
    tables: List[Dict[str, Any]] = Field(default_factory=list)
    images: List[str] = Field(default_factory=list)


class DocumentMetadata(BaseModel):
    """Metadata của tài liệu"""
    subject: Optional[str] = None
    grade: Optional[int] = None
    term: Optional[str] = None
    school_year: Optional[str] = None
    author: Optional[str] = None


class Document(BaseModel):
    """Tài liệu PDF đã parse"""
    doc_id: str
    file_name: str
    metadata: DocumentMetadata
    pages: List[DocumentPage]
    created_at: datetime = Field(default_factory=datetime.now)


# ===================== CHUNK MODELS =====================

class SourceTrace(BaseModel):
    """Truy vết nguồn gốc thông tin"""
    chunk_id: str
    page: int
    section: Optional[str] = None


class Chunk(BaseModel):
    """Đoạn văn bản đã chia nhỏ"""
    chunk_id: str
    page: int
    section: Optional[str] = None
    text: str
    char_start: int
    char_end: int
    embedding: Optional[List[float]] = None


# ===================== BLUEPRINT MODELS =====================

class LearningOutcome(BaseModel):
    """Yêu cầu cần đạt (outcome)"""
    outcome_id: str
    verb: str  # nhận biết, giải, phân tích...
    statement: str
    cognitive_level_hint: List[str] = Field(default_factory=list)  # ["biết", "hiểu"]
    source_trace: List[SourceTrace] = Field(default_factory=list)


class Topic(BaseModel):
    """Chủ đề/chương trong đề cương"""
    topic_id: str
    name: str
    outcomes: List[LearningOutcome] = Field(default_factory=list)
    keywords: List[str] = Field(default_factory=list)
    subtopics: List[str] = Field(default_factory=list)


class Blueprint(BaseModel):
    """Blueprint kiến thức từ đề cương"""
    subject: str
    grade: Optional[int] = None
    term: Optional[str] = None
    topics: List[Topic]
    created_at: datetime = Field(default_factory=datetime.now)


# ===================== MATRIX MODELS =====================

class GlobalConfig(BaseModel):
    """Cấu hình chung của đề"""
    time_minutes: int = 45
    total_points: float = 10.0
    mcq_ratio: float = 0.6  # Tỷ lệ trắc nghiệm
    essay_ratio: float = 0.4  # Tỷ lệ tự luận


class CognitiveRatios(BaseModel):
    """Tỷ lệ mức độ nhận thức"""
    biet: float = 0.3  # Biết
    hieu: float = 0.3  # Hiểu
    vandung: float = 0.3  # Vận dụng
    vandungcao: float = 0.1  # Vận dụng cao


class DifficultyRatios(BaseModel):
    """Tỷ lệ độ khó"""
    de: float = 0.3
    tb: float = 0.4
    kho: float = 0.3


class MatrixItem(BaseModel):
    """Một dòng trong ma trận đề"""
    row_id: str
    topic_id: str
    outcome_ids: List[str] = Field(default_factory=list)
    cognitive_level: Literal["biet", "hieu", "vandung", "vandungcao"]
    difficulty: Literal["de", "tb", "kha", "kho"]
    type: Literal["mcq_single", "mcq_multiple", "true_false", "fill_blank", "short_answer", "essay"]
    n_questions: int
    points_each: float
    source_trace: List[SourceTrace] = Field(default_factory=list)


class ExamMatrix(BaseModel):
    """Ma trận đề kiểm tra (theo CV 7991)"""
    global_config: GlobalConfig
    cognitive_ratios: CognitiveRatios
    difficulty_ratios: DifficultyRatios
    items_plan: List[MatrixItem]
    created_at: datetime = Field(default_factory=datetime.now)


# ===================== QUESTION MODELS =====================

class QuestionRubric(BaseModel):
    """Thang điểm cho câu tự luận"""
    max_points: float
    criteria: List[Dict[str, Any]] = Field(default_factory=list)
    # Example: [{"description": "Trình bày đúng công thức", "points": 0.5}, ...]


class Question(BaseModel):
    """Một câu hỏi"""
    id: str
    type: Literal["mcq_single", "mcq_multiple", "true_false", "fill_blank", "short_answer", "essay"]
    topic_id: str
    cognitive_level: Literal["biet", "hieu", "vandung", "vandungcao"]
    difficulty: Literal["de", "tb", "kha", "kho"]
    stem: str  # Câu hỏi
    options: Optional[List[str]] = None  # Cho MCQ: ["A. ...", "B. ...", ...]
    answer: str  # Đáp án đúng (A/B/C/D hoặc text cho tự luận)
    explanation: Optional[str] = None  # Giải thích
    rubric: Optional[QuestionRubric] = None  # Thang điểm cho tự luận
    source_trace: List[SourceTrace] = Field(default_factory=list)
    points: float = 0.0


class Exam(BaseModel):
    """Đề kiểm tra hoàn chỉnh"""
    exam_id: str
    title: str
    subject: str
    grade: Optional[int] = None
    time_minutes: int
    total_points: float
    questions: List[Question]
    created_at: datetime = Field(default_factory=datetime.now)


# ===================== VALIDATION MODELS =====================

class ValidationIssue(BaseModel):
    """Vấn đề phát hiện khi validate"""
    question_id: str
    severity: Literal["error", "warning", "info"]
    message: str
    suggestion: Optional[str] = None


class ValidationResult(BaseModel):
    """Kết quả validate đề"""
    is_valid: bool
    issues: List[ValidationIssue] = Field(default_factory=list)
    stats: Dict[str, Any] = Field(default_factory=dict)


# ===================== EXPORT MODELS =====================

class ExportRequest(BaseModel):
    """Yêu cầu xuất file"""
    exam: Exam
    matrix: ExamMatrix
    blueprint: Blueprint
    format: Literal["docx", "pdf", "both"] = "docx"
    include_answer_key: bool = True
    include_rubric: bool = True
