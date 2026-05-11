import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

mkdirSync(resolve(dist, 'assets'), { recursive: true });

execFileSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['tailwindcss', '-i', 'src/index.css', '-o', 'dist/assets/index.css', '--minify'],
  { cwd: root, stdio: 'inherit' },
);

await esbuild.build({
  entryPoints: [resolve(root, 'src/main.tsx')],
  bundle: true,
  platform: 'browser',
  format: 'esm',
  jsx: 'automatic',
  outfile: resolve(dist, 'assets/index.js'),
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL ?? ''),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY ?? ''),
    'import.meta.env.PROD': 'true',
    'import.meta.env.DEV': 'false',
  },
  loader: { '.ts': 'ts', '.tsx': 'tsx' },
  minify: true,
  sourcemap: false,
});

let html = readFileSync(resolve(root, 'index.html'), 'utf8');
html = html.replace(/<script[^>]+src="\/src\/main\.tsx"[^>]*><\/script>/, '<script type="module" src="/assets/index.js"></script>');
html = html.replace('</head>', '<link rel="stylesheet" href="/assets/index.css" /></head>');
writeFileSync(resolve(dist, 'index.html'), html);

try {
  cpSync(resolve(root, 'public'), dist, { recursive: true });
} catch {
  // The project does not require a public folder.
}
