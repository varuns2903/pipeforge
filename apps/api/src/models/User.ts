import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  failedLoginAttempts: { type: Number, default: 0 },
  lockedUntil: { type: Date }
}, {
  timestamps: true
});

export const User = mongoose.model('User', userSchema);
