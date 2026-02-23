# Ekzemplo2

言語自作入門用モデル言語`Ekzemplo2`のコンパイラ。

## Ekzemplo2言語

拡張子: .ekz2

（TODO: 言語仕様は追記）

## 開発者・AGENT向け

### ANTLR

- 文法ファイル: `src/grammar/`（`Ekzemplo2Lexer.g4`, `Ekzemplo2Parser.g4`）
- 生成コマンド: `npm run gen`（Java 17+ が必要）
- 生成物出力先: `src/generated/`（コミットしない想定で`.gitignore`済み）
