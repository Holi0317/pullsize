import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { captureError } from "@cfworker/sentry";
import z from "zod";
import { webhookSignatureMiddleware } from "./services/webhook";
import { EventSchema } from "./services/webhook_schema";
import { handle } from "./services/handler";

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
  webhookSignatureMiddleware,
  async (c) => {
    const headers = c.req.valid("header");
    const name = headers["x-github-event"];

    if (name === "ping") {
      return c.text("pong", 202);
    }

    if (name !== "pull_request") {
      return c.text(`unknown event name ${name}`, 400);
    }

    const event = EventSchema.parse(await c.req.json());

    return await handle(c, event);
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
