import type { Files } from "../../util/files.ts";
import albumTileHtml from "../AlbumTile/album-tile-html.ts";
import horizontalRowWithTitleHtml from "../HorizontalRowWithTitle/horizontal-row-with-title-html.ts";

/** Props for the album row with title HTML function */
export interface AlbumRowWithTitleProps {
  albumIds: { id: string }[];
  files: Files;
  title: string;
}

/** Single row on homepage */
export default async function albumRowWithTitleHtml(
  props: AlbumRowWithTitleProps,
): Promise<string> {
  const { albumIds, files, title } = props;

  const children = await Promise.all(
    albumIds.map((a) => albumTileHtml({ albumId: a.id, files })),
  );
  return horizontalRowWithTitleHtml({ title, children });
}
