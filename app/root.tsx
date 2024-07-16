// XXX: https://github.com/GoogleChrome/lighthouse?tab=readme-ov-file#cli-options
import type {
  ActionFunctionArgs,
  LinksFunction,
  LoaderFunctionArgs,
  UploadHandler,
} from "@remix-run/node";
import {
  Form,
  Links,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useNavigation,
  useSubmit,
} from "@remix-run/react";
import {
  json,
  redirect,
  unstable_composeUploadHandlers as composeUploadHandlers,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";
import { createEmptyContact, getContacts } from "./data";
import { useEffect } from "react";
import FilePicker from "./components/FilePicker";
import { s3UploadHandler } from "./util/s3.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "POST") {
    console.log(request.body);
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
  const { contacts, q, files } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const searching =
    navigation.location &&
    new URLSearchParams(navigation.location.search).has("q");

  useEffect(() => {
    const searchField = document.getElementById("q");
    if (searchField instanceof HTMLInputElement) {
      searchField.value = q || "";
    }
  }, [q]);

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
        <div id="sidebar">
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
          <nav>
            {files &&
              Object.entries(files).map(([artist, albumsObj]) => (
                <li key={artist}>
                  {artist}
                  <ul>
                    {Object.entries(albumsObj).map(([album, tracks]) => (
                      <li key={album}>
                        {album}
                        <ul>
                          {tracks.map((track) => (
                            <li key={track.title}>
                              <button onClick={() => playToggle(track)}>
                                {track.title}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            {contacts.length ? (
              <ul>
                {contacts.map((contact) => (
                  <li key={contact.id}>
                    <NavLink
                      className={({ isActive, isPending }) =>
                        isActive ? "active" : isPending ? "pending" : ""
                      }
                      to={`contacts/${contact.id}`}
                    >
                      {contact.first || contact.last ? (
                        <>
                          {contact.first} {contact.last}
                        </>
                      ) : (
                        <i>No Name</i>
                      )}{" "}
                      {contact.favorite ? <span>★</span> : null}
                    </NavLink>
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                <i>No contacts</i>
              </p>
            )}
          </nav>
        </div>
        <div
          className={
            navigation.state === "loading" && !searching ? "loading" : ""
          }
          id="detail"
        >
          <Outlet />
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
