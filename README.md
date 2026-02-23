# Ekzemplo2

言語自作入門用モデル言語`Ekzemplo2`のコンパイラ。

## Ekzemplo2言語

拡張子: .ekz2

（TODO: 言語仕様は追記）

## 開発者・AGENT向け

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
- 生成物出力先: `src/generated/`（コミットしない想定で`.gitignore`済み）

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

現状の文法は `program: EOF;` のみなので、トークン（例: `x` や `123`）がある入力は構文エラーになります。
