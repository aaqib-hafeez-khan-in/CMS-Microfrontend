const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const shellDist = path.join(rootDir, 'cms-root-orchestration', 'dist');

const modules = [
  'cms-angular-auth',
  'cms-react-editorial',
  'cms-svelte-collab',
  'cms-vue-media',
];

for (const moduleName of modules) {
  const source = path.join(rootDir, moduleName, 'dist', 'main.js');
  const targetDir = path.join(shellDist, 'mfes', moduleName);
  const target = path.join(targetDir, 'main.js');

  if (!fs.existsSync(source)) {
    throw new Error(`Missing production bundle: ${source}`);
  }

  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(source, target);
}

const indexPath = path.join(shellDist, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
const stylesPath = path.join(rootDir, 'cms-root-orchestration', 'public', 'design-system.css');
const styles = fs.readFileSync(stylesPath, 'utf8');

html = html.replaceAll('/cms-root-orchestration', '');
html = html.replace('base=""', 'base="/"');
html = html.replace('<link rel="stylesheet" href="/design-system.css">', `<style>${styles}</style>`);

for (const moduleName of modules) {
  const remoteUrl = `https://aaqibhafeezkhan.github.io/${moduleName}/main.js`;
  const localUrl = `/mfes/${moduleName}/main.js`;
  html = html.replaceAll(remoteUrl, localUrl);
}

fs.writeFileSync(indexPath, html);
