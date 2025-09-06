const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// KMeans clustering implementation
function kMeans(pixels, k) {
  if (pixels.length === 0) return [[64, 64, 64]];
  if (pixels.length < k) return pixels.slice(0, k);
  
  // Initialize centroids randomly
  const centroids = [];
  for (let i = 0; i < k; i++) {
    const randomIndex = Math.floor(Math.random() * pixels.length);
    centroids.push([...pixels[randomIndex]]);
  }
  
  // Run KMeans for iterations
  for (let iter = 0; iter < 10; iter++) {
    const clusters = Array(k).fill(null).map(() => []);
    
    for (const pixel of pixels) {
      let minDistance = Infinity;
      let bestCluster = 0;
      
      for (let c = 0; c < k; c++) {
        const distance = Math.sqrt(
          Math.pow(pixel[0] - centroids[c][0], 2) +
          Math.pow(pixel[1] - centroids[c][1], 2) +
          Math.pow(pixel[2] - centroids[c][2], 2)
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          bestCluster = c;
        }
      }
      
      clusters[bestCluster].push(pixel);
    }
    
    // Update centroids
    for (let c = 0; c < k; c++) {
      if (clusters[c].length > 0) {
        const avgR = clusters[c].reduce((sum, p) => sum + p[0], 0) / clusters[c].length;
        const avgG = clusters[c].reduce((sum, p) => sum + p[1], 0) / clusters[c].length;
        const avgB = clusters[c].reduce((sum, p) => sum + p[2], 0) / clusters[c].length;
        
        centroids[c] = [Math.round(avgR), Math.round(avgG), Math.round(avgB)];
      }
    }
  }
  
  return centroids;
}

// RGB to HSL conversion
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
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

// Check if color is dark
function isColorDark(r, g, b) {
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 128;
}

// Generate color palette
function generateColorPalette(r, g, b) {
  const hsl = rgbToHsl(r, g, b);
  
  const primary = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
  const secondary = `hsl(${hsl.h}, ${Math.max(0, hsl.s - 20)}%, ${Math.min(100, hsl.l + 10)}%)`;
  const accent = `hsl(${(hsl.h + 30) % 360}, ${hsl.s}%, ${hsl.l}%)`;
  
  // Smart lightness adjustment
  const isLightColor = hsl.l > 60;
  
  const background = isLightColor 
    ? `linear-gradient(135deg, 
        hsl(${hsl.h}, ${Math.min(100, hsl.s + 20)}%, ${Math.max(15, hsl.l - 25)}%) 0%, 
        hsl(${hsl.h}, ${hsl.s}%, ${Math.max(12, hsl.l - 30)}%) 25%, 
        hsl(${(hsl.h + 15) % 360}, ${Math.max(30, hsl.s - 10)}%, ${Math.max(10, hsl.l - 35)}%) 75%, 
        hsl(${(hsl.h + 30) % 360}, ${Math.max(20, hsl.s - 20)}%, ${Math.max(8, hsl.l - 40)}%) 100%)`
    : `linear-gradient(135deg, 
        hsl(${hsl.h}, ${Math.min(100, hsl.s + 20)}%, ${Math.max(35, hsl.l - 5)}%) 0%, 
        hsl(${hsl.h}, ${hsl.s}%, ${Math.max(30, hsl.l - 10)}%) 25%, 
        hsl(${(hsl.h + 15) % 360}, ${Math.max(30, hsl.s - 10)}%, ${Math.max(25, hsl.l - 15)}%) 75%, 
        hsl(${(hsl.h + 30) % 360}, ${Math.max(20, hsl.s - 20)}%, ${Math.max(20, hsl.l - 20)}%) 100%)`;
  
  const text = hsl.l > 50 ? '#000000' : '#ffffff';
  
  return {
    primary,
    secondary,
    accent,
    background,
    text
  };
}

// Extract colors from image URL
async function extractColorsFromImage(imageUrl, title) {
  try {
    console.log(`🎨 Extracting colors for: ${title}`);
    console.log(`📸 Image URL: ${imageUrl}`);
    
    // Load image
    const img = await loadImage(imageUrl);
    const canvas = createCanvas(100, 100);
    const ctx = canvas.getContext('2d');
    
    // Draw image to canvas
    ctx.drawImage(img, 0, 0, 100, 100);
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, 100, 100);
    const data = imageData.data;
    
    // Collect pixels for KMeans
    const pixels = [];
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Skip very light or very dark pixels
      const brightness = (r + g + b) / 3;
      if (brightness < 20 || brightness > 235) continue;
      
      pixels.push([r, g, b]);
    }
    
    if (pixels.length === 0) {
      console.log(`⚠️  No valid pixels found for ${title}, using fallback`);
      return {
        dominant: 'rgb(64, 64, 64)',
        palette: generateColorPalette(64, 64, 64),
        isDark: true
      };
    }
    
    // Use KMeans to find representative colors
    const kMeansColors = kMeans(pixels, 5);
    
    // Find the most vibrant color
    let bestColor = kMeansColors[0];
    let bestScore = 0;
    
    for (const color of kMeansColors) {
      const [r, g, b] = color;
      const hsl = rgbToHsl(r, g, b);
      const saturation = hsl.s / 100;
      const lightness = hsl.l / 100;
      
      // Score based on saturation and avoiding extremes
      const score = saturation * (1 - Math.abs(lightness - 0.5));
      
      if (score > bestScore) {
        bestScore = score;
        bestColor = color;
      }
    }
    
    const [r, g, b] = bestColor;
    const palette = generateColorPalette(r, g, b);
    const isDark = isColorDark(r, g, b);
    
    const result = {
      dominant: `rgb(${r}, ${g}, ${b})`,
      palette,
      isDark
    };
    
    console.log(`✅ Extracted for ${title}:`, result.dominant);
    return result;
    
  } catch (error) {
    console.error(`❌ Failed to extract colors for ${title}:`, error.message);
    return {
      dominant: 'rgb(64, 64, 64)',
      palette: generateColorPalette(64, 64, 64),
      isDark: true
    };
  }
}

// Main function to extract track colors
async function extractTrackColors() {
  try {
    // Read the albums JSON file
    const filePath = path.join(__dirname, '../public/data/albums-with-colors.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    let tracksProcessed = 0;
    let tracksWithUniqueArt = 0;
    
    console.log(`🚀 Scanning ${data.albums.length} albums for tracks with unique artwork...`);
    
    // Process each album and its tracks
    for (let albumIndex = 0; albumIndex < data.albums.length; albumIndex++) {
      const album = data.albums[albumIndex];
      
      if (!album.tracks || !Array.isArray(album.tracks)) continue;
      
      console.log(`\n📀 Processing album: ${album.title}`);
      
      // Process each track in the album
      for (let trackIndex = 0; trackIndex < album.tracks.length; trackIndex++) {
        const track = album.tracks[trackIndex];
        tracksProcessed++;
        
        // Check if track has unique artwork (different from album cover)
        if (track.image && track.image !== album.coverArt) {
          console.log(`  🎵 Track "${track.title}" has unique artwork`);
          tracksWithUniqueArt++;
          
          // Extract colors for this track
          const colors = await extractColorsFromImage(
            track.image, 
            `${album.title} - ${track.title}`
          );
          
          // Add colors to the track object
          data.albums[albumIndex].tracks[trackIndex].colors = colors;
          
          // Add delay to avoid overwhelming servers
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
    
    // Write updated data back to file
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    console.log(`\n🎉 Track color extraction completed!`);
    console.log(`📊 Statistics:`);
    console.log(`   • Total tracks processed: ${tracksProcessed}`);
    console.log(`   • Tracks with unique artwork: ${tracksWithUniqueArt}`);
    console.log(`   • Tracks with extracted colors: ${tracksWithUniqueArt}`);
    console.log(`📁 Updated: ${filePath}`);
    
  } catch (error) {
    console.error('❌ Error during track color extraction:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  extractTrackColors();
}

module.exports = { extractTrackColors };