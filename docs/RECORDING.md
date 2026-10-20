# Screen-recording checklist

The assignment marks the submission **invalid** if any of these is missing:

1. **In progress:** the models are visibly playing (cubes turning, timers running, "Reasoning about the next move" / "Choosing the next move").
2. **Completion:** every lane shows its final status (Solved / Not solved: used all 30 moves / game time limit reached) and its rank.
3. **Final slide:** the video ends on the **Results slide** tab, which shows the section-3 statistics.
4. **Name and roll number on screen for the entire video.** The dark identity block (Yesaullah Sheikh, Roll no. 23K-0019) sits in the top bar on every tab, and the slide repeats it.

## Setup

- Recorder: OBS Studio (free, *Window Capture* of the browser, 1920×1080, 30 fps), or Windows' built-in Xbox Game Bar (`Win + Alt + R` records the active window).
- Browser: open `http://localhost:8000` at 100% zoom, maximised or full screen (F11). Close other tabs and notifications.
- In the top-right switch, choose **Live**. The yellow "Mock mode" banner must **not** be visible.

## Script (about 2½ minutes)

The race is a **replay** of a real benchmark race (`primary-09`, the one Opus solved). It uses the logged moves and timings, so it costs nothing, and the header says "Replaying at 2.5× the recorded speed", which keeps it honest.

1. **Race tab (about 5 s):** show the page with your name and roll number in the top bar.
2. **Start the replay:** in **Replay**, pick `primary-09`, set the speed to **2.5×**, and click **Replay**.
3. **In-progress stage (about 30 s):** let the cubes turn. The decision models move fast; Opus shows "Reasoning about the next move".
4. **Keep it running:** the decision models finish within about 20 s of video. Opus solves at about 1:33.
5. **Completion stage (about 5 s):** hold on the finished lanes, with ranks (1st to 4th), "Solved in 12 moves", the "Not solved" lanes and the Final standings.
6. **Benchmark results tab (about 20 s):** scroll slowly through the findings, charts, *All metrics* table and *Every trial*.
7. **Results slide tab (at least 5 s):** with **Primary** selected, end the recording here.

## Export and size

GitHub rejects files over 100 MB and warns above 50 MB. Compress the recording (needs ffmpeg: `winget install Gyan.FFmpeg`):

```bash
ffmpeg -i raw.mp4 -vf scale=1920:-2 -c:v libx264 -crf 28 -preset slow -c:a aac -b:a 96k media/demo.mp4
```

Then make a thumbnail for the README:

```bash
ffmpeg -ss 00:00:20 -i media/demo.mp4 -frames:v 1 docs/demo-thumbnail.png
```
