import type { Files } from "../../../util/files.ts";

import FilePicker from "./FilePicker.tsx";
import Search from "./Search.tsx";
import { useEffect, useState } from "react";

/** Main Header for application. Contains logo and search and add buttons */
const AppBar = ({
  files,
  playToggle,
}: {
  files: Files;
  playToggle: (t: { url: string }) => void;
}) => {
  const [pathname, setPathname] = useState("/");

  useEffect(() => {
    // Set initial pathname
    setPathname(window.location.pathname);

    // Listen for navigation events (full-page navigation)
    const handlePopState = () => {
      setPathname(window.location.pathname);
    };
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

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
