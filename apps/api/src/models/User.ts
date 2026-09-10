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
  lockedUntil: { type: Date },
  emailVerified: { type: Boolean, default: false },
  emailVerificationTokenHash: { type: String },
  emailVerificationExpires: { type: Date },
  passwordResetTokenHash: { type: String },
  passwordResetExpires: { type: Date },

  // Billing — synced from Stripe via webhook (see billing.service.ts).
  // `plan` is the source of truth the rest of the app reads (quota checks,
  // UI); the Stripe ids exist only to correlate future webhook events and
  // support the billing portal, never read for authorization directly.
  plan: { type: String, enum: ['free', 'pro'], default: 'free' },
  stripeCustomerId: { type: String },
  stripeSubscriptionId: { type: String },
  stripeSubscriptionStatus: { type: String },
}, {
  timestamps: true
});

userSchema.index({ stripeCustomerId: 1 });

export const User = mongoose.model('User', userSchema);
