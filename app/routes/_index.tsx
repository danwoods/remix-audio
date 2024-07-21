/** @file Main content to display when at "/" */
import type { Files } from "../util/files";

import AlbumTile from "../components/AlbumTile";
import HorizontalRowWithTitle from "../components/HorizontalRowWithTitle";
import { getAlbumIdsByRecent } from "../util/files";
import { getUploadedFiles } from "../util/s3.server";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export const loader = async () => {
  const files = await getUploadedFiles();

  const recentAlbumIds = getAlbumIdsByRecent(files).slice(0, 5);

  return json({ files, recentAlbumIds });
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

const FavoritesRow = ({ files }: { files: Files }) => (
  <HorizontalRowWithTitle title="Favorites">
    <AlbumTile
      files={files}
      albumId="Joe Russo's Almost Dead/2019-08-29 Morrison, CO"
    />
    <AlbumTile files={files} albumId="Pearl Jam/Dark Matter" />
    <AlbumTile files={files} albumId="Dance Party Time Machine/Love Shack" />
    <AlbumTile files={files} albumId="Dance Party Time Machine/Love Shack" />
    <AlbumTile files={files} albumId="Dance Party Time Machine/Love Shack" />
  </HorizontalRowWithTitle>
);

/** Default (/) content */
const Index = () => {
  const {
    files,
    recentAlbumIds,
  }: {
    files: Files;
    recentAlbumIds: ReturnType<typeof getAlbumIdsByRecent>;
  } = useLoaderData<typeof loader>();

  if (files) {
    return (
      <>
        <ContinueListeningRow files={files} />
        <LatestRow files={files} albumIds={recentAlbumIds} />
        <FavoritesRow files={files} />
      </>
    );
  } else {
    return <div>Upload some music!</div>;
  }
};

export default Index;
