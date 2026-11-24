# Optical Blur Alignment

A skill for placing an icon or text inside a button, pill, chip, FAB, or rounded card so that it looks centered. Blur the content into a blob of perceived weight, then align the blob's rounded end with the concentric center of the container's inner frame. The measurement script reports the offset in pixels and draws a blue (off) or green (aligned) verification image.

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
  --radius 32 --padding 8 --edge left \
  --output /path/to/a/temp/folder/chip.png
```

Use `bun` in place of `node` if you prefer. Pass `--browser` or set `OPTICAL_BLUR_BROWSER` when playwright cannot find a browser.

## Source

The procedure comes from the idea demonstrated in a short video posted by [@Kubai087](https://x.com/Kubai087):

[Original post](https://x.com/i/status/2122514434069537097)

## License

MIT. See [LICENSE](LICENSE).

---

# 光学アライメント（ぼかしてそろえる）

ボタン、ピル、チップ、FAB、角丸のカードの中にアイコンや文字を置くとき、見た目の中心に合わせるためのスキルです。中身をぼかして「見た目の重さの塊」にし、その丸い端を容器の内枠の同心の中心に合わせます。計測スクリプトはずれを px で返し、ずれていれば青、合っていれば緑の確認画像を出します。

## 入れ方

skills CLI を使う場合:

```bash
npx skills add yukimasaki/optical-blur-alignment
```

手で clone して置く場合は、`skills/optical-blur-alignment` を使っているエージェントのスキルのフォルダへコピーします。

```bash
git clone https://github.com/yukimasaki/optical-blur-alignment.git
cp -R optical-blur-alignment/skills/optical-blur-alignment <your-skills-directory>/
```

## 必要なもの

- Node.js 23.6 以降（スクリプトが TypeScript の型を剥がして動かす）または Bun
- playwright 用の Chromium ブラウザ: `npx playwright install chromium`

依存は `SKILL.md` と `package.json` のあるスキルのルートで入れます。

```bash
npm install
```

`npx skills add` で入れた場合は、インストール先のスキルのフォルダで実行してください。

## 使い方

手順の全体は [SKILL.md](skills/optical-blur-alignment/SKILL.md) を読んでください。スキルのルートで計測します。

```bash
node scripts/measure.ts \
  --url http://localhost:3000/your-page \
  --selector '.chip .icon' \
  --container '.chip' \
  --radius 32 --padding 8 --edge left \
  --output /path/to/a/temp/folder/chip.png
```

`node` の代わりに `bun` でも動きます。playwright がブラウザを見つけられないときは、`--browser` か `OPTICAL_BLUR_BROWSER` で実行ファイルを渡してください。

## 出どころ

この手順は [@Kubai087](https://x.com/Kubai087) が投稿した短い動画が実演した考え方を元にしています。

[元の投稿](https://x.com/i/status/2122514434069537097)

## ライセンス

MIT。[LICENSE](LICENSE) を読んでください。
