# Git Client Feature Gaps — Implementation Plan

**Ngày:** 2026-09-19
**Trạng thái:** Proposed
**Phạm vi:** VS Code Git Client extension
**Nguồn yêu cầu:** Feedback người dùng về danh sách tính năng mong đợi ở một Git Client (MacOS desktop). Plan gồm 6 hạng mục: 3 mục chưa làm + 2 mục đã xác nhận cần cải thiện + 1 quick win discoverability (Command Palette category); các mục khác kiểm tra lại thấy đã đủ (xem mục "Đã kiểm tra lại — không đưa vào plan" ở cuối).

---

## Tổng quan

| # | Tính năng                                                                   | Trạng thái                                                  |
|---|-----------------------------------------------------------------------------|-------------------------------------------------------------|
| 1 | Credential helper GUI                                                       | ❌ Chưa làm                                                  |
| 2 | Toggle `http.sslVerify` theo repo                                           | ❌ Chưa làm                                                  |
| 3 | Dialog set `user.name` / `user.email` (+ checkbox global)                   | ❌ Chưa làm                                                  |
| 4 | Convert remote URL HTTPS ⇄ SSH (2 chiều, lệnh standalone)                   | ⚠️ Mới có 1 chiều, bị gắn chết vào Force SSH Pull            |
| 5 | Compare 2 nhánh bất kỳ (`compare.open`): thay InputBox bằng revision picker | ⚠️ Được dùng thật (Palette + Quick Actions), nhưng UX gõ tay |
| 6 | Command Palette: thêm `category` cho mọi lệnh để search tiền tố ra          | ❌ 127/137 lệnh không có category                            |

Kiến trúc chung áp dụng cho mọi mục (theo convention hiện có của repo):

- **Git ops**: thêm hàm standalone trong `src/services/gitService/<name>.ts`, đăng ký vào `index.ts` của `GitService`.
- **Handlers**: thêm `handle<Name>` trong `src/commands/commandController/`, khai báo `GitCommand` enum trong `src/config/commands.ts`, đăng ký trong `register.ts`.
- **UI**: QuickPick/InputBox cho thao tác nhanh; chỉ làm webview khi thật sự cần.
- **Test**: đặt tại `src/test/`, dùng pattern mock GitService như `selectedCommitChanges.test.ts`.
- **Palette**: mọi lệnh khai báo trong `package.json` phải có `"category": "VS Code Git Client"` (xem hạng mục 4) — áp dụng cho cả các lệnh mới trong plan này.
- **Quy trình bắt buộc (AGENTS.md)**: chạy `impact` trước khi sửa symbol có sẵn; `detect-changes` trước khi commit.

---

## 1. Repository Config Quick Actions

Gom cả 3 mục vào một hub duy nhất vì chung bản chất "git config quick edit" và chung một entry point UX.

### 1.1 Lệnh `vscodeGitClient.repoConfig.open` — "Repository Settings"

Entry point: QuickPick hub (không làm webview), hiển thị các mục:

```
Repository Settings
├─ User — name & email
├─ Credential helper
└─ SSL verification (http.sslVerify)
```

Đối tượng áp dụng: repository đang active (`this.git.rootPath`) — tự động đúng cả khi người dùng đang switch sang submodule qua `repository.select`.

### 1.2 Service layer — git config helper

File mới: `src/services/gitService/getConfigValue.ts` + `setConfigValue.ts` (hoặc một file `gitConfig.ts` chứa cả hai):

```ts
getConfig(this: GitService, key: string, scope: 'local' | 'global'): Promise<string | undefined>
// → runGit(['config', '--get', key]) / ['config', '--global', '--get', key]
// exit code 1 = unset → undefined, KHÔNG phải lỗi

setConfig(this: GitService, key: string, value: string | null, scope: 'local' | 'global'): Promise<void>
// value === null → ['config', '--unset-all', key] (xoá hẳn, để fallback về scope trên)
// còn lại → ['config', '--(global|)', key, value]
```

Lưu ý:
- `runGit` hiện ném lỗi khi unset → dùng `runGitAllowExitCodes` có sẵn cho `--get`.
- Luôn resolve path repo hiện tại qua GitService context (đã support submodule switching), không hard-code workspace root.

### 1.3 User name & email dialog

Handler: `handleRepoConfigUser.ts`

- QuickPick 2 option: **Set user name**, **Set user email** (hoặc mở cả 2 trong 2 input tuần tự).
- InputBox prefill giá trị hiện tại: thứ tự fallback `local` → `global` → không có.
- **QuickPick scope bắt buộc sau khi nhập value**:
  - `This repository only (local)`
  - `All repositories (global — --global)` ← checkbox "set global" trong yêu cầu, map sang bước này vì VS Code InputBox không có checkbox
- Validate email cơ bản: regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` trong `validateInput`.
- Sau khi set: `showInformationMessage` hiển thị giá trị + scope đã áp dụng; refresh không cần thiết (không ảnh hưởng tree data) nhưng log qua logger.

### 1.4 Credential helper

Handler: `handleRepoConfigCredentialHelper.ts`

- Đọc giá trị hiện tại (local trước, global sau) để đánh dấu option đang active.
- QuickPick options:
  - `osxkeychain` (default khi `process.platform === 'darwin'`)
  - `manager-core` / `manager` (Windows hint)
  - `store` (kèm warning: lưu plaintext — show `showWarningMessage` confirm)
  - `cache --timeout=<n>` → InputBox số giây
  - `none` → unset local (`--unset-all credential.helper`) để fallback global
  - `Custom…` → InputBox tự do
- Scope QuickPick: `local` (default) / `--global` — tái dùng helper UI từ 1.3 (extract `pickConfigScope()` dùng chung).
- **Không bao giờ** đọc/hiển thị credential đã lưu, chỉ quản lý helper config.

### 1.5 SSL verification

Handler: `handleRepoConfigSslVerify.ts`

- Đọc `http.sslVerify` (local → global → mặc định Git là `true`).
- QuickPick:
  - `Enable (default)` → set `true`
  - `Disable for this repository (NOT RECOMMENDED)` → set local `false`, **bắt buộc qua `showWarningMessage` với 2 nút xác nhận** ("Disable SSL verification changes security behavior..." → chỉ apply khi bấm đúng label). Không cho phép disable global từ UI này (an toàn); nếu user cần global → hướng dẫn docs.
  - `Also configure CA bundle (http.sslCAInfo)` → InputBox path, validate file tồn tại qua `vscode.workspace.fs.stat`.
- Khi đang disabled: option đầu tiên hiển thị `(currently disabled)` + nút `Reset to default (unset)`.

### 1.6 Test

- `src/test/repoConfigUser.test.ts`: prefill fallback local→global; unset (`--unset-all`) khi value null; scope flag đúng; email validation.
- `src/test/repoConfigCredentialHelper.test.ts`: `store` yêu cầu confirm; `none` → unset local; custom value pass-through.
- `src/test/repoConfigSsl.test.ts`: disable phải đi qua warning confirm (mock `showWarningMessage` trả `undefined` → không apply); không có đường tắt global.

---

## 2. Remote URL Scheme Converter (HTTPS ⇄ SSH)

### 2.1 Vì sao cần, dù đã có Force SSH Pull

Hạn chế đã xác minh trong `sshPull.ts` / `gitParsing.ts`:

- **Một chiều**: chỉ có `convertToSshUrl`, không có SSH → HTTPS.
- **Gắn chết với pull**: convert URL xong là `pull()` + `refreshAll()` luôn — không có cách nào chỉ đổi URL (ví dụ chuẩn bị chuyển sang push qua SSH mà chưa muốn pull).
- **Khó khám phá**: nằm trong Quick Actions ("Force SSH pull GitHub/GitLab/..."), không nằm cạnh menu quản lý remote nơi người dùng tìm actions của remote (`RemoteChangeUrl`...).

### 2.2 Parsing mở rộng — `src/services/gitParsing.ts`

- Giữ nguyên `convertToSshUrl(currentUrl, targetHost)` (đã có test).
- Thêm `convertToHttpsUrl(currentUrl: string): string | null`:
  - `git@host:path` → `https://host/path`
  - `ssh://git@host[:port]/path` → `https://host/path` (bỏ port — không có nghĩa với HTTPS)
  - Đã là https → trả `null`
- Thêm `detectUrlScheme(url): 'ssh' | 'https' | 'other'` cho UI.
- Mở rộng `convertToSshUrl`: cho phép suy ra host từ chính URL khi không truyền `targetHost` (mode "convert, giữ nguyên host").

### 2.3 Lệnh mới `vscodeGitClient.remote.convertUrl`

Handler: `handleRemoteConvertUrl.ts`

1. `getRemoteFetchUrls()` → QuickPick remote (detail hiển thị scheme hiện tại: `SSH` / `HTTPS`).
2. QuickPick đích: `Convert to SSH` / `Convert to HTTPS` (ẩn/disable nếu URL không parse được hoặc đã đúng scheme — báo "already SSH/HTTPS" thay vì làm không).
3. Confirm `old → new` trước khi `setRemoteUrl` (tái dùng pattern `confirmDangerousAction` trong `guards.ts`).
4. **Không tự pull** — chỉ đổi URL + thông báo, gợi ý nút "Fetch now" nếu người dùng muốn.
5. Đăng ký: Command Palette + vị trí cạnh `RemoteChangeUrl` trong menu remote; Quick Actions đổi item "Force SSH pull" cũ thành trỏ sang lệnh mới này (giữ 4 lệnh sshPull cũ cho tương thích).

`sshPull` giữ nguyên hành vi nhưng delegate phần convert sang helper dùng chung để tránh logic đúp.

### 2.4 Test

- `gitParsing.test.ts` bổ sung: `convertToHttpsUrl` với `git@`, `ssh://`, có port, không parse được; `convertToSshUrl` mode suy host từ URL.
- `remoteConvertUrl.test.ts`: cancel confirm → không mutate; URL đã đúng scheme → no-op + message; đổi xong không có lệnh pull nào được gọi.

---

## 3. Compare 2 nhánh bất kỳ — nâng cấp `compare.open`

### 3.1 Hiện trạng (đã kiểm tra kỹ — lệnh đang được dùng, không xóa được)

Call sites của `GitCommand.CompareOpen`:

- `package.json:416` — Command Palette "Compare Branches"
- `openQuickActions.ts:31` — item "Open compare branches" trong Quick Actions hub
- `README.md:323` — tài liệu

Quan trọng: `compare.open` (`openCompareWorkflow.ts`) là **entry point duy nhất** để so sánh 2 nhánh **bất kỳ** không liên quan current branch — context menu branch/tag chỉ có "Compare With Current". Đây đúng là cái user yêu cầu #8 ("xem sự khác biệt giữa 2 nhánh"). Vì vậy phương án là **nâng cấp UX**, không phải xóa.

### 3.2 Cải thiện

1. **Thay 2 InputBox gõ tay bằng `pickRevisionToCompare`** (đã có, đang dùng cho CompareWithRevision — hỗ trợ branch/remote/tag/commit/SHA prefix). Left mặc định = current branch nhưng vẫn cho đổi qua picker; right bắt buộc chọn.
2. **Bỏ follow-up QuickPick cuối workflow** (`'Open changed file diff' / 'Cherry-pick commit range' / 'No more actions'`) — webview CompareView đã có sẵn: click commit → range details, click file → diff (`openBranchComparisonFileDiff`), export CSV/Excel. Follow-up QuickPick chỉ là tầng trung gian thừa.
3. **Thêm alias trong branch context menu** (tùy chọn, small): trên branch node → "Compare with Branch…" mở thẳng workflow với left = branch được click, right = revision picker.

Kết quả: `openCompareWorkflow` giảm từ ~35 dòng IO sang 2 lần gọi picker + 1 lần `openBranchCompare`; hành vi Palette/Quick Actions giữ nguyên.

### 3.3 Test

- `compareWorkflow.test.ts`: mock picker trả selection → assert `openBranchCompare(left, right)` được gọi đúng cặp; cancel ở bất kỳ bước → không mở webview.

---

## 4. Command Palette discoverability — thêm `category` cho toàn bộ lệnh

### 4.1 Vấn đề (đo lường được, không phải cảm tính)

`package.json` có **137 lệnh**, phân bố `category` hiện tại:

| Category               | Số lệnh                                   |
|------------------------|-------------------------------------------|
| *(không có)*           | **127**                                   |
| `"VS Code Git Client"` | 8                                         |
| `"Git Client"`         | 1 (`graph.loadMore` — lạc, không khớp ai) |
| `"Text Compare"`       | 1                                         |

Command Palette hiển thị và **search theo chuỗi `"category: title"`**. Không có `category` thì lệnh chỉ hiện裸 `title`, nên người dùng gõ `git client` (hoặc `git`) sẽ **không ra**: `Refresh`, `Fetch`, `Add Git remote`, `Change remote URL`, toàn bộ `worktree.*`, `submodule.*`, `recovery.*`, `stash.*`... Đây chính là lý do nhóm remote (kế hoạch mục 2) vô hình.

`displayName` của extension là `"VS Code Git Client"` (`package.json:3`) → tiền tố chuẩn phải là `"VS Code Git Client"`.

### 4.2 Cách làm

1. **Thêm `"category": "VS Code Git Client"`** cho 127 lệnh còn thiếu + sửa `graph.loadMore` từ `"Git Client"` về cùng giá trị. Một cơ chế duy nhất cho mọi lệnh — **không** dùng tên menu, không dùng `"Git"` đơn thuần.
   - Làm bằng script một lần (`scripts/`), generate lại khối `contributes.commands`, rồi review diff — không edit tay 127 chỗ.
   - `textCompare.open` giữ nguyên `"Text Compare"` (đối tượng so sánh file độc lập, có menu/binding riêng).
2. **Không sửa `title`**: `category` đã tự sinh prefix trong Palette, thêm vào title sẽ thành `"VS Code Git Client: Git Client: ..."` bị đúp. Chỉ một lệnh có `Git Client` trong title (`scm.shelveResource` — chủ đích vì nó nằm lẫn trong menu SCM của extension `git`), giữ nguyên.
3. **Chống tái diễn**: thêm assertion vào `commandRegistration.test.ts` — mọi `contributes.commands` phải có `category === 'VS Code Git Client'`, ngoại trừ whitelist hiện diện tường minh (`textCompare.open`). Đây là chỗ trống thật sự: test hiện tại đã kiểm enum ↔ package.json khớp nhau nhưng **không hề kiểm tra `category`**.

### 4.3 Test

- `commandRegistration.test.ts`: case mới → danh sách lệnh thiếu `category` phải rỗng; category phải khớp đúng một hằng số duy nhất; whitelist `textCompare.open`.

---

## Effort ước lượng

| Hạng mục                                                                    | Effort     |
|-----------------------------------------------------------------------------|------------|
| 1. Repo Settings hub (user/email, credential helper, SSL) + test            | 1–2 ngày   |
| 2. Remote URL converter 2 chiều (`remote.convertUrl`) + test                | 0.5–1 ngày |
| 3. Nâng cấp `compare.open` (revision picker, bỏ follow-up QuickPick) + test | 0.5 ngày   |
| 4. `category` cho toàn bộ lệnh + script generate + test chống tái diễn      | 0.5 ngày   |

Thứ tự: **4 → 1 → 2 → 3**. Hạng mục 4 là quick win độc lập (chỉ động `package.json` + test), làm trước để mọi lệnh mới thêm về sau (repo config, `remote.convertUrl`) đều có sẵn category đúng chuẩn — và nó khuếch khả năng tìm thấy của cả 3 hạng mục còn lại. Ship cả 4 trong bản `1.18.x`.

## Risks & lưu ý

- **Safety**: mọi thao tác config chỉ mutate `git config`, không đụng working tree — ngoại trừ SSL disable cần double-confirm và cấm tắt UI cho global scope.
- **`runGit` vs exit code 1**: `git config --get` trả 1 khi unset — bắt buộc dùng `runGitAllowExitCodes`, tránh nhầm "unset" thành lỗi.
- **Submodule awareness**: vì `repository.select` đã đổi active repo, mọi config op phải resolve qua `GitService.rootPath` hiện tại → tính năng tự động đúng cho submodule mà không cần code riêng.
- **Không phá API cũ**: giữ nguyên 4 lệnh `gitSshPull.*` và lệnh `compare.open` (đang có người dùng qua Palette/Quick Actions/README) — chỉ delegate/nâng cấp bên trong.
- Chạy `impact` (GitNexus) trước khi sửa `gitParsing.ts`, `sshPull.ts`, `openCompareWorkflow.ts` vì có nhiều call site.

---

## Đã kiểm tra lại — không đưa vào plan

1. **Multi-commit combined cherry-pick / revert**: ĐÃ CÓ đủ chuỗi (không cần việc riêng):
   - Multi-select commit (graph `canSelectMany`) → `openCommitRangeDetails` tính net changes `oldest^..newest` qua `getFilesChangedBetweenRefsWithStatus` → `CommitFilesTreeProvider.showCommitRange` hiển thị danh sách file gộp.
   - Chọn nhiều file trong range → `handleCherryPickSelectedChanges` / `handleRevertSelectedChanges` có nhánh `kind === 'range'` → `getPatchBetweenRefsForFiles` → `applyPatchToWorkingTree` / `reverseApplyPatchToWorkingTree`.
   - Cherry-pick range tạo commit: `cherryPickRange`.
   - Edge case còn lại: commit chọn **không liên tục** được xử lý như range (kèm commit chen giữa) — cùng semantics với Ctrl+click dải commit trong IntellIJ. Không cần việc riêng.
