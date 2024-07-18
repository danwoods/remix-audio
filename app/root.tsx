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
import { createEmptyContact, getContacts } from "./data";
import { useEffect, useRef, useState } from "react";
import AppBar from "./components/Layout/AppBar";
import PlayerControls from "./components/Layout/PlayerControls";
// import FilePicker from "./components/FilePicker";
import { s3UploadHandler, getUploadedFiles } from "./util/s3.server";

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
    const contact = await createEmptyContact();
    return redirect(`/contacts/${contact.id}/edit`);
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
  const contacts = await getContacts(q);

  return json({ contacts, q, files });
};

export default function App() {
  const { q, files }: { q: string | null; files: Files } =
    useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const audioElmRef = useRef<HTMLAudioElement>(null);
  // const submit = useSubmit();
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);
  // const currentPlaylist = useRef<string[]>([]);
  const searching =
    navigation.location &&
    new URLSearchParams(navigation.location.search).has("q");

  useEffect(() => {
    const searchField = document.getElementById("q");
    if (searchField instanceof HTMLInputElement) {
      searchField.value = q || "";
    }
  }, [q]);

  useEffect(() => {
    if (audioElmRef.current) {
      if (isPlaying) {
        audioElmRef.current.play();
      } else {
        audioElmRef.current.pause();
      }
    }
  }, [isPlaying, currentTrack]);

  const playToggle = (track: Track) => {
    if (!isPlaying || track.url !== currentTrack) {
      setCurrentTrack(track.url);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  };

  // const onPlayerControlsClick = (tracks: Track[]) => {

  // }

  // const addToPlaylist = (tracks: Track[]) => {
  //   currentPlaylist.current = [
  //     ...currentPlaylist.current,
  //     ...tracks.map((t) => t.url),
  //   ];
  // };

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Remix Audio</title>
        <meta name="description" content="Your audio where you want it."></meta>
        <Meta />
        <Links />
      </head>
      <body>
        <AppBar />
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
          <main className="md:container md:mx-auto max-sm:px-6">
            <Outlet context={{ files, isPlaying, playToggle, currentTrack }} />
          </main>
        </div>
        <PlayerControls files={files} />
        <ScrollRestoration />
        <Scripts />
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        {currentTrack && <audio src={currentTrack} ref={audioElmRef}></audio>}
      </body>
    </html>
  );
}
