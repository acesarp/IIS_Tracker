import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone: server.js plus only the node_modules it needs, for the Docker image.
  output: "standalone",
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
