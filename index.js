import "dotenv/config";
import fs from "fs";
import express from "express";
import { pipeLine, transcribe } from "./helper.js";
import { fileURLToPath } from "url";
import cors from "cors";
import path, { dirname } from "path";
import Busboy from "busboy";
import { getFileExtension } from "./conts.js";
import { createClient } from "@deepgram/sdk";

global.__filename = fileURLToPath(import.meta.url);
global.__dirname = dirname(__filename);

const app = express();

const cleanupTimers = {};

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

app.get("/stream/:video", (req, res) => {
  const fileName = req.params.video;
  const filePath = path.resolve(__dirname, "temp", fileName);

  fs.stat(filePath, (err, stats) => {
    if (err) {
      console.error("File not found:", err);
      return res.sendStatus(404);
    }

    const range = req.headers.range;
    if (!range) {
      res.writeHead(200, {
        "Content-Length": stats.size,
        "Content-Type": "video/mp4",
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    const CHUNK_SIZE = 1 * 1e6;
    const start = Number(range.replace(/\D/g, ""));
    const end = Math.min(start + CHUNK_SIZE, stats.size - 1);

    const contentLength = end - start + 1;
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${stats.size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": contentLength,
      "Content-Type": "video/mp4",
    });

    fs.createReadStream(filePath, { start, end }).pipe(res);

    res.on("finish", () => {
      if (cleanupTimers[filePath]) {
        clearTimeout(cleanupTimers[filePath]);
      }
      cleanupTimers[filePath] = setTimeout(() => {
        fs.unlink(filePath, (err) => {
          if (err) console.error("Error deleting file:", err);
          else console.log("File deleted:", filePath);
        });

        delete cleanupTimers[filePath];
      }, 60 * 1000);
    });
  });
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
  console.log(`App listing on port ${process.env.PORT}`);
});
