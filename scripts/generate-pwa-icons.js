import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "../public");

async function generateIcons() {
  const sourceLogo = path.join(publicDir, "zappix-logo.png");

  // Generate PWA icons
  await sharp(sourceLogo).resize(192, 192).toFile(path.join(publicDir, "pwa-192x192.png"));

  await sharp(sourceLogo).resize(512, 512).toFile(path.join(publicDir, "pwa-512x512.png"));

  // Generate apple touch icon
  await sharp(sourceLogo).resize(180, 180).toFile(path.join(publicDir, "apple-touch-icon.png"));

  // Generate favicon
  await sharp(sourceLogo).resize(32, 32).toFile(path.join(publicDir, "favicon.ico"));

  console.log("PWA icons generated successfully!");
}

generateIcons().catch(console.error);
