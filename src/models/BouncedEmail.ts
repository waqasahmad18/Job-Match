import mongoose, { Schema, type InferSchemaType } from "mongoose";

const BouncedEmailSchema = new Schema(
  {
    email: { type: String, required: true, unique: true },
    reason: { type: String },
    firstSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export type BouncedEmailDoc = InferSchemaType<typeof BouncedEmailSchema>;

export const BouncedEmail =
  mongoose.models.BouncedEmail || mongoose.model("BouncedEmail", BouncedEmailSchema);
