import mongoose from 'mongoose';

const languageSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
  },
  version: {
    type: String,
    default: '',
  },
  category: {
    type: String,
    default: 'Scripting',
  },
  extensions: {
    type: [String],
    default: [],
  },
  aliases: {
    type: [String],
    default: [],
  },
  color: {
    type: String,
    default: '#cccccc',
  },
  description: {
    type: String,
    default: '',
  },

  isActive: {
    type: Boolean,
    default: true,
  }
}, {
  timestamps: true
});

// Map _id to mongoId and virtual id to JSON responses
languageSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.mongoId = ret._id;
    delete ret.__v;
    return ret;
  }
});

const Language = mongoose.model('Language', languageSchema);

export const seedLanguages = async () => {
  try {
    // We removed the early return so new languages get added even if the DB is already populated
    const defaults = [
      {
        id: 93, name: 'javascript', displayName: 'JavaScript',
        version: 'Node.js 18.15.0', category: 'Scripting',
        extensions: ['.js', '.jsx'], aliases: ['js', 'jsx', 'javascript'], color: '#f7df1e',
        description: 'Lightweight interpreted language for web & server-side scripting.'
      },
      {
        id: 94, name: 'typescript', displayName: 'TypeScript',
        version: 'TypeScript 5.0.3 / Node.js 18.15.0', category: 'Scripting',
        extensions: ['.ts', '.tsx'], aliases: ['ts', 'tsx', 'typescript'], color: '#3178c6',
        description: 'Typed superset of JavaScript that compiles to plain JS.'
      },
      {
        id: 71, name: 'python', displayName: 'Python 3',
        version: 'CPython 3.11.2', category: 'Scripting',
        extensions: ['.py'], aliases: ['py', 'python', 'python3'], color: '#3776ab',
        description: 'High-level language emphasising readability and versatility.'
      },
      {
        id: 62, name: 'java', displayName: 'Java',
        version: 'OpenJDK 13.0.1', category: 'Compiled (JVM)',
        extensions: ['.java'], aliases: ['java'], color: '#f89820',
        description: 'Object-oriented, platform-independent language for enterprise apps.'
      },
      {
        id: 54, name: 'cpp', displayName: 'C++',
        version: 'GCC 9.2.0 (C++17)', category: 'Compiled (Native)',
        extensions: ['.cpp', '.cc', '.cxx'], aliases: ['cpp', 'cc', 'cxx'], color: '#00599c',
        description: 'High-performance systems language with OOP and generic programming.'
      },
      {
        id: 50, name: 'c', displayName: 'C',
        version: 'GCC 9.2.0 (C17)', category: 'Compiled (Native)',
        extensions: ['.c'], aliases: ['c'], color: '#a8b9cc',
        description: 'Low-level procedural language, foundation of modern systems software.'
      },
      {
        id: 60, name: 'go', displayName: 'Go',
        version: 'Go 1.13.5', category: 'Compiled (Native)',
        extensions: ['.go'], aliases: ['go', 'golang'], color: '#00add8',
        description: 'Statically typed, compiled language designed for concurrency & cloud.'
      },
      {
        id: 73, name: 'rust', displayName: 'Rust',
        version: 'Rust 1.40.0', category: 'Compiled (Native)',
        extensions: ['.rs'], aliases: ['rs', 'rust'], color: '#ce422b',
        description: 'Memory-safe systems language without a garbage collector.'
      },
      {
        id: 68, name: 'php', displayName: 'PHP',
        version: 'PHP 7.4.1', category: 'Scripting',
        extensions: ['.php'], aliases: ['php'], color: '#8993be',
        description: 'Server-side scripting language widely used for web development.'
      },
      {
        id: 72, name: 'ruby', displayName: 'Ruby',
        version: 'MRI Ruby 2.7.0', category: 'Scripting',
        extensions: ['.rb'], aliases: ['rb', 'ruby'], color: '#cc342d',
        description: 'Dynamic, expressive language with elegant syntax and strong OOP.'
      },
      {
        id: 43, name: 'plaintext', displayName: 'Plain Text',
        version: 'Plaintext 1.0.0', category: 'Text',
        extensions: ['.txt'], aliases: ['txt', 'plaintext'], color: '#cccccc',
        description: 'Plain text files without formatting or compilation capabilities.'
      },
      {
        id: 101, name: 'react', displayName: 'React (Web)',
        version: 'React 18', category: 'Web',
        extensions: ['.jsx', '.js', '.css'], aliases: ['react'], color: '#61dafb',
        description: 'React web application powered by Sandpack.'
      },
      {
        id: 102, name: 'vanilla-web', displayName: 'Vanilla Web',
        version: 'HTML/CSS/JS', category: 'Web',
        extensions: ['.html', '.css', '.js'], aliases: ['vanilla'], color: '#e34f26',
        description: 'Vanilla HTML, CSS, and JS web project powered by Sandpack.'
      },
      {
        id: 103, name: 'node-web', displayName: 'Node.js (Web)',
        version: 'Node.js 18', category: 'Web',
        extensions: ['.js'], aliases: ['node'], color: '#339933',
        description: 'Node.js backend project powered by Sandpack.'
      }
    ];

    const ops = defaults.map(lang => ({
      updateOne: {
        filter: { id: lang.id },
        update: { $set: lang },
        upsert: true
      }
    }));
    await Language.bulkWrite(ops);
    console.log('[Database] Sandbox languages synced successfully.');
  } catch (err) {
    console.error('[Database] Failed to seed default sandbox languages:', err.message);
  }
};

export default Language;
