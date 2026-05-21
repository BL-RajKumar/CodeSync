import ExecutionHistory from '../models/ExecutionHistory.js';
import crypto from 'crypto';

export const activeExecutions = new Map();

// ─── Language maps ───────────────────────────────────
const LANGUAGE_MAP = {
  javascript: 93, typescript: 94, python: 71,
  java: 62, cpp: 54, c: 50, go: 60,
  rust: 73, php: 68, ruby: 72, plaintext: 43,
};
const LANG_ALIAS_MAP = {
  js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  py: 'python', java: 'java', cpp: 'cpp', cc: 'cpp',
  c: 'c', go: 'go', rs: 'rust', php: 'php', rb: 'ruby',
};
const getLanguageId = (lang) => {
  if (!lang) return LANGUAGE_MAP.plaintext;
  const n = lang.toLowerCase();
  return LANGUAGE_MAP[n] ?? LANGUAGE_MAP[LANG_ALIAS_MAP[n]] ?? LANGUAGE_MAP.plaintext;
};

const JUDGE0_BASE_URL  = 'https://ce.judge0.com';
const JUDGE0_TIMEOUT   = 12000;
const MAX_OUTPUT_BYTES = 10 * 1024; // 10 KB per stream

// ─── Helper: persist execution result ─────────────────
const saveHistory = async ({ userId, fileId, projectId, language, code, stdin, result, cancelled }) => {
  try {
    // Enforce 50-record cap per user
    const count = await ExecutionHistory.countDocuments({ userId });
    if (count >= 50) {
      const oldest = await ExecutionHistory
        .find({ userId }).sort({ createdAt: 1 }).limit(count - 49).select('_id');
      await ExecutionHistory.deleteMany({ _id: { $in: oldest.map(d => d._id) } });
    }

    const CAP_10KB = 10 * 1024;
    const CAP_2KB  = 2  * 1024;

    await ExecutionHistory.create({
      userId,
      fileId:    fileId    || null,
      projectId: projectId || null,
      language:  language  || 'plaintext',

      // ─── Submission (aligned to entity diagram) ───────────
      sourceCode: (code  || '').substring(0, CAP_10KB),
      stdin:      (stdin || '').substring(0, CAP_2KB),

      // ─── Result ───────────────────────────────────────────
      status:  result.status?.description || 'Unknown',
      exitCode: result.status?.id ?? null,
      stdout:  (result.stdout        || '').substring(0, CAP_10KB),
      stderr:  (result.stderr        || '').substring(0, CAP_10KB),

      // ─── Timing & resources ───────────────────────────────
      executionTimeMs: result.time   ? Math.round(parseFloat(result.time) * 1000) : null,
      memoryUsedKb:    result.memory ? result.memory : null,

      // ─── Lifecycle ────────────────────────────────────────
      completedAt: new Date(),
      cancelled:   cancelled || false,
    });
  } catch (err) {
    console.error('[History] Failed to save execution record:', err.message);
  }
};


/**
 * @desc    Submit code to Judge0 CE sandbox and return output
 * @route   POST /api/sandbox/run
 * @access  Private
 */
export const runCode = async (req, res) => {
  const { code, language, stdin, fileId, projectId } = req.body;

  if (code === undefined || code === null) {
    return res.status(400).json({ message: 'code is required' });
  }
  if (stdin && Buffer.byteLength(stdin, 'utf8') > 65536) {
    return res.status(400).json({ message: 'stdin input is too large (max 64 KB).' });
  }

  const languageId = getLanguageId(language);
  const executionId = crypto.randomBytes(8).toString('hex');

  // UC23: combined AbortController — aborts on timeout OR client disconnect
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), JUDGE0_TIMEOUT);
  req.on('close', () => { clearTimeout(timeoutId); controller.abort(); });

  // Register in active executions registry
  activeExecutions.set(executionId, {
    executionId,
    userId: req.user?._id,
    username: req.user?.username || 'Guest',
    projectId: projectId || null,
    fileId: fileId || null,
    language,
    startedAt: new Date(),
    controller,
  });

  try {
    const payload = {
      source_code: code,
      language_id: languageId,
      stdin:       stdin || '',
      cpu_time_limit:  10,
      wall_time_limit: 12,
    };

    let judgeRes;
    try {
      judgeRes = await fetch(
        `${JUDGE0_BASE_URL}/submissions?base64_encoded=false&wait=true`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!judgeRes.ok) {
      const errText = await judgeRes.text();
      console.error('Judge0 error:', errText);
      return res.status(502).json({ message: 'Sandbox service error. Please try again.', detail: errText.substring(0, 200) });
    }

    const raw = await judgeRes.json();
    const result = {
      stdout:        raw.stdout        || '',
      stderr:        raw.stderr        || '',
      compileOutput: raw.compile_output || '',
      message:       raw.message       || '',
      status: {
        id:          raw.status?.id,
        description: raw.status?.description || 'Unknown',
      },
      time:   raw.time   || null,
      memory: raw.memory || null,
    };

    // UC24: persist to history (fire-and-forget)
    if (req.user) {
      saveHistory({ userId: req.user._id, fileId, projectId, language, code, stdin, result });
    }

    return res.json(result);

  } catch (error) {
    if (error.name === 'AbortError' || controller.signal.aborted) {
      return res.status(504).json({ message: 'Code execution timed out or was terminated by administrator.' });
    }
    console.error('Sandbox error:', error);
    return res.status(500).json({ message: 'Internal server error during code execution.' });
  } finally {
    // Unregister when completed
    activeExecutions.delete(executionId);
  }
};

/**
 * @desc    Get execution history for logged-in user
 * @route   GET /api/sandbox/history
 * @access  Private
 */
export const getHistory = async (req, res) => {
  try {
    const { fileId, limit = 50 } = req.query;
    const filter = { userId: req.user._id };
    if (fileId) filter.fileId = fileId;

    const records = await ExecutionHistory
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit), 50));

    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Delete a single history entry
 * @route   DELETE /api/sandbox/history/:id
 * @access  Private
 */
export const deleteHistoryEntry = async (req, res) => {
  try {
    const entry = await ExecutionHistory.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id, // ensure ownership
    });
    if (!entry) return res.status(404).json({ message: 'History entry not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Clear all history for logged-in user
 * @route   DELETE /api/sandbox/history
 * @access  Private
 */
export const clearHistory = async (req, res) => {
  try {
    await ExecutionHistory.deleteMany({ userId: req.user._id });
    res.json({ message: 'History cleared' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * @desc    Get list of supported languages with version & metadata
 * @route   GET /api/sandbox/languages
 * @access  Public (Guests + Developers — UC25)
 */
export const getSupportedLanguages = async (req, res) => {
  const LANGUAGES = [
    {
      id: 93, name: 'javascript', displayName: 'JavaScript',
      version: 'Node.js 18.15.0', category: 'Scripting',
      extensions: ['.js', '.jsx'], color: '#f7df1e',
      description: 'Lightweight interpreted language for web & server-side scripting.',
    },
    {
      id: 94, name: 'typescript', displayName: 'TypeScript',
      version: 'TypeScript 5.0.3 / Node.js 18.15.0', category: 'Scripting',
      extensions: ['.ts', '.tsx'], color: '#3178c6',
      description: 'Typed superset of JavaScript that compiles to plain JS.',
    },
    {
      id: 71, name: 'python', displayName: 'Python 3',
      version: 'CPython 3.11.2', category: 'Scripting',
      extensions: ['.py'], color: '#3776ab',
      description: 'High-level language emphasising readability and versatility.',
    },
    {
      id: 62, name: 'java', displayName: 'Java',
      version: 'OpenJDK 13.0.1', category: 'Compiled (JVM)',
      extensions: ['.java'], color: '#f89820',
      description: 'Object-oriented, platform-independent language for enterprise apps.',
    },
    {
      id: 54, name: 'cpp', displayName: 'C++',
      version: 'GCC 9.2.0 (C++17)', category: 'Compiled (Native)',
      extensions: ['.cpp', '.cc', '.cxx'], color: '#00599c',
      description: 'High-performance systems language with OOP and generic programming.',
    },
    {
      id: 50, name: 'c', displayName: 'C',
      version: 'GCC 9.2.0 (C17)', category: 'Compiled (Native)',
      extensions: ['.c'], color: '#a8b9cc',
      description: 'Low-level procedural language, foundation of modern systems software.',
    },
    {
      id: 60, name: 'go', displayName: 'Go',
      version: 'Go 1.13.5', category: 'Compiled (Native)',
      extensions: ['.go'], color: '#00add8',
      description: 'Statically typed, compiled language designed for concurrency & cloud.',
    },
    {
      id: 73, name: 'rust', displayName: 'Rust',
      version: 'Rust 1.40.0', category: 'Compiled (Native)',
      extensions: ['.rs'], color: '#ce422b',
      description: 'Memory-safe systems language without a garbage collector.',
    },
    {
      id: 68, name: 'php', displayName: 'PHP',
      version: 'PHP 7.4.1', category: 'Scripting',
      extensions: ['.php'], color: '#8993be',
      description: 'Server-side scripting language widely used for web development.',
    },
    {
      id: 72, name: 'ruby', displayName: 'Ruby',
      version: 'MRI Ruby 2.7.0', category: 'Scripting',
      extensions: ['.rb'], color: '#cc342d',
      description: 'Dynamic, expressive language with elegant syntax and strong OOP.',
    },
  ];

  res.json(LANGUAGES);
};

