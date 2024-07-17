import type { Files } from "~/util/s3.server";

import { Link } from "@remix-run/react";
import { getAlbumArt } from "~/util/trackOrganization";
import { useEffect, useState } from "react";

/** Title with album art and title/artist text below */
const AlbumTitle = ({ albumId, files }: { albumId: string; files: Files }) => {
  // const album = getAlbum(files, albumId);
  const [artistName, albumName] = albumId.split("/");
  const [albumArt, setAlbumArt] = useState<string>(
    "https://placehold.co/600x400",
  );

  useEffect(() => {
    getAlbumArt(files, albumId).then((url) => {
      if (url) {
        setAlbumArt(url);
      }
    });
  }, [albumId, files]);

  return (
    <Link to={`/artists/${artistName}/albums/${albumName}`}>
      <div className="w-24">
        <img className="rounded" alt="album art" src={albumArt} />
        <div>
          <p className="text-base">{albumName}</p>
          <p className="text-sm line-clamp-1">{`by ${artistName}`}</p>
        </div>
      </div>
    </Link>
  );
};

export default AlbumTitle;
