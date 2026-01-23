const { Queue } = require('bullmq');
const Redis = require('ioredis');

// Redis connection
const connection = new Redis(process.env.REDIS_URL || 'redis://redis:6379', {
  family: 4, // Force IPv4
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

// Document extraction queue
const documentExtractQueue = new Queue('document-extract-queue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: true,
    removeOnFail: false // Keep failed jobs for debugging
  }
});

/**
 * Add document extraction job to queue
 * @param {object} payload - Job payload
 * @returns {Promise<Job>}
 */
async function addExtractionJob(payload) {
  const { documentId, ownerId, bucket, objectKey, mimeType } = payload;

  const job = await documentExtractQueue.add('extract-document', {
    documentId,
    ownerId,
    bucket,
    objectKey,
    mimeType
  }, {
    jobId: `extract-${documentId}`,
    removeOnComplete: true,
    removeOnFail: false
  });

  console.log(`📋 Enqueued extraction job: ${job.id}`);
  return job;
}

/**
 * Get job by document ID
 * @param {string} documentId
 * @returns {Promise<Job|null>}
 */
async function getJobByDocumentId(documentId) {
  const jobId = `extract-${documentId}`;
  try {
    const job = await documentExtractQueue.getJob(jobId);
    return job;
  } catch (error) {
    return null;
  }
}

/**
 * Get job progress
 * @param {string} documentId
 * @returns {Promise<number|null>} Progress percentage (0-100)
 */
async function getJobProgress(documentId) {
  const job = await getJobByDocumentId(documentId);
  if (!job) return null;
  
  const progress = await job.progress;
  return progress || 0;
}

/**
 * Remove job
 * @param {string} documentId
 */
async function removeJob(documentId) {
  const job = await getJobByDocumentId(documentId);
  if (job) {
    await job.remove();
  }
}

/**
 * Close queue connection
 */
async function closeQueue() {
  await documentExtractQueue.close();
  await connection.quit();
}

module.exports = {
  documentExtractQueue,
  addExtractionJob,
  getJobByDocumentId,
  getJobProgress,
  removeJob,
  closeQueue
};
