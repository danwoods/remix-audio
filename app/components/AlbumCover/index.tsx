import type { Files } from "../../util/files";

import { getAlbumArt } from "../../util/files";
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
    getAlbumArt(files, albumId).then((url) => {
      if (url) {
        setAlbumArt(url);
      }
    });
  }, [albumId, files]);

  return <img className={className || ""} alt="album art" src={albumArt} />;
};

export default AlbumCover;
