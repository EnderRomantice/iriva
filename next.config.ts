import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 纯静态导出：`npm run build` 后生成 out/，可直接部署到任何静态托管
  output: "export",
};

export default nextConfig;
