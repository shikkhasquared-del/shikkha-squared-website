# Shikkha Squared — Website source

This is the complete tracked source for the redesigned frontend built in this conversation, exported on 12 October 2026. It includes the homepage, standalone Courses and Instructors pages, category pages, detail pages, 3D effects, mouse/scroll motion, and the server connection to the admin catalogue.

**Published version:** 6  
**Source commit:** `afa63516ab8c12bad0c2276394805f3c8181c120`  
**Live website:** https://shikkha-squared-rebrand.fairnote16.chatgpt.site

## Open the files

1. Download and extract the ZIP. On Windows, right-click it and choose **Extract All**.
2. Open the extracted `Shikkha_Squared_Website_Source` folder in a code editor such as Visual Studio Code.
3. Read this file first. `SOURCE_MANIFEST.json` lists every exported source file, its size and SHA-256 checksum.

This is a server application. Opening a single HTML or TSX file does not run the complete website. To view it immediately, use the live website above.

## Main files

| Purpose | Files |
| --- | --- |
| Homepage HTML and server route | `app/legacy-html.ts`, `app/route.ts` |
| Homepage behaviour and motion | `public/app.js`, `public/motion.js` |
| Homepage appearance | `public/styles.css`, `public/motion.css` |
| Courses and instructor page rendering | `lib/catalog-pages.ts` |
| Separate page routes | `app/courses/`, `app/instructors/` |
| Search, filters, navigation and page motion | `public/catalog-pages.js` |
| Catalogue layouts and 3D graphics | `public/catalog-pages.css` |
| Server connection to the backend | `lib/cms-read.ts`, `app/api/catalog/route.ts`, `app/media/[id]/route.ts` |
| Course qualification and section matching | `lib/course-taxonomy.ts` |
| Logos, course covers, instructor portraits and fonts | `public/assets/` |
| Automated checks | `tests/catalog-pages.test.mjs` |

The component library, framework configuration, dependency lockfile, build helpers and third-party license notices are all preserved. `public/shikkha-squared-prototype.zip` is an older static prototype retained as an existing project asset; the current application source is in the folders listed above.

## Languages

| Language or format | Use |
| --- | --- |
| TypeScript | Server routes, page rendering, catalogue connection and shared logic |
| HTML | Public page markup inside the server-rendered templates |
| JavaScript | Browser interactions, filters, animation and scrolling behaviour |
| CSS | Responsive layouts, styling, animation and 3D transforms |
| TSX | Included React components and the framework layout |
| SQL / TypeScript schema definitions | Included storage examples and Drizzle configuration |
| JSON / YAML | Runtime declarations, dependency configuration and lockfile |
| Bash / JavaScript | Installation and build helper scripts |

## Local development

Use Node.js **22.13.0 or newer** and the pnpm version recorded in `package.json` (**11.25.0** in this export). Run these commands in the extracted project folder:

```sh
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
node --test tests/catalog-pages.test.mjs
pnpm build
```

Create an ignored `.dev.vars` file using `.dev.vars.example` as the template. Configure the actual server-only `CMS_READ_TOKEN` separately. Then start the development server:

```sh
pnpm dev
```

The portable development script starts at port 5173. Open the address printed in the terminal. If the backend connection is not configured, managed course pages report that the catalogue is unavailable.

## Backend connection and hosting

The application expects the admin at `https://shikkha-squared-admin.fairnote16.chatgpt.site`. Its server-only configuration is:

- `CMS_ORIGIN`: that exact admin origin.
- `CMS_READ_TOKEN`: the admin Site's service credential, stored as a hosting secret.

If you deploy a different admin origin, update both `expectedOrigin` in `lib/cms-read.ts` and `CMS_ORIGIN`. Keep the credential on the server. Configure a new credential for the new backend rather than putting one in browser code.

The included `.openai/hosting.json` preserves this existing Site's project identity. Reuse it for updates to that Site. For a new Site, register a new project through the Sites workflow and set its returned project ID before publishing. Normal source changes should go through build, source push, saved version and deployment.

This application uses Vinext and Cloudflare Workers. Deployment to other hosting, or to the official domain, requires the corresponding runtime, server configuration and domain integration. The existing site remains available at the live URL above.

## Verification

The eight frontend tests, TypeScript check and production build passed for this source. `VERIFICATION_NOTES.md` records the malformed-URL correction, dependency updates, remaining upstream advisory and audit limits.

## Export contents

Every Git-tracked file from the stated commit is included unchanged, including tracked TypeScript compiler metadata, plus this guide, a placeholder environment example and a source manifest. Installed dependencies, untracked build output/caches, Git history, credentials and live database/object-storage contents are excluded. Reinstall dependencies from the lockfile. Source assets are included.
