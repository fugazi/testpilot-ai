import type { NextConfig } from "next";
import path from 'path';

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // El Copilot SDK carga koffi (binding nativo FFI) que no puede ser
  // empaquetado por el bundler; se resuelve en runtime desde node_modules.
  serverExternalPackages: ['@github/copilot-sdk', 'koffi'],
  // Explicit turbopack root to avoid Next.js picking the wrong workspace root
  // (silences the warning when multiple lockfiles are present)
  turbopack: {
    // use absolute path to avoid ambiguous resolution to parent workspace
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
