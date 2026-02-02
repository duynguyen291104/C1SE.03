const Document = require('../models/Document');
const DocumentPage = require('../models/DocumentPage');
const axios = require('axios');

/**
 * Virtual Tutor - RAG-based chatbot
 * Only answers based on uploaded documents
 */
exports.askQuestion = async (req, res) => {
  try {
    const { question, documentIds = [] } = req.body;

    if (!question || question.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Câu hỏi không được để trống'
      });
    }

    // Get user's documents or specific documents
    let query = { ownerId: req.user._id, status: 'completed' };
    if (documentIds.length > 0) {
      query._id = { $in: documentIds };
    }

    const documents = await Document.find(query).select('_id originalName');

    if (documents.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài liệu nào. Vui lòng upload tài liệu trước.'
      });
    }

    const documentIdList = documents.map(d => d._id);

    // Search for relevant content in document pages
    const relevantPages = await DocumentPage.find({
      documentId: { $in: documentIdList }
    })
      .select('documentId pageNumber content')
      .limit(10);

    if (relevantPages.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy nội dung liên quan trong tài liệu.'
      });
    }

    // Build context from document pages
    const context = relevantPages
      .map(page => {
        const doc = documents.find(d => d._id.toString() === page.documentId.toString());
        return `[${doc?.originalName || 'Document'} - Trang ${page.pageNumber}]\n${page.content}`;
      })
      .join('\n\n---\n\n');

    // Call AI service (assuming you have an AI endpoint)
    // For now, return a mock response based on context
    const answer = await generateAnswer(question, context);

    res.json({
      success: true,
      data: {
        question,
        answer,
        sources: relevantPages.map(page => {
          const doc = documents.find(d => d._id.toString() === page.documentId.toString());
          return {
            documentName: doc?.originalName,
            pageNumber: page.pageNumber,
            excerpt: page.content.substring(0, 200) + '...'
          };
        })
      }
    });
  } catch (error) {
    console.error('Error in virtual tutor:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Generate answer using AI or simple keyword matching
 * In production, this would call an AI API like OpenAI, Claude, etc.
 */
async function generateAnswer(question, context) {
  // Try to call AI exam generator API if available
  const AI_API_URL = process.env.AI_API_URL || 'http://localhost:8000';
  
  try {
    const response = await axios.post(`${AI_API_URL}/api/chat`, {
      question,
      context,
      system_prompt: `Bạn là một trợ lý ảo thông minh chỉ trả lời dựa trên tài liệu được cung cấp. 
      Nếu câu hỏi không liên quan đến tài liệu, hãy lịch sự từ chối và đề nghị hỏi về nội dung trong tài liệu.
      Trả lời bằng tiếng Việt, rõ ràng và chính xác.`
    }, {
      timeout: 30000
    });

    return response.data.answer || response.data.response || 'Xin lỗi, tôi không thể trả lời câu hỏi này.';
  } catch (aiError) {
    console.warn('AI API not available, using fallback:', aiError.message);
    
    // Fallback: Simple keyword matching
    const lowerQuestion = question.toLowerCase();
    const lowerContext = context.toLowerCase();
    
    // Check if question keywords are in context
    const questionWords = lowerQuestion.split(/\s+/).filter(w => w.length > 3);
    const relevantWords = questionWords.filter(word => lowerContext.includes(word));
    
    if (relevantWords.length < 2) {
      return 'Xin lỗi, tôi không tìm thấy thông tin liên quan trong tài liệu của bạn. Vui lòng hỏi về nội dung có trong tài liệu đã upload.';
    }
    
    // Extract relevant sentences
    const sentences = context.split(/[.!?]\s+/);
    const relevantSentences = sentences.filter(sentence => {
      const lowerSentence = sentence.toLowerCase();
      return relevantWords.some(word => lowerSentence.includes(word));
    });
    
    if (relevantSentences.length > 0) {
      return `Dựa trên tài liệu của bạn:\n\n${relevantSentences.slice(0, 3).join('. ')}.`;
    }
    
    return 'Tôi tìm thấy một số thông tin liên quan trong tài liệu, nhưng không đủ để trả lời chính xác. Vui lòng làm rõ câu hỏi hoặc cung cấp thêm ngữ cảnh.';
  }
}

/**
 * Get chat history for a user
 */
exports.getChatHistory = async (req, res) => {
  try {
    // This would typically fetch from a ChatHistory model
    // For now, return empty array
    res.json({
      success: true,
      data: []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get available documents for chatbot
 */
exports.getAvailableDocuments = async (req, res) => {
  try {
    const documents = await Document.find({
      ownerId: req.user._id,
      status: 'completed'
    }).select('_id originalName createdAt sizeBytes');

    res.json({
      success: true,
      data: documents
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = exports;
