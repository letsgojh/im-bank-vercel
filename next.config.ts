import type { NextConfig } from "next";

// Vercel 서버리스 함수는 요청 본문이 4.5MB로 제한되므로 업로드 한도를 낮춘다(멀티파트 여유분 포함 4MB).
// Render 등 일반 Node 서버에서는 계획서대로 50MB.
const maxUploadMb = process.env.MAX_UPLOAD_MB ?? (process.env.VERCEL ? "4" : "50");

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_MAX_UPLOAD_MB: maxUploadMb },
};

export default nextConfig;
