import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build autocontido para o Docker (roda com `node server.js`).
  output: "standalone",
};

export default nextConfig;
