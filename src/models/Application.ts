import mongoose, { Schema, type InferSchemaType } from "mongoose";

const ApplicationSchema = new Schema(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    matchId: { type: Schema.Types.ObjectId, ref: "JobMatch" },
    cvId: { type: Schema.Types.ObjectId, ref: "CvVersion" },
    status: {
      type: String,
      enum: ["sent", "skipped", "rejected", "duplicate", "failed", "ready"],
      required: true,
    },
    emailTo: { type: String },
    emailSubject: { type: String },
    emailBody: { type: String },
    reason: { type: String },
    createdAt: { type: Date },
    updatedAt: { type: Date },
  },
  { timestamps: true },
);

ApplicationSchema.index({ jobId: 1 });
ApplicationSchema.index({ createdAt: -1 });

export type ApplicationDoc = InferSchemaType<typeof ApplicationSchema>;

export const Application =
  mongoose.models.Application ||
  mongoose.model("Application", ApplicationSchema);
