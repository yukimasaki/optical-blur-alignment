# 光学アライメント（ぼかしてそろえる）

[English](README.md) | 日本語

ボタン、ピル、チップ、FAB、角丸のカードの中にアイコンや文字を置くとき、見た目の中心に合わせるためのスキルです。中身をぼかして「見た目の重さの塊」にし、その丸い端を容器の丸い端の中心に合わせます。計測スクリプトはずれを px で返し、ずれていれば青、合っていれば緑の確認画像を出します。

![ピルの左端の飛行機のアイコンをそろえた例。上の段はぼかした確認画像で、左のずれた状態は青い枠、右の合わせた状態は緑の枠。下の段はぼかさない画面](docs/images/alignment-before-after.png)

## ほかの道具との関係

| 道具                                           | 答える問い                                 | 見るもの                             | 直し方                                                      |
| ---------------------------------------------- | ------------------------------------------ | ------------------------------------ | ----------------------------------------------------------- |
| make-interfaces-feel-better                    | どんな細部がUIを良く見せるか（原則の一覧） | コードと設計の原則                   | 原則を示す。測らない                                        |
| opticalcenter.dev（v0.2.0-alpha、2026-11時点） | このアイコン単体の見た目の中心はどこか     | SVGのアイコンのピクセルだけ          | ビルドの時点で中心のずれを求め、viewBoxや配置の値に書き込む |
| このスキル                                     | この容器の中で、中身の塊をどこに置くか     | 画面に描いた容器と中身（文字も含む） | 測ったずれを、paddingやtranslateの値で返す                  |

1. make-interfaces-feel-better で、外の角丸 = 内の角丸 + padding になっているかなど、原則に沿っているかを見る
2. opticalcenter.dev で、アイコンの形そのものの偏り（再生の三角など）を直す
3. このスキルで、そのアイコンや文字を、容器の丸い端に対してどこに置くかを測って直す
- 正方形のアイコンボタンで、アイコンの偏りだけが問題のとき → opticalcenter.dev だけで足りる
- 文字や、左右に寄せて置く中身があるとき、ピルやチップの端に置くとき → このスキルが要る

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

- Node.js 23.6以降（スクリプトが TypeScript の型を剥がして動かす）または Bun
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
  --radius 20 --padding-x 16 --padding-y 0 --edge left \
  --output /path/to/a/temp/folder/icon.png \
  --plain-output /path/to/a/temp/folder/icon-plain.png
```

`node` の代わりに `bun` でも動きます。playwright がブラウザを見つけられないときは、`--browser` か `OPTICAL_BLUR_BROWSER` で実行ファイルを渡してください。

| オプション                    | 用途                                                             |
| ----------------------------- | ---------------------------------------------------------------- |
| `--padding-x`、`--padding-y`  | 横と縦の padding を別に渡す。`--padding` は両方に適用する        |
| `--selector`                  | ぼかす中身。省略すると容器に残っているもの全部をぼかす           |
| `--hide <selector>`           | 測るあいだ隠す兄弟要素。テキストを測るときにアイコンを隠す、など |
| `--edge left\|right`          | どちらの丸い端に合わせるか                                       |
| `--output`、`--plain-output`  | ぼかした確認画像と、ぼかさない通常画面                           |
| `--tolerance`、`--blur-ratio` | 許容するずれ（既定2px）とぼかしの比率（既定0.1）                 |

## クレジット

この手順は [@Kubai087](https://x.com/Kubai087) が投稿した短い動画が実演した考え方を元にしています。

https://x.com/i/status/2122514434069537097

[opticalcenter.dev](https://opticalcenter.dev/) ・ [make-interfaces-feel-better](https://github.com/jakubkrehel/make-interfaces-feel-better)

冒頭の画像の飛行機のアイコンは、[Lucide](https://lucide.dev/) の `plane`（ISC License）です。

## ライセンス

MIT。[LICENSE](LICENSE) を読んでください。
