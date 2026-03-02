# AGENTS メモ（vscode-extension）

更新日: 2026-03-02

## 現在の状態

- 作業ディレクトリ: `vscode-extension/`
- VS Code 拡張のデバッグのため、この `vscode-extension/` ディレクトリをワークスペースルートとして開いて作業している。
- このディレクトリ単体には `.git/` がなく、Git 管理のルートは親ディレクトリ `../`（`/workspaces/Ekzemplo2`）。
- 親ディレクトリには `src/`, `fixtures/`, `grammar/`, `vscode-extension/` などが存在し、`vscode-extension` はサブディレクトリとして配置されている。
- さらに上位の `/workspaces` には `Ekzemplo2/` のみが存在する。

## 検証メモ

- `npm run typecheck`（`vscode-extension/` 内）: 成功（TypeScript エラーなし）。
- 問題パネル上の注意として、`package.json` の `activationEvents: ["onLanguage:ekzemplo2"]` は VS Code 側で自動生成可能なため、削除可能という指摘がある。
