import "dotenv/config";
import fs from "fs";
import express from "express";
import { pipeLine } from "./helper.js";
import { fileURLToPath } from "url";
import cors from "cors";
import path, { dirname } from "path";
import Busboy from "busboy";
import { getFileExtension } from "./conts.js";

global.__filename = fileURLToPath(import.meta.url);
global.__dirname = dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());
app.post("/censor", async (req, res) => {
  try {
    const busboy = Busboy({ headers: req.headers });

    let tempVideoFile;

    busboy.on("file", (fieldname, file, filename) => {
      tempVideoFile = path.resolve(__dirname, "temp", `${Date.now()}.${getFileExtension(filename.mimeType)}`);

      const writeStream = fs.createWriteStream(tempVideoFile);

      file.pipe(writeStream);
    });

    let formData = {};

    busboy.on("field", (fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) => {
      formData = { ...formData, [fieldname]: JSON.parse(val) };
    });

    busboy.on("finish", async () => {
      const filename = await pipeLine({ videoFile: tempVideoFile, words_to_censor: formData.words_to_censor });

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
    const fileName = req.params.video;
    const filePath = path.resolve(__dirname, "temp", fileName);

    console.log(filePath, "filepath");

    if (fs.existsSync(filePath)) {
      res.writeHead(200, { "Content-Type": "video/mp4" });
      const stream = fs.createReadStream(filePath);
      console.log("can read stream");

      stream.pipe(res);
      res.on("finish", () => {
        setTimeout(() => {
          fs.unlinkSync(filePath);
          return res.send("ok")
        }, 500);
      });
    }
  } catch (error) {
    return res.json(error);
  }
});

app.listen(process.env.PORT, () => {
  console.log(`App listing on port ${process.env.PORT}`);
});
