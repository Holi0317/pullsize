/**
 * App entry point for Cloudflare.
 *
 * This looks stupid but that's because hono router naively implements cloudflare's
 * fetch interface. We might add other runtime (probably nodejs) in the future
 * if there's any need with initialization logic in this file.
 */

import app from "./router";

export default app;
