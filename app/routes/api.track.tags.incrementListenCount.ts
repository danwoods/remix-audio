import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { getTags, setTags } from "../util/s3.server";

/** Increment a track's `listenCount` metadata */
export async function action({ request }: ActionFunctionArgs) {
  const { trackUrl } = await request.json();
  const trackKey = trackUrl.replace(
    `https://${process.env.STORAGE_BUCKET}.s3.${process.env.STORAGE_REGION}.amazonaws.com/`,
    "",
  );
  const { TagSet } = await getTags(trackKey);
  const listenCountTag = TagSet?.find((t) => t.Key === "listenCount");
  let listenCount =
    (listenCountTag?.Value && Number(listenCountTag.Value)) || 0;

  listenCount += 1;

  await setTags(trackKey, [{ Key: "listenCount", Value: String(listenCount) }]);

  return json({ ok: true });
}
