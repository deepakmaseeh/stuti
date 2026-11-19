import { execSync } from 'node:child_process';
import pkg from '../../package.json';

/** Build-time only (imported from .astro frontmatter, never from islands). */
function gitSha(): string {
  const fromCi = process.env.CF_PAGES_COMMIT_SHA ?? process.env.GITHUB_SHA;
  if (fromCi) return fromCi.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}

export const appVersion: string = pkg.version;
export const contentVersion = `${gitSha()} · ${new Date().toISOString().slice(0, 10)}`;
