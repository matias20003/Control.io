import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["web-push", "resend", "@prisma/client", "pg"],
};

export default nextConfig;
