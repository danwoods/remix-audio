/** @file Listing of an album's tracks */
import type { Files, Track } from "../util/files.ts";

import AlbumCover from "../components/AlbumCover/index.tsx";
import { PauseIcon, PlayIcon } from "@heroicons/react/24/solid";
import { extractColors } from "extract-colors";
import {
  getAlbum,
  getAlbumArtAsBlobUrl,
  sortTracksByTrackNumber,
} from "../util/files.ts";
import { useEffect, useState } from "react";
import { usePlayerContext } from "../context/PlayerContext.tsx";
import { useInView } from "react-intersection-observer";

export interface AlbumProps {
  artistId: string;
  albumId: string;
  files: Files;
}

/** Header including album art, title, and artis */
const Header = ({
  artistId,
  albumId,
  files,
  forceSmallSticky,
}: {
  artistId: string;
  albumId: string;
  files: Files;
  forceSmallSticky: boolean;
}) => {
  const [bgGradient, setBgGradient] = useState<string | null>(null);

  useEffect(() => {
    getAlbumArtAsBlobUrl(files, `${artistId}/${albumId}`)
      .then((url) => {
        if (url) {
          return extractColors(url).then((colors) => [
            colors[0].hex,
            colors[colors.length - 1].hex,
          ]);
        } else {
          return ["oklch(var(--su))", "oklch(var(--b1))"];
        }
      })
      .then((colors) =>
        setBgGradient(`linear-gradient(to bottom, ${colors[0]}, ${colors[1]})`),
      );
  }, [artistId, albumId, files]);

  return (
    <div
      className={`p-4 rounded flex z-50 transition-all ${!forceSmallSticky ? "lg:p-6 sm:h-48 md:h-60 lg:h-72" : "sticky top-0"}`}
      style={{
        background: bgGradient || "",
      }}
    >
      <div
        className={`size-20 ${!forceSmallSticky ? "sm:size-40 md:min-w-48 lg:min-w-60" : ""}`}
      >
        <AlbumCover
          files={files}
          albumId={`${artistId}/${albumId}`}
          className="rounded shadow-2xl"
        />
      </div>
      <div
        className={`ml-3 pt-2 text-black ${!forceSmallSticky ? "md:pt-4" : ""}`}
      >
        <p
          className={`text-lg font-bold ${!forceSmallSticky ? "sm:text-2xl md:text-4xl lg:text-6xl" : ""}`}
        >
          {albumId}
        </p>
        <p
          className={`text-base line-clamp-1 ${!forceSmallSticky ? "sm:text-lg md:text-xl lg:text-2xl line-clamp-3" : ""}`}
        >
          {artistId}
        </p>
      </div>
    </div>
  );
};

/** Tracklist */
const Tracklist = ({
  tracks,
  isPlaying,
  playToggle,
  currentTrack,
}: {
  tracks: Track[];
  isPlaying: boolean;
  playToggle: (t: { url: string }) => void;
  currentTrack: string | null;
}) => (
  <ol className="divide-y divide-solid p-6 pt-0">
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
);

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

/** Main album display page */
const Album = ({ artistId, albumId, files }: AlbumProps) => {
  const { currentTrack, isPlaying, playToggle } = usePlayerContext();
  const [forceSmallSticky, setForceSmallSticky] = useState(false);
  // useInView hook - will be false on server, true initially on client
  // This can cause hydration mismatches, so we handle it carefully
  const { ref, inView } = useInView({
    initialInView: true,
    rootMargin: "-150px",
  });

  useEffect(() => {
    // This effect only runs on client after hydration
    if (!inView) {
      setForceSmallSticky(true);
    } else {
      setForceSmallSticky(false);
    }
  }, [inView]);

  if (artistId && albumId) {
    const album = getAlbum(files, `${artistId}/${albumId}`);

    if (!album) {
      return <div>Album not found</div>;
    }

    const tracks = [...album.tracks].sort(sortTracksByTrackNumber);

    return (
      <section>
        <Header
          artistId={artistId}
          albumId={albumId}
          files={files}
          forceSmallSticky={forceSmallSticky}
        />
        {/* Trigger shifting to/from smaller header */}
        {/* Suppress hydration warning for this element since useInView behaves differently on server/client */}
        <div ref={ref} suppressHydrationWarning />
        <Tracklist
          tracks={tracks}
          isPlaying={isPlaying}
          currentTrack={currentTrack}
          playToggle={playToggle}
        />
      </section>
    );
  } else {
    return <div>{"Missing artistId or albumId"}</div>;
  }
};

export default Album;
