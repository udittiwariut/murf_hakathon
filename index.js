import fs from "fs";
import "dotenv/config";
import { pipeLine } from "./helper.js";
import { fileURLToPath } from "url";
import { dirname } from "path";
// import busboy from "busboy";

global.__filename = fileURLToPath(import.meta.url);
global.__dirname = dirname(__filename);

(async () => {
  const videoFile = "./original.mp4";
  const audioFile = "original_audio.mp3";
  const censoredAudio = "censored_audio.mp3";
  const outputVideo = "output.mp4";

  await pipeLine({ videoFile });

  process.exit();
})();
