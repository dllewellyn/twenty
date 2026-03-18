<p align="center">
  <a href="https://www.twenty.com">
    <img src="./packages/twenty-website/public/images/core/logo.svg" width="100px" alt="Twenty logo" />
  </a>
</p>

<h2 align="center" >The #1 Open-Source CRM </h2>

<p align="center"><a href="https://twenty.com">🌐 Website</a> · <a href="https://docs.twenty.com">📚 Documentation</a> · <a href="https://github.com/orgs/twentyhq/projects/1"><img src="./packages/twenty-website/public/images/readme/planner-icon.svg" width="12" height="12"/> Roadmap </a> · <a href="https://discord.gg/cx5n4Jzs57"><img src="./packages/twenty-website/public/images/readme/discord-icon.svg" width="12" height="12"/> Discord</a> · <a href="https://www.figma.com/file/xt8O9mFeLl46C5InWwoMrN/Twenty"><img src="./packages/twenty-website/public/images/readme/figma-icon.png"  width="12" height="12"/>  Figma</a></p>
<br />


<p align="center">
  <a href="https://www.twenty.com">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/github-cover-dark.png" />
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/github-cover-light.png" />
      <img src="./packages/twenty-website/public/images/readme/github-cover-light.png" alt="Cover" />
    </picture>
  </a>
</p>

<br />

# Getting Started

Twenty is now **Firebase-native**. The local setup relies entirely on the Firebase Emulator Suite, eliminating the need for a local PostgreSQL or Redis instance for core CRM functionality.

## Prerequisites
- **Node.js**: v24.5.0 (enforced via `.nvmrc`)
- **Yarn**: v4 (enable via `corepack enable`)
- **Firebase CLI**: `npm install -g firebase-tools`

## Quick Start
1. **Clone and Install**:
   ```bash
   git clone https://github.com/twentyhq/twenty.git
   cd twenty
   yarn
   ```

2. **Start Firebase Emulators**:
   In a new terminal, start the Firestore and Auth emulators:
   ```bash
   yarn firebase:emulators
   ```

3. **Launch Twenty**:
   In another terminal, start the backend and frontend:
   ```bash
   yarn start
   ```
   Access the app at [http://localhost:3001](http://localhost:3001).

# Architecture: JSON-Schema Metadata

Twenty has transitioned from a relational metadata engine to a **JSON-schema driven system** powered by Firestore.

- **Dynamic Schemas**: Object and field definitions are stored as JSON schemas in the `_metadata` collection.
- **Validation**: Runtime data integrity is enforced using [Ajv](https://ajv.js.org/) against these schemas.
- **Real-time**: Schema changes are propagated instantly to all clients via Firestore's reactive listeners.

# Troubleshooting (Emulators)

- **Port Conflicts**: The emulators use port `8080` (Firestore) and `9099` (Auth) by default. Ensure these are free.
- **Persistence**: To save your emulator state across restarts, use:
  ```bash
  # Export data
  yarn firebase:emulators:export
  # Start with imported data
  yarn firebase:emulators:import
  ```
- **UI**: Access the Firebase Emulator UI at [http://localhost:4000](http://localhost:4000) to inspect data and logs.

# Why Twenty

We built Twenty for three reasons:

**CRMs are too expensive, and users are trapped.** Companies use locked-in customer data to hike prices. It shouldn't be that way.

**A fresh start is required to build a better experience.** We can learn from past mistakes and craft a cohesive experience inspired by new UX patterns from tools like Notion, Airtable or Linear.

**We believe in Open-source and community.** Hundreds of developers are already building Twenty together. Once we have plugin capabilities, a whole ecosystem will grow around it.

<br />

# What You Can Do With Twenty

Please feel free to flag any specific needs you have by creating an issue.

Below are a few features we have implemented to date:

+ [Personalize layouts with filters, sort, group by, kanban and table views](#personalize-layouts-with-filters-sort-group-by-kanban-and-table-views)
+ [Customize your objects and fields](#customize-your-objects-and-fields)
+ [Create and manage permissions with custom roles](#create-and-manage-permissions-with-custom-roles)
+ [Automate workflow with triggers and actions](#automate-workflow-with-triggers-and-actions)
+ [Emails, calendar events, files, and more](#emails-calendar-events-files-and-more)


## Personalize layouts with filters, sort, group by, kanban and table views

<p align="center">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/views-dark.png" />
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/views-light.png" />
      <img src="./packages/twenty-website/public/images/readme/views-light.png" alt="Companies Kanban Views" />
    </picture>
</p>

## Customize your objects and fields

<p align="center">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/data-model-dark.png" />
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/data-model-light.png" />
      <img src="./packages/twenty-website/public/images/readme/data-model-light.png" alt="Setting Custom Objects" />
    </picture>
</p>

## Create and manage permissions with custom roles

<p align="center">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/permissions-dark.png" />
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/permissions-light.png" />
      <img src="./packages/twenty-website/public/images/readme/permissions-light.png" alt="Permissions" />
    </picture>
</p>

## Automate workflow with triggers and actions

<p align="center">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/workflows-dark.png" />
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/workflows-light.png" />
      <img src="./packages/twenty-website/public/images/readme/workflows-light.png" alt="Workflows" />
    </picture>
</p>

## Emails, calendar events, files, and more

<p align="center">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/plus-other-features-dark.png" />
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/twentyhq/twenty/refs/heads/main/packages/twenty-website/public/images/readme/plus-other-features-light.png" />
      <img src="./packages/twenty-website/public/images/readme/plus-other-features-light.png" alt="Other Features" />
    </picture>
</p>

<br />

# Stack
- [TypeScript](https://www.typescriptlang.org/)
- [Nx](https://nx.dev/)
- [NestJS](https://nestjs.com/)
- [Firebase](https://firebase.google.com/) (Auth, Firestore, Hosting)
- [React](https://reactjs.org/), with [Jotai](https://jotai.org/), [Linaria](https://linaria.dev/) and [Lingui](https://lingui.dev/)

# Archives (Legacy Relational Setup)

The following instructions are for legacy environments still utilizing the relational PostgreSQL-based architecture. Note that these are being decommissioned in favor of the Firebase-native setup.

🚀 [Self-hosting (PostgreSQL)](https://docs.twenty.com/developers/self-hosting/docker-compose)
🖥️ [Local Setup (PostgreSQL/Redis)](https://docs.twenty.com/developers/local-setup)

### Firebase Auth Migration
After migrating your PostgreSQL users to Firestore, run the following to provision them in Firebase Auth:
`yarn nx run twenty-server:command database:import-firebase-auth-users`

# Thanks

<p align="center">
  <a href="https://www.chromatic.com/"><img src="./packages/twenty-website/public/images/readme/chromatic.png" height="30" alt="Chromatic" /></a>
  <a href="https://greptile.com"><img src="./packages/twenty-website/public/images/readme/greptile.png" height="30" alt="Greptile" /></a>
  <a href="https://sentry.io/"><img src="./packages/twenty-website/public/images/readme/sentry.png" height="30" alt="Sentry" /></a>
  <a href="https://crowdin.com/"><img src="./packages/twenty-website/public/images/readme/crowdin.png" height="30" alt="Crowdin" /></a>
  <a href="https://e2b.dev/"><img src="./packages/twenty-website/public/images/readme/e2b.svg" height="30" alt="E2B" /></a>
</p>

  Thanks to these amazing services that we use and recommend for UI testing (Chromatic), code review (Greptile), catching bugs (Sentry) and translating (Crowdin).


# Join the Community

- Star the repo
- Subscribe to releases (watch -> custom -> releases)
- Follow us on [Twitter](https://twitter.com/twentycrm) or [LinkedIn](https://www.linkedin.com/company/twenty/)
- Join our [Discord](https://discord.gg/cx5n4Jzs57)
- Improve translations on [Crowdin](https://twenty.crowdin.com/twenty)
- [Contributions](https://github.com/twentyhq/twenty/contribute) are, of course, most welcome!
