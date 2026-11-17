import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://migace.openbrod.org',
  markdown: {
    shikiConfig: { themes: { light: 'github-light', dark: 'one-dark-pro' } },
  },
});
