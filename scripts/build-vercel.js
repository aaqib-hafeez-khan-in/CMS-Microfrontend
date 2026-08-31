const { execFileSync } = require('child_process');

const rootDir = require('path').resolve(__dirname, '..');
const modules = [
  'cms-angular-auth',
  'cms-react-editorial',
  'cms-svelte-collab',
  'cms-vue-media',
  'cms-root-orchestration',
];

process.env.NODE_OPTIONS = '--openssl-legacy-provider';

for (const moduleName of modules) {
  execFileSync('npm', ['--prefix', moduleName, 'ci', '--legacy-peer-deps'], {
    cwd: rootDir,
    stdio: 'inherit',
  });
  execFileSync('npm', ['--prefix', moduleName, 'run', 'build'], {
    cwd: rootDir,
    stdio: 'inherit',
  });
}

execFileSync('node', ['scripts/prepare-vercel-deployment.js'], {
  cwd: rootDir,
  stdio: 'inherit',
});
