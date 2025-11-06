import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import fs from 'fs';

// Plugin to auto-generate home_images.json when files in public/images/home/ change
const homeImagesPlugin = () => {
  const generateHomeImages = () => {
    try {
      const homeDir = './public/images/home/';
      const outputFile = './public/home_images.json';
      
      if (!fs.existsSync(homeDir)) {
        return;
      }

      const files = fs.readdirSync(homeDir).filter(f => /\.(png|jpg|jpeg|webp|mp4|webm)$/i.test(f));
      
      const getMimeType = (filename: string) => {
        if (filename.endsWith('.mp4')) return 'video/mp4';
        if (filename.endsWith('.webm')) return 'video/webm';
        if (filename.endsWith('.png')) return 'image/png';
        if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg';
        if (filename.endsWith('.webp')) return 'image/webp';
        return 'image/png';
      };
      
      // Sort files: videos first, then images
      const sortedFiles = files.sort((a, b) => {
        const aIsVideo = /\.(mp4|webm)$/i.test(a);
        const bIsVideo = /\.(mp4|webm)$/i.test(b);
        
        if (aIsVideo && !bIsVideo) return -1; // video comes first
        if (!aIsVideo && bIsVideo) return 1;   // image comes after
        return a.localeCompare(b); // same type, sort alphabetically
      });
      
      const homeImages = sortedFiles.map((filename, index) => ({
        id: `home_${index + 1}`,
        name: filename,
        type: getMimeType(filename),
        dataUrl: `/images/home/${filename}`,
        timestamp: Date.now() - (index * 60000)
      }));

      fs.writeFileSync(outputFile, JSON.stringify(homeImages, null, 2));
      console.log(`✅ Auto-generated ${files.length} home images in ${outputFile}`);
    } catch (error) {
      console.error('❌ Failed to generate home images:', error);
    }
  };

  return {
    name: 'home-images-generator',
    buildStart() {
      generateHomeImages();
    },
    configureServer(server) {
      // Watch for changes in public/images/home/
      const homeDir = path.resolve(__dirname, 'public/images/home');
      if (fs.existsSync(homeDir)) {
        fs.watch(homeDir, { recursive: false }, (eventType, filename) => {
          if (filename && /\.(png|jpg|jpeg|webp|mp4|webm)$/i.test(filename)) {
            console.log(`📁 Home images changed: ${filename}, regenerating home_images.json...`);
            generateHomeImages();
            console.log(`✅ Please refresh the browser to see the updated images.`);
          }
        });
      }
    }
  };
};

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [homeImagesPlugin()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      optimizeDeps: {
        exclude: ['@imgly/background-removal']
      },
      assetsInclude: ['**/*.wasm']
    };
});
