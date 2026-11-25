---
name: optical-blur-alignment
description: Use when placing an icon or text inside a button, pill, chip, FAB, or rounded card and the content looks off-center or pushed toward one edge. Blurs the content into a blob and aligns the blob's rounded end with the container's rounded end. Measurement uses scripts/measure.ts (playwright only).
---

# Optical alignment by blurring

Content placed at the geometric center of a button or chip often does not look centered. Icons and text carry visual weight unevenly. This skill blurs the content into a "blob of perceived weight" and aligns the blob's rounded end with the center of the container's rounded end.

Two rules are enough to read this skill on its own: align by perceived weight instead of geometry, and when rounded shapes nest, the outer radius equals the inner radius plus the padding between them.

## How it works

If the container's corner radius is `R` and its padding is `p`, the inner frame radius is `r = R - p`. With equal horizontal and vertical padding, the center of the inner frame's rounded end coincides with the center of the container's rounded end.

Pass the horizontal and vertical padding separately with `--padding-x` and `--padding-y`. `--padding <value>` remains an alias that sets both. The inner radius is always `innerRadius = R - paddingY`; vertical padding of zero does not shrink it (a chip with `R = 20`, `padding: 0 16px` has `innerRadius: 20`).

**Which rounded end is the target?** The target is always the center of the **container's** rounded end: `x = R` for the left end and `x = width - R` for the right end. An inner frame can serve as the target only when its rounded ends are concentric with the container's, which requires equal horizontal and vertical padding. With `padding: 0 16px`, the inner frame's left roundness would be centered at `paddingX + innerRadius = 36`, while the container's is at `20`; there is no single inner radius that makes them concentric. The script therefore reports `usesContainerRoundedEnd: true` for unequal padding, and also when `innerRadius` collapses below 4px (vertical padding close to `R`, not zero). `innerRadius` stays in the output as the inner frame's radius; it sets the boundary of `inner-frame` searches and is not the target when the flag is true. Reason: the shape the eye compares the content against is the container's rounded end.

| Shape | What to align |
|---|---|
| End of a pill | For the left end, align the blob's left roundness with the container's rounded end; for the right end, use the right end. Choose with `--edge left` or `--edge right`. |
| Rounded rectangle | First check that the blob's vertical centroid sits at the container's vertical midpoint, then measure the left and right ends. Do not move the four corners separately. |
| Circular button | The content is nearly round, so the centroid and the rounded end's center almost coincide. When there are two icons, measure each blob on its own. |
| Icon beside text | Align the icon with the left end and the text with the right end. A text blob is wide, so use the center of its rounded end, **not its centroid**. |

In the source video, blurring a plane icon erased its shape into a round blob. The frame changed from blue to green when the blob sat concentrically inside the inner frame's left end. The same happened at the right end with the text "47m". After removing the blur, the content sits away from the geometric center. That is the expected result; a geometrically centered position is the one to suspect.

## Procedure

### 1. Read the numbers

In DevTools, select the element and read the container's `border-radius` and its horizontal and vertical padding. For a pill with `9999px`, the radius is half the height. Pass them as `--radius`, `--padding-x`, and `--padding-y`.

### 2. Take a screenshot

Run the script from the skill root, the directory containing `SKILL.md` and `package.json`. Install its dependency there first.

```bash
npm install
node scripts/measure.ts \
  --url http://localhost:3000/your-page \
  --selector '.chip .icon' \
  --container '.chip' \
  --radius 20 --padding-x 16 --padding-y 0 --edge left \
  --output /path/to/a/temp/folder/icon.png \
  --plain-output /path/to/a/temp/folder/icon-plain.png
```

The same script runs with Bun: replace `node` with `bun`. Node.js 23.6 or newer is required because the script uses TypeScript type stripping. If playwright cannot find a browser, run `npx playwright install chromium`. To use a specific executable, pass `--browser <path>` or set `OPTICAL_BLUR_BROWSER`.

- `--selector` points at the content to blur, and `--container` at the rounded container. Without `--container`, the content's parent element is used.
- **Icons beside text:** measure each one in its own run. With `--selector`, the script hides the container's other children for the duration of the screenshot, so an unblurred sibling (the "Add" text next to a plus icon) is never picked up as part of the blob. You do not need to edit the HTML.
- **Bare text nodes:** text that is not inside a `<span>` cannot be selected with a CSS selector. Omit `--selector` and pass `--hide <selector>` for the sibling you do not want; the script wraps text nodes in a temporary `<span class="optical-blur-text-node">` and blurs everything that remains. To measure the icon instead, pass `--selector` for the icon and omit `--hide`.
- Add `--edge right` for text at the right end.
- `--image <PNG>` accepts an existing screenshot. In that mode the whole image is blurred with a Canvas `filter`, so the container edge blurs too. Use URL mode when you need to judge the frame color.
- `--plain-output <PNG>` saves the unblurred screenshot. Capture it before any hiding or blurring, so it shows the real screen.
- Put screenshots in a temporary folder, not in a source repository.

### 3. Blur

The script blurs only the chosen content with `σ = h × 0.1`, where `h` is the container height. In the source video, roughly a tenth of the height was enough to erase the icon's outline into a blob. A fixed pixel value does not scale between a small chip and a large button. Change it with `--blur-ratio <number>`.

### 4. Read the measurement

The output is JSON plus the verification image (and the plain image when requested).

- `offset.roundEnd`: **the offset in pixels between the blob's rounded end center and the target center**. Closer to zero is better alignment. Tolerance is 2px by default; change it with `--tolerance`.
- `offset.centroidX` / `centroidY`: the offset of the blob's centroid itself. Informational only. For wide text, the centroid can be far off even when `roundEnd` is zero.
- `offset.edge`: the raw bounding-box edge distance before the rounded end is taken into account. It differs from `roundEnd` by the blob's radius; do not use it to write CSS.
- `frame.usesContainerRoundedEnd`: `true` when horizontal and vertical padding differ by 1px or more, or when the inner radius collapsed below 4px. It describes the **target**, not where pixels are searched.
- `search`: the rectangle used to collect blob pixels (`mode`, `insetX`, `insetY`, `width`, `height`, `radius`). With a collapsed inner radius the mode is `container`; otherwise it is `inner-frame` with a 2px margin, even when the target is the container's rounded end. For the chip (`padding-x 16`, `padding-y 0`) it is `inner-frame` with `insetY: 0` and `radius: 22`, so the search covers almost the full 40px height. An earlier revision searched only the strict inner frame (an 8px-tall band when both paddings were 16px); the current 2px margin makes the "Add" blob's lower edge y=26 instead of 24. That is why its `roundEnd` moved from -1.5 to -2 without the text being moved.
- `aligned`: `true` when `roundEnd` and the vertical centroid are both within tolerance.
- `suggestion`: the displacement to apply. `translateX` is the primary value (positive right, negative left); `paddingLeftDelta` and `paddingRightDelta` are the same displacement expressed as padding changes, with the right side negated. `translateY` is the vertical displacement (positive down, negative up); it is `offset.centroidY` with the sign flipped.
- Verification image: the blurred blob with the frame that matches the target drawn over it (the inner frame, or the container outline when `usesContainerRoundedEnd` is true). Green means aligned, blue means off. The cross at the target center uses the same color as the frame, the orange dot is the blob's rounded end center, and the yellow dot is the centroid.

Enlarge the image and look at it. Even with a zero offset, fix the position if the blob cuts into the inner corner or leaves an uneven gap at the top and bottom.

### 5. Write the CSS

Pick the form already used in the project and apply the `suggestion` value.

| Fix | When to choose it | Example |
|---|---|---|
| Left/right padding | The content is positioned with padding and the same spacing must hold in other states | Add `paddingLeftDelta` / `paddingRightDelta` to the current value. With 8px left padding and a delta of +14, write `padding-left: 22px;`. Use the returned delta as-is; its sign is the opposite of `offset.roundEnd`. |
| `left` / `right` | The content is absolutely positioned with `left` or `right` | Add `translateX` to `left`; subtract it from `right`. Example: `left: 22px` with `translateX: +10` becomes `left: 32px`; `right: 8px` with `translateX: -12.5` becomes `right: 20.5px`. One Tailwind form is `left-[32px]`. |
| `translate` | Shared UI primitives should keep their padding; only one icon or label needs to move | `transform: translateX(10px);` (Tailwind form: `translate-x-[10px]`). Positive is right, negative is left. |
| SVG viewBox or path | The shape itself is asymmetric, and padding or translate would break in other states | Move the icon's path coordinates and add no extra margin at the call site. |

When `translateY` is outside the tolerance, also move the content vertically: `transform: translateY(2px);`, or combine both axes as `transform: translate(10px, 2px);` (Tailwind form: `translate-y-[2px]`). If the content is absolutely positioned with `top`, add `translateY` to `top` instead.

Prefer the method the screen already uses. Do not put two of these on the same content; that moves it twice. Follow the direction from the measurement rather than a generic rule about icon-side spacing.

### 6. Measure again

Run the same command and confirm `aligned: true` and a green frame. Open the `--plain-output` image (or take a screenshot with the blur removed) and check that the icon or text is not clipped and does not overlap other elements. Do not skip this step for a small change.

## Do not

- Judge from numbers alone. Look at the verification image and the unblurred screen.
- Trust geometric centering alone (`left: 50%`, `justify-content: center`, `text-align: center`).
- Judge alignment from the sharp icon outline instead of the blurred blob.
- Use the centroid of wide text as the target. Use the rounded end's center.
- Use a fixed blur radius. Scale it with the element height.
- Stack padding, `left`/`right`, and translate on the same content.
- Edit shared UI primitives from this skill to fix a single instance.
