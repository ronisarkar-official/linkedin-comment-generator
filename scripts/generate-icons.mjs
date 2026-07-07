import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const iconsDir = path.join(rootDir, 'public', 'icons');
const sourceIconPath = path.join(iconsDir, 'icon-source.png');

// Fallback to the generated AI artifact if icon-source.png doesn't exist yet
const aiArtifactPath = 'C:\\\\Users\\\\ronis\\\\.gemini\\\\antigravity-ide\\\\brain\\\\011f2cc2-ebc6-4e50-bf17-3a68a191d13e\\\\linkedin_comment_icon_1783336976851.png';

async function generateIcons() {
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  // Ensure we have a persistent source image in public/icons/
  if (!fs.existsSync(sourceIconPath) && fs.existsSync(aiArtifactPath)) {
    fs.copyFileSync(aiArtifactPath, sourceIconPath);
    console.log('Copied AI icon to public/icons/icon-source.png');
  }

  const inputPath = fs.existsSync(sourceIconPath) ? sourceIconPath : aiArtifactPath;
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Source icon not found at ${inputPath}`);
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
