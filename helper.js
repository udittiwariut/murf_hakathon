import child_process from "child_process";
import fs from "fs";
import path from "path";
import { createClient } from "@deepgram/sdk";
import { CURSE_WORDS } from "./conts.js";

export async function extractAudio(videoFile) {
  return new Promise((resolve, reject) => {
    const fileName = path.resolve(__dirname, "temp", `${Date.now()}.mp3`);

    const ffmpeg = child_process.spawn("ffmpeg", ["-i", videoFile, "-vn", "-y", fileName]);

    // ffmpeg.stdin.on("error", (err) => {
    //   console.error("stdin error:", err.message);
    // });

    // ffmpeg.stderr.on("data", (data) => {
    //   console.error("ffmpeg stderr:", data.toString());
    // });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve(fileName);
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
  });
}

export function addBeeps(audioFile, badSegments) {
  return new Promise((resolve, reject) => {
    const fileName = path.resolve(__dirname, "temp", `${Date.now()}.mp3`);

    let mainAudio = [];
    let beep_creation = [];
    let beep_play = [];
    let beep_output = [];

    badSegments.forEach(({ start, end }, i) => {
      let duration = end - start;
      mainAudio.push(`between(t,${start},${end})`);
      beep_creation.push(`sine=frequency=1000:duration=${duration}[beep${i + 1}]`);
      beep_play.push(`[beep${i + 1}]adelay=${start * 1000}|${start * 1000}[b${i + 1}]`);
      beep_output.push(`[b${i + 1}]`);
    });

    const muteExpr = mainAudio.join("+");
    const filterChain = `[0:a]volume=enable='${muteExpr}':volume=0[aud];
                       ${beep_creation.join(";")};
                       ${beep_play.join(";")};
                       [aud]${beep_output.join("")}amix=inputs=${
      beep_output.length + 1
    }:duration=longest:normalize=0[out]`;

    const args = ["-y", "-i", audioFile, "-filter_complex", filterChain, "-map", "[out]", "-f", "wav", fileName];

    const ffmpeg = child_process.spawn("ffmpeg", args);

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve(fileName);
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
  });
}

export async function transcribe(audioFile) {
  try {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

    const res = await deepgram.listen.prerecorded.transcribeFile(fs.createReadStream(audioFile), {
      model: "nova-3",
      language: "en",
    });

    let word = res.result.results.channels[0].alternatives[0].words;

    return word;

    // From Local File
    // const jsonData = JSON.stringify(word, null, 2);

    // const res = fs.readFileSync("response.json", { encoding: "utf8" });

    // fs.writeFileSync("", jsonData, "utf8");

    // return JSON.parse(res);
  } catch (error) {
    console.log(error.response);
  }
}

export function findBadSegments(segments, words) {
  return segments.filter((seg) => words.some((w) => seg.word.toLowerCase().includes(w)));
}
export function replaceAudio(videoFile, censored_audio, audioFile) {
  return new Promise((resolve, reject) => {
    const fileName = `${Date.now()}.mp4`;
    const filePath = path.resolve(__dirname, "temp", fileName);

    const ffmpeg = child_process.spawn("ffmpeg", [
      "-i",
      videoFile,
      "-i",
      censored_audio,
      "-c:v",
      "copy",
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-shortest",
      "-f",
      "mp4",
      filePath,
    ]);

    ffmpeg.stdin.on("error", (err) => {
      console.error("stdin error:", err.message);
    });

    ffmpeg.on("close", (code) => {
      fs.unlinkSync(audioFile);
      fs.unlinkSync(censored_audio);
      fs.unlinkSync(videoFile);
      if (code == 0) resolve(fileName);
      reject("Unable to process the video");
    });
  });
}

export const pipeLine = async ({ videoFile, words_to_censor = CURSE_WORDS }) => {
  const audioFile = await extractAudio(videoFile);

  const audio_response = await transcribe(audioFile);

  const badSegments = findBadSegments(audio_response, words_to_censor);

  const censored_audio = await addBeeps(audioFile, badSegments);

  return replaceAudio(videoFile, censored_audio, audioFile);
};
