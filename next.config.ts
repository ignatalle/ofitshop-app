import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ['192.168.1.6', '192.168.1.5', '192.168.1.7', '192.168.1.8', '192.168.1.9', '192.168.1.10', '192.168.1.11', '192.168.1.12', '192.168.0.6', '192.168.0.5', '192.168.0.10', 'localhost', '127.0.0.1', '*'] as any,
};

export default nextConfig;
