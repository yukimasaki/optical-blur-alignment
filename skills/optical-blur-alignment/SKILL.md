---
name: optical-blur-alignment
description: Use when placing an icon or text inside a button, pill, chip, FAB, or rounded card and the content looks off-center or pushed toward one edge. Blurs the content into a blob and aligns the blob's rounded end concentrically with the container's inner frame. Measurement uses scripts/measure.ts (playwright only).
---

# Optical alignment by blurring

Content placed at the geometric center of a button or chip often does not look centered. Icons and text carry visual weight unevenly. This skill blurs the content into a "blob of perceived weight" and aligns the blob's rounded end with the concentric center of the container's inner frame.

Two rules are enough to read this skill on its own: align by perceived weight instead of geometry, and when rounded shapes nest, the outer radius equals the inner radius plus the padding between them.

## How it works

If the container's corner radius is `R` and its padding is `p`, the inner frame radius is `r = R - p`. The center of the inner frame's rounded end sits at the same coordinates as the center of the container's rounded end. The target is to place the center of the blob's rounded end at that point.

| Shape | What to align |
|---|---|
| End of a pill | For the left end, align the blob's left roundness with the inner frame's left end; for the right end, use the right end. Choose with `--edge left` or `--edge right`. |
| Rounded rectangle | First check that the blob's vertical centroid sits at the container's vertical midpoint, then measure the left and right ends. Do not move the four corners separately. |
| Circular button | The content is nearly round, so the centroid and the rounded end's center almost coincide. When there are two icons, measure each blob on its own. |
| Icon beside text | Align the icon with the left end and the text with the right end. A text blob is wide, so use the center of its rounded end, **not its centroid**. Measuring the centroid alone pulls text toward the middle by mistake. |

In the source video, blurring a plane icon erased its shape into a round blob. The frame changed from blue to green when the blob sat concentrically inside the inner frame's left end. The same happened at the right end with the text "47m": the wide blob's right roundness was matched to the button's right roundness. After removing the blur, the content sits away from the geometric center. That is the expected result; a geometrically centered position is the one to suspect.

## Procedure

### 1. Read the numbers

In DevTools, select the element and read the container's `border-radius` and padding. For a pill with `9999px`, the radius is half the height. If the inner radius `r = R - p` is zero or less, the two shapes cannot be concentric; fix the padding or the corner radius first. Padding must be greater than zero: with zero padding, the inner frame equals the container and the script cannot sample the container background.

### 2. Take a screenshot

Run the script from the skill root, the directory containing `SKILL.md` and `package.json`. Install its dependency there first. Pass the content and its container separately.

```bash
npm install
node scripts/measure.ts \
  --url http://localhost:3000/your-page \
  --selector '.chip .icon' \
  --container '.chip' \
  --radius 32 --padding 8 --edge left \
  --output /path/to/a/temp/folder/chip.png
```

The same script runs with Bun: replace `node` with `bun`. Node.js 23.6 or newer is required because the script uses TypeScript type stripping. If playwright cannot find a browser, run `npx playwright install chromium`. To use a specific executable, pass `--browser <path>` or set `OPTICAL_BLUR_BROWSER`.

- `--selector` points at the content (icon, label, number), and `--container` at the rounded container. Without `--container`, the content's parent element is used.
- Add `--edge right` for text at the right end.
- `--image <PNG>` accepts an existing screenshot. In that mode the whole image is blurred with a Canvas `filter`, so the container edge blurs too. Use URL mode when you need to judge the frame color.
- Put screenshots in a temporary folder, not in a source repository.

### 3. Blur

The script blurs only the content with `σ = h × 0.1`, where `h` is the container height. In the source video, roughly a tenth of the height was enough to erase the icon's outline into a blob. A fixed pixel value does not scale between a small chip and a large button. Change it with `--blur-ratio <number>`.

### 4. Read the measurement

The output is JSON plus a verification image.

- `offset.roundEnd`: **the offset in pixels between the blob's rounded end center and the inner frame's rounded end center**. Closer to zero is better concentric alignment. Tolerance is 2px by default; change it with `--tolerance`.
- `offset.centroidX` / `centroidY`: the offset of the blob's centroid itself. Informational only. For wide text, the centroid can be far off even when `roundEnd` is zero.
- `aligned`: `true` when `roundEnd` and the vertical centroid are both within tolerance.
- `suggestion`: only the amount to move. `translateX` is positive to the right and negative to the left. `paddingLeftDelta` and `paddingRightDelta` are values to add to the current padding.
- Verification image: the blurred blob with the inner frame drawn over it. Green means aligned, blue means off. The cross at the target center uses the same color as the frame, the orange dot is the blob's rounded end center, and the yellow dot is the centroid.

Enlarge the image and look at it. Even with a zero offset, fix the position if the blob cuts into the inner corner or leaves an uneven gap at the top and bottom.

### 5. Write the CSS

Pick the form already used in the project and apply the `suggestion` value.

| Fix | When to choose it | Example |
|---|---|---|
| Left/right padding | The content is positioned with padding and the same spacing must hold in other states | Add `paddingLeftDelta` / `paddingRightDelta` to the current value. With 8px left padding and a delta of +14, write `padding-left: 22px;`. Use the returned delta as-is; its sign is the opposite of `offset.roundEnd`. |
| `translate` | Shared UI primitives should keep their padding; only one icon or label needs to move | `transform: translateX(10px);` (Tailwind form: `translate-x-[10px]`). Positive is right, negative is left. |
| SVG viewBox or path | The shape itself is asymmetric, and padding or translate would break in other states | Move the icon's path coordinates and add no extra margin at the call site. |

Prefer the method the screen already uses. Do not put padding and translate on the same content; that moves it twice. Follow the direction from the measurement rather than a generic rule about icon-side spacing.

### 6. Measure again

Run the same command and confirm `aligned: true` and a green frame. With the blur removed, check that the icon or text is not clipped and does not overlap other elements. Do not skip this step for a small change.

## Do not

- Judge from numbers alone. Look at the verification image and the unblurred screen.
- Trust geometric centering alone (`left: 50%`, `justify-content: center`, `text-align: center`).
- Judge alignment from the sharp icon outline instead of the blurred blob.
- Use the centroid of wide text as the target. Use the rounded end's center.
- Use a fixed blur radius. Scale it with the element height.
- Stack padding and translate on the same content.
- Edit shared UI primitives from this skill to fix a single instance.
