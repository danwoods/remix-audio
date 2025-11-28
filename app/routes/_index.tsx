/** @file Main content to display when at "/" */
import type { Files } from "../util/files.ts";

import AlbumTile from "../components/AlbumTile/index.tsx";
import HorizontalRowWithTitle from "../components/HorizontalRowWithTitle/index.tsx";
import { getAlbumIdsByRecent } from "../util/files.ts";

export interface IndexProps {
  files: Files;
  recentlyUploadedAlbumIds: ReturnType<typeof getAlbumIdsByRecent>;
}

/** Single row on homepage */
const Row = ({
  albumIds,
  files,
  title,
}: {
  albumIds: { id: string }[];
  files: Files;
  title: string;
}) => (
  <HorizontalRowWithTitle title={title}>
    {albumIds.map((a) => (
      <AlbumTile key={a.id} files={files} albumId={a.id} />
    ))}
  </HorizontalRowWithTitle>
);

/** Default (/) content */
const Index = ({ files, recentlyUploadedAlbumIds }: IndexProps) => {
  const recentlyListenedToAlbumIds = [
    { id: "Childish Gambino/Poindexter" },
    { id: "Girl Talk/All Day" },
    { id: "Pearl Jam/Vitalogy (Expanded Edition)" },
    { id: "The Rolling Stones/Let It Bleed" },
    { id: "The Black Keys/Ohio Players" },
  ];

  const mostListenedToAlbumIds = [
    { id: "Pearl Jam/Dark Matter" },
    { id: "Run The Jewels/RTJ4" },
    { id: "Pink Floyd/Wish You Were Here" },
    { id: "Wu-Tang Clan/Enter The Wu-Tang: 36 Chambers" },
    { id: "The Rolling Stones/Exile On Main St." },
  ];

  if (files) {
    return (
      <>
        <Row
          files={files}
          albumIds={recentlyListenedToAlbumIds}
          title="Continue Listening"
        />
        <Row files={files} albumIds={recentlyUploadedAlbumIds} title="Latest" />
        <Row
          files={files}
          albumIds={mostListenedToAlbumIds}
          title="Favorites"
        />
      </>
    );
  } else {
    return <div>Upload some music!</div>;
  }
};

export default Index;
