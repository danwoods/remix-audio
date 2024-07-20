import type { Files } from "../../../util/s3.server";

import FilePicker from "~/components/FilePicker";
import Search from "~/components/Search";
import { Link } from "@remix-run/react";

/** Main Header for application. Contains logo and search and add buttons */
const AppBar = ({
  files,
  playToggle,
}: {
  files: Files;
  playToggle: (t: { url: string }) => void;
}) => {
  return (
    <div className="navbar">
      <div className="navbar-start" />
      <div className="navbar-center">
        <Link to="/" className="text-xl font-bold">
          Remix Audio
        </Link>
      </div>
      <div className="navbar-end">
        <Search files={files} playToggle={playToggle} />
        <button className="btn btn-ghost btn-circle max-md:hidden">
          <FilePicker />
        </button>
      </div>
    </div>
  );
};

export default AppBar;
