/** @file Player controls seen at the bottom of the screen */
import type { Files } from "../../../util/s3.server";

import {
  BackwardIcon,
  ForwardIcon,
  PauseIcon,
  PlayIcon,
  QueueListIcon,
} from "@heroicons/react/24/solid";
import AlbumCover from "~/components/AlbumCover";
import {
  getParentDataFromTrackUrl,
  getRemainingAlbumTracks,
} from "~/util/trackOrganization";

/**
 * Handle whether to display a play or pause button, including indicating if
 * the current track is paused
 */
export const PlayPauseIcon = ({
  currentTrack,
  isPlaying,
}: {
  currentTrack: string | null;
  isPlaying: boolean;
}) => {
  if (!currentTrack) {
    return <PlayIcon className="size-6" />;
  }

  if (!isPlaying && currentTrack) {
    return <PlayIcon className="size-6 animate-pulse" />;
  }

  return <PauseIcon className="size-8" />;
};

/** Show album art, title, and album/artist name of currently playing track */
const CurrentlyPlaying = ({
  currentTrack,
  files,
}: {
  currentTrack: string | null;
  files: Files;
}) => {
  const { artistName, albumName, trackName } =
    getParentDataFromTrackUrl(currentTrack);

  const scrollingText =
    artistName && albumName ? `${albumName}, ${artistName}` : null;

  return (
    <div className="flex cursor-default">
      <AlbumCover
        files={files}
        albumId={`${artistName}/${albumName}`}
        className="rounded z-10 size-20"
      />
      <div className="ml-3 pt-2">
        <p className="text-base font-bold">{trackName}</p>
        <div className="flex items-center">
          {scrollingText && (
            <>
              <p className="marquee pr-6 md:animate-none">
                <span className="text-sm text-nowrap">{`${albumName}, ${artistName}`}</span>
              </p>
              <p className="md:hidden marquee2 pr-6">
                <span className="text-sm text-nowrap">{`${albumName}, ${artistName}`}</span>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/** Play/pause, prev/next */
const Controls = ({
  currentTrack,
  isPlaying,
  playNext,
  playToggle,
}: {
  currentTrack: string | null;
  isPlaying: boolean;
  playNext: () => void;
  playToggle: (t: { url: string }) => void;
}) => {
  return (
    <div className="flex justify-evenly w-full cursor-default">
      <button className="max-sm:hidden">
        <BackwardIcon className="size-6" />
      </button>
      <button
        className="md:px-6"
        onClick={() => {
          if (currentTrack) {
            playToggle({ url: currentTrack });
          }
        }}
      >
        <PlayPauseIcon isPlaying={isPlaying} currentTrack={currentTrack} />
      </button>
      <button className="" onClick={playNext}>
        <ForwardIcon className="size-6" />
      </button>
    </div>
  );
};

/** Cuurent Queue */
const Playlist = ({
  files,
  currentTrack,
  playToggle,
}: {
  files: Files;
  currentTrack: string | null;
  playToggle: (t: { url: string }) => void;
}) => {
  const tracks = getRemainingAlbumTracks(files, currentTrack || "") || [];
  return (
    <div className="dropdown dropdown-top dropdown-end cursor-default">
      <button
        className={`btn btn-xs btn-square mr-6 ${!tracks.length ? "btn-disabled" : ""}`}
      >
        <QueueListIcon />
      </button>
      <ol className="dropdown-content menu bg-primary rounded-box z-[1] w-52 p-2 shadow divide-y divide-solid">
        {tracks.map((track) => (
          <li key={track.url}>
            <button
              className="py-1 w-full flex justify-between"
              onClick={() => playToggle(track)}
            >
              {track.title}
              <PlayIcon className="size-6" />
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
};

/** Main player controls */
const PlayerControls = ({
  currentTrack,
  files,
  isPlaying,
  playNext,
  playToggle,
}: {
  currentTrack: string | null;
  files: Files;
  isPlaying: boolean;
  playNext: () => void;
  playToggle: (t: { url: string }) => void;
}) => {
  return (
    <div
      className={`btm-nav btm-nav-md bg-base-100 z-10 h-fit justify-between transition-transform ${!currentTrack ? "translate-y-full" : ""}`}
    >
      <div className="max-sm:basis-3/5 lg:basis-5/12 overflow-x-clip items-start">
        <CurrentlyPlaying files={files} currentTrack={currentTrack} />
      </div>
      <div className="basis-2/5">
        <Controls
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          playNext={playNext}
          playToggle={playToggle}
        />
      </div>
      <div className="max-sm:basis-1/5 max-sm:hidden lg:basis-5/12 items-end">
        <Playlist
          currentTrack={currentTrack}
          files={files}
          playToggle={playToggle}
        />
      </div>
    </div>
  );
};

export default PlayerControls;
