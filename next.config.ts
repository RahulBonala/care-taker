import path from "node:path";
import type { NextConfig } from "next";

// Static export: `npm run build` writes a plain website to `out/` that any
// static host can serve. Set NEXT_PUBLIC_BASE_PATH when the site lives in a
// sub-folder (for example GitHub Pages: /care-taker).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const root = path.resolve(".");

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: basePath || undefined,
  images: { unoptimized: true },
  devIndicators: false,
  agentRules: false,
  turbopack: { root },
  outputFileTracingRoot: root,
};

export default nextConfig;
