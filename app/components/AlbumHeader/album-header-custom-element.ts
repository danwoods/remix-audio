/** @file Custom element for the header on an album page. */
/**
 * Custom element for the header on an album page.
 */
export class AlbumHeaderCustomElement extends HTMLElement {
  static observedAttributes = ["data-album-id"];

  constructor() {
    // Always call super first in constructor
    super();

    const [artistId, albumId] =
      this.getAttribute("data-album-id")?.split("/") || [];
    if (!artistId || !albumId) {
      throw new Error("Artist ID and album ID are required");
    }

    this.innerHTML = `
      <header class="album-header" id="albumHeader">
        <div class="album-content">
          <div class="album-art">🎵</div>
          <div class="album-info">
            <span class="album-label">Album</span>
            <h1 class="album-title">${albumId}</h1>
            <p class="album-artist">${artistId}</p>
            <p class="album-meta">2024 • 12 songs • 48 min</p>
          </div>
        </div>
      </header>
      `;
  }

  connectedCallback() {
    console.log("Custom element added to page.");

    // Scroll handling with Intersection Observer for efficiency
    const sentinel = document.createElement("div");
    sentinel.style.height = "1px";
    sentinel.style.position = "absolute";
    sentinel.style.top = "60px"; // Trigger point
    sentinel.style.left = "0";
    sentinel.style.right = "0";
    sentinel.style.pointerEvents = "none";
    document.body.insertBefore(sentinel, this);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const header = this.querySelector(".album-header");
          // When sentinel is NOT intersecting (scrolled past), shrink header
          if (!entry.isIntersecting) {
            header?.classList.add("shrunk");
          } else {
            header?.classList.remove("shrunk");
          }
        });
      },
      {
        threshold: 0,
        rootMargin: "0px",
      },
    );

    observer.observe(sentinel);
  }

  disconnectedCallback() {
    console.log("Custom element removed from page.");
  }

  connectedMoveCallback() {
    console.log("Custom element moved with moveBefore()");
  }

  adoptedCallback() {
    console.log("Custom element moved to new page.");
  }

  attributeChangedCallback(
    name: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _oldValue: string | null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _newValue: string | null,
  ) {
    console.log(`Attribute ${name} has changed.`);
  }
}

customElements.define("album-header-custom-element", AlbumHeaderCustomElement);
