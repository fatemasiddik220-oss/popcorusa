import mongoose, { Schema, Document } from 'mongoose';

export interface IMiningLevelDocument extends Document {
  level: number;
  name: string;
  speedPerHour: number;
  pricePOP: number;
  priceUSD: number;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MiningLevelSchema = new Schema<IMiningLevelDocument>(
  {
    level: {
      type: Number,
      required: true,
      unique: true,
      index: true,
      min: 1,
      max: 100,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    speedPerHour: {
      type: Number,
      required: true,
      min: 0,
    },
    pricePOP: {
      type: Number,
      required: true,
      min: 0,
    },
    priceUSD: {
      type: Number,
      default: 0,
      min: 0,
    },
    description: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

MiningLevelSchema.index({ level: 1 });

export const MiningLevelModel =
  mongoose.models.MiningLevel ||
  mongoose.model<IMiningLevelDocument>('MiningLevel', MiningLevelSchema);
