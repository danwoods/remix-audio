import type { Files } from "../../../util/s3.server";

import FilePicker from "~/components/FilePicker";
import Search from "./Search";
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
        <FilePicker btnClassName="max-md:hidden" />
      </div>
    </div>
  );
};

export default AppBar;
