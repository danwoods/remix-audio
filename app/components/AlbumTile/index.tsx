import type { Files } from "../../util/files.ts";

import AlbumCover from "../AlbumCover/index.tsx";

/** Title with album art and title/artist text below */
const AlbumTitle = ({ albumId, files }: { albumId: string; files: Files }) => {
  const [artistName, albumName] = albumId.split("/");

  return (
    <a
      href={`/artists/${encodeURIComponent(artistName)}/albums/${encodeURIComponent(albumName)}`}
    >
      <AlbumCover files={files} albumId={albumId} className="rounded w-full" />
      <div className="pt-1 md:pt-2">
        <p className="text-base font-bold line-clamp-1">{albumName}</p>
        <p className="text-sm line-clamp-1">{`by ${artistName}`}</p>
      </div>
    </a>
  );
};

export default AlbumTitle;
