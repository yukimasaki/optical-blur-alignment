# Optical Blur Alignment

English | [日本語](README.ja.md)

A skill for placing an icon or text inside a button, pill, chip, FAB, or rounded card so that it looks centered. Blur the content into a blob of perceived weight, then align the blob's rounded end with the center of the container's rounded end. The measurement script reports the offset in pixels and draws a blue (off) or green (aligned) verification image.

## Install

With the skills CLI:

```bash
npx skills add yukimasaki/optical-blur-alignment
```

Or clone the repository and copy `skills/optical-blur-alignment` into your agent's skills directory:

```bash
git clone https://github.com/yukimasaki/optical-blur-alignment.git
cp -R optical-blur-alignment/skills/optical-blur-alignment <your-skills-directory>/
```

## Requirements

- Node.js 23.6 or newer (the script uses TypeScript type stripping), or Bun
- A Chromium browser for playwright: `npx playwright install chromium`

Install the dependency in the skill root, the directory with `SKILL.md` and `package.json`:

```bash
npm install
```

If you installed the skill with `npx skills add`, run this inside the installed skill directory instead.

## Usage

Read [SKILL.md](skills/optical-blur-alignment/SKILL.md) for the full procedure. Run the script from the skill root:

```bash
node scripts/measure.ts \
  --url http://localhost:3000/your-page \
  --selector '.chip .icon' \
  --container '.chip' \
  --radius 20 --padding-x 16 --padding-y 0 --edge left \
  --output /path/to/a/temp/folder/icon.png \
  --plain-output /path/to/a/temp/folder/icon-plain.png
```

Use `bun` in place of `node` if you prefer. Pass `--browser` or set `OPTICAL_BLUR_BROWSER` when playwright cannot find a browser.

| Option | Purpose |
|---|---|
| `--padding-x`, `--padding-y` | Horizontal and vertical padding separately. `--padding` sets both. |
| `--selector` | Content to blur. Omit it to blur everything left in the container. |
| `--hide <selector>` | Hide a sibling while measuring, for example the icon when measuring bare text. |
| `--edge left\|right` | Which rounded end of the container to align with. |
| `--output`, `--plain-output` | Blurred verification image and unblurred screenshot. |
| `--tolerance`, `--blur-ratio` | Alignment tolerance in px (default 2) and blur ratio (default 0.1). |

## Source

The procedure comes from the idea demonstrated in a short video posted by [@Kubai087](https://x.com/Kubai087):

[Original post](https://x.com/i/status/2122514434069537097)

## License

MIT. See [LICENSE](LICENSE).
