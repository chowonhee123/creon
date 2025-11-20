// Auto-generate home_images.json from files in public/images/home/ and subfolders (veo2, veo3)
const fs = require('fs');
const path = require('path');

const homeDir = './public/images/home/';
const outputFile = './public/home_images.json';

const getMimeType = (filename) => {
  if (filename.endsWith('.mp4')) return 'video/mp4';
  if (filename.endsWith('.webm')) return 'video/webm';
  if (filename.endsWith('.png')) return 'image/png';
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg';
  if (filename.endsWith('.webp')) return 'image/webp';
  return 'image/png';
};

const getAllFiles = (dir, basePath = '') => {
  let results = [];
  const list = fs.readdirSync(dir);
  
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    const relativePath = basePath ? `${basePath}/${file}` : file;
    
    if (stat.isDirectory()) {
      // Recursively scan subdirectories (veo2, veo3, etc.)
      results = results.concat(getAllFiles(filePath, relativePath));
    } else if (/\.(png|jpg|jpeg|webp|mp4|webm)$/i.test(file)) {
      results.push(relativePath);
    }
  });
  
  return results;
};

try {
  const allFiles = getAllFiles(homeDir);
  
  // Sort files: videos first, then images
  const sortedFiles = allFiles.sort((a, b) => {
    const aIsVideo = /\.(mp4|webm)$/i.test(a);
    const bIsVideo = /\.(mp4|webm)$/i.test(b);
    
    if (aIsVideo && !bIsVideo) return -1; // video comes first
    if (!aIsVideo && bIsVideo) return 1;   // image comes after
    return a.localeCompare(b); // same type, sort alphabetically
  });
  
  const homeImages = sortedFiles.map((filePath, index) => ({
    id: `home_${index + 1}`,
    name: path.basename(filePath),
    type: getMimeType(filePath),
    dataUrl: `/images/home/${filePath}`,
    timestamp: Date.now() - (index * 60000)
  }));

  fs.writeFileSync(outputFile, JSON.stringify(homeImages, null, 2));
  console.log(`✅ Generated ${allFiles.length} home images in ${outputFile}`);
  console.log(`   - Files from veo2/: ${allFiles.filter(f => f.includes('veo2/')).length}`);
  console.log(`   - Files from veo3/: ${allFiles.filter(f => f.includes('veo3/')).length}`);
} catch (error) {
  console.error('❌ Failed to generate home images:', error);
}



