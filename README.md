# Johnny Builds to Mars

A six-chapter, interactive pop-up storybook made with plain HTML, CSS, JavaScript, and inline SVG. Art and audio are bundled with the site; no libraries, build tools, or accounts are required. Bree Serif headings and Nunito text load through Google Fonts, with local fallback fonts when offline. The main menu credits the book to Parker & Pine.

## Open the book

Open `index.html` in a modern browser, or serve this folder with any static HTTP server. Select **Open book** from the main menu to enter the reader, which fills the browser window. **Main menu** returns to the menu and keeps your chapter position. The book uses a spread in landscape and a stacked illustration and story in portrait; the story pane can scroll on smaller screens without moving the illustration or navigation. Dedicated short-height landscape rules keep the menu, toolbar, story text, activity card, and navigation usable on horizontally rotated phones as well as tall phones and tablets.

Touch, mouse, and keyboard are supported. Swipe horizontally across a page or use the arrows to turn pages. Supplies, rocket parts, and the landing rocket require dragging and dropping at the marked destination; tapping does not move or complete them. With a keyboard, focus an object, press Space/Enter to pick it up, move it with the arrow keys (Shift moves farther), and press Space/Enter again to drop it. Escape cancels. Forward navigation is locked until the current activity is complete, while earlier completed chapters remain available for review. After the final activity, **Start the story again** clears the saved progress and returns to the first chapter; the final forward arrow performs the same reset.

Interactive objects and drop destinations have a subtle glow on hover or keyboard focus, without extra outlines around the artwork. The garage retains its dashed assembly guides. Picking up a draggable object also highlights its matching destination for touch and keyboard readers. Faint arrows connect unfinished supplies, rocket parts, and the landing rocket to their destinations, disappearing as those actions are completed. The reader shows a short activity hint without repeated success messages; detailed keyboard instructions remain available in help.

In chapter three, readers work on a blue grid blueprint and draw the body, nose cone, and fin in three separate steps. They can follow a dashed guide or invent their own shapes, drawing with touch, a stylus, a mouse, or the keyboard. Color, line thickness, undo, and clear apply to the current part. Readers can return to earlier blueprint steps to revise a part.

After drawing all three parts and naming the rocket, readers take their own cutouts to the garage. Their single fin drawing also produces a horizontally mirrored second fin; both pieces are labeled **Fin**. The body, nose cone, and both fins can be dragged into their matching outlines in any order. All four pieces must be assembled before launch unlocks. Unordered assembly progress survives chapter changes within the current session. The same drawn parts, both fins, and rocket name appear in the launch, landing, and Mars scenes. The landing rocket has a generous transparent hitbox around the entire drawing so readers can grab its interior or nearby space. Editing a saved blueprint resets assembly and later chapter completion so the changed rocket must be assembled again.

Interactive sounds include a short, quiet dog bark and a light wooden assembly impact, plus original Web Audio effects for rocket exhaust, landing, paper, tape, a metal funnel, pencil strokes, and interface feedback. Biscuit responds with a short line of dialogue and a bark in the main menu and story scenes. The bark is decoded into a native audio buffer, skips leading silence, and uses a normalized gentle level; both recordings have softened starts and finishes and low-pass filtering to reduce sharpness, including on iPads. If the bark cannot load or decode, a quiet procedural woof plays instead. The sound toggle stops ongoing effects. Recordings are bundled in `assets/audio`; attribution and licenses are documented there and in the help dialog. Unsupported Vorbis playback falls back to a quiet procedural thud. Optional read-aloud narration uses the browser's speech synthesis and available voices; voice availability varies by device.

All progress is held in memory for the current page session only. Packed supplies, individual blueprint strokes and drawing steps, rocket name, assembled parts, launch, landing, and backpack reveal survive moving between chapters or returning to the menu. Closing the blueprint editor keeps unfinished drawings for the next time it is opened. Refreshing or reopening the website starts a new book and ignores older browser storage. The restart control also clears progress and unfinished drawings immediately.

## GitHub Pages

1. Commit these files to your GitHub repository and push them.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Select your branch and **/ (root)**, then save.

The site uses relative paths and works at both a repository Pages URL and a custom domain. No build step or package installation is needed.

## Files

- `index.html` — semantic book layout, navigation, and help dialog.
- `styles.css` — responsive paper spread, animations, and reduced-motion support.
- `script.js` — original SVG illustrations, chapter content, interactions, sound, and narration.
- `rocket-designer.js` — blueprint drawing steps, saved-part validation, and shared rendering of the reader’s assembled rocket.
- `story-audio.js` — recorded sound playback and original procedural effects.
- `assets/audio/` — bundled recordings and their attribution.

Complete each activity to unlock the following chapter. Earlier completed chapters remain available to revisit.

## Checks

Run `node --test tests/*.test.cjs` for code-level checks of drawing input, naming, safe rendering, session progress, refresh behavior, audio, chapter progression, and restart behavior. These checks use Node’s built-in test runner; they do not require installing any packages. Browser layout, real-device touch behavior, and audible playback still need device testing.
