# Ekzemplo2

言語自作入門用モデル言語`Ekzemplo2`のコンパイラ。

## Ekzemplo2言語

拡張子: .ekz2

### 現状実装されている構文（2026-03時点）

#### トップレベル

- 関数定義
  - `type name(param, ...) { ... }`
- extern 関数宣言
  - `type name(param, ...);`
  - 可変長引数（`...`）対応

#### 型

- スカラー型: `int`, `bool`, `string`, `char`
- 配列型: `int[n]`, `bool[n]`, `char[n]`

#### 文

- 変数宣言: `type x;`, `type x = expr;`
- 代入: `x = expr;`, `arr[i] = expr;`
- if / else: `if (cond) stmt [else stmt]`
- for: `for (init; cond; update) stmt`
- while: `while (cond) stmt`
- `break;`, `continue;`, `return expr;`
- ブロック: `{ ... }`
- 式文: `expr;`

#### 式

- リテラル: 整数、文字列、文字、`true` / `false`
- 識別子、関数呼び出し、配列/文字列インデックスアクセス
- 二項演算子
  - 乗除: `*`, `/`
  - 加減: `+`, `-`
  - 比較: `<`, `<=`, `>`, `>=`
  - 等値: `==`, `!=`
- キャスト: `(type)expr`

### 現状の制約（重要）

- 関数の戻り値に配列型は使えない
- 関数引数に配列型は使えない
- 配列初期化子は未対応（`int[4] a = ...` は不可）
- 配列全体代入は未対応（`a = b` は不可）
- `string` へのインデックス代入は未対応（読み出しのみ）
- `if/for/while` 条件式は `bool` 必須
- 関数本体には `return` が必要
- 文字列/文字リテラルは ASCII 前提
- `string[]` は未対応

## 開発者・AGENT向け

### ディレクトリ構成

- `src/frontend/`: 字句/構文解析と AST 構築（ANTLR 生成物を含む）
- `src/frontend/astBuilder/`: AST 構築 visitor の分割実装
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

`npm run exec` は `src/index.ts`（内部的に `src/main.ts` → `src/cli/runCli.ts`）を実行します。
入力のパース、AST構築、必要に応じて LLVM IR 出力/コンパイルを行います。

```bash
# stdin から読む（空/空白/コメントのみなら成功）
npm run exec

# ファイルを読む
npm run exec -- path/to/file.ekz2

# 例: コメントだけ
printf '// hello\n' | npm run exec

# AST を表示
npm run exec -- --dump-ast fixtures/test1.ekz2
```

### LLVM IR 生成 / コンパイル（開発中）

CLIオプション:

- `--dump-ast`: ASTをJSON表示
- `--emit-llvm`: `.ll` を出力
- `--compile`: `.ll` 出力 + `clang` でバイナリ生成
- `--out-dir <dir>`: 出力先ディレクトリ（デフォルト `output`）
- `--out-name <name>`: 出力名（未指定時は入力ファイル名ベース）

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
