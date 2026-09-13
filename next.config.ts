import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mongoose", "mongodb", "nodemailer", "tls"],
  outputFileTracingIncludes: {
    "/api/cron": ["./cv/**/*"],
    "/api/pipeline": ["./cv/**/*"],
    "/api/email/test": ["./cv/**/*"],
  },
};

export default nextConfig;
