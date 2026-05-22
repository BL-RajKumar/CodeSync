import mongoose from 'mongoose';

const executionHistorySchema = new mongoose.Schema(
  {
    // ─── Identity ───────────────────────────────────────────
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    projectId: { type: String, default: null },
    fileId:    { type: String, default: null },

    // ─── Submission ─────────────────────────────────────────
    language:   { type: String, required: true },
    sourceCode: { type: String, default: '' },   // full code (capped at 10 KB on save)
    stdin:      { type: String, default: '' },   // full stdin (capped at 2 KB on save)

    // ─── Result ─────────────────────────────────────────────
    status:  { type: String, default: 'Unknown' }, // e.g. "Accepted", "Runtime Error"
    stdout:  { type: String, default: '' },         // capped at 10 KB
    stderr:  { type: String, default: '' },         // capped at 10 KB
    exitCode: { type: Number, default: null },      // Judge0 status id as numeric exit code

    // ─── Timing & Resources ─────────────────────────────────
    executionTimeMs: { type: Number, default: null }, // converted from Judge0 "time" (seconds → ms)
    memoryUsedKb:    { type: Number, default: null }, // Judge0 "memory" is already in KB

    // ─── Lifecycle ──────────────────────────────────────────
    completedAt: { type: Date, default: null },
    cancelled:   { type: Boolean, default: false },
  },
  {
    timestamps: true, // adds createdAt, updatedAt automatically
  }
);

// TTL: auto-expire records after 7 days
executionHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

// Efficient per-user lookup (most recent first)
executionHistorySchema.index({ userId: 1, createdAt: -1 });

// Optional: per-file lookup
executionHistorySchema.index({ fileId: 1, createdAt: -1 });

const ExecutionHistory = mongoose.model('ExecutionHistory', executionHistorySchema);

export default ExecutionHistory;
