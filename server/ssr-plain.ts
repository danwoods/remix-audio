/** @file Server-side rendering utilities
 *  Render a React component to HTML string with the root App wrapper
 */

const CSS_PATH = "/app.css";

export function renderPage(
  props: {
    appName: string;
    headLinks: Array<{ rel: string; href: string }>;
    assets: { css: string; js: string };
  },
  children: Array<string>,
): string {
  // Serialize data for client hydration (escape </script> to prevent XSS)
  //   const initialData = { ...appProps, pageProps, appName };
  //   const dataJson = JSON.stringify(initialData).replace(/</g, "\\u003c");

  //   // Get actual asset filenames from build
  //   const assets = await getClientAssets();

  props.assets.css = CSS_PATH;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${props.appName}</title>
    <meta name="description" content="Your audio where you want it." />
    <link rel="stylesheet" href="${props.assets.css}" />
    ${(props.headLinks || [])
      .map((link) => `<link rel="${link.rel}" href="${link.href}" />`)
      .join("\n    ")}
  </head>
  <body>
    <div id="root">${children}</div>
    <script type="module" src="${props.assets.js}"></script>
  </body>
</html>`;
}
