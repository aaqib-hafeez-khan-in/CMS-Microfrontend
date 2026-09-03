# CMS Microfrontend Platform

A portfolio-grade content management platform built as a **multi-framework microfrontend architecture**. The application demonstrates how Angular, React, Svelte, and Vue applications can coexist as independently developed modules while being composed into a single CMS experience through **single-spa, SystemJS, and import maps**.

The repository is intentionally structured as a small microfrontend ecosystem rather than a conventional monolithic frontend. Each business capability lives in its own application, has its own dependency graph and build process, and can also be developed and deployed independently.

## What this project demonstrates

- Microfrontend architecture with **single-spa**
- Runtime composition with **SystemJS import maps**
- Multiple frontend frameworks in one product
- Independent builds and deployments for each microfrontend
- Shell-level routing and application lifecycle management
- Shared authentication state across independently mounted applications
- Client-side session validation and protected routes
- Role-based authorization contracts
- Responsive CMS-style user interfaces
- Vercel deployment composition that bundles the independently built MFEs

## Architecture

```text
                           CMS Microfrontend Platform
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │   Root Orchestration    │
                         │     single-spa shell    │
                         │  SystemJS + import map  │
                         └────────────┬────────────┘
                                      │
                ┌─────────────────────┼─────────────────────┐
                │                     │                     │
                ▼                     ▼                     ▼
        ┌───────────────┐     ┌───────────────┐     ┌───────────────┐
        │ Angular Auth  │     │React Editorial │     │Svelte Collab  │
        │   Angular 11  │     │    React 17   │     │    Svelte 3   │
        └───────────────┘     └───────────────┘     └───────────────┘
                │                     │                     │
                └─────────────────────┼─────────────────────┘
                                      │
                                      ▼
                              ┌───────────────┐
                              │  Vue Media    │
                              │   Vue 2.6     │
                              └───────────────┘
```

### Microfrontend responsibilities

| Application | Framework | Responsibility | Route |
|---|---|---|---|
| `cms-root-orchestration` | TypeScript + single-spa | Application shell, routing and composition | `/` |
| `cms-angular-auth` | Angular 11 | Authentication and role-based access control | `/auth` |
| `cms-react-editorial` | React 17 + TypeScript | Article creation, editing and publishing workflow | `/editorial` |
| `cms-svelte-collab` | Svelte 3 + TypeScript | Team collaboration, chat and activity | `/collab` |
| `cms-vue-media` | Vue 2.6 + TypeScript | Media and digital asset management | `/media` |

## Repository structure

```text
CMS-Microfrontend/
├── cms-root-orchestration/
│   ├── public/
│   │   ├── index.html
│   │   └── design-system.css
│   ├── src/
│   │   └── index.ts
│   ├── package.json
│   ├── webpack.config.js
│   └── vercel.json
│
├── cms-angular-auth/
│   ├── public/
│   ├── src/
│   │   └── app/
│   │       ├── app.component.html
│   │       ├── app.component.ts
│   │       ├── app.module.ts
│   │       └── auth-contract.ts
│   ├── package.json
│   └── webpack.config.js
│
├── cms-react-editorial/
│   ├── src/
│   │   ├── EditorialApp.tsx
│   │   ├── PageEditor.tsx
│   │   └── index.tsx
│   ├── package.json
│   └── webpack.config.js
│
├── cms-svelte-collab/
│   ├── src/
│   │   ├── CollabApp.svelte
│   │   └── main.ts
│   ├── package.json
│   └── webpack.config.js
│
├── cms-vue-media/
│   ├── src/
│   │   ├── MediaApp.vue
│   │   └── main.ts
│   ├── package.json
│   └── vue.config.js
│
├── scripts/
│   ├── build-vercel.js
│   └── prepare-vercel-deployment.js
│
└── vercel.json
```

## Microfrontend details

### 1. Root orchestration shell

`cms-root-orchestration` is the host application. It provides the CMS navigation experience and delegates module lifecycle management to single-spa.

Responsibilities include:

- Registering microfrontends with single-spa
- Defining application routes through `single-spa-layout`
- Loading remote modules through `System.import`
- Managing the import map used for runtime composition
- Providing the shared shell and design system
- Monitoring authentication state
- Protecting `/auth`, `/editorial`, `/collab`, and `/media` routes
- Handling responsive sidebar and navigation state

The shell currently validates the `cms_session` entry in `localStorage` before allowing access to protected modules.

### 2. Authentication & authorization

`cms-angular-auth` owns the authentication experience and the authorization contract used by the platform.

The current authorization model defines three roles:

- **Administrator** — full CMS permissions
- **Editor** — content, media and collaboration management
- **Contributor** — content creation/editing and collaboration

The authorization contract includes permissions such as:

```text
content.create
content.edit
content.review
content.publish
content.delete
media.manage
collaboration.manage
users.manage
```

Authentication state is represented as a CMS session containing the user, issue time and expiration time. Authentication events are exposed as browser custom events so independently mounted applications can react without being tightly coupled to the Angular implementation.

> This is a client-side demonstration architecture. It is not intended to provide production-grade server-side authentication or authorization by itself.

### 3. Editorial suite

`cms-react-editorial` provides the content management workflow.

Capabilities include:

- Article listing
- Published / Review / Draft status tracking
- Article creation
- Article editing
- Article deletion
- Title and body editing
- Publishing-state selection
- Local persistence through `localStorage`

The React application exposes the standard single-spa lifecycle functions and is consumed by the root shell as a SystemJS module.

### 4. Collaboration

`cms-svelte-collab` provides the collaboration workspace.

The module is designed around:

- Team chat
- Message threading
- User presence
- Activity tracking
- Collaboration-oriented CMS workflows

The Svelte entry point exposes `bootstrap`, `mount`, and `unmount` lifecycle functions so the application can participate in the shell's microfrontend lifecycle.

### 5. Media library

`cms-vue-media` provides digital asset management capabilities.

The module includes:

- Media grid
- Image, video and document filtering
- Asset statistics
- Quick actions
- Upload-oriented interface
- Vue Router integration

It is mounted into the platform through `single-spa-vue`.

## Runtime composition

The platform uses an import map in the root shell to resolve shared libraries and remote microfrontends at runtime.

Conceptually:

```text
Browser
  │
  ├── SystemJS
  │     │
  │     ├── single-spa
  │     ├── single-spa-layout
  │     ├── React / ReactDOM
  │     ├── Vue
  │     └── Microfrontend bundles
  │
  └── single-spa
        │
        ├── /auth      → cms-angular-auth
        ├── /editorial → cms-react-editorial
        ├── /collab    → cms-svelte-collab
        └── /media     → cms-vue-media
```

This means the shell does not need to bundle every application into one frontend artifact. Microfrontends can be resolved and loaded independently.

## Local development

Each microfrontend is an independent Node.js project. Install dependencies separately inside each application.

### Root shell

```bash
cd cms-root-orchestration
npm install
npm start
```

The root development server runs on port `9000`.

### Angular authentication

```bash
cd cms-angular-auth
npm install
npm start
```

The Angular microfrontend runs on port `8084`.

### React editorial

```bash
cd cms-react-editorial
npm install
npm start
```

The React microfrontend runs on port `8081`.

### Vue media

```bash
cd cms-vue-media
npm install
npm start
```

The Vue microfrontend runs on port `8082`.

### Svelte collaboration

```bash
cd cms-svelte-collab
npm install
npm start
```

The Svelte microfrontend runs on port `8083`.

### Running the complete platform locally

Start the four microfrontends first, then start the root orchestration shell.

For local composition, update the import map in `cms-root-orchestration/public/index.html` so the MFE entries point at their local development servers instead of the deployed bundles.

The important idea is that the shell remains the composition layer while each MFE owns its own development server and build pipeline.

## Production builds

Each application has its own production build.

```bash
cd cms-angular-auth
npm run build

cd ../cms-react-editorial
npm run build

cd ../cms-svelte-collab
npm run build

cd ../cms-vue-media
npm run build

cd ../cms-root-orchestration
npm run build
```

The microfrontend builds produce their SystemJS-compatible production bundles, while the root shell produces the host application.

## Deployment

The repository supports two deployment patterns.

### Independent microfrontend deployment

Each application has its own `gh-pages` deployment script and homepage configuration. This supports publishing each microfrontend independently and allows the root shell's import map to consume its remote bundle.

The deployed module URLs follow this pattern:

```text
https://AaqibhafeezKhan.github.io/cms-angular-auth
https://AaqibhafeezKhan.github.io/cms-react-editorial
https://AaqibhafeezKhan.github.io/cms-svelte-collab
https://AaqibhafeezKhan.github.io/cms-vue-media
https://AaqibhafeezKhan.github.io/cms-root-orchestration
```

### Unified Vercel deployment

The repository also contains a root-level `vercel.json` and build scripts that compose the independently built microfrontends into the root shell's `dist` directory.

The Vercel build process:

1. Installs dependencies for every microfrontend.
2. Builds Angular, React, Svelte, Vue and the root shell.
3. Copies each MFE's production `main.js` into `cms-root-orchestration/dist/mfes/`.
4. Rewrites the generated shell configuration to use local `/mfes/...` bundle paths.
5. Inlines the shell design-system CSS for the combined deployment.
6. Serves the resulting root shell as the Vercel output.

The Vercel configuration also rewrites module routes such as `/auth`, `/editorial`, `/collab`, and `/media` back to the shell entry point so client-side routing can resolve correctly.

## Technology stack

| Area | Technology |
|---|---|
| Architecture | Microfrontends |
| Orchestration | single-spa 5.x |
| Runtime module loading | SystemJS |
| Routing/layout | single-spa-layout |
| Authentication MFE | Angular 11 |
| Editorial MFE | React 17 + TypeScript |
| Collaboration MFE | Svelte 3 + TypeScript |
| Media MFE | Vue 2.6 + TypeScript |
| Bundling | Webpack 5 |
| Transpilation | Babel / TypeScript loaders |
| Styling | CSS + shared design system |
| Client-side persistence | Browser `localStorage` |
| Deployment | GitHub Pages / Vercel |

## Why multiple frameworks?

Using four frontend frameworks in a single product is deliberate. It demonstrates one of the core motivations for microfrontends: **teams can evolve different parts of a large application independently while a host application provides a unified user experience**.

In a conventional monolith, introducing a second framework would usually increase coupling and bundle complexity. Here, the frameworks are isolated behind microfrontend boundaries and exposed through a common application lifecycle.

The project therefore serves as a practical demonstration of:

- Framework independence
- Team autonomy
- Independent deployment boundaries
- Runtime composition
- Incremental modernization
- Legacy/new framework coexistence
- Shared platform concerns without forcing a single implementation technology

## Data and persistence model

This repository is a frontend architecture demonstration and currently uses browser storage rather than a backend database.

Examples include:

- `cms_session` — authenticated session state
- `cms_articles` — editorial content state
- `cms_sidebar_collapsed` — shell UI preference

Because this state is local to the browser, data is not automatically shared between users or devices and should not be treated as durable production CMS data.

## Authentication flow

The current client-side flow is approximately:

```text
User
  │
  ▼
Angular Auth MFE
  │
  ├── Validate credentials/form
  │
  ├── Create cms_session
  │
  └── Publish authentication event
  │
  ▼
Root Shell
  │
  ├── Validate session
  ├── Check expiry
  └── Allow protected route
       │
       ├── Editorial
       ├── Collaboration
       └── Media
```

When the session is invalid or expired, the shell removes the invalid session and redirects protected routes back to authentication.

## Security considerations

This project intentionally demonstrates **frontend authentication and authorization patterns**, not a complete security boundary.

For production use, the architecture should be extended with:

- Server-side authentication
- Secure token/session handling
- HttpOnly and Secure cookies where appropriate
- Backend authorization checks
- CSRF protection where applicable
- Input validation and sanitization
- Content security policy
- Dependency and supply-chain controls
- Centralized audit logging
- Real persistence and API boundaries
- Stronger cross-MFE contract versioning

A role check in a browser must never be considered sufficient authorization for a privileged backend operation.

## Microfrontend communication

The current platform favors lightweight browser-level contracts instead of direct imports between business microfrontends.

Authentication events are exposed using `CustomEvent`, allowing the shell and other modules to respond to state changes without creating a direct Angular-to-React, Angular-to-Vue, or Angular-to-Svelte dependency.

This keeps the architecture aligned with the microfrontend principle that modules should communicate through explicit, stable contracts rather than reaching into one another's implementation details.

## Design principles

### Independent ownership

Each business capability is isolated into its own application and dependency tree.

### Explicit contracts

Cross-application behavior should be exposed through stable events and interfaces rather than framework-specific internals.

### Runtime composition

The shell discovers and loads microfrontends through SystemJS rather than compiling the complete platform into one framework-specific application.

### Progressive evolution

The architecture allows individual modules to be replaced or upgraded independently. For example, an Angular module can eventually be replaced without requiring the editorial React application to be rewritten.

### Thin orchestration layer

The root shell coordinates navigation, lifecycle and platform-level concerns while business functionality remains inside the individual MFEs.

## Project status

This repository is a **working portfolio/reference implementation** of a multi-framework CMS microfrontend architecture.

It focuses on architectural demonstration and frontend composition rather than providing a production-ready headless CMS backend.

## Useful URLs

### Root shell

- [CMS Root Orchestration](https://AaqibhafeezKhan.github.io/cms-root-orchestration)

### Standalone microfrontends

- [Angular Auth](https://AaqibhafeezKhan.github.io/cms-angular-auth)
- [React Editorial](https://AaqibhafeezKhan.github.io/cms-react-editorial)
- [Svelte Collaboration](https://AaqibhafeezKhan.github.io/cms-svelte-collab)
- [Vue Media](https://AaqibhafeezKhan.github.io/cms-vue-media)

## Learning objectives

This project is particularly useful for studying:

1. Microfrontend architecture
2. single-spa application lifecycles
3. SystemJS and import maps
4. Runtime module federation concepts
5. Multi-framework frontend platforms
6. Independent build and deployment pipelines
7. Shell-level routing and authentication
8. Cross-application browser contracts
9. Frontend authorization models
10. Migration and modernization strategies for large web applications

## License

No explicit open-source license is currently defined for this repository. Unless a license is added, standard copyright restrictions apply to the repository contents.
