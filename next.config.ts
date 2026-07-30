import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build autocontido para o Docker (roda com `node server.js`).
  output: "standalone",
  // O runtime standalone não roda o otimizador de imagem (sem `sharp`), então
  // `/_next/image` falha e o next/image fica em branco. Servindo as imagens
  // como estão, o next/image usa o caminho direto (igual ao favicon) e funciona.
  images: { unoptimized: true },
};

export default nextConfig;
