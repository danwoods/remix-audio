/** @file Server-side rendering utilities */
import React from "react";
import { renderToString } from "react-dom/server";
import App from "../app/root.tsx";
import { getClientAssets } from "./utils/manifest.ts";
import { getAppName } from "./utils/appName.ts";
import type { Files } from "../app/util/files.ts";

export interface SSRData {
  [key: string]: unknown;
}

/**
 * Render a React component to HTML string with the root App wrapper
 */
export async function renderPage(
  PageComponent: React.ComponentType<Record<string, unknown>>,
  pageProps: Record<string, unknown>,
  appProps: {
    files: Files;
    headLinks?: Array<{ rel: string; href: string }>;
    pathname?: string;
  },
): Promise<string> {
  // Render the page component as children of App
  const pageElement = <PageComponent {...pageProps} />;

  // Get app name from deno.json
  const appName = await getAppName();

  // Render the page component as children of App with appName
  const appElement = (
    <App {...appProps} appName={appName} pathname={appProps.pathname}>
      {pageElement}
    </App>
  );
  const appHtml = renderToString(appElement);

  // Serialize data for client hydration (escape </script> to prevent XSS)
  const initialData = { ...appProps, pageProps, appName };
  const dataJson = JSON.stringify(initialData).replace(/</g, "\\u003c");

  // Get actual asset filenames from build
  const assets = await getClientAssets();

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${appName}</title>
    <meta name="description" content="Your audio where you want it." />
    <link rel="stylesheet" href="${assets.css}" />
    ${
    (appProps.headLinks || [])
      .map((link) => `<link rel="${link.rel}" href="${link.href}" />`)
      .join("\n    ")
  }
  </head>
  <body>
    <div id="root">${appHtml}</div>
    <script>
      window.__INITIAL_DATA__ = ${dataJson};
    </script>
    <script type="module" src="${assets.js}"></script>
  </body>
</html>`;
}
