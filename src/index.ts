import { type IRequestStrict, Router, error, text } from "itty-router";
import { captureError } from "@cfworker/sentry";
import { useOctoApp } from "./octo";
import { unwrap } from "./utils";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface AppRequest extends IRequestStrict {}

export const router = Router<
  AppRequest,
  [env: Env, context: ExecutionContext]
>();

router.post("/github/webhook", async (req, env) => {
  const octoApp = useOctoApp(env);

  await octoApp.webhooks.verifyAndReceive({
    id: unwrap(req.headers.get("x-github-hook-id")),
    name: unwrap(req.headers.get("x-github-event")) as any,
    signature: unwrap(req.headers.get("x-hub-signature")),
    payload: await req.text(),
  });

  return text("ok", {
    status: 202,
  });
});

router.all("*", () => error(404));

// Export a default object containing event handlers
export default {
  // The fetch handler is invoked when this worker receives a HTTP(S) request
  // and should return a Response (optionally wrapped in a Promise)
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    try {
      return await router.handle(request, env, ctx);
    } catch (error) {
      console.error("Router raised exception", error);

      if (env.SENTRY_DSN) {
        const { posted } = captureError({
          sentryDsn: env.SENTRY_DSN,
          environment: "prod",
          release: "release",
          err: error,
          request,
          user: "",
        });

        ctx.waitUntil(posted);
      }

      return text("Internal server error", { status: 500 });
    }
  },
};
