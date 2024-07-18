import { MagnifyingGlassIcon, PlusCircleIcon } from "@heroicons/react/24/solid";

/** Main Header for application. Contains logo and search and add buttons */
const AppBar = () => (
  <div className="navbar">
    <div className="navbar-start" />
    <div className="navbar-center">
      <a href="/" className="text-xl font-bold">
        Remix Audio
      </a>
    </div>
    <div className="navbar-end">
      <button className="btn btn-ghost btn-circle max-sm:hidden">
        <MagnifyingGlassIcon className="size-6" />
      </button>
      <button className="btn btn-ghost btn-circle">
        <PlusCircleIcon className="size-6" />
      </button>
    </div>
  </div>
);

export default AppBar;
