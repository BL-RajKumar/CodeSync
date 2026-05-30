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
  dockerImage: {
    type: String,
    default: '',
  },
  dockerRunCmd: {
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
    const count = await Language.countDocuments();
    if (count > 0) return;

    const defaults = [
      {
        id: 93, name: 'javascript', displayName: 'JavaScript',
        version: 'Node.js 18.15.0', category: 'Scripting',
        extensions: ['.js', '.jsx'], aliases: ['js', 'jsx', 'javascript'], color: '#f7df1e',
        description: 'Lightweight interpreted language for web & server-side scripting.',
        dockerImage: 'node:18-alpine', dockerRunCmd: 'node script.js'
      },
      {
        id: 94, name: 'typescript', displayName: 'TypeScript',
        version: 'TypeScript 5.0.3 / Node.js 18.15.0', category: 'Scripting',
        extensions: ['.ts', '.tsx'], aliases: ['ts', 'tsx', 'typescript'], color: '#3178c6',
        description: 'Typed superset of JavaScript that compiles to plain JS.',
        dockerImage: 'node:18-alpine', dockerRunCmd: 'npx ts-node script.ts'
      },
      {
        id: 71, name: 'python', displayName: 'Python 3',
        version: 'CPython 3.11.2', category: 'Scripting',
        extensions: ['.py'], aliases: ['py', 'python', 'python3'], color: '#3776ab',
        description: 'High-level language emphasising readability and versatility.',
        dockerImage: 'python:3.9-alpine', dockerRunCmd: 'python script.py'
      },
      {
        id: 62, name: 'java', displayName: 'Java',
        version: 'OpenJDK 13.0.1', category: 'Compiled (JVM)',
        extensions: ['.java'], aliases: ['java'], color: '#f89820',
        description: 'Object-oriented, platform-independent language for enterprise apps.',
        dockerImage: 'eclipse-temurin:17-alpine', dockerRunCmd: 'java script.java'
      },
      {
        id: 54, name: 'cpp', displayName: 'C++',
        version: 'GCC 9.2.0 (C++17)', category: 'Compiled (Native)',
        extensions: ['.cpp', '.cc', '.cxx'], aliases: ['cpp', 'cc', 'cxx'], color: '#00599c',
        description: 'High-performance systems language with OOP and generic programming.',
        dockerImage: 'gcc:latest', dockerRunCmd: 'g++ script.cpp -o app && ./app'
      },
      {
        id: 50, name: 'c', displayName: 'C',
        version: 'GCC 9.2.0 (C17)', category: 'Compiled (Native)',
        extensions: ['.c'], aliases: ['c'], color: '#a8b9cc',
        description: 'Low-level procedural language, foundation of modern systems software.',
        dockerImage: 'gcc:latest', dockerRunCmd: 'gcc script.c -o app && ./app'
      },
      {
        id: 60, name: 'go', displayName: 'Go',
        version: 'Go 1.13.5', category: 'Compiled (Native)',
        extensions: ['.go'], aliases: ['go', 'golang'], color: '#00add8',
        description: 'Statically typed, compiled language designed for concurrency & cloud.',
        dockerImage: 'golang:alpine', dockerRunCmd: 'go run script.go'
      },
      {
        id: 73, name: 'rust', displayName: 'Rust',
        version: 'Rust 1.40.0', category: 'Compiled (Native)',
        extensions: ['.rs'], aliases: ['rs', 'rust'], color: '#ce422b',
        description: 'Memory-safe systems language without a garbage collector.',
        dockerImage: 'rust:alpine', dockerRunCmd: 'rustc script.rs -o app && ./app'
      },
      {
        id: 68, name: 'php', displayName: 'PHP',
        version: 'PHP 7.4.1', category: 'Scripting',
        extensions: ['.php'], aliases: ['php'], color: '#8993be',
        description: 'Server-side scripting language widely used for web development.',
        dockerImage: 'php:8.2-cli-alpine', dockerRunCmd: 'php script.php'
      },
      {
        id: 72, name: 'ruby', displayName: 'Ruby',
        version: 'MRI Ruby 2.7.0', category: 'Scripting',
        extensions: ['.rb'], aliases: ['rb', 'ruby'], color: '#cc342d',
        description: 'Dynamic, expressive language with elegant syntax and strong OOP.',
        dockerImage: 'ruby:3.2-alpine', dockerRunCmd: 'ruby script.rb'
      },
      {
        id: 43, name: 'plaintext', displayName: 'Plain Text',
        version: 'Plaintext 1.0.0', category: 'Text',
        extensions: ['.txt'], aliases: ['txt', 'plaintext'], color: '#cccccc',
        description: 'Plain text files without formatting or compilation capabilities.',
        dockerImage: '', dockerRunCmd: ''
      }
    ];

    await Language.insertMany(defaults);
    console.log('[Database] Default sandbox languages seeded successfully.');
  } catch (err) {
    console.error('[Database] Failed to seed default sandbox languages:', err.message);
  }
};

export default Language;
