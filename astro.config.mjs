import { defineConfig } from 'astro/config';

// Set the SITE_URL and BASE_PATH repo variables (BASE_PATH e.g. /on-roam for a
// project page); the deploy workflow passes them through as SITE and BASE.
// `||`, not `??`: an unset Actions variable arrives as an empty string, and an
// empty `site` fails the build with "site: Invalid url".
export default defineConfig({
  site: process.env.SITE || 'https://example.github.io',
  base: process.env.BASE || '/',
  // the dev toolbar sits exactly over the archive's bottom-centre controls
  devToolbar: { enabled: false },
});
