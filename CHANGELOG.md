# Changelog

What changed in each Delve version, newest first. Also shown in the Delve menu.

## 0.39.12 - 2026-11-26
- Hide channels on the guide: the small video at the top of the guide no longer plays a hidden channel. If the page opens on one, the video stays blank, and the Channel Up and Down buttons (and the W, S and R keys) skip hidden channels there, as they already did on the Watch and Channel pages.

## 0.39.11 - 2026-11-26
- Picture tweaks in the guide: a zoomed or shifted picture could spill out of the guide's video box and cover the channel title and description beside it. It now stays inside its box, as it does in Watch mode.

## 0.39.10 - 2026-11-26
- Hide options: the Reactions and Both choices now also hide the hearts that float up over the video, not only the reaction bar under it.

## 0.39.9 - 2026-11-26
- Theater mode on a phone: the row of buttons ran off the bottom of the screen, so SPELUNK and MORE could not be reached, and the page's own Guide / Watch / Channel bar showed through behind it. The row now fits on the screen and that bar is hidden in Theater.

## 0.39.8 - 2026-11-26
- Audio panel on a phone: the panel was cut off at the top of the screen. It now opens in the middle of the screen like the Picture, Watermark and Hide panels; tap outside it to close.

## 0.39.7 - 2026-11-26
- Watermark and Picture panels: on a narrower window the panel could be cut off at the left edge of the video. It now slides in to stay fully visible, and the Picture panel scrolls if there is not enough room above its button.

## 0.39.6 - 2026-11-26
- Audio tweaks: when a channel's video fails to download after another channel has already been played through Delve, Delve now tries again up to three times (about three seconds apart) instead of going straight to a silent video. The picture stays blank while it retries.

## 0.39.5 - 2026-11-25
- Audio tweaks: the video player no longer keeps every piece of the file it has downloaded in memory. Rewinding around a long video used to add a little memory each time; now it stays small.

## 0.39.4 - 2026-11-25
- Extended guide: the hour labels (like 11:00 PM) are no longer hidden by the playhead when the current time is close to the hour; they sit on top of it with a thin dark outline.

## 0.39.3 - 2026-11-25
- The page no longer shifts sideways by a few pixels when you switch between Guide, Watch and Channel: the room for the page's scrollbar is always kept, so the Guide view now shows a thin empty strip on the right.

## 0.39.2 - 2026-11-25
- On a phone, the SCHEDULE page's top links (About, Updates, Directory, Schedule, App, DELVE) no longer leave APP and DELVE stuck at the left edge when they wrap to a second row; both rows now line up on the right.

## 0.39.1 - 2026-11-25
- Channel pages: when Favorites or Hide channels is on, a FAVORITE button and a HIDE CHANNEL button sit in their own row above WATCH and GUIDE. FAVORITE turns gold while the channel is starred, and HIDE CHANNEL becomes UNHIDE CHANNEL once it is hidden.

## 0.39.0 - 2026-11-25
- Hide channels: a new Guide switch. Every channel gets a ✕ beside its star that hides it from the guide, and a ⊘ Hidden button in the toolbar shows hidden channels again, dimmed, with a ↺ to bring one back.
- Hidden channels are skipped: Search leaves them out, Channel Up and Down (buttons or W and S) pass over them, SPELUNK, R and the Auto spelunk timer never stay on one, and clicking a dimmed channel does nothing. If you land on one another way, its stream is removed so nothing plays.

## 0.38.1 - 2026-11-25
- Auto spelunk: the AUTO popup has a new Spelunk among row, All channels or ★ Favorites. With Favorites, SPELUNK and the timer jump to a random starred channel other than the one you are on. The row only shows while the Favorites switch is on.

## 0.38.0 - 2026-11-25
- Added Auto spelunk (Player switch, off by default): an AUTO button next to SPELUNK opens a popup to pick Off, 15 s, 30 s, 1 min or 5 min. Delve then presses SPELUNK for you each time the countdown on the AUTO button reaches zero, and pressing SPELUNK yourself restarts the countdown.

## 0.37.0 - 2026-11-25
- Added Volume slider (Player switch, off by default): in the guide, hovering the mute button opens a small volume slider above it, since the site shows no volume slider in the guide's compact player.

## 0.36.2 - 2026-11-24
- Watermark: it now sits in the corner of the visible picture, where the picture meets the Crop box, and follows Zoom, Width, Height and the Left / right and Up / down alignment. Size is a percentage of the visible picture's height.

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
