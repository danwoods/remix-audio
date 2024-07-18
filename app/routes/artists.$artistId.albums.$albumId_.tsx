/** @file Listing of an album's tracks */
import type { Context } from "../root";
import type { LoaderFunctionArgs } from "@remix-run/node";

import { useLoaderData, useOutletContext } from "@remix-run/react";
import { PauseIcon, PlayIcon } from "@heroicons/react/24/solid";
import AlbumCover from "~/components/AlbumCover";
import { useEffect, useState } from "react";
import { extractColors } from "extract-colors";
import { getAlbumArt } from "~/util/trackOrganization";

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
  const [bgGradient, setBgGradient] = useState<string | null>(null);

  useEffect(() => {
    getAlbumArt(files, `${artistId}/${albumId}`)
      .then((url) => {
        if (url) {
          return extractColors(url).then((colors) => [
            colors[0].hex,
            colors[11].hex,
          ]);
        } else {
          return ["oklch(var(--su))", "oklch(var(--b1))"];
        }
      })
      .then((colors) =>
        setBgGradient(`linear-gradient(to bottom, ${colors[0]}, ${colors[1]})`),
      );
  }, []);

  if (artistId && albumId) {
    const tracks = files[artistId][albumId].tracks;

    return (
      <section>
        <div
          className={`p-4 lg:p-6 rounded`}
          style={{
            background: bgGradient || "",
          }}
        >
          <div className="flex md:w-1/2 lg:w-2/3">
            <AlbumCover
              files={files}
              albumId={`${artistId}/${albumId}`}
              className="rounded w-2/3"
            />
            <div className="ml-3 pt-4 text-black">
              <p className="text-lg font-bold">{albumId}</p>
              <p className="text-base line-clamp-3">{artistId}</p>
            </div>
          </div>
        </div>
        <nav className="album p-6 pt-0">
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
      </section>
    );
  } else {
    return <div>{"Missing artistId or albumId"}</div>;
  }
};

export default Album;
