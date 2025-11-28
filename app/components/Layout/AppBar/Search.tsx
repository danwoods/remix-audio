import type { Files, SearchResults } from "../../../util/files.ts";

import useClickOutside from "../../../hooks/useClickOutside.tsx";
import { MagnifyingGlassIcon } from "@heroicons/react/24/solid";
import { search } from "../../../util/files.ts";
import { useEffect, useRef, useState } from "react";

/** Container for search results */
const SearchResultsContainer = ({
  onClick,
  onPlayClick,
  searchResults,
  isShowingResults,
}: {
  searchResults: SearchResults | null;
  onClick: () => void;
  onPlayClick: (t: { url: string }) => void;
  isShowingResults: boolean;
}) => (
  <div
    className={`absolute
      right-0
      mr-14
      p-3
      ${isShowingResults ? "w-1/2" : "w-6"}
      rounded-l
      rounded-b
      bg-secondary
      ${isShowingResults ? "" : "-translate-y-12"}`}
  >
    <ol>
      {searchResults && searchResults.artists.length ? (
        <li>
          <p className="font-bold">Artists</p>
          <ol>
            {searchResults.artists.map((a) => (
              <li key={a.id}>{a.title}</li>
            ))}
          </ol>
        </li>
      ) : null}
      {isShowingResults && !searchResults && "No Results Found"}
      {searchResults && searchResults.albums.length ? (
        <li className="mt-2">
          <p className="font-bold">Albums</p>
          <ol>
            {searchResults.albums.map((a) => (
              <li key={a.id}>
                <a href={a.localUrl} onClick={onClick}>
                  {a.title}
                </a>
              </li>
            ))}
          </ol>
        </li>
      ) : null}
      {searchResults && searchResults.tracks.length ? (
        <li className="mt-2">
          <p className="font-bold">Songs</p>
          <ol>
            {searchResults.tracks.map((t) => (
              <li key={t.id}>
                <a
                  href={t.localUrl}
                  onClick={() => {
                    onClick();
                    onPlayClick({ url: t.url });
                  }}
                >
                  {t.title}
                </a>
              </li>
            ))}
          </ol>
        </li>
      ) : null}
    </ol>
  </div>
);

/** Search button, input, and results display */
const Search = ({
  files,
  playToggle,
}: {
  files: Files;
  playToggle: (t: { url: string }) => void;
}) => {
  const [isSearchInputShowing, setIsSearchInputShowing] =
    useState<boolean>(false);
  const [isShowingResults, setIsShowingResults] = useState<boolean>(false);
  const [searchStr, setSearchStr] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResults | null>(
    null,
  );
  const ref = useRef(null);

  // Handle changing search string
  useEffect(() => {
    if (!searchStr) {
      setSearchResults(null);
      setIsShowingResults(false);
    } else {
      setIsShowingResults(true);
      const searchResults = search(files, searchStr);
      if (
        !searchResults.artists.concat(
          searchResults.albums,
          searchResults.tracks,
        ).length
      ) {
        setSearchResults(null);
      } else {
        setSearchResults(searchResults);
      }
    }
  }, [searchStr, files]);

  /** Clear out results and close results pane */
  const clearAndClose = () => {
    setIsSearchInputShowing(false);
    setIsShowingResults(false);
    setSearchResults(null);
  };

  useClickOutside(ref, clearAndClose);

  return (
    <>
      {isSearchInputShowing ? (
        <div ref={ref}>
          {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
          <label className="input input-bordered flex items-center gap-2 z-10 relative">
            <input
              className="grow"
              onChange={(evt) => setSearchStr(evt.target.value)}
              placeholder="Search"
              type="text"
            />
            <MagnifyingGlassIcon className="size-6" />
          </label>
          <SearchResultsContainer
            isShowingResults={isShowingResults}
            onClick={clearAndClose}
            onPlayClick={playToggle}
            searchResults={searchResults}
          />
        </div>
      ) : (
        <button
          aria-label="search"
          className="btn btn-ghost btn-circle"
          onClick={() => setIsSearchInputShowing(true)}
        >
          <MagnifyingGlassIcon className="size-6" />
        </button>
      )}
    </>
  );
};

export default Search;
