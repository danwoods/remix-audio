/** @file Main Listing of Artists */
import type { Context } from "../root";

import { useOutletContext, NavLink } from "@remix-run/react";

/** Main Listing of Artists */
const Artists = () => {
  const { files } = useOutletContext<Context>();
  const artistsNames = Object.keys(files);

  return (
    <nav>
      {artistsNames.map((name) => (
        <NavLink key={name} to={`/artists/${name}`}>
          {name}
        </NavLink>
      ))}
    </nav>
  );
};

export default Artists;
