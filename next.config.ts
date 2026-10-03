import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["@prisma/client", "playwright", "exceljs"],
  devIndicators: false,
};
export default config;
