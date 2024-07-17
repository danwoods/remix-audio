/** @file Main content to display when at "/" */
import type { Context } from "../root";

import ArtistAlbumTrackNavList from "~/components/ArtistAlbumTrackNavList";
import { useOutletContext } from "@remix-run/react";

/** Default (/) content */
const Index = () => {
  const { files, playToggle } = useOutletContext<Context>();

  if (files) {
    return <ArtistAlbumTrackNavList files={files} playToggle={playToggle} />;
  } else {
    return <div>Upload some music!</div>;
  }
};

export default Index;
