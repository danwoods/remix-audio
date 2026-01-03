/** @file Standalone registration file for custom elements
 *  This can be imported directly in HTML or built with Deno bundle
 */

import "./AlbumHeader/album-header-custom-element.ts";
import "./AlbumImage/album-image-custom-element.ts";
import "./Layout/PlayerControls/player-controls-custom-element.ts";
import "./Layout/PlayerControls/track-info-custom-element.ts";
import "./Tracklist/tracklist-item-custom-element.ts";
import "../icons/play/index.ts";
import "../icons/pause/index.ts";
// The custom elements are registered when the modules above are imported
// This file serves as a convenient entry point for standalone usage
