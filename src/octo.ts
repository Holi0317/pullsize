import { App } from "octokit";

export function useOctoApp(env: Env) {
  const app = new App({
    appId: env.GH_APP_ID,
    privateKey: env.GH_PRIVATE_KEY,
    webhooks: { secret: env.GH_WEBHOOK_SECRET },
  });

  return app;
}
