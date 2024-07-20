/** @file Main content to display when at "/" */
import type { Context } from "../root";
import type { Files } from "../util/s3.server";

import { useOutletContext } from "@remix-run/react";
import AlbumTile from "~/components/AlbumTile";
import HorizontalRowWithTitle from "~/components/HorizontalRowWithTitle";
import { getAlbumIdsByRecent } from "~/util/trackOrganization";

const ContinueListeningRow = ({ files }: { files: Files }) => (
  <HorizontalRowWithTitle title="Continue Listening">
    <AlbumTile files={files} albumId="Dance Party Time Machine/Love Shack" />
  </HorizontalRowWithTitle>
);

const LatestRow = ({ files }: { files: Files }) => {
  const albumIds = getAlbumIdsByRecent(files).slice(0, 5);

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
    <AlbumTile files={files} albumId="Dance Party Time Machine/Love Shack" />
    <AlbumTile files={files} albumId="Dance Party Time Machine/Love Shack" />
    <AlbumTile files={files} albumId="Dance Party Time Machine/Love Shack" />
    <AlbumTile files={files} albumId="Dance Party Time Machine/Love Shack" />
    <AlbumTile files={files} albumId="Dance Party Time Machine/Love Shack" />
  </HorizontalRowWithTitle>
);

/** Default (/) content */
const Index = () => {
  const { files } = useOutletContext<Context>();

  if (files) {
    return (
      <>
        <ContinueListeningRow files={files} />
        <LatestRow files={files} />
        <FavoritesRow files={files} />
      </>
    );
  } else {
    return <div>Upload some music!</div>;
  }
};

export default Index;
