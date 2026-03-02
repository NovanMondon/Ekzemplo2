# Ekzemplo2

言語自作入門用モデル言語`Ekzemplo2`のコンパイラ。

## Ekzemplo2言語

拡張子: .ekz2

（TODO: 言語仕様は追記）

## 開発者・AGENT向け

### ディレクトリ構成

- `src/frontend/`: 字句/構文解析と AST 構築（ANTLR 生成物を含む）
- `src/middle/`: 中間層（型検査・名前解決・最適化などの予定地）
- `src/backend/`: LLVM IR 生成などのバックエンド
- `fixtures/`: 入力例（`.ekz2`）

### Lint / Format

```bash
# Lint（チェックのみ）
npm run lint

# Lint（自動修正）
npm run lint:fix

# Format（Prettierで整形）
npm run format
```

### ANTLR

- 文法ファイル: `grammar/`（`Ekzemplo2Lexer.g4`, `Ekzemplo2Parser.g4`）
- 生成コマンド: `npm run gen`（Java 17+ が必要）
- 生成物出力先: `src/frontend/generated/`（コミットしない想定で`.gitignore`済み）

### パーサ実行（開発中）

`src/index.ts` は現在、ANTLR で生成した Lexer/Parser を使って入力を `program` ルールでパースする簡易CLIです。

```bash
# stdin から読む（空/空白/コメントのみなら成功）
npm run exec

# ファイルを読む
npm run exec -- path/to/file.ekz2

# 例: コメントだけ
printf '// hello\n' | npm run exec
```

現状の文法は最小構成で、まずは `int <name>() { return <int>; }` の形のみを受理します（今後拡張予定）。

### LLVM IR 生成 / コンパイル（開発中）

`src/main.ts` はパースに加えて、最小機能として LLVM IR（`.ll`）生成と `clang` によるバイナリ生成もできます。

前提:

- `clang` / `llvm` / `lld` がインストールされていること（devcontainer では Dockerfile で導入済み）

```bash
# LLVM IR を output/ に出力（例: output/test1.ll）
npm run exec -- --emit-llvm fixtures/test1.ekz2

# LLVM IR を出して、そのまま clang でバイナリ生成（例: output/test1）
npm run exec -- --compile fixtures/test1.ekz2

# 出力先ディレクトリや名前を指定
npm run exec -- --compile --out-dir output --out-name a.out fixtures/test1.ekz2
```
