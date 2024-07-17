/** @file Listing of an album's tracks */
import type { Context } from "../root";
import type { LoaderFunctionArgs } from "@remix-run/node";

import { useLoaderData, useOutletContext, NavLink } from "@remix-run/react";

export async function loader({ params }: LoaderFunctionArgs) {
  if (!params.artistId || !params.albumId)
    throw new Response("Missing an artist or album ID", { status: 400 });
  return params;
}

/** Listing of an album's tracks */
const Album = () => {
  const { files } = useOutletContext<Context>();
  const { artistId, albumId } = useLoaderData<typeof loader>();

  if (artistId && albumId) {
    const tracks = files[artistId][albumId];

    return (
      <nav className="album">
        {tracks.map(({ title }) => (
          <NavLink key={title} to={`/artists/${artistId}/albums/${title}`}>
            {title}
          </NavLink>
        ))}
      </nav>
    );
  } else {
    return <div>{"Missing artistId or albumId"}</div>;
  }
};

export default Album;
