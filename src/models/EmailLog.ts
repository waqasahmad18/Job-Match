import mongoose, { Schema, type InferSchemaType } from "mongoose";

const EmailLogSchema = new Schema(
  {
    applicationId: { type: Schema.Types.ObjectId, ref: "Application" },
    jobId: { type: Schema.Types.ObjectId, ref: "Job" },
    to: { type: String },
    subject: { type: String },
    success: { type: Boolean, required: true },
    error: { type: String },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export type EmailLogDoc = InferSchemaType<typeof EmailLogSchema>;

export const EmailLog =
  mongoose.models.EmailLog || mongoose.model("EmailLog", EmailLogSchema);
