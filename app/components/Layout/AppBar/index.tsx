import type { Files } from "../../../util/files";

import FilePicker from "~/components/FilePicker";
import Search from "./Search";
import { Link, useLocation } from "@remix-run/react";

/** Main Header for application. Contains logo and search and add buttons */
const AppBar = ({
  files,
  playToggle,
}: {
  files: Files;
  playToggle: (t: { url: string }) => void;
}) => {
  const { pathname } = useLocation();
  return (
    <div
      className={`navbar bg-base-100 ${pathname === "/" ? "sticky top-0" : ""}`}
    >
      <div className="navbar-start" />
      <div className="navbar-center">
        <Link to="/" className="text-xl font-bold">
          Remix Audio
        </Link>
      </div>
      <div className="navbar-end">
        <Search files={files} playToggle={playToggle} />
        <FilePicker btnClassName="max-md:hidden" />
      </div>
    </div>
  );
};

export default AppBar;
