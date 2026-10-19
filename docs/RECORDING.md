# Screen-recording checklist

The assignment marks the submission **invalid** if any of these is missing:

1. **In progress:** the models are visibly playing (cubes turning, timers running, "thinking…/deciding…").
2. **Completion:** every card shows its final status (SOLVED ✓ / RAN OUT OF MOVES / OUT OF TIME) and its rank.
3. **Final slide:** the video ends on the **Results Slide** tab, which shows the section-3 statistics.
4. **Name and roll number on screen for the entire video.** The yellow identity badge in the top bar is on every tab, and the slide shows it too. Before you record, set `ROLL_NO` in `.env` and restart the backend.

## Setup

- Tool: OBS Studio (free). Use a *Window Capture* of the browser, 1920×1080 canvas, 30 fps.
- Browser at 100% zoom, full screen (F11), with the app at `http://localhost:8000` in **Live** mode. The yellow MOCK banner must **not** be visible.
- Optional backup: add an OBS *Text* source with "Yesaullah Sheikh · Roll No …" in a corner, so your identity is visible even if the window changes.

## Suggested script (about 2–3 minutes)

1. 0:00: the Race tab, with your identity badge visible. Briefly show the puzzle picker and the scramble.
2. Click **Run Race** on a primary puzzle (live). Let it play: the decision models finish fast and Opus keeps thinking. *(In-progress stage.)*
   - If the live race is long, you can instead **Replay** a saved live race at 2.5×. The replay uses the real logged timings, and the speed badge shows "2.5× replay".
3. Wait until all four cards are finished and ranked. *(Completion stage.)*
4. Open **Benchmark Dashboard** and scroll through the table and charts (optional but good).
5. End on **Results Slide** (Primary set) for about 5 seconds. *(Final slide.)*

## Export and size

GitHub rejects files over 100 MB and warns above 50 MB. Compress the recording:

```bash
ffmpeg -i raw.mkv -vf scale=1920:-2 -c:v libx264 -crf 28 -preset slow -c:a aac -b:a 96k media/demo.mp4
```

Then make a thumbnail for the README:

```bash
ffmpeg -ss 00:00:20 -i media/demo.mp4 -frames:v 1 docs/demo-thumbnail.png
```
