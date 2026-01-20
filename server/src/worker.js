const { Worker } = require('bullmq');
const Redis = require('ioredis');
const mongoose = require('mongoose');
const Document = require('./models/Document');
const DocumentPage = require('./models/DocumentPage');
const minioService = require('./services/minio');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createWriteStream } = require('fs');
const { promisify } = require('util');
const pipeline = promisify(require('stream').pipeline);

// PDF extraction
const pdfParse = require('pdf-parse');

// DOCX extraction
const mammoth = require('mammoth');

// PPTX extraction
const Textract = require('textract');
const textractExtract = promisify(Textract.fromFileWithPath);

// Redis connection
const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/education', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('[Worker] MongoDB connected'))
  .catch(err => {
    console.error('[Worker] MongoDB connection error:', err);
    process.exit(1);
  });

// Initialize MinIO
minioService.initialize()
  .then(() => console.log('[Worker] MinIO initialized'))
  .catch(err => {
    console.error('[Worker] MinIO initialization error:', err);
    process.exit(1);
  });

/**
 * Download file from MinIO to temp directory
 */
async function downloadFile(objectKey) {
  const tempDir = os.tmpdir();
  const fileName = path.basename(objectKey);
  const tempPath = path.join(tempDir, `${Date.now()}-${fileName}`);

  const stream = await minioService.downloadObject(objectKey);
  await pipeline(stream, createWriteStream(tempPath));

  return tempPath;
}

/**
 * Extract text from PDF
 */
async function extractPDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);

  // Extract pages (if possible)
  const pages = [];
  
  // pdf-parse doesn't give per-page text, so we split by page breaks
  // This is a simple heuristic and may need adjustment
  const pageTexts = data.text.split(/\f/); // Form feed character often separates pages
  
  pageTexts.forEach((pageText, index) => {
    if (pageText.trim()) {
      pages.push({
        pageNumber: index + 1,
        text: pageText.trim(),
        meta: {
          charCount: pageText.trim().length,
          source: 'pdf'
        }
      });
    }
  });

  // If no page breaks found, treat as single page
  if (pages.length === 0 && data.text.trim()) {
    pages.push({
      pageNumber: 1,
      text: data.text.trim(),
      meta: {
        charCount: data.text.trim().length,
        source: 'pdf'
      }
    });
  }

  return {
    pages,
    textPreview: data.text.substring(0, 500)
  };
}

/**
 * Extract text from DOCX
 */
async function extractDOCX(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  const text = result.value;

  // Split into pages (arbitrary: ~2000 characters per page)
  const charsPerPage = 2000;
  const pages = [];
  
  for (let i = 0; i < text.length; i += charsPerPage) {
    const pageText = text.substring(i, i + charsPerPage);
    pages.push({
      pageNumber: Math.floor(i / charsPerPage) + 1,
      text: pageText,
      meta: {
        charCount: pageText.length,
        source: 'docx'
      }
    });
  }

  return {
    pages,
    textPreview: text.substring(0, 500)
  };
}

/**
 * Extract text from PPTX
 */
async function extractPPTX(filePath) {
  const text = await textractExtract(filePath, { preserveLineBreaks: true });

  // Split into slides (heuristic: split by multiple line breaks)
  const slideTexts = text.split(/\n\s*\n\s*\n/);
  const pages = [];

  slideTexts.forEach((slideText, index) => {
    if (slideText.trim()) {
      pages.push({
        pageNumber: index + 1,
        text: slideText.trim(),
        meta: {
          charCount: slideText.trim().length,
          source: 'pptx'
        }
      });
    }
  });

  return {
    pages,
    textPreview: text.substring(0, 500)
  };
}

/**
 * Process document extraction job
 */
async function processExtraction(job) {
  const { documentId, objectKey, mimeType } = job.data;

  console.log(`[Worker] Processing document ${documentId}`);

  let tempPath = null;

  try {
    // Update document status
    const document = await Document.findById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    document.status = 'extracting';
    document.extract.startedAt = new Date();
    await document.save();

    // Download file from MinIO
    job.updateProgress(10);
    tempPath = await downloadFile(objectKey);
    console.log(`[Worker] Downloaded to ${tempPath}`);

    // Extract text based on MIME type
    job.updateProgress(30);
    let extractionResult;

    if (mimeType === 'application/pdf') {
      extractionResult = await extractPDF(tempPath);
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      extractionResult = await extractDOCX(tempPath);
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      extractionResult = await extractPPTX(tempPath);
    } else {
      throw new Error(`Unsupported MIME type: ${mimeType}`);
    }

    const { pages, textPreview } = extractionResult;

    // Save pages to database
    job.updateProgress(60);
    for (const pageData of pages) {
      await DocumentPage.create({
        documentId,
        ...pageData
      });
    }

    // Update document
    job.updateProgress(90);
    document.status = 'ready';
    document.extract.pageCount = pages.length;
    document.extract.textPreview = textPreview;
    document.extract.finishedAt = new Date();
    await document.save();

    console.log(`[Worker] Completed document ${documentId}: ${pages.length} pages`);

    return { success: true, pageCount: pages.length };
  } catch (error) {
    console.error(`[Worker] Error processing document ${documentId}:`, error);

    // Update document with error
    try {
      const document = await Document.findById(documentId);
      if (document) {
        document.status = 'failed';
        document.extract.error = error.message;
        document.extract.finishedAt = new Date();
        await document.save();
      }
    } catch (dbError) {
      console.error('[Worker] Error updating document status:', dbError);
    }

    throw error;
  } finally {
    // Clean up temp file
    if (tempPath && fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch (cleanupError) {
        console.error('[Worker] Error cleaning up temp file:', cleanupError);
      }
    }
  }
}

// Create worker
const worker = new Worker('document-extraction', processExtraction, {
  connection,
  concurrency: 2, // Process 2 documents at a time
  limiter: {
    max: 10, // Max 10 jobs
    duration: 60000 // per 60 seconds
  }
});

worker.on('completed', job => {
  console.log(`[Worker] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job.id} failed:`, err);
});

worker.on('error', err => {
  console.error('[Worker] Error:', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Worker] SIGTERM received, shutting down gracefully');
  await worker.close();
  await connection.quit();
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Worker] SIGINT received, shutting down gracefully');
  await worker.close();
  await connection.quit();
  await mongoose.connection.close();
  process.exit(0);
});

console.log('[Worker] Document extraction worker started');
