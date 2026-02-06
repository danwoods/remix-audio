/** @file Server-side rendering utilities
 *  Render full HTML page (shell + content) for custom elements / static HTML.
 */

import appBarHtml from "../app/components/AppBar/app-bar-html.ts";

const CSS_PATH = "/app.css";
const JS_PATH = "/build/main.js";

/**
 * Render the full HTML page (shell + main content). Used by index and album
 * handlers.
 *
 * @param props - Page options. `isAdmin` is set from admin Basic Auth status
 *   (see `getAdminAuthStatus` in index handler); when true, the page shows
 *   admin-only UI (e.g. upload dialog).
 * @param children - HTML fragments for the main content (e.g. album rows)
 * @returns Full HTML document string
 */
export function renderPage(
  props: {
    appName: string;
    headLinks: Array<{ rel: string; href: string }>;
    assets: { css: string; js: string };
    pathname?: string;
    isAdmin?: boolean;
  },
  children: Array<string>,
): string {
  // Serialize data for client hydration (escape </script> to prevent XSS)
  //   const initialData = { ...appProps, pageProps, appName };
  //   const dataJson = JSON.stringify(initialData).replace(/</g, "\\u003c");

  //   // Get actual asset filenames from build
  //   const assets = await getClientAssets();

  props.assets.css = CSS_PATH;

  const isAdmin = props.isAdmin ?? false;
  const pathname = props.pathname ?? "/";

  return `<!DOCTYPE html>
<html lang="en" class="bg-black text-white">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${props.appName}</title>
    <meta name="description" content="Your audio where you want it." />
    <link rel="stylesheet" href="${props.assets.css}" />
    ${
    (props.headLinks || [])
      .map((link) => `<link rel="${link.rel}" href="${link.href}" />`)
      .join("\n    ")
  }
  </head>
  <body>
    <div id="root">
      <div class="flex w-full flex-col">
        ${
    appBarHtml({
      appName: props.appName,
      pathname,
      isAdmin,
    })
  }
        <main class="md:mx-auto md:px-6 grow">
          ${children.join("")}
        </main>
      </div>
    </div>
    <script type="module" src="${JS_PATH}"></script>
  </body>
</html>`;
}
