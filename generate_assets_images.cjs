// Auto-generate assets_images.json from files in public/assets/
const fs = require('fs');
const path = require('path');

const assetsDir = './public/assets/';
const outputFile = './public/assets_images.json';

const getMimeType = (filename) => {
  if (filename.endsWith('.png')) return 'image/png';
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg';
  if (filename.endsWith('.webp')) return 'image/webp';
  return 'image/png';
};

try {
  const files = fs.readdirSync(assetsDir).filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.webp'].includes(ext);
  });
  
  const assetsImages = files.map((filename, index) => ({
    id: `asset_${index + 1}`,
    name: filename,
    type: getMimeType(filename),
    url: `/assets/${filename}`,
    timestamp: Date.now() - (index * 1000)
  }));

  fs.writeFileSync(outputFile, JSON.stringify(assetsImages, null, 2));
  console.log(`✅ Generated ${files.length} asset images in ${outputFile}`);
} catch (error) {
  console.error('❌ Failed to generate asset images:', error);
}





