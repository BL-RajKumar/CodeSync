// Judge0 CE language IDs (subset of commonly used languages)
const LANGUAGE_MAP = {
  javascript: 93,   // Node.js 18.15.0
  typescript: 94,   // TypeScript 5.0.3
  python: 71,       // Python 3.11.2
  java: 62,         // Java (OpenJDK 13.0.1)
  cpp: 54,          // C++ (GCC 9.2.0)
  c: 50,            // C (GCC 9.2.0)
  go: 60,           // Go (1.13.5)
  rust: 73,         // Rust (1.40.0)
  php: 68,          // PHP (7.4.1)
  ruby: 72,         // Ruby (2.7.0)
  plaintext: 43,    // Plain Text
};

// Map file extension language names to our map
const LANG_ALIAS_MAP = {
  'js': 'javascript',
  'jsx': 'javascript',
  'ts': 'typescript',
  'tsx': 'typescript',
  'py': 'python',
  'java': 'java',
  'cpp': 'cpp',
  'cc': 'cpp',
  'c': 'c',
  'go': 'go',
  'rs': 'rust',
  'php': 'php',
  'rb': 'ruby',
};

const getLanguageId = (lang) => {
  if (!lang) return LANGUAGE_MAP['plaintext'];
  const normalized = lang.toLowerCase();
  // Try direct match first
  if (LANGUAGE_MAP[normalized]) return LANGUAGE_MAP[normalized];
  // Try alias
  if (LANG_ALIAS_MAP[normalized]) return LANGUAGE_MAP[LANG_ALIAS_MAP[normalized]];
  return LANGUAGE_MAP['plaintext'];
};

const JUDGE0_BASE_URL = 'https://ce.judge0.com';
const JUDGE0_TIMEOUT_MS = 12000; // 12 second timeout

/**
 * @desc    Submit code to Judge0 CE sandbox and return output
 * @route   POST /api/sandbox/run
 * @access  Private
 */
export const runCode = async (req, res) => {
  const { code, language, stdin } = req.body;

  if (!code && code !== '') {
    return res.status(400).json({ message: 'code is required' });
  }

  // Limit stdin to 64 KB to prevent abuse
  if (stdin && Buffer.byteLength(stdin, 'utf8') > 65536) {
    return res.status(400).json({ message: 'stdin input is too large (max 64 KB).' });
  }

  const languageId = getLanguageId(language);

  try {
    // Build submission payload
    const payload = {
      source_code: code,
      language_id: languageId,
      stdin: stdin || '',
      // CPU time limit (seconds)
      cpu_time_limit: 10,
      // Wall clock time limit
      wall_time_limit: 12,
    };

    // Use AbortController to enforce timeout on our side
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), JUDGE0_TIMEOUT_MS);

    let judgeRes;
    try {
      judgeRes = await fetch(
        `${JUDGE0_BASE_URL}/submissions?base64_encoded=false&wait=true`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!judgeRes.ok) {
      const errText = await judgeRes.text();
      console.error('Judge0 error response:', errText);
      return res.status(502).json({ 
        message: 'Sandbox service returned an error. Please try again shortly.',
        detail: errText.substring(0, 200),
      });
    }

    const result = await judgeRes.json();

    // Shape the response for the frontend
    return res.json({
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      compileOutput: result.compile_output || '',
      message: result.message || '',
      status: {
        id: result.status?.id,
        description: result.status?.description || 'Unknown',
      },
      time: result.time || null,
      memory: result.memory || null,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ message: 'Code execution timed out (12s limit).' });
    }
    console.error('Sandbox error:', error);
    return res.status(500).json({ message: 'Internal server error during code execution.' });
  }
};

/**
 * @desc    Get list of supported languages
 * @route   GET /api/sandbox/languages
 * @access  Private
 */
export const getSupportedLanguages = async (req, res) => {
  const languages = Object.entries(LANGUAGE_MAP).map(([name, id]) => ({
    name,
    id,
    displayName: name.charAt(0).toUpperCase() + name.slice(1),
  }));
  res.json(languages);
};
