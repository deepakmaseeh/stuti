import { describe, expect, it } from 'vitest';
import { pageAssets, staticImports } from '../../scripts/check-budgets';

describe('check-budgets parsing', () => {
  it('finds scripts, island components, renderers, preloads and stylesheets', () => {
    const html =
      '<link rel="stylesheet" href="/_astro/a.css"><script type="module" src="/_astro/page.js"></script>' +
      '<astro-island component-url="/_astro/Fav.js" renderer-url="/_astro/client.js"></astro-island>' +
      '<link rel="modulepreload" href="/_astro/chunk.js"><a href="/other.js">x</a>';
    expect(pageAssets(html)).toEqual({
      js: ['/_astro/page.js', '/_astro/Fav.js', '/_astro/client.js', '/_astro/chunk.js'],
      css: ['/_astro/a.css'],
    });
  });

  it('follows static imports only', () => {
    const code = 'import{a}from"./preact.js";import"./side.js";const m=()=>import("./lazy.js");';
    expect(staticImports(code)).toEqual(['./preact.js', './side.js']);
  });
});
