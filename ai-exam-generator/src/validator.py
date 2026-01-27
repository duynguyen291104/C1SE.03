"""
Module kiểm tra chất lượng câu hỏi và đề kiểm tra
"""
import re
from typing import List, Set, Dict, Any
from loguru import logger
from rapidfuzz import fuzz

from .models import Exam, Question, ValidationIssue, ValidationResult


class ExamValidator:
    """Validate chất lượng đề kiểm tra"""
    
    def __init__(self, similarity_threshold: float = 0.8):
        """
        Args:
            similarity_threshold: Ngưỡng similarity để coi là trùng lặp
        """
        self.similarity_threshold = similarity_threshold
    
    def validate(self, exam: Exam) -> ValidationResult:
        """
        Validate đề kiểm tra
        
        Args:
            exam: Đề kiểm tra cần validate
            
        Returns:
            ValidationResult
        """
        logger.info(f"🔍 Validating exam: {exam.title}")
        
        issues = []
        
        # Rule-based validation
        issues.extend(self._validate_structure(exam))
        issues.extend(self._validate_questions(exam))
        issues.extend(self._validate_duplicates(exam))
        issues.extend(self._validate_points(exam))
        
        # Stats
        stats = self._compute_stats(exam)
        
        is_valid = not any(i.severity == "error" for i in issues)
        
        result = ValidationResult(
            is_valid=is_valid,
            issues=issues,
            stats=stats
        )
        
        logger.info(f"✅ Validation done: {len(issues)} issues found")
        return result
    
    def _validate_structure(self, exam: Exam) -> List[ValidationIssue]:
        """Kiểm tra cấu trúc cơ bản"""
        issues = []
        
        if not exam.questions:
            issues.append(ValidationIssue(
                question_id="EXAM",
                severity="error",
                message="Đề không có câu hỏi nào"
            ))
        
        if exam.total_points <= 0:
            issues.append(ValidationIssue(
                question_id="EXAM",
                severity="error",
                message="Tổng điểm phải > 0"
            ))
        
        if exam.time_minutes <= 0:
            issues.append(ValidationIssue(
                question_id="EXAM",
                severity="error",
                message="Thời gian phải > 0"
            ))
        
        return issues
    
    def _validate_questions(self, exam: Exam) -> List[ValidationIssue]:
        """Kiểm tra từng câu hỏi"""
        issues = []
        
        for q in exam.questions:
            # Check stem
            if not q.stem or len(q.stem.strip()) < 10:
                issues.append(ValidationIssue(
                    question_id=q.id,
                    severity="error",
                    message="Câu hỏi quá ngắn hoặc trống",
                    suggestion="Viết lại câu hỏi rõ ràng hơn"
                ))
            
            # Check MCQ
            if q.type in ["mcq_single", "mcq_multiple"]:
                if not q.options or len(q.options) < 2:
                    issues.append(ValidationIssue(
                        question_id=q.id,
                        severity="error",
                        message="MCQ phải có ít nhất 2 lựa chọn"
                    ))
                
                if q.options and len(q.options) != len(set(q.options)):
                    issues.append(ValidationIssue(
                        question_id=q.id,
                        severity="warning",
                        message="Có lựa chọn trùng lặp"
                    ))
                
                # Check answer format
                if q.type == "mcq_single":
                    if q.answer not in ["A", "B", "C", "D", "E", "F"]:
                        issues.append(ValidationIssue(
                            question_id=q.id,
                            severity="error",
                            message=f"Đáp án '{q.answer}' không hợp lệ cho MCQ"
                        ))
                    
                    # Check if answer exists in options
                    answer_letters = ["A", "B", "C", "D", "E", "F"]
                    if q.options:
                        answer_idx = answer_letters.index(q.answer) if q.answer in answer_letters else -1
                        if answer_idx >= len(q.options):
                            issues.append(ValidationIssue(
                                question_id=q.id,
                                severity="error",
                                message=f"Đáp án {q.answer} vượt quá số lựa chọn"
                            ))
            
            # Check answer
            if not q.answer or len(q.answer.strip()) == 0:
                issues.append(ValidationIssue(
                    question_id=q.id,
                    severity="error",
                    message="Câu hỏi không có đáp án"
                ))
            
            # Check essay rubric
            if q.type in ["short_answer", "essay"]:
                if not q.rubric:
                    issues.append(ValidationIssue(
                        question_id=q.id,
                        severity="warning",
                        message="Câu tự luận nên có rubric"
                    ))
            
            # Check points
            if q.points <= 0:
                issues.append(ValidationIssue(
                    question_id=q.id,
                    severity="error",
                    message="Điểm câu hỏi phải > 0"
                ))
            
            # Check source trace
            if not q.source_trace:
                issues.append(ValidationIssue(
                    question_id=q.id,
                    severity="info",
                    message="Câu hỏi không có truy vết nguồn"
                ))
        
        return issues
    
    def _validate_duplicates(self, exam: Exam) -> List[ValidationIssue]:
        """Kiểm tra câu hỏi trùng lặp"""
        issues = []
        
        stems = [q.stem for q in exam.questions]
        
        for i, q1 in enumerate(exam.questions):
            for j, q2 in enumerate(exam.questions[i+1:], start=i+1):
                similarity = self._text_similarity(q1.stem, q2.stem)
                
                if similarity > self.similarity_threshold:
                    issues.append(ValidationIssue(
                        question_id=f"{q1.id},{q2.id}",
                        severity="warning",
                        message=f"Câu {q1.id} và {q2.id} có nội dung tương tự ({similarity:.0%})",
                        suggestion="Kiểm tra và loại bỏ câu trùng lặp"
                    ))
        
        return issues
    
    def _validate_points(self, exam: Exam) -> List[ValidationIssue]:
        """Kiểm tra tổng điểm"""
        issues = []
        
        actual_total = sum(q.points for q in exam.questions)
        expected_total = exam.total_points
        
        diff = abs(actual_total - expected_total)
        
        if diff > 0.01:  # Tolerance for floating point
            issues.append(ValidationIssue(
                question_id="EXAM",
                severity="error",
                message=f"Tổng điểm thực tế ({actual_total}) ≠ tổng điểm khai báo ({expected_total})",
                suggestion=f"Điều chỉnh điểm các câu hỏi để tổng = {expected_total}"
            ))
        
        return issues
    
    def _compute_stats(self, exam: Exam) -> dict:
        """Tính thống kê đề"""
        stats = {
            "total_questions": len(exam.questions),
            "total_points": sum(q.points for q in exam.questions),
            "by_type": {},
            "by_cognitive_level": {},
            "by_difficulty": {}
        }
        
        # Count by type
        for q in exam.questions:
            stats["by_type"][q.type] = stats["by_type"].get(q.type, 0) + 1
            stats["by_cognitive_level"][q.cognitive_level] = stats["by_cognitive_level"].get(q.cognitive_level, 0) + 1
            stats["by_difficulty"][q.difficulty] = stats["by_difficulty"].get(q.difficulty, 0) + 1
        
        return stats
    
    def _text_similarity(self, text1: str, text2: str) -> float:
        """Tính độ tương tự giữa 2 text"""
        # Normalize
        t1 = self._normalize_text(text1)
        t2 = self._normalize_text(text2)
        
        # Use rapidfuzz (faster than difflib)
        return fuzz.ratio(t1, t2) / 100.0
    
    def _normalize_text(self, text: str) -> str:
        """Chuẩn hóa text để so sánh"""
        # Lowercase
        text = text.lower()
        
        # Remove punctuation
        text = re.sub(r'[^\w\s]', '', text)
        
        # Remove extra spaces
        text = re.sub(r'\s+', ' ', text)
        
        return text.strip()
