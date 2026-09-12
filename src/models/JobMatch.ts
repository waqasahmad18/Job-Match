import mongoose, { Schema, type InferSchemaType } from "mongoose";

const JobMatchSchema = new Schema(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    score: { type: Number, required: true },
    relevant: { type: Boolean, default: false },
    matchedSkills: { type: [String], default: [] },
    missingSkills: { type: [String], default: [] },
    reason: { type: String, default: "" },
    rejected: { type: Boolean, default: false },
    rejectReason: { type: String },
    method: {
      type: String,
      enum: ["rules", "ai", "hybrid"],
      default: "rules",
    },
    createdAt: { type: Date },
    updatedAt: { type: Date },
  },
  { timestamps: true },
);

JobMatchSchema.index({ jobId: 1 }, { unique: true });

export type JobMatchDoc = InferSchemaType<typeof JobMatchSchema>;

export const JobMatch =
  mongoose.models.JobMatch || mongoose.model("JobMatch", JobMatchSchema);
