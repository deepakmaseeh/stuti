/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_INCLUDE_DEMO?: string;
  readonly PUBLIC_REPORT_FORM_URL?: string;
  readonly PUBLIC_CF_ANALYTICS_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
