/**
 * POP TELEGRAM MINI APP - PRODUCTION MONGOOSE / MONGODB SCHEMAS
 */

export const MONGOOSE_SCHEMAS_CODE = `
import mongoose, { Schema, Document } from 'mongoose';

// 1. User Schema
export interface IUserDocument extends Document {
  telegramId: string;
  username?: string;
  firstName: string;
  lastName?: string;
  photoUrl?: string;
  tonWalletAddress?: string | null;
  balancePOP: number;
  unclaimedMiningPOP: number;
  minerLevel: number;
  storageTier: number;
  miningStartedAt: Date;
  lastClaimedAt: Date;
  hasStartedMining: boolean;
  hasJoinedChannel: boolean;
  isQualified: boolean;
  referrerId?: string | null;
  ipAddress?: string;
  deviceFingerprint?: string;
  isFlagged: boolean;
  flaggedReason?: string;
  dailyStreak: number;
  lastCheckInDate?: string | null;
  totalMined: number;
  squadCommissionRate: number;
  unclaimedSquadPOP: number;
  claimedSquadPOP: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUserDocument>(
  {
    telegramId: { type: String, required: true, unique: true, index: true },
    username: { type: String, index: true },
    firstName: { type: String, required: true },
    lastName: { type: String, default: '' },
    photoUrl: { type: String, default: '' },
    tonWalletAddress: { type: String, default: null, index: true },
    balancePOP: { type: Number, default: 0, min: 0 },
    unclaimedMiningPOP: { type: Number, default: 0 },
    minerLevel: { type: Number, default: 1, min: 1 },
    storageTier: { type: Number, default: 1, min: 1 },
    miningStartedAt: { type: Date, default: Date.now },
    lastClaimedAt: { type: Date, default: Date.now },
    hasStartedMining: { type: Boolean, default: false },
    hasJoinedChannel: { type: Boolean, default: false },
    isQualified: { type: Boolean, default: false },
    referrerId: { type: String, default: null, index: true },
    ipAddress: { type: String, default: '127.0.0.1', index: true },
    deviceFingerprint: { type: String, default: 'fp_unknown', index: true },
    isFlagged: { type: Boolean, default: false, index: true },
    flaggedReason: { type: String },
    dailyStreak: { type: Number, default: 0 },
    lastCheckInDate: { type: String, default: null },
    totalMined: { type: Number, default: 0 },
    squadCommissionRate: { type: Number, default: 10 },
    unclaimedSquadPOP: { type: Number, default: 0 },
    claimedSquadPOP: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Compound indexes for anti-cheat & fast squad lookups
UserSchema.index({ ipAddress: 1, deviceFingerprint: 1 });
UserSchema.index({ totalMined: -1 });

export const UserModel = mongoose.model<IUserDocument>('User', UserSchema);

// 2. Withdrawal Schema
export interface IWithdrawalDocument extends Document {
  userId: string;
  telegramId: string;
  username?: string;
  amountPOP: number;
  feePercent: number;
  feeAmountPOP: number;
  netAmountPOP: number;
  tonAddress: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID' | 'COMPLETED';
  adminNote?: string;
  txHash?: string;
  createdAt: Date;
  processedAt?: Date;
}

const WithdrawalSchema = new Schema<IWithdrawalDocument>(
  {
    userId: { type: String, required: true, index: true },
    telegramId: { type: String, required: true, index: true },
    username: { type: String },
    amountPOP: { type: Number, required: true, min: 500 },
    feePercent: { type: Number, default: 5 },
    feeAmountPOP: { type: Number, required: true },
    netAmountPOP: { type: Number, required: true },
    tonAddress: { type: String, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'PAID', 'COMPLETED'],
      default: 'PENDING',
      index: true,
    },
    adminNote: { type: String },
    txHash: { type: String },
    processedAt: { type: Date },
  },
  { timestamps: true }
);

export const WithdrawalModel = mongoose.model<IWithdrawalDocument>('Withdrawal', WithdrawalSchema);
`;
