import type { NextConfig } from "next";

import { BASE_PATH } from "./lib/base-path";

const nextConfig: NextConfig = {
  basePath: BASE_PATH,
  // The tracker used to live at /iss before it became the home page; keep old links working.
  async redirects() {
    return [{ source: "/iss", destination: "/", permanent: false }];
  },
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
