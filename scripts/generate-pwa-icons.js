const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

// Create lnaddress music logo with lightning bolt
function createHPMLogo(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Purple to blue gradient background
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#8B5CF6'); // Purple
  gradient.addColorStop(1, '#3B82F6'); // Blue
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Add rounded corners
  ctx.globalCompositeOperation = 'destination-in';
  ctx.beginPath();
  const radius = size * 0.15;
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();

  ctx.globalCompositeOperation = 'source-over';

  // Draw lightning bolt
  const scale = size / 100;
  ctx.fillStyle = '#FBBF24'; // Yellow/Gold
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = size * 0.015;

  ctx.beginPath();
  ctx.moveTo(55 * scale, 25 * scale);
  ctx.lineTo(40 * scale, 50 * scale);
  ctx.lineTo(52 * scale, 50 * scale);
  ctx.lineTo(45 * scale, 75 * scale);
  ctx.lineTo(60 * scale, 50 * scale);
  ctx.lineTo(48 * scale, 50 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  return canvas;
}

// PWA icon sizes
const iconSizes = [
  { size: 192, name: 'icon-192x192.png' },
  { size: 512, name: 'icon-512x512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 152, name: 'apple-touch-icon-152x152.png' },
  { size: 144, name: 'apple-touch-icon-144x144.png' },
  { size: 120, name: 'apple-touch-icon-120x120.png' },
  { size: 76, name: 'apple-touch-icon-76x76.png' },
  { size: 32, name: 'favicon-32x32.png' },
  { size: 16, name: 'favicon-16x16.png' }
];

async function generatePWAIcons() {
  const publicDir = path.join(__dirname, '..', 'public');
  
  console.log('Generating PWA icons...');
  
  for (const icon of iconSizes) {
    console.log(`Creating ${icon.name} (${icon.size}x${icon.size})`);
    
    const canvas = createHPMLogo(icon.size);
    const buffer = canvas.toBuffer('image/png');
    
    const filepath = path.join(publicDir, icon.name);
    fs.writeFileSync(filepath, buffer);
    
    console.log(`✅ Created ${icon.name}`);
  }
  
  console.log('🎉 All PWA icons generated successfully!');
}

// Generate favicon.ico using the 32x32 version
function generateFavicon() {
  const canvas = createHPMLogo(32);
  const buffer = canvas.toBuffer('image/png');
  
  // Save as PNG (modern browsers support PNG favicons)
  const faviconPath = path.join(__dirname, '..', 'public', 'favicon.ico');
  fs.writeFileSync(faviconPath, buffer);
  
  console.log('✅ Created favicon.ico');
}

if (require.main === module) {
  generatePWAIcons()
    .then(() => {
      generateFavicon();
      console.log('🚀 PWA logo setup complete!');
    })
    .catch(console.error);
}

module.exports = { generatePWAIcons, generateFavicon };