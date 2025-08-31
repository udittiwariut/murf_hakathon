import { DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import cron from "node-cron";
import { client } from "./helper.js";
cron.schedule("*/2 * * * *", async () => {
  console.log("Running S3 cleanup job...");

  try {
    const now = Date.now();
    const cutoff = now - 24 * 60 * 60 * 1000;

    let continuationToken;

    do {
      const list = await client.send(
        new ListObjectsV2Command({
          Bucket: process.env.BUCKET_NAME,
          ContinuationToken: continuationToken,
        })
      );

      if (list.Contents) {
        for (const obj of list.Contents) {
          if (obj.LastModified && obj.LastModified.getTime() < cutoff) {
            console.log(`Deleting ${obj.Key}...`);
            await client.send(
              new DeleteObjectCommand({
                Bucket: process.env.BUCKET_NAME,
                Key: obj.Key,
              })
            );
          }
        }
      }

      continuationToken = list.IsTruncated ? list.NextContinuationToken : null;
    } while (continuationToken);
  } catch (err) {
    console.error("Error in cleanup job:", err);
  }
});
