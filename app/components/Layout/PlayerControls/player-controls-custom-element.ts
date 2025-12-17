/** @file Custom element for player controls seen at the bottom of the screen */

import { getBucketContents } from "../../../../lib/s3.ts";

/**
 * Given a track's URL, pull data from it to determine the track's artist, album, and number
 */
const getParentDataFromTrackUrl = (trackUrl: string | null) => {
  if (!trackUrl) {
    return {
      artistName: null,
      albumName: null,
      trackName: null,
      trackNumber: null,
    };
  }

  const currentTrackPieces = trackUrl.split("/");
  const artistName = currentTrackPieces[currentTrackPieces.length - 3];
  const albumName = currentTrackPieces[currentTrackPieces.length - 2];
  const trackPieces = currentTrackPieces[currentTrackPieces.length - 1].split(
    "__",
  );
  const trackName = trackPieces && trackPieces[1];
  const trackNumber = trackPieces && trackPieces[0];

  return {
    artistName,
    albumName,
    trackName,
    trackNumber,
  };
};

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Get remaining tracks in album after current track
 */
const getRemainingAlbumTracks = async (
  albumUrl: string,
  currentTrackUrl: string,
): Promise<Array<{ url: string; title: string; trackNum: number }>> => {
  const { artistName, albumName } = getParentDataFromTrackUrl(currentTrackUrl);
  if (!artistName || !albumName) {
    return [];
  }

  const albumUrlParts = albumUrl.split("/");
  const bucketUrl = albumUrlParts.join("/");
  const prefix = `${artistName}/${albumName}/`;
  const contents = (await getBucketContents(bucketUrl, prefix)).filter(
    (key): key is string => key !== null && key !== undefined,
  );

  const currentTrackPieces = currentTrackUrl.split("/");
  const currentTrackKey = currentTrackPieces[currentTrackPieces.length - 1];
  const currentTrackIndex = contents.findIndex((key) => {
    // Extract filename from full key path for comparison
    const keyFilename = key.split("/").pop();
    return keyFilename === currentTrackKey;
  });

  if (currentTrackIndex === -1) {
    return [];
  }

  const remainingKeys = contents.slice(currentTrackIndex + 1);
  const tracks = remainingKeys.map((key) => {
    // Extract filename from full key path
    const filename = key.split("/").pop() || key;
    const trackPieces = filename.split("__");
    const trackNum = parseInt(trackPieces[0], 10) || 0;
    const title = trackPieces[1] || filename;
    const fullUrl = `${bucketUrl}/${key}`;

    return {
      url: fullUrl,
      title,
      trackNum,
    };
  });

  return tracks.sort((a, b) => a.trackNum - b.trackNum);
};

/**
 * Custom element for player controls
 */
export class PlayerControlsCustomElement extends HTMLElement {
  static observedAttributes = [
    "data-current-track-url",
    "data-is-playing",
    "data-album-url",
  ];

  private currentTrackUrl: string | null = null;
  private isPlaying: boolean = false;
  private albumUrl: string | null = null;
  private remainingTracks: Array<{
    url: string;
    title: string;
    trackNum: number;
  }> = [];

  constructor() {
    super();
  }

  connectedCallback() {
    this.updateAttributes();
    this.render();
  }

  disconnectedCallback() {
    // Cleanup if needed
  }

  attributeChangedCallback(
    name: string,
    _oldValue: string | null,
    _newValue: string | null,
  ) {
    if (name === "data-current-track-url") {
      this.currentTrackUrl = _newValue;
      // this.loadRemainingTracks();
      console.log({ currentTrackUrl: this.currentTrackUrl });
    } else if (name === "data-is-playing") {
      this.isPlaying = _newValue === "true";
    } else if (name === "data-album-url") {
      this.albumUrl = _newValue;
      // this.loadRemainingTracks();
      console.log({ albumUrl: this.albumUrl });
    }

    this.render();
  }

  private updateAttributes() {
    this.currentTrackUrl = this.getAttribute("data-current-track-url");
    this.isPlaying = this.getAttribute("data-is-playing") === "true";
    this.albumUrl = this.getAttribute("data-album-url");
    this.loadRemainingTracks();
  }

  private async loadRemainingTracks() {
    if (this.albumUrl && this.currentTrackUrl) {
      this.remainingTracks = await getRemainingAlbumTracks(
        this.albumUrl,
        this.currentTrackUrl,
      );
      this.render();
    } else {
      this.remainingTracks = [];
    }
  }

  private dispatchPlayerToggle(trackUrl: string) {
    const event = new CustomEvent("player-toggle", {
      detail: { url: trackUrl },
      bubbles: true,
      cancelable: true,
    });
    this.dispatchEvent(event);
  }

  private dispatchPlayerNext() {
    const event = new CustomEvent("player-next", {
      bubbles: true,
      cancelable: true,
    });
    this.dispatchEvent(event);
  }

  private render() {
    const { artistName, albumName, trackName } = getParentDataFromTrackUrl(
      this.currentTrackUrl,
    );
    const scrollingText = artistName && albumName
      ? `${albumName}, ${artistName}`
      : null;

    // Determine visibility class
    const visibilityClass = !this.currentTrackUrl ? "translate-y-full" : "";

    // Play/Pause icon SVG
    let playPauseIcon = "";
    if (!this.currentTrackUrl) {
      playPauseIcon =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
        <path fill-rule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.285L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clip-rule="evenodd" />
      </svg>`;
    } else if (!this.isPlaying) {
      playPauseIcon =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6 animate-pulse">
        <path fill-rule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.285L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clip-rule="evenodd" />
      </svg>`;
    } else {
      playPauseIcon =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-8">
        <path fill-rule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0A.75.75 0 0 1 15 4.5h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z" clip-rule="evenodd" />
      </svg>`;
    }

    // Album art element - construct full album URL from base URL and artist/album
    // const fullAlbumUrl =
    //   this.albumUrl && artistName && albumName
    //     ? `${this.albumUrl}/${artistName}/${albumName}`
    //     : null;
    const albumArtElement = this.albumUrl
      ? `<album-image-custom-element data-album-url="${
        escapeHtml(this.albumUrl)
      }" style="width: 80px; height: 80px; border-radius: 8px;"></album-image-custom-element>`
      : `<img alt="album art" src="https://placehold.co/100x100?text=." class="rounded z-10 size-20" />`;

    // Track name
    const trackNameHtml = trackName
      ? `<p class="text-base font-bold">${escapeHtml(trackName)}</p>`
      : "";

    // Scrolling text
    const scrollingTextHtml = scrollingText
      ? `
        <p class="marquee pr-6 md:animate-none">
          <span class="text-sm text-nowrap">${escapeHtml(scrollingText)}</span>
        </p>
        <p class="md:hidden marquee2 pr-6">
          <span class="text-sm text-nowrap">${escapeHtml(scrollingText)}</span>
        </p>
      `
      : "";

    // Playlist dropdown
    const playlistItems = this.remainingTracks
      .map(
        (track) => `
      <li>
        <button class="py-1 w-full flex justify-between px-0" data-track-url="${
          escapeHtml(track.url)
        }">
          ${escapeHtml(track.title)}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
            <path fill-rule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.285L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clip-rule="evenodd" />
          </svg>
        </button>
      </li>
    `,
      )
      .join("");

    const playlistHtml = `
      <div class="dropdown dropdown-top dropdown-end cursor-default">
        <button class="btn btn-xs btn-square mr-6 ${
      !this.remainingTracks.length ? "btn-disabled" : ""
    }">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
            <path d="M5.507 4.048A3 3 0 0 1 7.785 3h8.43a3 3 0 0 1 2.278 1.048l1.722 2.008A4.533 4.533 0 0 1 19.5 6.166v11.668a4.533 4.533 0 0 1-1.285 3.11l-1.722 2.008A3 3 0 0 1 16.215 21H7.785a3 3 0 0 1-2.278-1.048l-1.722-2.008A4.533 4.533 0 0 1 2.5 17.834V6.166a4.533 4.533 0 0 1 1.285-3.11l1.722-2.008Z" />
            <path fill-rule="evenodd" d="M6.75 8.25a.75.75 0 0 1 .75-.75h9a.75.75 0 0 1 0 1.5h-9a.75.75 0 0 1-.75-.75Zm0 3a.75.75 0 0 1 .75-.75h9a.75.75 0 0 1 0 1.5h-9a.75.75 0 0 1-.75-.75Zm0 3a.75.75 0 0 1 .75-.75h9a.75.75 0 0 1 0 1.5h-9a.75.75 0 0 1-.75-.75Z" clip-rule="evenodd" />
          </svg>
        </button>
        <ol class="dropdown-content menu bg-primary rounded-box z-[1] w-52 p-2 shadow divide-y divide-solid">
          ${playlistItems}
        </ol>
      </div>
    `;

    this.innerHTML = `
      <div class="btm-nav btm-nav-md bg-base-100 z-10 h-fit justify-between transition-transform ${visibilityClass}">
        <div class="max-sm:basis-3/5 lg:basis-5/12 overflow-x-clip items-start">
          <div class="flex cursor-default">
            ${albumArtElement}
            <div class="ml-3 pt-2">
              ${trackNameHtml}
              <div class="flex items-center">
                ${scrollingTextHtml}
              </div>
            </div>
          </div>
        </div>
        <div class="basis-2/5">
          <div class="flex justify-evenly w-full cursor-default">
            <button class="max-sm:hidden">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
                <path d="M9.195 18.44c1.25.714 2.805-.189 2.805-1.628v-4.084l5.391 3.584c1.25.714 2.805-.188 2.805-1.628V7.284c0-1.44-1.555-2.342-2.805-1.628L12 9.23V5.153c0-1.44-1.555-2.343-2.805-1.629l-7.5 4.27a1.875 1.875 0 0 0 0 3.212l7.5 4.27Z" />
              </svg>
            </button>
            <button class="md:px-6" data-play-toggle>
              ${playPauseIcon}
            </button>
            <button data-play-next>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
                <path fill-rule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.285L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
        <div class="max-sm:basis-1/5 max-sm:hidden lg:basis-5/12 items-end">
          ${playlistHtml}
        </div>
      </div>
    `;

    // Attach event listeners
    this.attachEventListeners();
  }

  private attachEventListeners() {
    // Play/Pause button
    const playToggleBtn = this.querySelector("[data-play-toggle]");
    if (playToggleBtn) {
      playToggleBtn.addEventListener("click", () => {
        if (this.currentTrackUrl) {
          this.dispatchPlayerToggle(this.currentTrackUrl);
        }
      });
    }

    // Play Next button
    const playNextBtn = this.querySelector("[data-play-next]");
    if (playNextBtn) {
      playNextBtn.addEventListener("click", () => {
        this.dispatchPlayerNext();
      });
    }

    // Playlist items
    const playlistButtons = this.querySelectorAll("[data-track-url]");
    playlistButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const trackUrl = btn.getAttribute("data-track-url");
        if (trackUrl) {
          this.dispatchPlayerToggle(trackUrl);
        }
      });
    });
  }
}

customElements.define(
  "player-controls-custom-element",
  PlayerControlsCustomElement,
);
