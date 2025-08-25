import child_process from "child_process";
import fs from "fs";
import path from "path";
import { CURSE_WORDS } from "./conts.js";
import { createClient } from "@deepgram/sdk";

export function extractAudio(videoFile) {
  return child_process.spawn("ffmpeg", ["-i", videoFile, "-vn", "-f", "wav", "pipe:1"]).stdout;
}

export function addBeeps(videoFile, badSegments) {
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

  const args = ["-y", "-i", "pipe:0", "-filter_complex", filterChain, "-map", "[out]", "-f", "wav", "pipe:1"];

  const ffmpegProcess = child_process.spawn("ffmpeg", args);

  extractAudio(videoFile).pipe(ffmpegProcess.stdin);

  return ffmpegProcess.stdout;
}

export async function transcribe(fileStream) {
  try {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

    // const res = await deepgram.listen.prerecorded.transcribeFile(fileStream, {
    //   model: "nova-3",
    //   language: "en",
    // });
    // const jsonData = JSON.stringify(word, null, 2);

    const res = fs.readFileSync("response.json", { encoding: "utf8" });

    // let word = res.result.results.channels[0].alternatives[0].words;

    // fs.writeFileSync("", jsonData, "utf8");

    return JSON.parse(res);
    return word;
  } catch (error) {
    console.log(error.response);
  }
}

export function findBadSegments(segments) {
  return segments.filter((seg) => CURSE_WORDS.some((w) => seg.word.toLowerCase().includes(w)));
}
export function replaceAudio(videoFile, censored_audio_stream) {
  const ffmpeg = child_process.spawn("ffmpeg", [
    "-i",
    videoFile,
    "-i",
    "pipe:0",
    "-c:v",
    "copy",
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-shortest",
    "-movflags",
    "frag_keyframe+empty_moov+default_base_moof",
    "-f",
    "mp4",
    "pipe:1",
  ]);

  ffmpeg.stdin.on("error", (err) => {
    console.error("stdin error:", err.message);
  });

  ffmpeg.stderr.on("data", (data) => {
    console.error("ffmpeg stderr:", data.toString());
  });

  ffmpeg.on("close", (code) => {
    console.log("ffmpeg exited with code", code);
  });

  censored_audio_stream.pipe(ffmpeg.stdin);

  return ffmpeg.stdout;
}

export const pipeLine = async ({ videoFile }) => {
  const pipe1 = extractAudio(videoFile);

  const audio_response = await transcribe(pipe1);

  const badSegments = findBadSegments(audio_response);

  const censored_audio_stream = addBeeps(videoFile, badSegments);

  const finalVideo = replaceAudio(videoFile, censored_audio_stream);

  const output = fs.createWriteStream("output.mp4");
  finalVideo.pipe(output);

  return new Promise((resolve, reject) => {
    output.on("finish", (message) => {
      resolve();
    });
    output.on("error", (error) => {
      console.log(error);
      reject();
    });
  });
};
