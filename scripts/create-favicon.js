const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function createFavicon() {
  const inputPath = path.join(__dirname, '../public/logo.webp');
  const outputPath = path.join(__dirname, '../public/favicon.ico');

  try {
    // Create a 32x32 favicon from the logo
    await sharp(inputPath)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toFormat('png')
      .toFile(outputPath.replace('.ico', '.png'));

    // Also create multiple sizes for better browser support
    await sharp(inputPath)
      .resize(16, 16, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toFormat('png')
      .toFile(path.join(__dirname, '../public/favicon-16x16.png'));

    await sharp(inputPath)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toFormat('png')
      .toFile(path.join(__dirname, '../public/favicon-32x32.png'));

    // Create apple-touch-icon
    await sharp(inputPath)
      .resize(180, 180, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toFormat('png')
      .toFile(path.join(__dirname, '../public/apple-touch-icon.png'));

    console.log('✅ Favicon created successfully!');
  } catch (error) {
    console.error('❌ Failed to create favicon:', error);
    process.exit(1);
  }
}

createFavicon();
