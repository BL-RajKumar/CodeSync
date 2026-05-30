import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  // userId is typically represented by _id in MongoDB
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  passwordHash: {
    type: String,
    required: function() {
      // Password is required if the user registered locally
      return this.provider === 'local';
    },
  },
  fullName: {
    type: String,
    default: '',
  },
  role: {
    type: String,
    enum: ['Guest', 'Developer', 'Admin'],
    default: 'Developer',
  },
  avatarUrl: {
    type: String,
    default: '',
  },
  provider: {
    type: String,
    enum: ['local', 'google', 'github'],
    default: 'local',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  verificationToken: {
    type: String,
  },
  bio: {
    type: String,
    default: '',
  },
  starredProjects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
  }],
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
});

// Pre-save middleware to hash password
userSchema.pre('save', async function() {
  // Only hash if passwordHash was modified and exists (not empty)
  if (!this.isModified('passwordHash') || !this.passwordHash) {
    return;
  }
  // Check if it's already hashed (bcrypt hashes start with $2a$ or $2b$)
  if (this.passwordHash.startsWith('$2a$') || this.passwordHash.startsWith('$2b$')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
});

// Method to compare entered password with hashed password
userSchema.methods.matchPassword = async function(enteredPassword) {
  if (!this.passwordHash) return false;
  return await bcrypt.compare(enteredPassword, this.passwordHash);
};

const User = mongoose.model('User', userSchema);
export default User;
