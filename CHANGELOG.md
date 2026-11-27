# Changelog

What changed in each Delve version, newest first. Also shown in the Delve menu.

## 0.39.14 - 2026-11-26
- Mono Auto: a file whose left and right sides differ by 1 dB or more (was 1.5 dB) now gets Mix, so mildly uneven files like the one on channel 200 are caught more reliably.

## 0.39.13 - 2026-11-26
- Audio sync: the slider no longer restarts the stream on every small step. The stream reloads once when you let go of the slider, or after a short pause.

## 0.39.12 - 2026-11-26
- Fixed: Hide channels now also applies to the guide's small video. It no longer plays a hidden channel, and Channel Up/Down (including W, S and R) skip hidden channels there.

## 0.39.11 - 2026-11-26
- Fixed: Picture tweaks in the guide no longer let a zoomed or shifted picture spill over the channel title and description.

## 0.39.10 - 2026-11-26
- Changed: Hide options "Reactions" and "Both" now also hide the hearts floating over the video.

## 0.39.9 - 2026-11-26
- Fixed: Theater mode on a phone no longer pushes SPELUNK and MORE off the bottom of the screen, and the page's Guide / Watch / Channel bar is hidden in Theater.

## 0.39.8 - 2026-11-26
- Fixed: the Audio panel on a phone is no longer cut off at the top. It now opens centered, like the other panels.

## 0.39.7 - 2026-11-26
- Fixed: the Watermark and Picture panels are no longer cut off at the left edge of the video on narrow windows. The Picture panel scrolls when there is little room.

## 0.39.6 - 2026-11-26
- Fixed: Audio tweaks now retries a failed video download up to three times, about three seconds apart, instead of falling straight to a silent video.

## 0.39.5 - 2026-11-25
- Fixed: Audio tweaks no longer grows in memory each time you rewind around a long video.

## 0.39.4 - 2026-11-25
- Fixed: in the Extended guide, hour labels are no longer hidden by the playhead when it is close to the hour.

## 0.39.3 - 2026-11-25
- Fixed: the page no longer shifts a few pixels sideways when switching between Guide, Watch and Channel. The Guide now shows a thin empty strip where the scrollbar would be.

## 0.39.2 - 2026-11-25
- Fixed: on a phone, the SCHEDULE page's top links no longer leave APP and DELVE stuck at the left edge when they wrap to a second row.

## 0.39.1 - 2026-11-25
- Added: FAVORITE and HIDE CHANNEL buttons on channel pages, shown while Favorites or Hide channels is on.

## 0.39.0 - 2026-11-25
- Added: Hide channels (Guide switch). Each channel gets a ✕ beside its star, and a ⊘ Hidden toolbar button shows hidden channels again so you can restore them with ↺.
- Hidden channels are left out of Search, skipped by Channel Up/Down, SPELUNK, R and Auto spelunk, and cannot be clicked. If you land on one another way, its stream is removed.

## 0.38.1 - 2026-11-25
- Added: Auto spelunk can jump to ★ Favorites only. A new "Spelunk among" row in the AUTO popup shows while the Favorites switch is on.

## 0.38.0 - 2026-11-25
- Added: Auto spelunk (Player switch). An AUTO button next to SPELUNK presses it for you every 15 s, 30 s, 1 min or 5 min, with a countdown on the button.

## 0.37.0 - 2026-11-25
- Added: Volume slider (Player switch). Hover the mute button in the guide to get a volume slider.

## 0.36.2 - 2026-11-24
- Changed: the watermark now sits in the corner of the visible picture and follows Zoom, Width, Height and alignment. Size is a percentage of the visible picture's height.

## 0.36.1 - 2026-11-24
- Added: the Extended guide toolbar shows how much of the schedule is loaded, for example "Mon 9:00 PM – Wed 9:00 PM".

## 0.36.0 - 2026-11-24
- Added: What's new button in the menu footer, which opens this changelog.

## 0.35.3 - 2026-11-24
- Fixed: Extended guide watch counts and the header total no longer go missing after a reload.

## 0.35.2 - 2026-11-24
- Added: Watcher count (Guide switch), a total-watchers badge beside the header clock and a card on the home page.

## 0.35.1 - 2026-11-24
- Changed: Theater mode now stays on when the channel changes.
- Fixed: Theater's exit button and key row stay above bumpers and the tuning screen, and the exit button shows while no picture is up.

## 0.35.0 - 2026-11-24
- Added: Tag tooltips (Guide switch), hover text on the guide's REWIND tag.

## 0.34.9 - 2026-11-24
- Added: Hiss reduction in the Audio popup.
- Fixed: Leveling no longer pushes quiet scenes to maximum boost.

## 0.34.8 - 2026-11-24
- Fixed: tall buttons in the Audio, Picture, Hide and Watermark popups.

## 0.34.6 - 2026-11-24
- Changed: the drawer now has expandable Layout, Guide and Player sections (remembered), one-line rows, a pinned header and footer, and a popup-style frame flush with the window.
- Added: Reset all settings.

## 0.34.4 - 2026-11-24
- Added: Picture tweaks Width and Height scaling, and Zoom down to 50%.
- Changed: Lights-out is merged into Theater, whose key row now overlays the picture and slides away when idle.

## 0.34.3 - 2026-11-24
- Added: Picture tweaks Saturation, Dim, Zoom, Left/right and Up/down alignment, Crop with Fill/Fit, and Lights-out.

## 0.34.2 - 2026-11-24
- Changed: Watermark opacity now runs 1% to 20% in 1% steps. Saved values above 20 load as 20.

## 0.34.1 - 2026-11-24
- Added: Watermark B&W logo, which removes the logo background and draws the rest in stepped grays.

## 0.34.0 - 2026-11-24
- Added: Watermark, with a popup for On/Off, Size, Opacity, Corner and Logo (Original, B&W).

## 0.33.4 - 2026-11-23
- Added: Hide options, with a HIDE popup for Off, Both, Comments and Reactions.

## 0.33.2 - 2026-11-23
- Changed: Audio popup entries are regrouped by purpose.

## 0.33.1 - 2026-11-23
- Added: Mono row with Auto channel detection in the Audio popup.
- Changed: the Audio popup is wider.

## 0.33.0 - 2026-11-23
- Added: Audio tweaks, with an AUDIO popup for volume boost, sync, mono, leveling and night mode.

## 0.32.3 - 2026-11-23
- Changed: the Picture popup and Search modal use the site's popup styling, and sliders match the volume slider.
- Fixed: Search input text and placeholder are no longer clipped.

## 0.32.1 - 2026-11-23
- Changed: Picture tweaks sliders use the site's volume slider look.
- Removed: the play icon next to the active channel number in Watch mode's guide.

## 0.32.0 - 2026-11-23
- Added: Picture tweaks, with a PICTURE button in the player's key row for brightness and contrast.

## 0.31.4 - 2026-11-23
- Changed: Search shows the channel header and a Tune to channel button above the program information.

## 0.31.3 - 2026-11-23
- Added: Search, a SEARCH button that opens a popup with results on the left and the chosen program or channel on the right.

## 0.31.2 - 2026-11-23
- Added: 24-hour clock for the header, guide labels, Up Next, tooltips and program card.

## 0.31.1 - 2026-11-23
- Added: Theater mode, a THEATER button that shows the video alone on a full window. The exit button and pointer hide after 3 s idle.

## 0.31.0 - 2026-11-23
- Added: Split in Watch mode, with the video on one half and the guide on the other, plus a program info card with an X button.

## 0.30.15 - 2026-11-23
- Added: Delve checks GitHub hourly for a newer version. The DELVE button glows and the menu's Update footer turns gold when one is out.

## 0.30.14 - 2026-11-23
- Changed: when a page element Delve needs is missing, that feature is skipped and a warning is written to the console.

## 0.30.13 - 2026-11-23
- Fixed: the phone guide toolbar and header. The Wide stage stays at least 390 px.

## 0.30.12 - 2026-11-23
- Changed: feature switches now default to off.
- Fixed: guide zoom when the Favorites filter hides the first row.

## 0.30.11 - 2026-11-23
- First public version of the rewrite, with auto-update for Tampermonkey.
