/**
 * App entry point for Cloudflare.
 */

import * as Sentry from "@sentry/cloudflare";
import app from "./router";

export default Sentry.withSentry((env: Env) => {
  const { id: versionId } = env.CF_VERSION_METADATA;

  return {
    dsn: env.SENTRY_DSN,
    // Only enable sentry if the DSN is set to something
    enabled: !!env.SENTRY_DSN,
    release: versionId,
    tracesSampleRate: 1.0,
  };
}, app);
