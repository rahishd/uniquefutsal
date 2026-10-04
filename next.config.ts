import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-8815fdd0533a432a8e3c5f71a5b76a85.r2.dev",
        port: "",
        pathname: "/**",
      },
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
  webpack: (config) => {
    config.resolve.modules = [
      path.resolve(process.cwd(), "node_modules"),
      "node_modules",
    ];
    return config;
  },
};

export default nextConfig;
