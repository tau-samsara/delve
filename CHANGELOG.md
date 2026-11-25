# Changelog

What changed in each Delve version, newest first. Also shown in the Delve menu.

## 0.36.1 - 2026-11-24
- Extended guide: the toolbar shows how much of the schedule is loaded, for example "Mon 9:00 PM – Wed 9:00 PM", and the label grows as more days load.

## 0.36.0 - 2026-11-24
- Added What's new: a button in the menu footer opens this changelog in a popup.

## 0.35.3 - 2026-11-24
- Extended guide: channel watch counts and the header total are copied from the site's rows as they load and change, so they no longer go missing after a reload.

## 0.35.2 - 2026-11-24
- Added Watcher count: total watchers as a badge right of the header clock and a card on the home page (Guide switch, off by default).

## 0.35.1 - 2026-11-24
- Theater mode stays on when the channel changes.
- Theater mode: the exit button and key row stay above bumpers and the tuning screen; the exit button shows while no picture is up.

## 0.35.0 - 2026-11-24
- Added Tag tooltips: hover text on the guide's REWIND tag (Guide switch, off by default).

## 0.34.9 - 2026-11-24
- Leveling holds its gain below -45 LUFS so quiet scenes are not pushed to max boost.
- Added Hiss reduction (6 kHz high-shelf, -6 dB) to the Audio popup.

## 0.34.8 - 2026-11-24
- Fixed tall buttons in the Audio, Picture, Hide and Watermark popups.

## 0.34.6 - 2026-11-24
- Drawer: Layout, Guide and Player expanders (state remembered), one-line rows, pinned header and footer, Reset all settings, and a popup-style frame flush with the window.

## 0.34.4 - 2026-11-24
- Picture tweaks: Width and Height scale; Zoom goes down to 50%.
- Lights-out merged into Theater, whose key row now overlays the picture and slides away when idle.

## 0.34.3 - 2026-11-24
- Picture tweaks: added Saturation, Dim, Zoom, Left/right and Up/down alignment, Crop with Fill/Fit, and Lights-out.

## 0.34.2 - 2026-11-24
- Watermark: opacity runs 1% to 20% in 1% steps; saved values above 20 load as 20.

## 0.34.1 - 2026-11-24
- Watermark: B&W removes the logo background and draws the rest in stepped grays.

## 0.34.0 - 2026-11-24
- Added Watermark: WATERMARK popup with On/Off, Size, Opacity, Corner and Logo (Original, B&W).

## 0.33.4 - 2026-11-23
- Added Hide options: HIDE popup with Off, Both, Comments and Reactions.

## 0.33.2 - 2026-11-23
- Audio popup entries regrouped by purpose.

## 0.33.1 - 2026-11-23
- Audio tweaks: Mono row with Auto channel detection; wider popup.

## 0.33.0 - 2026-11-23
- Added Audio tweaks: AUDIO popup with volume boost, sync, mono, leveling and night mode.

## 0.32.3 - 2026-11-23
- Picture popup and Search modal use the site's popup styling; sliders match the volume slider.
- Search: the input no longer clips text, and the placeholder is no longer clipped at the top.

## 0.32.1 - 2026-11-23
- Watch mode: removed the play icon next to the active channel number in the guide.
- Picture tweaks: sliders use the site's volume slider look.

## 0.32.0 - 2026-11-23
- Added Picture tweaks: PICTURE button in the player's key row opens brightness and contrast sliders.

## 0.31.4 - 2026-11-23
- Search: channel header and Tune to channel button above the program information.

## 0.31.3 - 2026-11-23
- Added Search: SEARCH button opens a popup with results on the left and the chosen program or channel's information on the right.

## 0.31.2 - 2026-11-23
- Added 24-hour clock: header clock, guide labels, Up Next, tooltips and program card show 19:00 instead of 7:00 PM.

## 0.31.1 - 2026-11-23
- Added Theater mode: THEATER button puts the video alone on a full window; the exit button and pointer hide after 3 s idle.

## 0.31.0 - 2026-11-23
- Added Split in watch mode: video on one half, guide on the other; program info card above the guide with an X button.

## 0.30.15 - 2026-11-23
- Delve checks GitHub hourly for a newer version; the DELVE button glows and the menu's Update footer turns gold when one is out.

## 0.30.14 - 2026-11-23
- When a page element Delve needs is missing, the feature is skipped and a warning is written to the console.

## 0.30.13 - 2026-11-23
- Fixed the phone guide toolbar and header; the Wide stage stays at least 390 px.

## 0.30.12 - 2026-11-23
- Feature switches now default to off.
- Fixed guide zoom when the Favorites filter hides the first row.

## 0.30.11 - 2026-11-23
- First public version of the rewrite, with auto-update for Tampermonkey.
