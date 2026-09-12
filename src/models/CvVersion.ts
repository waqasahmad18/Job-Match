import mongoose, { Schema, type InferSchemaType } from "mongoose";

const CvVersionSchema = new Schema(
  {
    name: { type: String, required: true },
    focus: {
      type: String,
      enum: ["fullstack", "mern", "laravel", "python"],
      required: true,
    },
    filePath: { type: String, required: true },
    fileName: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    createdAt: { type: Date },
    updatedAt: { type: Date },
  },
  { timestamps: true },
);

export type CvVersionDoc = InferSchemaType<typeof CvVersionSchema>;

export const CvVersion =
  mongoose.models.CvVersion || mongoose.model("CvVersion", CvVersionSchema);
