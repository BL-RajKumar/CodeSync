import ExecutionHistory from '../models/ExecutionHistory.js';
import Language from '../models/Language.js';
import crypto from 'crypto';


export const activeExecutions = new Map();

// ─── In-memory languages cache ───────────────────────
let languageMapCache = {};
let langAliasMapCache = {};
let supportedLanguagesCache = [];

export const refreshLanguagesCache = async () => {
  try {
    const activeLangs = await Language.find({ isActive: true });
    
    const newMap = {};
    const newAliasMap = {};
    const newSupported = [];

    activeLangs.forEach(lang => {
      newMap[lang.name] = lang.id;
      
      if (lang.aliases && lang.aliases.length > 0) {
        lang.aliases.forEach(alias => {
          newAliasMap[alias.toLowerCase()] = lang.name;
        });
      }
      if (lang.extensions && lang.extensions.length > 0) {
        lang.extensions.forEach(ext => {
          const extClean = ext.replace(/^\./, '').toLowerCase();
          newAliasMap[extClean] = lang.name;
        });
      }

      newSupported.push({
        id: lang.id,
        name: lang.name,
        displayName: lang.displayName,
        version: lang.version,
        category: lang.category,
        extensions: lang.extensions,
        color: lang.color,
        description: lang.description,
      });
    });

    languageMapCache = newMap;
    langAliasMapCache = newAliasMap;
    supportedLanguagesCache = newSupported;
    console.log('[Sandbox Cache] Cache refreshed. Active count:', activeLangs.length);
  } catch (err) {
    console.error('[Sandbox Cache] Failed to refresh languages cache:', err.message);
  }
};

// Initialize cache on start
setTimeout(refreshLanguagesCache, 1000);

const getLanguageId = (lang) => {
  if (!lang) return languageMapCache.plaintext || 43;
  const n = lang.toLowerCase().trim();
  
  if (languageMapCache[n] !== undefined) {
    return languageMapCache[n];
  }
  
  const resolvedName = langAliasMapCache[n];
  if (resolvedName && languageMapCache[resolvedName] !== undefined) {
    return languageMapCache[resolvedName];
  }
  
  return languageMapCache.plaintext || 43;
};

const MAX_OUTPUT_BYTES = 10 * 1024; // 10 KB per stream
const LOCAL_EXECUTION_TIMEOUT = 12000;

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

      // ─── Submission ───────────
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
 * @desc    Submit code to local Docker sandbox and return output
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

  const executionId = crypto.randomBytes(8).toString('hex');
  const languageId = getLanguageId(language);

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), LOCAL_EXECUTION_TIMEOUT);
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
      language_id: languageId,
      source_code: Buffer.from(code).toString('base64'),
      stdin: stdin ? Buffer.from(stdin).toString('base64') : ''
    };

    // Using the official free Judge0 CE public instance! (No API Key Required)
    const response = await fetch('https://ce.judge0.com/submissions?base64_encoded=true&wait=true', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Judge0 API returned ${response.status}`);
    }

    const data = await response.json();
    const decodeBase64 = (str) => str ? Buffer.from(str, 'base64').toString('utf8') : '';

    const result = {
      stdout: decodeBase64(data.stdout),
      stderr: decodeBase64(data.stderr),
      compileOutput: decodeBase64(data.compile_output),
      message: decodeBase64(data.message),
      status: data.status || { id: 3, description: 'Accepted' },
      time: data.time || '0.000',
      memory: data.memory || 0,
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
    return res.status(500).json({ message: 'Internal server error during code execution: ' + error.message });
  } finally {
    clearTimeout(timeoutId);
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
  try {
    if (supportedLanguagesCache.length === 0) {
      await refreshLanguagesCache();
    }
    res.json(supportedLanguagesCache);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
