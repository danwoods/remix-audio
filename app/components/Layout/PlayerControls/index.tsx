/** @file Player controls seen at the bottom of the screen */
import type { Files } from "../../../util/s3.server";

import {
  BackwardIcon,
  ForwardIcon,
  PlayCircleIcon,
  QueueListIcon,
} from "@heroicons/react/24/solid";
import AlbumCover from "~/components/AlbumCover";

/** Show album art, title, and album/artist name of currently playing track */
const CurrentlyPlaying = ({ files }: { files: Files }) => {
  const artistId = "Dance Party Time Machine";
  const albumId = "Love Shack";
  return (
    <div className="flex">
      <AlbumCover
        files={files}
        albumId={`${artistId}/${albumId}`}
        className="rounded w-2/3 max-sm:w-1/3 z-10"
      />
      <div className="ml-3 pt-2">
        <p className="text-base">Some Song</p>
        <div className="flex items-center">
          <p className="marquee pr-6">
            <span className="text-sm text-nowrap">{`${albumId}, ${artistId}`}</span>
          </p>
          <p className="marquee2 pr-6">
            <span className="text-sm text-nowrap">{`${albumId}, ${artistId}`}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

/** Play/pause, prev/next */
const Controls = () => {
  return (
    <div className="flex-row bg-base-100">
      <button className="max-sm:hidden btn btn-circle">
        <BackwardIcon />
      </button>
      <button className="btn btn-circle">
        <PlayCircleIcon />
      </button>
      <button className="btn btn-circle">
        <ForwardIcon />
      </button>
    </div>
  );
};

/** Cuurent Queue */
const Playlist = () => {
  return (
    <button className="btn btn-xs btn-square">
      <QueueListIcon />
    </button>
  );
};

/** Main player controls */
const PlayerControls = ({ files }: { files: Files }) => {
  return (
    <div className="btm-nav btm-nav-md bg-base-100 z-10">
      <div className="basis-1/4 max-sm:basis-3/5 overflow-x-clip">
        <CurrentlyPlaying files={files} />
      </div>
      <div className="basis-2/5">
        <Controls />
      </div>
      <div className="basis-1/4  max-sm:basis-1/5 max-sm:hidden">
        <Playlist />
      </div>
    </div>
  );
};

export default PlayerControls;
