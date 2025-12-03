import type { Files } from "../../util/files.ts";

import { getAlbumArtAsBlobUrl } from "../../util/files.ts";
import { useEffect, useState } from "react";

/**
 * Album cover image
 * @returns `<img />` element
 **/
const AlbumCover = ({
  albumId,
  className,
  files,
}: {
  albumId: string;
  className?: string;
  files: Files;
}) => {
  const [albumArt, setAlbumArt] = useState<string>(
    "https://placehold.co/100x100?text=.",
  );

  // Get album art
  useEffect(() => {
    getAlbumArtAsBlobUrl(files, albumId).then((url: string | null) => {
      if (url) {
        setAlbumArt(url);
      }
    });
  }, [albumId, files]);

  return <img className={className || ""} alt="album art" src={albumArt} />;
};

export default AlbumCover;
