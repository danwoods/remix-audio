import type { Files } from "./util/files.ts";
import type { SyntheticEvent, ReactNode } from "react";

import AppBar from "./components/Layout/AppBar/index.tsx";
import PlayerControls from "./components/Layout/PlayerControls/index.tsx";
import { getRemainingAlbumTracks } from "./util/files.ts";
import { useEffect, useRef, useState } from "react";
import { PlayerContext } from "./context/PlayerContext.tsx";

export type Context = {
  playToggle: (track?: { url: string }) => void;
  currentTrack: string | null;
  isPlaying: boolean;
};

export interface AppProps {
  files: Files;
  headLinks?: Array<{ rel: string; href: string }>;
  appName?: string;
  children?: ReactNode;
}

export default function App({
  files,
  headLinks = [],
  appName = "Remix Audio",
  children,
}: AppProps) {
  const audioElmRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTrackUrl, setCurrentTrackUrl] = useState<string | null>(null);
  const [nextTrackLoaded, setNextTrackLoaded] = useState<boolean>(false);

  // Player functionality /////////////////////////////////////////////////////

  /**
   * @summary Play/Pause/Resume/Stop
   * @desc There are 4 different scenarios this supports
   *       1. If a track is passed in that is not currently being played, it will start playing that track
   *       2. If a track is passed in that is currently being played, it will pause
   *       2. If a track is passed in that is the current track, but it's not currently playing, it will resume
   *       3. If no track is passed in, it will stop playback
   **/
  const playToggle = (track?: { url: string }) => {
    if (track) {
      if (track.url !== currentTrackUrl) {
        setCurrentTrackUrl(track.url);
        setIsPlaying(true);
      } else if (isPlaying) {
        pause();
      } else {
        setIsPlaying(true);
      }
    } else {
      setCurrentTrackUrl(null);
      pause();
    }
  };

  /** Pause track */
  const pause = () => {
    setIsPlaying(false);
  };

  /** Play next track */
  const playNext = () => {
    if (currentTrackUrl) {
      const [nextTrack] = getRemainingAlbumTracks(files, currentTrackUrl);
      playToggle(nextTrack);
    }
  };

  /**
   * Listen to progress changes for current track so we can start loading the
   * next track when it's close to finishing and move to the next track once
   * it's done.
   **/
  const onTimeUpdate = (evt: SyntheticEvent<HTMLAudioElement, Event>) => {
    const t = evt.target as HTMLAudioElement;
    if (
      !nextTrackLoaded &&
      !Number.isNaN(t.duration) &&
      // If we're within 20s of the end of the track
      t.duration - 20 < t.currentTime &&
      currentTrackUrl
    ) {
      setNextTrackLoaded(true);
      const [nextTrack] = getRemainingAlbumTracks(files, currentTrackUrl);

      if (nextTrack) {
        new Audio(nextTrack.url);
      }
    }
  };

  // Call play/pause on the audio element to respond to `isPlaying` or a track changing
  useEffect(() => {
    const audioElm = audioElmRef.current;
    if (audioElm) {
      if (isPlaying) {
        audioElm.play();
        setNextTrackLoaded(false);
      } else {
        audioElm.pause();
      }
    }
  }, [isPlaying, currentTrackUrl]);

  // Main component ///////////////////////////////////////////////////////////

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{appName}</title>
        <meta name="description" content="Your audio where you want it." />
        {headLinks.map((l) => (
          <link key={l.rel + l.href} rel={l.rel} href={l.href} />
        ))}
      </head>
      <body>
        <PlayerContext.Provider
          value={{
            isPlaying,
            playToggle,
            currentTrack: currentTrackUrl,
          }}
        >
          <AppBar files={files} playToggle={playToggle} />
          <div className={`flex w-full`}>
            <main
              className={`md:mx-auto md:px-6 grow ${currentTrackUrl ? "pb-24" : ""}`}
            >
              {children}
            </main>
          </div>
          <PlayerControls
            currentTrack={currentTrackUrl}
            files={files}
            isPlaying={isPlaying}
            playNext={playNext}
            playToggle={playToggle}
          />
          {currentTrackUrl && (
            <audio // eslint-disable-line jsx-a11y/media-has-caption
              onEnded={playNext}
              onTimeUpdate={onTimeUpdate}
              ref={audioElmRef}
              src={currentTrackUrl}
            ></audio>
          )}
        </PlayerContext.Provider>
      </body>
    </html>
  );
}
