import type { Files } from "~/util/s3.server";

import { getAlbumArt } from "~/util/trackOrganization";
import { useEffect, useState } from "react";

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
    "https://placehold.co/600x400?text=.",
  );

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
