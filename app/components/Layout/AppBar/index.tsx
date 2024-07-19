import { Link } from "@remix-run/react";
import { MagnifyingGlassIcon, PlusCircleIcon } from "@heroicons/react/24/solid";

/** Main Header for application. Contains logo and search and add buttons */
const AppBar = () => (
  <div className="navbar">
    <div className="navbar-start" />
    <div className="navbar-center">
      <Link to="/" className="text-xl font-bold">
        Remix Audio
      </Link>
    </div>
    <div className="navbar-end">
      <button className="btn btn-ghost btn-circle">
        <MagnifyingGlassIcon className="size-6" />
      </button>
      <button className="btn btn-ghost btn-circle max-md:hidden">
        <PlusCircleIcon className="size-6" />
      </button>
    </div>
  </div>
);

export default AppBar;
