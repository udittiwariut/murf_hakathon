import "dotenv/config";
import fs from "fs";
import express from "express";
import { pipeLine } from "./helper.js";
import { fileURLToPath } from "url";
import path, { dirname } from "path";
import Busboy from "busboy";
import { getFileExtension } from "./conts.js";

global.__filename = fileURLToPath(import.meta.url);
global.__dirname = dirname(__filename);

const app = express();

app.post("/censor", async (req, res) => {
  try {
    const busboy = Busboy({ headers: req.headers });

    let tempVideoFile;

    busboy.on("file", (fieldname, file, filename) => {
      tempVideoFile = path.resolve(__dirname, "temp", `${Date.now()}.${getFileExtension(filename.mimeType)}`);

      const writeStream = fs.createWriteStream(tempVideoFile);

      file.pipe(writeStream);
    });

    busboy.on("finish", async () => {
      await pipeLine({ videoFile: tempVideoFile, res });
    });

    return req.pipe(busboy);
  } catch {
    console.error(error);
    res.status(500).send("Error processing video");
  }
});

app.get("/del", async (req, res) => {
  fs.unlink(tempVideoFile, (err) => {
    if (err) console.log(err);
    else console.log("removed");
  });
});

app.listen(8080, () => {
  console.log(`App listing on port 8080`);
});
