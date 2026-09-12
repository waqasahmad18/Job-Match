import mongoose, { Schema, type InferSchemaType } from "mongoose";

const JobSchema = new Schema(
  {
    source: { type: String, required: true },
    externalId: { type: String },
    sourceUrl: { type: String, required: true },
    title: { type: String, required: true },
    company: { type: String, required: true },
    location: { type: String, default: "Remote" },
    description: { type: String, required: true },
    tags: { type: [String], default: [] },
    fingerprint: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["new", "processed", "rejected", "matched", "sent"],
      default: "new",
    },
    postedAt: { type: Date },
    collectedAt: { type: Date, default: Date.now },
    createdAt: { type: Date },
    updatedAt: { type: Date },
  },
  { timestamps: true },
);

JobSchema.index({ source: 1, externalId: 1 });
JobSchema.index({ company: 1, title: 1 });
JobSchema.index({ collectedAt: -1 });

export type JobDoc = InferSchemaType<typeof JobSchema>;

export const Job = mongoose.models.Job || mongoose.model("Job", JobSchema);
