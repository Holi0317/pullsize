import { Webhooks } from "@octokit/webhooks";
import { createMiddleware } from "hono/factory";

/**
 * Verify GitHub webhook signature.
 */
export const webhookSignatureMiddleware = createMiddleware<
  { Bindings: Env },
  string,
  {
    in: {
      header: {
        "x-hub-signature-256": string;
      };
    };
    out: {
      header: {
        "x-hub-signature-256": string;
      };
    };
  }
>(async (c, next) => {
  const payload = await c.req.text();
  const headers = c.req.valid("header");

  const webhooks = new Webhooks({ secret: c.env.GH_WEBHOOK_SECRET });
  const valid = await webhooks.verify(payload, headers["x-hub-signature-256"]);

  if (!valid) {
    return c.text("Invalid signature", 400);
  }

  await next();
});
