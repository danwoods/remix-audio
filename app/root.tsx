// XXX: https://github.com/GoogleChrome/lighthouse?tab=readme-ov-file#cli-options
import type {
  ActionFunctionArgs,
  LinksFunction,
  LoaderFunctionArgs,
  UploadHandler,
} from "@remix-run/node";
import type { Files, Track } from "./util/s3.server";
import {
  // Form,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useNavigation,
  // useSubmit,
} from "@remix-run/react";
import {
  json,
  redirect,
  unstable_composeUploadHandlers as composeUploadHandlers,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";
import { useEffect, useRef, useState } from "react";
import AppBar from "./components/Layout/AppBar";
import PlayerControls from "./components/Layout/PlayerControls";
// import FilePicker from "./components/FilePicker";
import { s3UploadHandler, getUploadedFiles } from "./util/s3.server";
import { getRemainingAlbumTracks } from "./util/trackOrganization";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "POST") {
    const uploadHandler: UploadHandler = composeUploadHandlers(
      s3UploadHandler,
      createMemoryUploadHandler(),
    );
    const formData = await parseMultipartFormData(request, uploadHandler);
    console.log({ formData });
    return redirect("/");
  } else {
    // const contact = await createEmptyContact();
    return redirect("/"); //redirect(`/contacts/${contact.id}/edit`);
  }
};

import appStylesHref from "./app.css?url";

export type Context = {
  files: Files;
  playToggle: (track: Track) => void;
  currentTrack: string | null;
  isPlaying: boolean;
};

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: appStylesHref },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const files = await getUploadedFiles();
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  const headLinks = [
    {
      rel: "preconnect",
      href: `https://${process.env.STORAGE_BUCKET}.s3.${process.env.STORAGE_REGION}.amazonaws.com`,
    },
  ];

  return json({ q, files, headLinks });
};

export default function App() {
  const {
    q,
    files,
    headLinks,
  }: {
    q: string | null;
    files: Files;
    headLinks: { rel: string; href: string }[];
  } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const audioElmRef = useRef<HTMLAudioElement>(null);
  // const submit = useSubmit();
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTrackUrl, setCurrentTrackUrl] = useState<string | null>(null);
  const [nextTrackLoaded, setNextTrackLoaded] = useState<boolean>(false);
  const searching =
    navigation.location &&
    new URLSearchParams(navigation.location.search).has("q");

  useEffect(() => {
    const searchField = document.getElementById("q");
    if (searchField instanceof HTMLInputElement) {
      searchField.value = q || "";
    }
  }, [q]);

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
        {/* <Drawer>
          <ArtistAlbumTrackNavList files={files} />
        </Drawer> */}
        {/* <div id="sidebar">
          <section id="upload-button-container">
            <FilePicker />
          </section>
          <div>
            <Form
              id="search-form"
              role="search"
              onChange={(event) => {
                const isFirstSearch = q === null;
                submit(event.currentTarget, {
                  replace: !isFirstSearch,
                });
              }}
            >
              <input
                id="q"
                aria-label="Search contacts"
                className={searching ? "loading" : ""}
                defaultValue={q || ""}
                placeholder="Search"
                type="search"
                name="q"
              />
              <div id="search-spinner" aria-hidden hidden={!searching} />
            </Form>
            <Form method="post">
              <button type="submit">New</button>
            </Form>
          </div>
        </div> */}
        <div
          className={`${navigation.state === "loading" && !searching ? "loading" : ""} flex w-full`}
        >
          <main className="md:mx-auto md:px-6">
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
