# Internal Brainstorming

Working document for product ideas, experiments, and rough decisions worth preserving before they turn into specs.

## Active Themes

### 1. Custom Domains For Linky

#### Core Idea
Allow Linky creators to attach custom domains to their Linky setup so branded short links can live on domains they control.

#### Why This Matters
- Makes Linky feel more like infrastructure than a toy.
- Gives users stronger ownership over their links and brand.
- Creates a natural path toward accounts, API keys, and paid tiers later.

#### Product Shape
- Custom domains likely require authenticated ownership.
- Authenticated ownership likely means accounts.
- Domain management likely requires API keys or a similar secure machine-to-machine credential.

#### Here.now-Style Claim Flow
Use a lightweight claim model inspired by `here.now`:

1. A user can create a Linky key immediately.
2. That key exists in an unclaimed state for up to 24 hours.
3. Within that 24-hour window, the user can claim it by creating an account and attaching it to an API key.
4. If the key is never claimed, it is automatically deleted.

#### Agent-First Onboarding Idea
Make claiming feel agent-first instead of dashboard-first:

1. User creates a Linky.
2. The system issues a temporary claimable key.
3. The user claims the Linky through an agent flow that provisions:
   - an account
   - an API key
   - ownership of the pending Linky
4. Once claimed, the Linky becomes durable and manageable.

This feels straightforward and could keep the initial UX extremely fast while still giving us a clean path into identity and account ownership.

#### Post-Claim Experience
Once a user has an API key and account, they can:

- keep and manage their existing Linky links
- configure a custom domain
- potentially choose custom slugs once domain setup is complete

#### Open Questions
- Should unclaimed Linkies be publicly resolvable during the 24-hour window, or only previewable by the creator?
- Does claiming create a full user account immediately, or can we support a lighter-weight owner identity first?
- Is the API key the primary ownership primitive, or should account ownership be primary with API keys underneath it?
- Do custom domains belong to an account, a workspace, or an individual Linky?
- After custom domain setup, do users get fully custom slugs, partially reserved slugs, or some other naming model?
- What should happen to existing default `linky` URLs after a custom domain is attached?

#### Risks
- Accounts and API keys add operational complexity early.
- The 24-hour claim window needs cleanup jobs and abuse protection.
- Domain verification introduces DNS support, retries, and failure states.
- Slug ownership rules could become messy if they are introduced before account/domain boundaries are very clear.

#### Rough MVP Slice
- Generate claimable Linky keys.
- Expire unclaimed keys after 24 hours.
- Let users claim a Linky by creating an account.
- Issue an API key on claim.
- Preserve claimed Linkies permanently.
- Defer full custom domain support until the ownership/account model feels solid.

## Notes To Expand Later
- Pricing and packaging once custom domains exist.
- Whether free users can claim Linkies without attaching a custom domain.
- Whether one account can own multiple Linkies.
- Whether agents should be the default control surface for account setup and management.

## Competitive Notes: here.now

### What here.now Gets Right
- The value proposition is immediate: publish something with an agent and get a live link fast.
- Anonymous first, account second is a strong onboarding pattern.
- The 24-hour expiry plus claim flow is a clean bridge from casual creation to ownership.
- The API is legible and agent-friendly: create, upload, finalize, claim, update.
- They clearly separate anonymous and authenticated behavior instead of muddying the model.
- They support both direct human dashboard use and fully agent-assisted flows.
- Their docs make sharing, permanence, and deployment lifecycle easy to understand.

### Similarities To Linky
- Both products can start from "agent creates something, returns one URL".
- Both benefit from zero-friction creation before requiring account setup.
- Both need a clean ownership model if links are going to persist.
- Both can use API keys as the durable authenticated surface for agents.
- Both can grow from simple anonymous publishing into more durable account-backed infrastructure.

### Where Linky Should Be Different
- Linky should not primarily be "web hosting for humans".
- Linky should be optimized for agents bundling structured information into a single shareable link.
- The primary artifact is likely not a whole static site every time; it may be a compact agent-generated bundle, landing page, report, brief, or response object with a strong default viewer.
- The user story is closer to "my agent packaged this for me" than "my agent deployed my website".
- The control surface should bias toward agent workflows first, with a dashboard as a secondary management tool if we add one at all.

### Product Learnings We Should Probably Adopt

#### 1. Anonymous First, Claim Later
- Let agents create Linkies without requiring login up front.
- Return a one-time claim token or claim URL immediately.
- Make the claim path durable, obvious, and hard to lose.

#### 2. Clean Lifecycle API
- A small lifecycle is easier for agents to reason about:
  - create
  - update
  - claim
  - list
  - delete
- If Linky supports larger artifacts later, a staged upload flow may still be the right abstraction.

#### 3. Separate Anonymous And Owned Modes
- Anonymous mode should be intentionally limited.
- Owned mode should unlock permanence, custom domains, richer management, and higher limits.
- The product feels cleaner if these modes have explicit differences instead of hidden feature flags.

#### 4. Agent-Assisted Account Creation
- here.now's email-code verification flow inside the agent is especially relevant.
- Linky could let the agent request a code, the user paste it back, and the account plus API key get created without forcing a full dashboard flow.
- That keeps the product aligned with agent-native usage. [here.now docs](https://here.now/docs#overview)

#### 5. One Stable URL, Then Better Routing Later
- Start with one generated Linky URL per artifact.
- Add custom domains and custom paths only after ownership is solved.
- This preserves simplicity in the earliest versions.

### Feature Ideas Inspired By here.now
- Claim URLs for anonymous Linkies.
- Agent-native API key issuance.
- Permanent Linkies once claimed.
- Custom domains for owned Linkies.
- Named handles or stable namespaces if Linky eventually needs multi-link identity.
- Metadata patching so an agent can revise title, description, preview image, or expiry without re-creating the whole Linky.
- Duplication or forking if a Linky becomes a reusable template format.
- Password-protected Linkies for private sharing.
- Paid or gated Linkies only if monetization becomes central later.
- Account-level variables or secrets if Linky eventually needs secure agent-side integrations.

### Features We Should Be Careful Not To Copy Too Early
- Full static hosting semantics.
- Proxy routes and variable injection.
- Payment gating.
- Fork ecosystems.
- Broad dashboard complexity.

These are powerful, but they risk pulling Linky toward a general hosting platform instead of a focused agent packaging and sharing product.

### Linky-Specific Opportunities Beyond here.now
- Better default presentation for agent outputs such as:
  - structured summaries
  - reports
  - research dumps
  - multi-file bundles with a strong viewer
- A canonical "single useful link" format for agents to return in chats.
- Auto-generated preview pages that explain what the link contains, who created it, and when it expires.
- Rich metadata optimized for agent output rather than generic website deployment.
- A stronger bundle model where one Linky can contain text, files, citations, actions, and follow-up context in a coherent viewer.

### Working Product Hypothesis
Linky should borrow `here.now`'s low-friction creation, claim flow, and agent-native authentication patterns, while staying much narrower in purpose: agents use Linky to package information and send one durable, well-presented link. It should feel less like deploy infrastructure and more like an agent delivery layer. [here.now](https://here.now/) [here.now docs](https://here.now/docs#overview)

### Open Questions From The Comparison
- Is a Linky fundamentally a site, a document bundle, or a typed artifact with multiple render modes?
- Should the first API be optimized for uploading files, or for submitting a structured payload that Linky renders?
- Do we want claim tokens to be human-usable links, agent-usable tokens, or both?
- Is there a future where Linky supports namespaces like handles, or do custom domains cover that need?
- How much of the product should be visible to humans versus optimized entirely around agent workflows?
