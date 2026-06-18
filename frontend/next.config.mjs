/** @type {import('next').NextConfig} */
const nextConfig = {
  // Salida autocontenida para una imagen Docker pequeña.
  output: "standalone",
  images: {
    remotePatterns: [
      // Imágenes de ejemplo del seed; reemplazar por el CDN/Odoo real luego.
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
};

export default nextConfig;
