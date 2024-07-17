/** @file Listing of an artist's albums */
import type { Context } from "../root";
import type { LoaderFunctionArgs } from "@remix-run/node";

import { useLoaderData, useOutletContext, NavLink } from "@remix-run/react";

export async function loader({ params }: LoaderFunctionArgs) {
  if (!params.artistId)
    throw new Response("Missing an artist ID", { status: 400 });
  return params.artistId;
}

/** Listing of an artist's albums */
const Albums = () => {
  const { files } = useOutletContext<Context>();
  const artistId = useLoaderData<typeof loader>();

  const albums = Object.keys(files[artistId]);

  return (
    <nav className="artist">
      {albums.map((name) => (
        <NavLink key={name} to={`/artists/${artistId}/albums/${name}`}>
          {name}
        </NavLink>
      ))}
    </nav>
  );
};

export default Albums;
