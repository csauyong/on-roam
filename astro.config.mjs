import { defineConfig } from 'astro/config';

// When the GitHub repo exists, set SITE (and BASE if this is a project page,
// e.g. BASE=/on-roam) in the deploy workflow. Defaults work for local dev
// and for a user/custom-domain Pages site.
export default defineConfig({
  site: process.env.SITE ?? 'https://example.github.io',
  base: process.env.BASE ?? '/',
  // the dev toolbar sits exactly over the archive's bottom-centre controls
  devToolbar: { enabled: false },
});
