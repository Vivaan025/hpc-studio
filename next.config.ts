import type { NextConfig } from "next";

// On GitHub Pages the site lives at https://<user>.github.io/hpc-studio,
// so production builds get a base path. Local `npm run dev` stays at /.
const isPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: isPages ? "/hpc-studio" : "",
};

export default nextConfig;
