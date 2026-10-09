import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Jeden plik HTML na wyjściu: łatwo go opublikować jako Artifact albo wrzucić gdziekolwiek.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
});
