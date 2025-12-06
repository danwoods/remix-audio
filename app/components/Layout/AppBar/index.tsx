import type { Files } from "../../../util/files.ts";

import FilePicker from "./FilePicker.tsx";
import Search from "./Search.tsx";
import { useEffect, useState } from "react";

/** Main Header for application. Contains logo and search and add buttons */
const AppBar = ({
  files,
  playToggle,
  pathname: initialPathname,
}: {
  files: Files;
  playToggle: (t: { url: string }) => void;
  pathname?: string;
}) => {
  // Initialize pathname from prop (SSR) or window.location (client hydration)
  // This ensures server and client render the same initial value
  const [pathname, setPathname] = useState(() => {
    // On server, use the prop if provided, otherwise default to "/"
    // On client, use window.location.pathname if prop not provided
    if (typeof window !== "undefined") {
      return initialPathname ?? window.location.pathname;
    }
    return initialPathname ?? "/";
  });

  useEffect(() => {
    // Update pathname from window.location if prop changes or on mount
    // This handles client-side navigation
    const currentPathname = window.location.pathname;
    if (currentPathname !== pathname) {
      setPathname(currentPathname);
    }

    // Listen for navigation events (full-page navigation)
    const handlePopState = () => {
      setPathname(window.location.pathname);
    };
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [pathname]);

  return (
    <div
      className={`navbar bg-base-100 ${pathname === "/" ? "sticky top-0" : ""}`}
    >
      <div className="navbar-start" />
      <div className="navbar-center">
        <a href="/" className="text-xl font-bold">
          Remix Audio
        </a>
      </div>
      <div className="navbar-end">
        <Search files={files} playToggle={playToggle} />
        <FilePicker btnClassName="max-md:hidden" />
      </div>
    </div>
  );
};

export default AppBar;
