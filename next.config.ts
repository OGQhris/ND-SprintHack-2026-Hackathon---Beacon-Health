import type { NextConfig } from "next";
const config: NextConfig = {
  // A second dev server (for example npm run test:ui on its own port while npm run dev is up)
  // needs its own build directory: Next locks <distDir>/dev for one server at a time.
  distDir: process.env.NEXT_DIST_DIR?.trim() || ".next",
  serverExternalPackages: ["@prisma/client", "playwright", "exceljs"],
  devIndicators: false,
};
export default config;
