// Zamienia dist/index.html (jeden plik od vite-plugin-singlefile) na treść strony Artifact:
// bez <!doctype>/<html>/<head>/<body>, bo Artifact dokłada własny szkielet.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const html = readFileSync('dist/index.html', 'utf8');
const head = /<head>([\s\S]*?)<\/head>/i.exec(html)[1]
  .replace(/<meta[^>]*>\s*/gi, '');
const body = /<body>([\s\S]*?)<\/body>/i.exec(html)[1];
// Skrypt modułowy musi iść po treści, a nie w <head>, żeby znalazł elementy DOM.
const scripts = [];
const headNoScripts = head.replace(/<script[\s\S]*?<\/script>\s*/gi, (m) => { scripts.push(m); return ''; });
mkdirSync('artifact', { recursive: true });
writeFileSync('artifact/kratka.html', `${headNoScripts.trim()}\n${body.trim()}\n${scripts.join('\n')}\n`);
console.log('artifact/kratka.html', Math.round(readFileSync('artifact/kratka.html').length / 1024) + ' KB');
