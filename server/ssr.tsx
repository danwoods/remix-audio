/** @file Server-side rendering utilities */
import { renderToString } from "react-dom/server";
import App from "../app/root.tsx";
import { getClientAssets } from "./utils/manifest.ts";
import type { Files } from "../app/util/files.ts";

export interface SSRData {
  [key: string]: unknown;
}

/**
 * Render a React component to HTML string with the root App wrapper
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function renderPage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PageComponent: React.ComponentType<any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pageProps: any,
  appProps: { files: Files; headLinks?: Array<{ rel: string; href: string }> },
): Promise<string> {
  // Render the page component as children of App
  const pageElement = <PageComponent {...pageProps} />;
  const appHtml = renderToString(<App {...appProps}>{pageElement}</App>);

  // Serialize data for client hydration (escape </script> to prevent XSS)
  const initialData = { ...appProps, pageProps };
  const dataJson = JSON.stringify(initialData).replace(/</g, "\\u003c");

  // Get actual asset filenames from build
  const assets = await getClientAssets();

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Remix Audio</title>
    <meta name="description" content="Your audio where you want it." />
    <link rel="stylesheet" href="${assets.css}" />
    ${(appProps.headLinks || [])
      .map((link) => `<link rel="${link.rel}" href="${link.href}" />`)
      .join("\n    ")}
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
