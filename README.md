[![Deploy status](https://github.com/Holi0317/pullsize/actions/workflows/deploy.yaml/badge.svg)](https://github.com/Holi0317/pullsize/actions/workflows/deploy.yaml)
![License MIT](https://img.shields.io/badge/License-MIT-blue)

[Install hosted GitHub App](https://github.com/apps/pullsize)

# Pullsize

Mark pull request size as label, hosted on Cloudflare worker.

## Features

- Basically a port of [microsoft/PullRequestQuantifier] to CloudFlare worker
- Mark PR size base on the diff size (lines added + lines deleted) as label
- Configurable per repo: See [configuration](#configuration-file) for details
- Runs on CloudFlare worker, within free plan usage limit
- Easy to host yourself (on cloudflare worker)

Example PR: https://github.com/Holi0317/pullsize/pull/10

Here are non-goals for this project:

- Semantic diff (Like [difftastic]). That is too expensive to run and does not
  compile to wasm (yet) for use in CloudFlare worker

[microsoft/PullRequestQuantifier]:
  https://github.com/microsoft/PullRequestQuantifier
[difftastic]: https://github.com/Wilfred/difftastic

## Installation (Hosted)

Install via Github Marketplace: <https://github.com/apps/pullsize>

> [!NOTE]  
> GitHub Enterprise Server is not yet supported. Open an issue if you need it.

Note that this hosted version is provided in best effort bases. It might break
or goes away without prior notice.

This is hosted on CloudFlare worker free plan. If this got too much traffic or
the PR is too large, the bot will stop working. I don't plan to pay for hosting
this bot. If you have a large amount of request, host it yourself.

Also this bot will have permission to access PR diff and repository content for
the config file. If the permission is a bit too wide and uncomfortable for your
organizations, host this bot yourself: It just needs a CloudFlare account on
worker free plan and a few setup steps. You don't even need to own a domain on
Cloudflare.

## Configuration file

Configuration file is stored in the repository's `.github/prsize.toml` in toml
format. If this file does not exist, we will use the default configuration
specified in
[config.ts](https://github.com/Holi0317/pullsize/blob/main/src/services/config.ts),
`ConfigSchema` variable.

Pullsize will read the config from the base branch of the PR. So if your PR is
updating the config, the new config will get applied on that PR.

This is an annotated toml configuration. Note that the content is for example
only and _not_ the default content.

```toml
# List of glob for ignoring files
ignore = [
  "*.md",
  ".yarn/*",
]

# Represent a label pullsize might apply.
# Each label must have all `name`, `color` and `threshold` fields
[[labels]]
name = "size/large" # Name of the label
color = "ff0000"    # Color of the label in GitHub
threshold = 100     # Minimum changes amount for this applying this label
                    # If there is other label with a higher threshold, that label will get applied.

[[labels]]
name = "size/small"
color = "ff0000"
threshold = 0 # Add a threshold=0 for smallest label
```

## Branching model and worker environment

- PR should target `main` branch, where it will deploy to `beta` environment and
  test on this repository
- If it's stable enough, I'll tag the main branch with a date to release to the
  hosted bot

## Deployment (self hosting)

This means forking this repository and host the bot within your CloudFlare
account. Most likely, restricting the GitHub app to only be available in the
organization.

### Step 1: Initial deploy

We will use GitHub action to deploy this app into CloudFlare.

1. Fork this repository
2. Create a CloudFlare account if you don't have one yet
3. Create a cloudflare API token following this guide:
   https://developers.cloudflare.com/fundamentals/api/get-started/create-token/
   Use "Edit Cloudflare Workers" for the API token template for permission sets.
   Stash the API token to somewhere.
4. Go to "Workers & Pages" -> "Overview". Copy the "Account ID" on the right.
5. Go to Github. In the forked repository, go to settings -> "Secrets and
   variables" -> "Actions". Add following repository secrets:
   - `CLOUDFLARE_ACCOUNT_ID`: Account ID from "Workers & Pages" dashboard
   - `CLOUDFLARE_API_TOKEN`: API token for cloudflare we just created
6. Run "Deploy cloudflare" action again. It should have failed before we setup
   the secrets. This should deploy the worker for the first time.
7. In Cloudflare dashboard -> "Workers & Pages" -> "Overview" -> "Pullsize".
   Copy the URL that ends with `.workers.dev`. This is your worker domain

### Step 2: Create a GitHub app

Check github documentation for creating a github apps:
https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app

- Callback URL: Leave it empty
- Set up URL: Leave it empty
- Webhook: Active
- Webhook URL: `https://<worker_domain>/github/webhook`, where `<worker_domain>`
  is the `.workers.dev` domain provided by CloudFlare
- Webhook secret: Generate a random string and save it up
- Repository permissions:
  - Contents: Read-only
  - Issues: Read and write
  - Pull requests: Read and write
- Subscribe to events: "Pull request"

### Step 3: Create private keys and collect GitHub apps information

1. Edit the GitHub apps
2. Copy GitHub app ID and store somewhere
3. Generate a private key and download it in the app. See
   https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/managing-private-keys-for-github-apps
   for details
4. Convert the key from PKCS#1 into PKCS#8 format with following command:
   ```bash
   openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in private-key.pem -out private-key-pkcs8.key
   ```
   https://github.com/octokit/auth-app.js/?tab=readme-ov-file#standalone-usage

### Step 4: Update CloudFlare worker variables

In CloudFlare dashboard, "Workers & Pages" -> "Overview" -> "Pullsize" ->
"Settings". Fill in following variables:

- `GH_APP_ID`: Github App ID. Should be a number
- `GH_PRIVATE_KEY`: Content of PKCS#8 format PEM key. Should be starting with
  `-----BEGIN PRIVATE KEY-----`
- `GH_WEBHOOK_SECRET`: Webhook secret chosen when creating the Github app
- `SENTRY_DSN`: Optionally, set the sentry.io DSN for error reporting

All variables must be encrypted.

### Step 5: Update for new change

If there is any new changes in upstream, sync the fork and github action should
deploy the new version automatically to cloudflare.

## License

MIT
