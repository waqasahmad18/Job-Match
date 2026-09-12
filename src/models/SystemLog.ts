import mongoose, { Schema, type InferSchemaType } from "mongoose";

const SystemLogSchema = new Schema(
  {
    level: {
      type: String,
      enum: ["info", "warn", "error"],
      default: "info",
    },
    message: { type: String, required: true },
    context: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export type SystemLogDoc = InferSchemaType<typeof SystemLogSchema>;

export const SystemLog =
  mongoose.models.SystemLog || mongoose.model("SystemLog", SystemLogSchema);
