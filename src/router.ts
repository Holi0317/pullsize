import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import z from "zod";
import * as Sentry from "@sentry/cloudflare";
import { HTTPException } from "hono/http-exception";
import { webhookSignatureMiddleware } from "./services/webhook";
import { EventSchema } from "./services/webhook_schema";
import { handle } from "./services/handler";
import { setSentry } from "./services/sentry";

const app = new Hono<{ Bindings: Env }>();

app.onError((err, c) => {
  console.error("Router raised exception", err);

  Sentry.captureException(err);

  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  return c.text("Internal server error", { status: 500 });
});

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

    setSentry(event.pull_request);

    return await handle(c, event);
  },
);

app.notFound((c) => {
  return c.text("Not found", 404);
});

export default app;
