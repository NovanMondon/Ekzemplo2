# Ekzemplo2 VS Code Extension (MVP)

`*.ekz2` 向けの最小VS Code拡張です。

- 言語ID登録（`ekzemplo2`）
- TextMateによる構文ハイライト
- LSPによるSemantic Tokens（型/関数/変数/引数/キーワードなど）
- 補完（キーワード/基本スニペット）
- Hover（識別子情報）
- 定義ジャンプ / 参照検索
- ドキュメントシンボル（関数・ローカル変数）
- 簡易診断（重複関数、重複引数、未定義関数呼び出し）

## セットアップ

```bash
cd vscode-extension
npm install
npm run build
```

## 起動方法（開発）

1. VS Codeで `vscode-extension` フォルダを開く
2. `F5` で Extension Development Host を起動
3. 開いた別ウィンドウで `.ekz2` ファイルを開いてハイライトを確認

## 補足

- MVPのため、Semantic Tokens は軽量な正規表現ベースです。
- 高精度化する場合は、既存のパーサ/AST/型検査結果をLSPサーバーから利用する実装に置き換えてください。
