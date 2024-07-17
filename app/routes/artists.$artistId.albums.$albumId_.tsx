/** @file Listing of an album's tracks */
import type { Context } from "../root";
import type { LoaderFunctionArgs } from "@remix-run/node";

import { useLoaderData, useOutletContext } from "@remix-run/react";
import { PauseIcon, PlayIcon } from "@heroicons/react/24/solid";

export async function loader({ params }: LoaderFunctionArgs) {
  if (!params.artistId || !params.albumId)
    throw new Response("Missing an artist or album ID", { status: 400 });
  return params;
}

/**
 * Handle whether to display a play or pause button, including indicating if
 * the current track is paused
 */
const PlayPauseIcon = ({
  trackUrl,
  currentTrack,
  isPlaying,
}: {
  trackUrl: string;
  currentTrack: string | null;
  isPlaying: boolean;
}) => {
  if (trackUrl !== currentTrack) {
    return <PlayIcon className="size-6" />;
  }

  if (!isPlaying) {
    return <PlayIcon className="size-6 animate-pulse" />;
  }

  return <PauseIcon className="size-6" />;
};

/** Listing of an album's tracks */
const Album = () => {
  const { currentTrack, isPlaying, files, playToggle } =
    useOutletContext<Context>();
  const { artistId, albumId } = useLoaderData<typeof loader>();

  if (artistId && albumId) {
    const tracks = files[artistId][albumId];

    return (
      <nav className="album">
        <ol className="divide-y divide-solid">
          {tracks.map((track) => (
            <li key={track.url}>
              <button
                className="py-4 w-full flex justify-between"
                onClick={() => playToggle(track)}
              >
                {track.title}
                <PlayPauseIcon
                  isPlaying={isPlaying}
                  currentTrack={currentTrack}
                  trackUrl={track.url}
                />
              </button>
            </li>
          ))}
        </ol>
      </nav>
    );
  } else {
    return <div>{"Missing artistId or albumId"}</div>;
  }
};

export default Album;
