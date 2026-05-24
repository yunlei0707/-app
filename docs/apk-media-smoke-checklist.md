# APK Media Smoke Checklist

Use this checklist after every APK build before treating the artifact as releasable.

## Install And Launch

- Install the newly built APK on a real Android device.
- Open the app once, finish any required first-run flow, then fully close and reopen it.
- Confirm the current baby/account is still selected after reopen.

## Add And Persist Media

- Add a photo record from the album or camera.
- Add a video record from the album.
- Add an audio file record.
- Add a recording from the in-app recorder.
- Fully close the app, reopen it, and confirm all four records still appear on the timeline.

## Playback And Preview

- Tap the photo and confirm the full-screen viewer opens.
- Play the video from the timeline and confirm audio/video playback starts.
- Play the audio file and confirm playback starts.
- Play the recording and confirm playback starts.

## Export

- Export a ZIP backup with media included.
- Confirm the success dialog appears.
- Open the public backup/download location in the device file manager.
- Confirm the ZIP file is visible.
- Inspect the ZIP and confirm it includes:
  - `data.json`
  - `data.js`
  - `photos/`
  - `audios/`
  - `videos/`

## Import

- Clear app data or install the APK on a second device.
- Import the ZIP backup.
- Confirm timeline records are restored.
- Confirm imported photos display.
- Confirm imported video, audio, and recording files play.

## Recycle Bin

- Delete one media record to the recycle bin.
- Confirm it appears in the recycle bin.
- Restore it and confirm it returns to the timeline.
- Delete it again, permanently delete it from the recycle bin, and confirm it no longer appears.

## Fail Criteria

Treat the APK as not releasable if any item below occurs:

- A saved media record disappears after app restart.
- Any exported ZIP is missing a referenced media file.
- Imported media shows as blank or cannot play.
- Recycle bin actions appear to work in the UI but revert after restart.
- The backup ZIP cannot be found in public storage after export.
