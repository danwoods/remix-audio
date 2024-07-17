/** @file Organized list of artist > albums > tracks */
import type { Files, Track } from "../../util/s3.server";

/**
 * Returns a nav element containing a list of artists, their albums, and
 * those album's tracks. Tracks play/pause when clicked.
 */
const ArtistAlbumTrackNavList = ({
  files,
  playToggle,
}: {
  files: Files;
  playToggle: (track: Track) => void;
}) => (
  <nav>
    {files && (
      <ol>
        {Object.entries(files).map(([artist, albumsObj]) => (
          <li key={artist}>
            {artist}
            <ul>
              {Object.entries(albumsObj).map(([album, tracks]) => (
                <li key={album}>
                  {album}
                  <ul>
                    {tracks
                      .sort((a, b) => a.trackNum - b.trackNum)
                      .map((track) => (
                        <li key={track.title}>
                          <button
                            onClick={() => playToggle(track)}
                            className="btn"
                          >
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
      </ol>
    )}
    {/*contacts.length ? (
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
            )*/}
  </nav>
);

export default ArtistAlbumTrackNavList;
