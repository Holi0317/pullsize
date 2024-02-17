interface Env {
  /**
   * Github app ID
   */
  GH_APP_ID: string;
  /**
   * Github webhook shared secret for verification.
   *
   * See https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
   */
  GH_WEBHOOK_SECRET: string;
  /**
   * Github app private key for api request.
   */
  GH_PRIVATE_KEY: string;

  /**
   * Sentry DSN. Optional and might not be configured
   */
  SENTRY_DSN?: string;

  // Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
  // MY_KV_NAMESPACE: KVNamespace;
  //
  // Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
  // MY_DURABLE_OBJECT: DurableObjectNamespace;
  //
  // Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
  // MY_BUCKET: R2Bucket;
  //
  // Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
  // MY_SERVICE: Fetcher;
  //
  // Example binding to a Queue. Learn more at https://developers.cloudflare.com/queues/javascript-apis/
  // MY_QUEUE: Queue;
}
