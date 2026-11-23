# Interaction model

Switchyard's layout, shortcuts, command dispatch, undo and clipboard follow the rules below.
Each rule names the BridgeMind One function that shows the rule, read from the shipped app.
Switchyard's code is written fresh. No BridgeMind code, text, images or styles are copied.

## Source

| | |
|---|---|
| App | BridgeMind One 0.3.4, `C:\Users\sixth\AppData\Local\BridgeMind One\bridgemind-one-rust.exe` |
| Exe SHA-256 | `fbb4760897ad909b4abf35533b401ac835cebc3f45a11254fedb8b1dd0cf66c3` |
| How the code was read | The app is Tauri with WebView2. Its web bundle was read from the running web view over the debug port (348 chunks), then searched and pretty-printed. REA `analyze_javascript_application` evidence: `ev_17e5bcd9281281ffe02aed6adaa6a49103c2427b8465ca464f1ddcb0a311e071`. |
| Kind of proof | Static. Each rule was read from code. It was not watched running in BridgeMind. |

A proof reads `chunk › function`, then a string or line that finds it.
Function names are the minifier's short names in that build. Line numbers are in the
pretty-printed chunk (`prettier --parser babel`, print width 110).
`index` means `index-BRXgRmQX.js`, `WP` means `WorkspacePane-DEYl0xKF.js`, `XT` means `XtermSurface-DMwUgI0I.js`.

Switchyard words: a **track** is a tab, a **pane** is a leaf.

## 1. Layout

| Rule | Switchyard | BridgeMind proof |
|---|---|---|
| A track is a tree. A split has 2 or more children in a row or a column, each with a share. Shares sum to 1. | `layout.ts` `Tree`, `isValid` | `panes-CDzT4q8H.js` split schema, lines 81-87 (ratios sum within 0.001) |
| A track holds at most 64 nodes, at most 16 deep. A folder holds at most 32 tracks. | `MAX_NODES`, `MAX_DEPTH`, `MAX_TABS` | `panes-CDzT4q8H.js` lines 106-129 |
| A change that breaks the limits is refused and the old layout stays. | `checked`, store `split` toast | `index › Io`, line 14704, "The pane layout could not be changed safely." |
| Split puts the new pane right after the target and focuses it. In a split of the same direction it joins it, and all shares even out. | `splitPane` | `index › xo`, line 14521; reducer `splitPane` 14807-14842 |
| A row that passes 4 panes wraps into two stacked rows: the first 4, then the rest, at 50/50. | `wrapRow` | `index › bo`, line 14508 (`t.slice(0, 4)`, `ratios: [0.5, 0.5]`); called from `xo` when `t.length > 4` |
| Closing a pane gives its space to its siblings in proportion. A split left with one child is replaced by that child. | `removePane` | `index › So`, line 14547; `po` normalizes ratios |
| Focus after a close goes to the pane before the closed one in reading order, else the first. | `focusAfterClose` | `index › Bo` case `closeLeaf`, line 14885 (`Math.max(l - 1, 0)`) |
| Closing the last pane closes its track. Closing a track activates the track that slides into its place, else the last one. | store `closePane`, `closeTab` | `index › Bo` cases `closeLeaf` and `closeTab`, lines 14885-14928 (`t[Math.min(n, t.length - 1)]`) |
| A fresh grid puts 2 panes per row for 2-4 panes, 3 for 5-6, then `min(4, max(2, ceil(sqrt(n·16/9))))`. Rows stack; a row of one is just the pane. | `perRow`, `tile` | `index › Fo`, line 14676 |
| Tidy lays the panes out again as a fresh grid in reading order. | `tidy`, Tidy button | `index › Bo` case `tidy`, lines 15055-15064, uses `Fo` |
| Equalize gives every child an equal share and keeps the arrangement. | `equalize`, Even button | `index › Po`, line 14673 |
| Divider: 8 px. A split of 280 px or less (after dividers) does not resize. Each side keeps at least `min(140, extent / children)` px. Only the two neighbours change and their total stays. | `DIVIDER_PX`, `RESIZE_FLOOR_PX`, `minPanePx`, `resize` | `index › Mo` line 14654 (`Math.min(140, …)`); `index › No` line 14657 (`i <= 280`) |
| A divider drag draws live and saves on release. An arrow key moves it by 4% of the pair. | `Divider` in `Yard.tsx` | `WP` divider handlers, lines 1001-1022 and 1103-1120 (`0.04`) |
| Any resize, split, close, swap, dock, equalize or tidy ends full-pane view. | store actions set `full: null` | `index › Bo`, every case listed sets `fullscreenLeafId: null` (14768-15074) |
| Full-pane view shows one pane alone. Escape ends it, but not while focus is in a terminal. | store `toggleFull`, `exitFull`; App `escape` | `WP` key handler line 3478 (`escapePresentation`, `!ar(e)`) |
| Swap trades two panes. Focus stays on the spot the action started from, which now holds the other pane. | `swapPanes`, store `swapStep`, `dropPane` | `index › wo` line 14561; `Bo` case `swapLeaves` (`focusedLeafId: t.sourceLeafId`) |
| Dock moves a pane to an edge of another. It is refused when a row would pass 4, or when nothing changes. | `dock` | `index › Do` (line 14589, `t.length > 4 ? null`), `Oo` (line 14606, `Eo(s) === Eo(To(e)) ? null`) |
| A drop on a pane: within 25% of an edge docks there, else swaps. The header always swaps. A dock that is refused becomes a swap. | `dropZone`, `dropAction` | `paneDropTarget-DsuEMAnF.js` function `n` (`a<.25?i:"center"`), function `r` (`.code-pane-header` → center); `index › ko` |
| A drop outside every pane moves the pane to a new track, only when its track has 2 or more panes. Switchyard's spot for this is the track bar. | store `extractPane` | `index › uo` line 14472 (`q(r.root).length > 1`); `Bo` case `extractLeafToTab` 14993-15017 |
| A header drag starts after 6 px. Buttons, inputs and links do not start it. Escape, leaving the window or a cancelled pointer stop it. | `pressToDrag` | `usePointerDrag-DjRo37fZ.js` lines 3, 67, 88-93 |
| Arrow focus picks the pane fully past the current edge. Panes that overlap on the other axis win, then the smallest gap (0.5 px tolerance), then the nearest centre. | `nearestPane` | `WP › er`, line 2542 |
| Old saved layouts load into the current form. Same-direction nesting is merged, keeping each pane's real share. | `fromSaved`, `flatten`, `readTabs` | `index › To` line 14567 (flatten); `panes-CDzT4q8H.js` v1 → v2 migration, lines 174-237 |

## 2. Keyboard shortcuts

Ctrl and Cmd both count unless a rule says "exactly Ctrl". Rules live in `keys.ts` `readKey`.

| Keys | Action | Where it works | BridgeMind proof |
|---|---|---|---|
| Ctrl+D | Split right | Yard. Not from inside a terminal | `WP` line 3521 (`t === 'd'`, `vertical`) |
| Ctrl+Shift+D | Split down | Yard, terminals included | same, `e.shiftKey ? 'horizontal'` |
| Ctrl+T, Ctrl+N | New track | Ctrl+N works from a terminal too and stops there | `WP` lines 3528-3537; `index › yi` line 13768 (Ctrl+N, also by `KeyN` on non-Latin layouts) |
| Ctrl+W | Close pane | Not from inside a terminal | `WP` line 3538 (`closeLeaf`) |
| Ctrl+Shift+W | Close track | Yard | same (`closeTab`) |
| Ctrl+[ and Ctrl+] | Focus the pane before or after, wrapping | Not from inside a terminal | `WP` line 3551; `index › Bo` case `focusAdjacentPane` |
| Ctrl+Shift+[ and ] | Track before or after, wrapping | Yard | `WP` line 3547; `Bo` case `selectAdjacentTab` |
| Ctrl+Alt+[ and ] | Swap with the pane before or after | Yard, not on key repeat | `WP` line 3490 (`swapAdjacent`) |
| Ctrl+Alt+Arrow | Focus the nearest pane that way | Yard | `WP` line 3499 (`e.altKey && t.startsWith('arrow')`) |
| Ctrl+Alt+= | Even shares | Yard | `WP` line 3516 (`equalize`) |
| Ctrl+= or +, Ctrl+-, Ctrl+0 | Zoom in ×1.1, out ÷1.1, reset to 100%. Range 60-200% | Everywhere, terminals included; exactly Ctrl, no Alt | `index › Tt` line 11255; reducer `stepZoom` line 11672 (`n * 1.1`); `rn` line 11615 (`60`, `200`) |
| Ctrl+Shift+B | Open or close the side drawer | Everywhere | `index › Zt` line 11515 |
| Ctrl+Alt+F | Show the Files drawer | Not from inside a terminal | `index › Xt` line 11510 (skips `.xterm`) |
| Escape | Cancel a drag, else end full-pane view | Not from inside a terminal or a dialog | `WP` line 3478 |
| Held keys | Repeats of T D B F A W = + [ ] are swallowed | Yard | `WP › sr`, line 2629 |
| Ctrl+Shift+J, Ctrl+Shift+O | Next pane that needs you; the task board | Switchyard's own, no BridgeMind rule | none |

The terminal rule: a plain Ctrl key (no Shift, Alt or Cmd) pressed inside a terminal goes to
the program in it, so Ctrl+D, Ctrl+W, Ctrl+T, Ctrl+[ and Ctrl+C reach the shell. Ctrl+N is the
one exception. Switchyard `belongsToShell`; BridgeMind `WP › or`, line 2627.

Two places differ on purpose:

- Ctrl+Shift+[ reads `e.code` as well as `e.key`. BridgeMind reads only `e.key`, which is `{` with Shift on a US keyboard, so its rule rarely fires.
- BridgeMind's Ctrl+Shift+B toggles a built-in browser panel. Switchyard has no such panel, so the same key toggles its drawer.

## 3. Command dispatch

| Rule | Switchyard | BridgeMind proof |
|---|---|---|
| Keys are read by one window listener in the capture phase, before the terminal sees them. | `App.tsx` `shortcuts`, `addEventListener('keydown', …, true)` | `WP` line 3555; `index` line 20778 (zoom, capture with `stopPropagation`) |
| A key becomes a typed command, then one handler runs it. There is no key event bus and no command palette. | `readKey` returns a `Command`; `run` switches on it | `WP` key handler calls `r({ type: … })` reducer dispatches; none of `CustomEvent`, command palette or global-shortcut plugin found |
| Layout keys only act on the yard; zoom and the drawer act everywhere. | `yardOnly` in `shortcuts` | `WP` gate line 3474 (visible, ready); zoom listener in app shell `index › gd` |
| A handled key is `preventDefault`ed. The terminal skips keys already handled. | `run` returns true → `preventDefault`; `terminalKey` checks `defaultPrevented` | `WP` handler (`e.preventDefault()` per case) |
| Keys typed while an input method is composing are ignored. | `readKey` (`isComposing`) | `WP` line 3476 (`e.isComposing`) |
| Dialogs keep their own keys. | `inDialog` context | `WP › rn`/`an`, lines 1362-1381 |

## 4. Undo and redo

BridgeMind has one app undo stack, in its notes editor. Switchyard has no notes editor, so the
same stack backs its two long text boxes: the Files editor and the prompt editor.

| Rule | Switchyard | BridgeMind proof |
|---|---|---|
| Ctrl+Z undoes. Ctrl+Shift+Z and Ctrl+Y redo. Cyrillic Я works like Z. | `historyKey` | `ScratchpadApp-DWKfHmmM.js` lines 18648-18654 (`Mod-z`, `Shift-Mod-z`, `Mod-y`, `Mod-я`) |
| Undo and redo from the edit menu or the keyboard's own keys use the same stack, and the browser's undo never runs. | `useHistory` `onBeforeInput` | `ScratchpadApp` lines 18158-18164 (`historyUndo`, `historyRedo`, always `preventDefault`) |
| At most 100 steps. Old steps are cut only past 120, back to 100. | `DEPTH`, `SLACK` | `ScratchpadApp` lines 18145, 18041 (`Tv = 20`), 17924 |
| Edits within 500 ms that touch the last changed range join one step. A pause or an edit elsewhere starts a new one. | `TextHistory.record`, `GROUP_MS` | `ScratchpadApp` lines 18062-18065 and 18091 (`newGroupDelay`, range check) |
| Any new edit clears redo. | `record` | `ScratchpadApp` lines 18067-18072 |
| Undo puts the cursor back where it was. | `apply` restores the selection | `ScratchpadApp › Av`, lines 18117-18126 |
| The history is in memory only and ends when the box goes away. | `useRef` in `useHistory` | `ScratchpadApp` lines 18147-18150 |
| Terminals have no app undo. Ctrl+Z goes to the program. | `terminalKey` returns true for it | `XT` lines 16794-16799 |
| Layout changes, closes and deletes have no undo. Risky ones ask first. | `closePane`, `closeTab`, `removeWorkspace` confirm | no undo toast anywhere; "This cannot be undone." in `ArchivedChatsDialog` line 175 |

## 5. Clipboard and drops

| Rule | Switchyard | BridgeMind proof |
|---|---|---|
| Ctrl+C with a selection copies through the browser and keeps the selection. With none it reaches the program. | `terminalKey` | `XT` lines 16771-16781 |
| Ctrl+Shift+C copies the selection as plain text. | `terminalKey` → `navigator.clipboard.writeText` | `XT › Eu` line 16285; handler 16765-16769 |
| Ctrl+V, Ctrl+Shift+V and Shift+Insert paste through the browser. | `terminalKey` returns false | `XT › wu`, line 16271 |
| A text paste turns line ends into CR and is marked as a paste (`ESC[200~ … ESC[201~`) when the program asked for that. | xterm's own paste, kept as is | `XT` lines 1763-1781 (bundled xterm; app leaves `ignoreBracketedPasteMode` off) |
| Shift+Enter sends Escape then Enter. | `terminalKey` writes `\x1b\r` | `XT › Ou` line 16291; handler 16782-16793 |
| No copy on select. | none added | no code path found |
| An image paste: an `image/*` file, when the clipboard text is empty or one http(s) link. PNG, JPEG, GIF, WebP, BMP, 1 byte to 25 MiB. | `pastedImage`, `imageFormat`, `stageableImage` | `XT › ku` 16302, `Au` 16311, `ju` 16329; limit `bu` 16265 (26214400) |
| The image is saved by the app side, then handed to the agent. | `clip_image_save` saves to the app cache; the path is typed in | `terminalRuntime.production-DeeAdU6Y.js` `stage_terminal_clipboard_image`, lines 1398-1412. What BridgeMind's app side does next is not in the bundle; typing the path is Switchyard's choice |
| Files dropped from the computer onto a pane: 1-20 paths, each 1-32768 characters, no control characters. | `dropPaths`, `dropText`, App `useFileDrops` | `terminalRuntime` `insert_terminal_drop_paths`, validator lines 757-766. Quoting is app side there; Switchyard quotes paths with spaces |
| Dragging an entry from the Files drawer onto a terminal types its path. Inside the app this is a pointer drag, not a browser drag. | `pressToDrag` with a `file` payload, `dropFileOnPane` | `usePointerDrag-DjRo37fZ.js`; `XT` lines 16435-16452 (`insert_terminal_files_entry`) |
| A Files entry path must be relative: no leading slash, no drive, no backslash or control characters, no empty, `.` or `..` parts, up to 4096 characters. | `isSafeRelative`, `readFilesEntry` | `sideFiles-uDrtBuA1.js` lines 79-107 |
| Mention text: folders end in `/`; a path with spaces goes in quotes. | `mentionText` | `sideFiles-uDrtBuA1.js › x`, line 108 |
| A saved prompt pasted in: line ends become LF, control characters except LF and tab go, C1 codes go, trailing space goes. Empty is refused. A marked-paste program gets one paste with no Enter. Otherwise more than one line is refused, and tabs become spaces. | `cleanText`, `promptInput`, `pasteToFocused` | `SidePromptsPanel-B-qtzvzj.js › D`, lines 40-75; `submissionPlan-1ebKu05b.js` lines 103-126 |
| A sent prompt: marked as a paste when the program takes marked pastes and the text has a line break, or always for Claude Code and Cursor. Enter follows after 250 ms (Claude Code, Cursor), 200 ms (Codex), 150 ms (other agents), 0 ms (plain terminal). | `deliveryFor`, `sendPlan`, `sendText` | `submissionPlan-1ebKu05b.js` lines 19-80 |

Switchyard's own format name for an internal Files entry is `application/x-switchyard-files-entry`.

## Not built

- BridgeMind's chat thread grid (up to 6 threads, 380 px columns). Switchyard has no chat view.
- Moving a pane with Move Left/Right/Up/Down menu items. Drag covers the same moves.
- Composer paste, attachments and the thread Ctrl+W. Switchyard has no composer.
- BridgeVerse game keys and the dictation chord.

## Tests

- `src/lib/layout.test.ts`: layout rules.
- `src/lib/interaction.test.ts`: shortcuts, undo, clipboard and drop rules.
- `src-tauri/src/clip.rs`: image save.
- `tools/e2e-interaction.mjs`: real key presses and mouse drags in the running app. Run `tools/live-dev.ps1`, then `tools/live-interaction.ps1`.
