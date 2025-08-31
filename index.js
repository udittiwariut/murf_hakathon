import "dotenv/config";
import fs from "fs";
import express from "express";
import { client, pipeLine, transcribe } from "./helper.js";
import { fileURLToPath } from "url";
import cors from "cors";
import path, { dirname } from "path";
import Busboy from "busboy";
import { FOLDER_NAME, getFileExtension } from "./conts.js";
import { createClient } from "@deepgram/sdk";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import "./cone.js";

global.__filename = fileURLToPath(import.meta.url);
global.__dirname = dirname(__filename);

const app = express();

app.use(cors());

app.use(express.json());


app.post("/censor", async (req, res) => {
  try {
    const busboy = Busboy({ headers: req.headers });

    let tempVideoFile;

    let fileId;
    busboy.on("file", (fieldname, file, fileInfo) => {
      tempVideoFile = path.resolve(__dirname, "temp", `${Date.now()}.${getFileExtension(fileInfo.mimeType)}`);

      const writeStream = fs.createWriteStream(tempVideoFile);
      fileId = fileInfo.filename;
      file.pipe(writeStream);
    });

    let formData = {};

    busboy.on("field", (fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) => {
      formData = { ...formData, [fieldname]: JSON.parse(val) };
    });

    busboy.on("finish", async () => {
      const filename = await pipeLine({
        videoFile: tempVideoFile,
        words_to_censor: formData.words_to_censor,
        fileId,
      });

      return res.status(200).json({ fileName: filename });
    });

    return req.pipe(busboy);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error processing video");
  }
});

app.get("/stream/:video", async (req, res) => {
  try {
    const fileName = `${FOLDER_NAME.videos}/${req.params.video}`;

    const range = req.headers.range;
    const head = await client.send(new HeadObjectCommand({ Bucket: process.env.BUCKET_NAME, Key: fileName }));
    const fileSize = head.ContentLength;
    if (!range) {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": "video/mp4",
      });
      const fullVideo = await client.send(new GetObjectCommand({ Bucket: process.env.BUCKET_NAME, Key: fileName }));
      fullVideo.Body.pipe(res);
      return;
    }

    const CHUNK_SIZE = 1 * 1e6;
    const start = Number(range.replace(/\D/g, ""));
    const end = Math.min(start + CHUNK_SIZE, fileSize - 1);

    const contentLength = end - start + 1;
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": contentLength,
      "Content-Type": "video/mp4",
    });

    const videoPart = await client.send(
      new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: fileName,
        Range: `bytes=${start}-${end}`,
      })
    );

    videoPart.Body.pipe(res);
  } catch (error) {
    console.error("Streaming error:", error);
    res.sendStatus(500);
  }
});

app.post("/get-transcript", (req, res) => {
  try {
    const busboy = Busboy({ headers: req.headers });
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

    let p = [];

    busboy.on("file", (fieldname, file, fileInfo) => {
      const chunks = [];

      file.on("data", (data) => {
        chunks.push(data);
      });

      file.on("end", () => {
        try {
          const buffer = Buffer.concat(chunks);
          p.push(transcribe(deepgram, buffer, fileInfo.filename));
        } catch (err) {
          console.error("Transcription failed:", err);
          return res.status(500).json({ error: "Transcription failed" });
        }
      });
    });

    busboy.on("close", async () => {
      try {
        const results = await Promise.all(p);
        res.json(results);
      } catch (error) {
        res.status(400).json({ error: "No transcript generated" });
      }
    });

    return req.pipe(busboy);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error processing video");
  }
});

app.listen(process.env.PORT, () => {
  let tempDir = path.resolve(__dirname, "temp");
  fs.readdir(tempDir, (err, files) => {
    if (err) throw err;

    for (const file of files) {
      fs.unlink(path.join(tempDir, file), (err) => {
        if (err) throw err;
      });
    }
  });
  console.log(`App listing on port ${process.env.PORT}`);
});
