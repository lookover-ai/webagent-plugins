# <App name>

<!-- Read by the QA agent before it tests. Keep it under one page. No passwords, keys or tokens in this file. -->

## What it is
<One or two sentences: what the app does and who uses it.>

## Users and roles
- <role, e.g. visitor>: <what they can do>
- <role, e.g. admin>: <what they can do>

## Key flows (must never break)
1. <e.g. Sign up with email, land on the dashboard>
2. <e.g. Log in and log out>
3. <e.g. Add an item to the cart and check out in test mode>

## Environments
| Name | URL | Notes |
|---|---|---|
| local | http://localhost:3000 | Dev server. The agent opens a tunnel to test it. Creates real rows in the dev database. |
| staging | https://staging.example.com | Deployed from `main`. |

## Test accounts
Logins live in the webagent vault (dashboard, Vault), never in this repo. Refer to them by namespace:
- `staging`: a member user of https://staging.example.com
- <Anything the agent cannot test: email codes, real payments, CAPTCHA pages.>

## Test data and gotchas
- <e.g. Signup needs a unique email: use qa+<random>@example.com.>
- <e.g. The card form accepts 4242 4242 4242 4242 in test mode.>
