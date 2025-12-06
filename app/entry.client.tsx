/** @file Client-side hydration entry point */
import "./entry.css";
import { hydrateRoot } from "react-dom/client";
import App from "./root.tsx";
import IndexPage from "./routes/_index.tsx";
import AlbumPage from "./routes/artists.$artistId.albums.$albumId_.tsx";
import type { Files } from "./util/files.ts";

// Get initial data from server
interface InitialData {
  files: unknown;
  headLinks?: Array<{ rel: string; href: string }>;
  appName?: string;
  pathname?: string;
  pageProps?: Record<string, unknown>;
}
const initialData = (window as { __INITIAL_DATA__?: InitialData })
  .__INITIAL_DATA__;
const rootElement = document.getElementById("root");

if (rootElement && initialData) {
  // Determine which page component to render based on current path
  const pathname = window.location.pathname;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let PageComponent: React.ComponentType<any> | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pageProps: any = {};

  if (pathname === "/") {
    // Homepage
    PageComponent = IndexPage;
    pageProps = initialData.pageProps || {};
  } else if (
    pathname.startsWith("/artists/") &&
    pathname.includes("/albums/")
  ) {
    // Album detail page - use pageProps from server to ensure hydration matches
    PageComponent = AlbumPage;
    pageProps = initialData.pageProps || {};
    // Ensure files are included
    if (!pageProps.files) {
      pageProps.files = initialData.files;
    }
  }

  if (PageComponent) {
    hydrateRoot(
      rootElement,
      <App
        files={initialData.files as Files}
        headLinks={initialData.headLinks || []}
        appName={initialData.appName}
        pathname={initialData.pathname ?? pathname}
      >
        <PageComponent {...pageProps} />
      </App>,
    );
  } else {
    console.error("No page component found for pathname:", pathname);
    // Fallback: render app without page component
    hydrateRoot(
      rootElement,
      <App
        files={initialData.files as Files}
        headLinks={initialData.headLinks || []}
        appName={initialData.appName}
        pathname={initialData.pathname ?? pathname}
      />,
    );
  }
} else {
  console.error("Root element or initial data not found");
}
