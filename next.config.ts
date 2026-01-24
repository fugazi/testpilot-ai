import type { NextConfig } from "next";
import path from 'path';

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Explicit turbopack root to avoid Next.js picking the wrong workspace root
  // (silences the warning when multiple lockfiles are present)
  turbopack: {
    // use absolute path to avoid ambiguous resolution to parent workspace
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
