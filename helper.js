import child_process from "child_process";
import path from "path";
import { CURSE_WORDS } from "./conts.js";




export function addBeeps(inputFile, outputFile, badSegments) {
  return new Promise((resolve, reject) => {
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

    const args = ["-y", "-i", inputFile, "-filter_complex", filterChain, "-map", "[out]", outputFile];

    const ffmpegProcess = child_process.spawn("ffmpeg", args);

    ffmpegProcess.on("close", (code) => {
      if (code == 0) resolve(code);
      else reject();
    });
  });
}

export function replaceAudio(videoFile, audioFile, outputFile) {
  return new Promise((resolve, reject) => {
    const ffmpeg = child_process.spawn("ffmpeg", [
      "-i",
      videoFile,
      "-i",
      audioFile,
      "-c:v",
      "copy",
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-shortest",
      outputFile,
    ]);

    ffmpeg.on("close", (code) => {
      if (code === 0) resolve(outputFile);
      else reject(new Error("FFmpeg failed"));
    });
  });
}

export async function extractAudio(videoFile, audioFile) {
  return new Promise((resolve, reject) => {
    const ffmpeg = child_process.spawn("ffmpeg", ["-i", videoFile, "-vn", "-acodec", "copy", audioFile]);

    ffmpeg.on("close", (code) => {
      if (code === 0) resolve(outputFile);
      else reject(new Error("FFmpeg failed"));
    });
  });
}

export async function transcribe(audioFile) {
  try {
    const filePath = path.join(__dirname, audioFile);

    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

    const fileStream = fs.createReadStream(path.resolve(__dirname, filePath));
    const res = await deepgram.listen.prerecorded.transcribeFile(fileStream, {
      model: "nova-3",
      language: "en",
    });

    const jsonData = JSON.stringify(res, null, 2);

    fs.writeFileSync("response.json", jsonData, "utf8");
  } catch (error) {
    console.log(error.response);
  }
}

export function findBadSegments(segments) {
  return segments.filter((seg) => CURSE_WORDS.some((w) => seg.word.toLowerCase().includes(w)));
}


