import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { captureError } from "@cfworker/sentry";
import { useOctoApp } from "./octo";
import z from "zod";

const app = new Hono<{ Bindings: Env }>();

app.post(
  "/github/webhook",
  zValidator(
    "header",
    z.object({
      "x-github-hook-id": z.string(),
      "x-github-event": z.string(),
      "x-hub-signature-256": z.string(),
    }),
  ),
  async (c) => {
    const octoApp = useOctoApp(c.env);

    const headers = c.req.valid("header");

    await octoApp.webhooks.verifyAndReceive({
      id: headers["x-github-hook-id"],
      name: headers["x-github-event"] as any, // FIXME: Verify enum on zod
      signature: headers["x-hub-signature-256"],
      payload: await c.req.text(),
    });

    return c.text("ok", 202);
  },
);

app.notFound((c) => {
  return c.text("Not found", 404);
});

app.onError((err, c) => {
  console.error("Router raised exception", err);

  if (c.env.SENTRY_DSN) {
    const { posted } = captureError({
      sentryDsn: c.env.SENTRY_DSN,
      environment: "prod",
      release: "release",
      err,
      request: c.req.raw,
      user: "",
    });

    c.executionCtx.waitUntil(posted);
  }

  return c.text("Internal server error", { status: 500 });
});

export default app;
