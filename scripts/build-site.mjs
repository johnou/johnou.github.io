import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = new URL('../dist/', import.meta.url);
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
for (const path of ['index.html', 'privacy.html', 'quiz.html', 'soul-match-privacy.html', 'app-ads.txt', 'CNAME', 'assets', 'meme', 'ruffle']) {
  cpSync(`${root}${path}`, new URL(path, output), { recursive: true });
}
console.log('Static site built in dist/.');
