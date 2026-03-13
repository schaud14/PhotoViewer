const sharp = require('sharp');
const path = require('path');

async function roundCorners() {
  const iconPath = path.resolve(__dirname, 'resources/icon.png');
  const logoPath = path.resolve(__dirname, 'src/renderer/src/assets/logo.png');
  
  const metadata = await sharp(iconPath).metadata();
  const width = metadata.width;
  const height = metadata.height;
  const radius = Math.round(Math.min(width, height) * 0.18); // Modern macOS-style rounding

  const mask = Buffer.from(
    `<svg><rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="white"/></svg>`
  );

  await sharp(iconPath)
    .composite([{ input: mask, blend: 'dest-in' }])
    .toFile(iconPath + '.tmp');

  const fs = require('fs');
  fs.renameSync(iconPath + '.tmp', iconPath);
  fs.copyFileSync(iconPath, logoPath);
  
  console.log('Successfully applied rounded corners to icon.');
}

roundCorners().catch(err => {
  console.error(err);
  process.exit(1);
});
