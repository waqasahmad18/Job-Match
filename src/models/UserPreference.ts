import mongoose, { Schema, type InferSchemaType } from "mongoose";

const UserPreferenceSchema = new Schema(
  {
    locations: { type: [String], default: [] },
    roles: { type: [String], default: [] },
    targetTechnologies: { type: [String], default: [] },
    excludedTechnologies: { type: [String], default: [] },
    excludedCompanies: { type: [String], default: ["Interact Global"] },
    onsiteCities: { type: [String], default: ["Lahore"] },
    skills: { type: [String], default: [] },
    matchThreshold: { type: Number, default: 80 },
    dailySendLimit: { type: Number, default: 50 },
    minSalaryPkr: { type: Number, default: 80000 },
    cooldownDays: { type: Number, default: 14 },
    autoSend: { type: Boolean, default: true },
    applicantName: { type: String, default: "Waqas Rafique" },
    applicantEmail: { type: String, default: "vickyksr2218@gmail.com" },
    smtpUser: { type: String, default: "vickyksr2218@gmail.com" },
    smtpPassword: { type: String, default: "" },
    smtpFrom: { type: String, default: "Waqas Rafique <vickyksr2218@gmail.com>" },
  },
  { timestamps: true },
);

export type UserPreferenceDoc = InferSchemaType<typeof UserPreferenceSchema>;

export const UserPreference =
  mongoose.models.UserPreference ||
  mongoose.model("UserPreference", UserPreferenceSchema);
