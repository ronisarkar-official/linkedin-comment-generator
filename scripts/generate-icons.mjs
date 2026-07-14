import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const iconsDir = path.join(rootDir, 'public', 'icons');
const sourceIconPath = path.join(iconsDir, 'icon-source.png');

async function generateIcons() {
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  if (!fs.existsSync(sourceIconPath)) {
    throw new Error(`Source icon not found at ${sourceIconPath}. Place a square PNG at public/icons/icon-source.png`);
  }

  const metadata = await sharp(inputPath).metadata();
  console.log(`Processing icon from ${inputPath} (${metadata.width}x${metadata.height})...`);

  // We use a 700x700 crop centered on the 1024x1024 AI image to perfectly frame the 3D speech bubble
  const cropSize = Math.min(700, metadata.width, metadata.height);
  const left = Math.round((metadata.width - cropSize) / 2);
  const top = Math.round((metadata.height - cropSize) / 2);

  const sizes = [16, 48, 128];
  for (const size of sizes) {
    const outputPath = path.join(iconsDir, `icon${size}.png`);
    await sharp(inputPath)
      .extract({ left, top, width: cropSize, height: cropSize })
      .resize(size, size, { kernel: sharp.kernel.lanczos3 })
      .png({ quality: 100 })
      .toFile(outputPath);
    console.log(`Generated public/icons/icon${size}.png`);
  }

  console.log('All extension icons successfully upgraded!');
}

generateIcons().catch((err) => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
