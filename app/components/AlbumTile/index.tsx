import type { Files } from "~/util/s3.server";

import { Link } from "@remix-run/react";
import AlbumCover from "../AlbumCover";

/** Title with album art and title/artist text below */
const AlbumTitle = ({ albumId, files }: { albumId: string; files: Files }) => {
  const [artistName, albumName] = albumId.split("/");

  return (
    <Link to={`/artists/${artistName}/albums/${albumName}`}>
      <AlbumCover files={files} albumId={albumId} className="rounded w-full" />
      <div className="pt-1 md:pt-2">
        <p className="text-base">{albumName}</p>
        <p className="text-sm line-clamp-1">{`by ${artistName}`}</p>
      </div>
    </Link>
  );
};

export default AlbumTitle;
