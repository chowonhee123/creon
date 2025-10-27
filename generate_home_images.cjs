// Auto-generate home_images.json from files in public/images/home/
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

try {
  const files = fs.readdirSync(homeDir).filter(f => /\.(png|jpg|jpeg|webp|mp4|webm)$/i.test(f));
  
  const homeImages = files.map((filename, index) => ({
    id: `home_${index + 1}`,
    name: filename,
    type: getMimeType(filename),
    dataUrl: `/images/home/${filename}`,
    timestamp: Date.now() - (index * 60000)
  }));

  fs.writeFileSync(outputFile, JSON.stringify(homeImages, null, 2));
  console.log(`✅ Generated ${files.length} home images in ${outputFile}`);
} catch (error) {
  console.error('❌ Failed to generate home images:', error);
}

