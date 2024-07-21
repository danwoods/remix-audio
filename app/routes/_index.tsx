/** @file Main content to display when at "/" */
import type { Files } from "../util/files";

import AlbumTile from "../components/AlbumTile";
import HorizontalRowWithTitle from "../components/HorizontalRowWithTitle";
import { getAlbumIdsByRecent, getAllTracks } from "../util/files";
import { getUploadedFiles } from "../util/s3.server";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export const loader = async () => {
  const files = await getUploadedFiles();
  const recentAlbumIds = getAlbumIdsByRecent(files).slice(0, 5);
  const tracksWithTags = await Promise.all(
    getAllTracks(files).map((t) => t.tagFetch.then((tags) => ({ ...t, tags }))),
  );
  const tracksWithListenCounts = tracksWithTags.filter((t) =>
    t.tags?.find((t) => t.Key === "listenCount"),
  );
  const sortedTracksWithListenCounts = tracksWithListenCounts.sort((a, b) => {
    const aListenCount = Number(
      a.tags?.find((t) => t.Key === "listenCount")?.Value,
    );
    const bListenCount = Number(
      b.tags?.find((t) => t.Key === "listenCount")?.Value,
    );

    if (aListenCount < bListenCount) {
      return 1;
    } else if (bListenCount < aListenCount) {
      return -1;
    }

    return 0;
  });

  const mostListenedToAlbumIds: string[] = Array.from(
    new Set(
      sortedTracksWithListenCounts.map((t) => {
        const urlPaths = t.url.split("/");
        const albumName = urlPaths[urlPaths.length - 2];
        const artistName = urlPaths[urlPaths.length - 3];
        return `${artistName}/${albumName}`;
      }),
    ),
  );

  return json({ files, mostListenedToAlbumIds, recentAlbumIds });
};

const ContinueListeningRow = ({ files }: { files: Files }) => (
  <HorizontalRowWithTitle title="Continue Listening">
    <AlbumTile files={files} albumId="Dance Party Time Machine/Love Shack" />
  </HorizontalRowWithTitle>
);

const LatestRow = ({
  albumIds,
  files,
}: {
  albumIds: ReturnType<typeof getAlbumIdsByRecent>;
  files: Files;
}) => {
  return (
    <HorizontalRowWithTitle title="Latest">
      {albumIds.map((a) => (
        <AlbumTile key={a.id} files={files} albumId={a.id} />
      ))}
    </HorizontalRowWithTitle>
  );
};

const FavoritesRow = ({
  files,
  albumIds,
}: {
  files: Files;
  albumIds: string[];
}) => (
  <HorizontalRowWithTitle title="Favorites">
    {albumIds.map((ai) => (
      <AlbumTile key={ai} files={files} albumId={ai} />
    ))}
  </HorizontalRowWithTitle>
);

/** Default (/) content */
const Index = () => {
  const {
    files,
    mostListenedToAlbumIds,
    recentAlbumIds,
  }: {
    files: Files;
    mostListenedToAlbumIds: string[];
    recentAlbumIds: ReturnType<typeof getAlbumIdsByRecent>;
  } = useLoaderData<typeof loader>();

  if (files) {
    return (
      <>
        <ContinueListeningRow files={files} />
        <LatestRow files={files} albumIds={recentAlbumIds} />
        <FavoritesRow files={files} albumIds={mostListenedToAlbumIds} />
      </>
    );
  } else {
    return <div>Upload some music!</div>;
  }
};

export default Index;
