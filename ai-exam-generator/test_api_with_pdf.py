#!/usr/bin/env python3
"""
Script test API với file PDF thực tế
"""
import requests
import json
import subprocess
import sys
from pathlib import Path

# Config
API_URL = "http://localhost:6000"
PDF_PATH = "/home/ngocduy/Downloads/sample_de_cuong_toan9_cv7991.pdf"

def extract_pdf_text(pdf_path):
    """Extract text from PDF using pdftotext"""
    try:
        result = subprocess.run(
            ['pdftotext', pdf_path, '-'],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"❌ Error extracting PDF: {e}")
        return None
    except FileNotFoundError:
        print("❌ pdftotext not found. Install: sudo apt install poppler-utils")
        return None

def test_health():
    """Test API health"""
    print("🔍 Checking API health...")
    try:
        response = requests.get(f"{API_URL}/health", timeout=5)
        print(f"✅ API Status: {response.json()}")
        return True
    except Exception as e:
        print(f"❌ API not available: {e}")
        return False

def generate_exam(pdf_content):
    """Generate exam from PDF content"""
    print("\n🚀 Generating exam from PDF...")
    
    # Config - giảm số câu để test nhanh
    config = {
        "time_minutes": 45,
        "total_points": 10.0,
        "num_questions": 3,  # Giảm xuống 3 câu để test nhanh
        "difficulty_level": "medium",
        "allow_calculator": True
    }
    
    cognitive_ratios = {
        "biet": 0.3,
        "hieu": 0.4,
        "van_dung": 0.2,
        "van_dung_cao": 0.1
    }
    
    difficulty_ratios = {
        "de": 0.3,
        "trung_binh": 0.5,
        "kho": 0.2
    }
    
    payload = {
        "content": pdf_content,
        "config": config,
        "cognitive_ratios": cognitive_ratios,
        "difficulty_ratios": difficulty_ratios
    }
    
    print(f"📤 Sending request to {API_URL}/generate-exam-from-pdf")
    print(f"📄 PDF content length: {len(pdf_content)} chars")
    print(f"⚙️ Config: {config['num_questions']} questions, {config['total_points']} points")
    print("\n⏳ Please wait... (this may take 2-5 minutes with local AI)\n")
    
    try:
        response = requests.post(
            f"{API_URL}/generate-exam-from-pdf",
            json=payload,
            timeout=300  # 5 minutes timeout
        )
        
        if response.status_code == 200:
            result = response.json()
            print("\n✅ SUCCESS! Exam generated successfully!\n")
            
            # Display summary
            print("="*60)
            print("📊 SUMMARY")
            print("="*60)
            
            if 'blueprint' in result:
                bp = result['blueprint']
                print(f"\n📚 BLUEPRINT:")
                print(f"  - Topics: {len(bp.get('topics', []))}")
                print(f"  - Outcomes: {len(bp.get('outcomes', []))}")
            
            if 'matrix' in result:
                mx = result['matrix']
                print(f"\n📊 MATRIX:")
                print(f"  - Total items: {mx.get('total_items', 0)}")
                print(f"  - Total points: {mx.get('total_points', 0)}")
            
            if 'exam' in result:
                exam = result['exam']
                print(f"\n📝 EXAM:")
                print(f"  - Title: {exam.get('title', 'N/A')}")
                print(f"  - Questions: {exam.get('total_questions', 0)}")
                print(f"  - Points: {exam.get('total_points', 0)}")
                
                # Show questions
                if 'questions' in exam and exam['questions']:
                    print(f"\n📋 QUESTIONS PREVIEW:")
                    for i, q in enumerate(exam['questions'][:3], 1):
                        print(f"\n  Question {i}:")
                        print(f"    ID: {q.get('question_id', 'N/A')}")
                        print(f"    Type: {q.get('question_type', 'N/A')}")
                        print(f"    Points: {q.get('points', 0)}")
                        print(f"    Difficulty: {q.get('difficulty', 'N/A')}")
                        statement = q.get('statement', '')
                        preview = statement[:100] + '...' if len(statement) > 100 else statement
                        print(f"    Statement: {preview}")
                        if 'source_trace' in q and q['source_trace']:
                            trace = q['source_trace'][0]
                            print(f"    Source: Chunk {trace.get('chunk_id', 'N/A')}, Page {trace.get('page', 'N/A')}")
            
            if 'validation' in result:
                val = result['validation']
                status = "✅ VALID" if val.get('valid') else "❌ INVALID"
                print(f"\n✅ VALIDATION: {status}")
            
            print("\n" + "="*60)
            
            # Save full result
            output_file = "test_result.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            print(f"\n💾 Full result saved to: {output_file}")
            print(f"💾 Check also: ./output/ directory for detailed files")
            
            return True
            
        else:
            error = response.json()
            print(f"\n❌ API Error ({response.status_code}):")
            print(f"   {error.get('error', 'Unknown error')}")
            return False
            
    except requests.Timeout:
        print("\n❌ Request timeout! Try reducing num_questions or check server logs.")
        return False
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("="*60)
    print("🎓 AI EXAM GENERATOR - PDF TEST")
    print("="*60)
    
    # Check API
    if not test_health():
        print("\n⚠️ Make sure API server is running:")
        print("   cd /home/ngocduy/duy/C1SE.03/ai-exam-generator")
        print("   AI_PORT=6000 venv/bin/python api_server.py")
        sys.exit(1)
    
    # Check PDF
    if not Path(PDF_PATH).exists():
        print(f"\n❌ PDF not found: {PDF_PATH}")
        print("   Please update PDF_PATH in script")
        sys.exit(1)
    
    # Extract text
    print(f"\n📄 Extracting text from: {PDF_PATH}")
    pdf_text = extract_pdf_text(PDF_PATH)
    
    if not pdf_text:
        print("\n❌ Could not extract PDF text")
        sys.exit(1)
    
    print(f"✅ Extracted {len(pdf_text)} characters")
    
    # Generate exam
    success = generate_exam(pdf_text)
    
    if success:
        print("\n🎉 TEST COMPLETED SUCCESSFULLY!")
        sys.exit(0)
    else:
        print("\n❌ TEST FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()
