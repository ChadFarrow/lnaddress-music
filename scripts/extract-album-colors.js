#!/usr/bin/env node

/**
 * Pre-extract colors from all album artwork and store them for use in the Now Playing screen
 * This avoids CORS issues and improves performance by doing the extraction server-side
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { createCanvas, loadImage } = require('canvas');

// Color extraction utilities (server-side version)
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    
    h /= 6;
  }
  
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

function generateColorPalette(r, g, b) {
  const hsl = rgbToHsl(r, g, b);
  
  return {
    primary: `rgb(${r}, ${g}, ${b})`,
    secondary: `hsl(${(hsl.h + 30) % 360}, ${hsl.s}%, ${Math.max(10, hsl.l - 20)}%)`,
    accent: `hsl(${(hsl.h + 60) % 360}, ${Math.min(100, hsl.s + 20)}%, ${hsl.l}%)`,
    background: `hsl(${hsl.h}, ${Math.max(0, hsl.s - 40)}%, ${Math.max(5, hsl.l - 60)}%)`,
    text: hsl.l > 50 ? '#000000' : '#ffffff'
  };
}

function isColorDark(r, g, b) {
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 128;
}

async function extractColorsFromImage(imageUrl) {
  try {
    console.log(`🎨 Extracting colors from: ${imageUrl}`);
    
    // Load image using node-canvas
    const image = await loadImage(imageUrl);
    const canvas = createCanvas(100, 100);
    const ctx = canvas.getContext('2d');
    
    // Draw image to canvas
    ctx.drawImage(image, 0, 0, 100, 100);
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, 100, 100);
    const data = imageData.data;
    
    // Analyze colors (same logic as client-side)
    const colors = {};
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Skip transparent pixels
      if (data[i + 3] < 128) continue;
      
      // Quantize colors to reduce noise
      const quantizedR = Math.round(r / 32) * 32;
      const quantizedG = Math.round(g / 32) * 32;
      const quantizedB = Math.round(b / 32) * 32;
      
      const colorKey = `${quantizedR},${quantizedG},${quantizedB}`;
      colors[colorKey] = (colors[colorKey] || 0) + 1;
    }
    
    // Find dominant color
    let maxCount = 0;
    let dominantColor = '64,64,64'; // fallback
    
    for (const [color, count] of Object.entries(colors)) {
      if (count > maxCount) {
        maxCount = count;
        dominantColor = color;
      }
    }
    
    const [r, g, b] = dominantColor.split(',').map(Number);
    const palette = generateColorPalette(r, g, b);
    const isDark = isColorDark(r, g, b);
    
    const result = {
      dominant: `rgb(${r}, ${g}, ${b})`,
      palette,
      isDark
    };
    
    console.log(`✅ Extracted colors:`, result);
    return result;
    
  } catch (error) {
    console.error(`❌ Failed to extract colors from ${imageUrl}:`, error.message);
    // Return a default color scheme
    return {
      dominant: 'rgb(64, 64, 128)',
      palette: {
        primary: 'rgb(64, 64, 128)',
        secondary: 'rgb(32, 32, 96)',
        accent: 'rgb(96, 96, 160)',
        background: 'rgb(16, 16, 32)',
        text: '#ffffff'
      },
      isDark: true
    };
  }
}

async function processAlbums() {
  try {
    console.log('🚀 Starting album color extraction...');
    
    // Load current albums data
    const albumsResponse = await fetch('http://localhost:3000/api/albums-static');
    if (!albumsResponse.ok) {
      throw new Error('Failed to fetch albums data');
    }
    
    const albumsData = await albumsResponse.json();
    const albums = albumsData.albums || [];
    
    console.log(`📚 Found ${albums.length} albums to process`);
    
    // Extract colors for each album
    const albumsWithColors = [];
    
    for (let i = 0; i < albums.length; i++) {
      const album = albums[i];
      console.log(`\n[${i + 1}/${albums.length}] Processing: ${album.title}`);
      
      let colors = null;
      if (album.coverArt) {
        colors = await extractColorsFromImage(album.coverArt);
        
        // Add a small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      albumsWithColors.push({
        ...album,
        colors
      });
    }
    
    // Save the enhanced data
    const outputPath = path.join(__dirname, '..', 'data', 'albums-with-colors.json');
    const outputDir = path.dirname(outputPath);
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, JSON.stringify({
      albums: albumsWithColors,
      generatedAt: new Date().toISOString(),
      totalAlbums: albumsWithColors.length
    }, null, 2));
    
    console.log(`\n✅ Successfully processed ${albumsWithColors.length} albums`);
    console.log(`💾 Data saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('❌ Error processing albums:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  processAlbums();
}

module.exports = { extractColorsFromImage, processAlbums };