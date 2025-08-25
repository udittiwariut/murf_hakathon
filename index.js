import fs from "fs";
import "dotenv/config";
import { addBeeps, replaceAudio, extractAudio, transcribe, findBadSegments } from "./helper.js";
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

  console.log("extracting audio...");

  await extractAudio(videoFile, audioFile);

  console.log("transcribe...");

  await transcribe(audioFile);

  const audio_response = JSON.parse(fs.readFileSync("./response.json", "utf-8"));

  const words = audio_response.result.results.channels[0].alternatives[0].words;

  const badSegments = findBadSegments(words);

  console.log("adding beep...");

  await addBeeps(audioFile, censoredAudio, badSegments);

  console.log("replacing audio...");

  await replaceAudio(videoFile, censoredAudio, outputVideo);
})();
