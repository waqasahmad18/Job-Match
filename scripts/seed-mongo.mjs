import { readFileSync } from "fs";
import dns from "dns";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

dns.setServers(["8.8.8.8", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2];
}

const UserPreferenceSchema = new mongoose.Schema(
  {
    locations: [String],
    roles: [String],
    targetTechnologies: [String],
    excludedTechnologies: [String],
    excludedCompanies: [String],
    onsiteCities: [String],
    skills: [String],
    matchThreshold: Number,
    dailySendLimit: Number,
    cooldownDays: Number,
    autoSend: Boolean,
    applicantName: String,
    applicantEmail: String,
  },
  { timestamps: true },
);

const CvVersionSchema = new mongoose.Schema(
  {
    name: String,
    focus: String,
    filePath: String,
    fileName: String,
    isDefault: Boolean,
  },
  { timestamps: true },
);

const UserPreference = mongoose.models.UserPreference || mongoose.model("UserPreference", UserPreferenceSchema);
const CvVersion = mongoose.models.CvVersion || mongoose.model("CvVersion", CvVersionSchema);

const settings = {
  locations: ["Remote worldwide", "Remote Pakistan", "Onsite Lahore only"],
  roles: [
    "Full Stack Developer",
    "Full Stack Engineer",
    "MERN Stack Developer",
    "React Developer",
    "Next.js Developer",
    "Node.js Developer",
    "Backend Developer",
    "PHP Developer",
    "Laravel Developer",
    "Python Developer",
    "Django Developer",
    "Software Engineer",
    "Software Developer",
    "Web Application Developer",
  ],
  targetTechnologies: [
    "React",
    "Next.js",
    "JavaScript",
    "TypeScript",
    "HTML",
    "CSS",
    "Node.js",
    "Express",
    "PHP",
    "Laravel",
    "Python",
    "Django",
    "MongoDB",
    "MySQL",
    "PostgreSQL",
    "REST APIs",
    "Git",
  ],
  excludedTechnologies: ["WordPress", "Shopify", "Elementor", "WooCommerce", "Shopify Liquid"],
  excludedCompanies: ["Interact Global"],
  onsiteCities: ["Lahore"],
  skills: [
    "React",
    "Next.js",
    "JavaScript",
    "TypeScript",
    "HTML",
    "CSS",
    "Node.js",
    "Express",
    "PHP",
    "Laravel",
    "Python",
    "Django",
    "MongoDB",
    "MySQL",
    "PostgreSQL",
    "REST APIs",
    "Git",
  ],
  matchThreshold: 80,
  dailySendLimit: 20,
  cooldownDays: 14,
  autoSend: true,
  applicantName: "Waqas Rafique",
  applicantEmail: "vickyksr2218@gmail.com",
};

const cvPath = path.join(root, "uploads", "cv", "Waqas_Rafique_CV.pdf");

const options = {
  dbName: process.env.MONGODB_DB,
  family: 4,
  serverSelectionTimeoutMS: 20000,
};

try {
  await mongoose.connect(process.env.MONGODB_URI, options);
} catch {
  await mongoose.connect(process.env.MONGODB_URI_STANDARD, options);
}

await UserPreference.findOneAndUpdate({}, settings, { upsert: true, new: true });
await CvVersion.updateMany({ fileName: { $ne: "Waqas_Rafique_CV.pdf" } }, { isDefault: false });
await CvVersion.findOneAndUpdate(
  { fileName: "Waqas_Rafique_CV.pdf" },
  {
    name: "Waqas Rafique Full Stack CV",
    focus: "fullstack",
    filePath: cvPath,
    fileName: "Waqas_Rafique_CV.pdf",
    isDefault: true,
  },
  { upsert: true, new: true },
);

const dbName = mongoose.connection.name;
const prefs = await UserPreference.countDocuments();
const cvs = await CvVersion.countDocuments();
console.log(JSON.stringify({ dbName, prefs, cvs, readyState: mongoose.connection.readyState }));
await mongoose.disconnect();
