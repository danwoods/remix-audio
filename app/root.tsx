import type {
  ActionFunctionArgs,
  LinksFunction,
  UploadHandler,
} from "@remix-run/node";
import type { Files } from "./util/files";

import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  // useNavigation,
  // useSubmit,
} from "@remix-run/react";
import {
  json,
  redirect,
  unstable_composeUploadHandlers as composeUploadHandlers,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";
import AppBar from "./components/Layout/AppBar";
import PlayerControls from "./components/Layout/PlayerControls";
import { getRemainingAlbumTracks } from "./util/files";
import { s3UploadHandler, getUploadedFiles } from "./util/s3.server";
import { useEffect, useRef, useState } from "react";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "POST") {
    const uploadHandler: UploadHandler = composeUploadHandlers(
      s3UploadHandler,
      createMemoryUploadHandler(),
    );
    await parseMultipartFormData(request, uploadHandler);
    // console.log({ formData });
    getUploadedFiles(true);
    return redirect("/");
  } else {
    return redirect("/");
  }
};

import appStylesHref from "./app.css?url";

export type Context = {
  files: Files;
  playToggle: (track?: { url: string }) => void;
  currentTrack: string | null;
  isPlaying: boolean;
};

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: appStylesHref },
];

export const loader = async (/*{ request }: LoaderFunctionArgs*/) => {
  const files = await getUploadedFiles();

  const headLinks = [
    {
      rel: "preconnect",
      href: `https://${process.env.STORAGE_BUCKET}.s3.${process.env.STORAGE_REGION}.amazonaws.com`,
    },
  ];

  return json({ files, headLinks });
};

export default function App() {
  const {
    files,
    headLinks,
  }: {
    files: Files;
    headLinks: { rel: string; href: string }[];
  } = useLoaderData<typeof loader>();
  // const navigation = useNavigation();
  const audioElmRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTrackUrl, setCurrentTrackUrl] = useState<string | null>(null);
  const [nextTrackLoaded, setNextTrackLoaded] = useState<boolean>(false);
  // const searching =
  //   navigation.location &&
  //   new URLSearchParams(navigation.location.search).has("q");

  // useEffect(() => {
  //   const searchField = document.getElementById("q");
  //   if (searchField instanceof HTMLInputElement) {
  //     searchField.value = q || "";
  //   }
  // }, [q]);

  // Player functionality /////////////////////////////////////////////////////

  /** Listen to progress changes for current track so we can start loading the
   * next track when it's close to finishing and move to the next track once
   * it's done
   **/
  const onTimeUpdate = (evt: Event) => {
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
      t.removeEventListener("timeupdate", onTimeUpdate);
    }
  };

  // Call play/pause on the audio element to respond to `isPlaying`
  useEffect(() => {
    const audioElm = audioElmRef.current;
    if (audioElm) {
      if (isPlaying) {
        audioElm.play();
        setNextTrackLoaded(false);
        audioElm.addEventListener("ended", playNext);
        audioElm.addEventListener("timeupdate", onTimeUpdate);
        return () => {
          audioElm.removeEventListener("ended", playNext);
          audioElm.removeEventListener("timeupdate", onTimeUpdate);
        };
      } else {
        audioElm.pause();
      }
    }
  }, [isPlaying, currentTrackUrl]);

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

  // XXX: Just pass URL
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

  // Main component ///////////////////////////////////////////////////////////

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Remix Audio</title>
        <meta name="description" content="Your audio where you want it."></meta>
        <Meta />
        <Links />
        {headLinks.map((l) => (
          <link key={l.rel + l.href} rel={l.rel} href={l.href} />
        ))}
      </head>
      <body>
        <AppBar files={files} playToggle={playToggle} />
        <div
          // className={`${navigation.state === "loading" && !searching ? "" : ""} flex w-full`}
          className={`flex w-full`}
        >
          <main className="md:mx-auto md:px-6 grow">
            <Outlet
              context={{
                files,
                isPlaying,
                playToggle,
                currentTrack: currentTrackUrl,
              }}
            />
          </main>
        </div>
        <PlayerControls
          currentTrack={currentTrackUrl}
          files={files}
          isPlaying={isPlaying}
          playNext={playNext}
          playToggle={playToggle}
        />
        <ScrollRestoration />
        <Scripts />
        {currentTrackUrl && (
          <audio src={currentTrackUrl} ref={audioElmRef}></audio> // eslint-disable-line jsx-a11y/media-has-caption
        )}
      </body>
    </html>
  );
}
