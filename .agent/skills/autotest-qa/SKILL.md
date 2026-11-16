---
name: autotest-qa
description: Test game slot trên bản RELEASE của máy build bằng tool autotest (MCP "autotest" qua HTTP, máy QA không có repo game hay automation). Dùng khi QA muốn chạy thử / tái hiện / kiểm tra một hành vi của game (vd "test sAztac spin 5 lần không lỗi", "tái hiện bug này", dán link trello.com/c/...), chạy lại một run hoặc case cũ, xem kết quả run, hoặc mở card Trello cho ô fail. Không dùng để sửa code game.
---

# Test game trên bản release qua autotest

Máy build (`192.168.0.200`) chạy service autotest cho cả team. Agent nói chuyện với nó qua MCP server tên `autotest`
(Claude Code: tool `mcp__autotest__…`; Codex: server `autotest`). Mọi run chạy **trên máy build**, mở **bản release
mà máy build tự host** (bản của lần build theo lịch gần nhất), không dùng gì trên máy QA.

Nói chuyện với QA bằng tiếng Việt, gọi tool với `lang: "vi"`. Dự án game slot là `webgame_v2`; QA nói game khác (bắn cá…)
thì `list_projects` để lấy đúng tên.

## 0. Có kết nối chưa

Gọi `list_projects`. Không có tool `autotest` hoặc lỗi kết nối → dừng, chỉ QA gắn MCP rồi mở session mới:

- Claude Code (một lệnh, chạy trong terminal của máy QA):
  ```
  claude mcp add --transport http -s user autotest http://192.168.0.200:4700/mcp --header "X-Autotest-User: <tên QA>" --header "X-Trello-Key: <key>" --header "X-Trello-Token: <token>" --header "X-Trello-Board: <board>" --header "X-Trello-List: <list>"
  ```
- Codex, `~/.codex/config.toml`:
  ```toml
  [mcp_servers.autotest]
  url = "http://192.168.0.200:4700/mcp"
  http_headers = { "X-Autotest-User" = "<tên QA>", "X-Trello-Board" = "<board>", "X-Trello-List" = "<list>" }
  env_http_headers = { "X-Trello-Key" = "TRELLO_KEY", "X-Trello-Token" = "TRELLO_TOKEN" }
  tool_timeout_sec = 660
  ```

Key Trello là của QA, nằm trong cấu hình agent. **Không bao giờ hỏi, in, hay chép key vào chat**; không dùng Trello thì
bỏ các header `X-Trello-*`. Không vào được `192.168.0.200:4700` (lỗi "did not answer") → máy build tắt hoặc khác mạng: báo
QA, đừng thử địa chỉ khác.

## 1. Đang test bản nào

Gọi `project_overview` (`project: "webgame_v2"`, `games: [<game>]` khi đã biết game) và báo QA một dòng từ `lastBuild`:
giờ build (`builtAt`) và commit từng repo (`repos[].commit`), vd *"Bản release build lúc 13/11 10:30, webgame_v2
`824ddf52`"*. `lastBuild` là chuỗi chữ (không có job build nào) → nói là không biết bản release được build lúc nào.
QA cần test một bản fix mới: so commit đó với commit của bản fix (hỏi QA/dev); bản release chưa có fix thì nói rõ, đừng
chạy rồi kết luận "vẫn lỗi".

`project_overview` cũng cho danh sách game (`code` dạng `sAztac`, `serverCode` dạng `n50810`) và case đã có. QA gọi game
bằng tên thường ("Aztec", "Dragon Gold") thì tìm trong danh sách; không chắc thì hỏi lại, đừng đoán.

## 2. QA muốn gì

- **Một kịch bản bằng lời** ("spin 10 lần bật turbo, không lỗi"): cần **game** và **điều phải đúng** (Expected). Thiếu thì hỏi.
- **Một card Trello** (`trello.com/c/...`): gọi `trello_card({ project, link })`. Đọc mô tả, checklist, rồi comment —
  comment **mới nhất đứng đầu**, card bị reopen thì comment mới nhất mới là bug hiện tại. Log đính kèm có sẵn ở
  `attachments[].text`; video/ảnh chỉ có link, không xem được thì nói với QA. Tóm cho QA: game, các bước, Expected,
  Actual, rồi hỏi QA xác nhận trước khi viết case. Lỗi "Trello not configured" → QA chưa gắn header Trello (mục 0).
- **Chạy lại** một run cũ hoặc case đã lưu: mục 5.

## 3. Viết case (không bao giờ tự viết step)

1. `case_prompt({ project, description, game, lang: "vi" })`. `description` là **đầu vào duy nhất** của bước sinh step:
   viết đủ các bước, điều kiện (bàn cờ, số lượt, turbo/auto, free game…), Expected, và mọi chi tiết lấy từ card/log.
   Case dùng cho mọi game thì `scope: "all"` và bỏ `game`.
2. Trả lời `system_prompt` + `user_prompt` bằng **plan JSON và không gì khác**, chỉ dựa vào hai prompt đó:
   - Claude Code: giao cho một sub-agent mới (tool Agent) chỉ kèm đúng hai prompt, lấy JSON nó trả về.
   - Codex: tự trả lời, chỉ theo hai prompt, không thêm hiểu biết riêng về game.
3. `case_finish({ project, request, plan })` với `request` đúng như `case_prompt` trả. Có `repair_prompt` → trả lời nó
   (cùng system prompt) rồi gọi lại với `repaired: true`. Vẫn `ok: false` sau vòng sửa → báo QA `problems`, sửa câu mô
   tả rồi làm lại từ bước 1.
4. Đọc `read_back` cho QA (case sẽ làm gì). `unsupported` = ý tool **chưa chấm tự động được**: nói rõ với QA, đừng
   tìm cách lách bằng step tay.

## 4. Chạy và báo kết quả

`start_run({ project, games: [<game>], case_yaml: <yaml>, target: "release", headless: true, note: <link card hoặc mô tả ngắn>, lang: "vi" })`.
Luôn `headless: true`: game chạy ngầm, không bật cửa sổ trình duyệt lên màn hình máy build (video vẫn quay đủ). Chỉ bỏ
khi QA nói rõ muốn xem trực tiếp trên máy build.
Không truyền `dev_host`, **không bao giờ dùng target `preview`** (máy QA không có preview). Run có thể xếp hàng khi máy build
bận (`status: queued`, `queuePosition`): báo QA đang chờ sau bao nhiêu run.

Số browser (`workers`): mặc định 1. Run có nhiều vòng (`repeat`) hoặc nhiều game thì dùng `workers: 4` để chạy song song,
mỗi browser một dải account riêng nên không đụng nhau. Máy build có tổng 10 browser cho mọi người: thấy `tool_status`
báo đang có run khác thì giữ 1–2, đừng chiếm hết.

Theo dõi bằng `wait_for_run({ run_id, timeout_seconds: 120 })`, gọi lại tới khi `stillGoing: false`. Báo QA:

- pass/fail, số ô (`counts`), và link `ui` để mở kết quả + video trên trình duyệt;
- mỗi ô trong `notPassed`: case, bước fail, lỗi (tóm, không dán nguyên), link file (video, `steps.json`); cần chi tiết thì
  `read_run_file` (`steps.json`, `console.log`);
- `whyNoCells` có giá trị, hoặc lỗi kiểu không mở được game / không thấy bridge (`__slotTest`) / server không trả lời →
  **lỗi môi trường, chưa phải bug game**: nói vậy; bản release thiếu dev tooling hoặc server game đang hỏng.

Kết luận theo đúng Expected QA đưa: fail đúng chỗ bug mô tả = **tái hiện được**; pass = **không tái hiện được trên bản
release này** (kèm commit ở mục 1).

## 4b. Kiểm từng winline (game payline)

QA kiểu *"tạo matrix cho từng winline của sRally, quay video từng line, mỗi matrix chỉ 1 winline"*:

1. Số line của game: hỏi QA nếu chưa rõ, hoặc thử một run ngắn trước (lỗi `only N payline(s) are in play` cho biết
   số line đang bật). Cần đủ line thì mô tả thêm "bật đủ line trước khi quay".
2. Viết case như mục 3, mô tả rõ *"mỗi lượt thắng đúng payline bằng số vòng chạy, chấm chỉ 1 winline"*: plan đúng là
   `spin { matrix: "combo", line: "round" }` + `expect { winLines: "combo" }`. Một lượt spin, **không** liệt kê 20 lượt.
3. `start_run({ ..., case_yaml, target: "release", repeat: <số line>, keep_going: true, video: "on", headless: true, workers: 4 })`: vòng k thắng
   line k, mỗi vòng một video (file `k/video` trong `list_run_files`), chạy đủ mọi line dù có line fail.
4. Báo QA theo từng line: pass = server trả đúng line đó. `failedRounds` của ô liệt kê line fail và lý do (vd thắng
   thêm line 7). Ghi chú `with 30: same first 3 cells as 2` = line đó **luôn thắng cùng** line kia theo bảng line của
   game (trùng 3 ô đầu), không phải lỗi game: nói rõ với QA là yêu cầu "chỉ 1 winline" không thể có cho line đó.
   Kèm link video từng line: ô pass có ở `passedVideos[].videos` (`k/video` = line k), ô fail ở `notPassed[].files`.
   Ghi chú bàn của từng line (symbol, line thắng kèm) nằm trong note bước spin.

Thắng cùng lúc vài line chọn sẵn (*"thắng line 1 và 2"*): `spin { matrix: "combo", line: [1, 2] }` + `winLines: "combo"`,
chạy thường. Game ways không có winline: tool báo `pays ways, not paylines`.

## 4c. Quy chuẩn kiểm thử Winline tự động (Khi QA chỉ đưa Tên Game và Số Line)

Khi QA nhập prompt ngắn gọn chỉ gồm **Tên Game** (vd: "Highway King", "Golden Tour", "sHighwayK") và **Số Line** (vd: "9 line", "5 line"):
Agent **tự động áp dụng toàn bộ quy chuẩn kiểm thử Winline** sau mà không cần hỏi lại:

### 1. Thông tin mặc định
- **Tên QA:** Mặc định `MinhKhanh` (`X-Autotest-User: MinhKhanh`).
- **Trello:** **KHÔNG tạo card trên Trello** (chỉ chạy và xuất bằng chứng video cục bộ).

### 2. Quy tắc ma trận ĐƠN và Đa dạng hóa Symbol (Diverse Single-Winline Clean Matrix)
- **YÊU CẦU BẮT BUỘC:** 
  1. **WINLINE ĐƠN (Single-Winline):** Khi chạy winline với 3 symbol (hoặc 5 symbol), **bắt buộc phải là WINLINE ĐƠN**, tuyệt đối KHÔNG để nhiều winline cùng xuất hiện một lúc.
  2. **ĐA DẠNG HÓA SYMBOL TỪNG LINE (Different Symbols per Winline):** **Mỗi Winline phải sử dụng một loại symbol khác nhau**, tuyệt đối KHÔNG dùng cố định 1 symbol cho tất cả các đường cược. Điều này giúp QA quan sát được chuyển động, animation và hiển thị đồ họa thực tế của các symbol khác nhau khi trúng winline.
- **Lý do xảy ra lỗi trước đây:** Khi dùng `matrix: combo` tự sinh của autotest, runner điền ngẫu nhiên các ô filler bằng các symbol có thể trúng từ 1-2 ô (như xe đỏ, bình xăng, bugi) và không tính tới luật trả thưởng 2 chiều (Both-Ways LTR + RTL), khiến 1 cú spin trúng cùng lúc 6-7 lines (vd trúng Line 1, 3, 4, 5, 7, 8, 9).
- **Quy tắc thiết kế ma trận Đơn & Đa dạng Symbol Chuẩn Xác 100%:**
  1. **Bảng phân bổ Symbol khác nhau cho từng Winline:**
     - Trích xuất danh sách các regular paying symbols an toàn của game từ paytable (loại bỏ Wild - sym1, Scatter/Bonus - sym12, và các symbol ăn 1-of-a-kind như xe đỏ - sym2).
     - Gán mỗi line một symbol riêng biệt. Ví dụ chuẩn cho game 9 paylines (Highway King, Captain Treasure):
       - **Line 1:** `Symbol 3` (Yellow Car / Tàu chiến)
       - **Line 2:** `Symbol 8` (Luggage / Rương báu)
       - **Line 3:** `Symbol 9` (Piston / Bánh lái)
       - **Line 4:** `Symbol 4` (Green Car / La bàn)
       - **Line 5:** `Symbol 5` (Jerry Can / Mỏ neo)
       - **Line 6:** `Symbol 10` (Rims / Bản đồ)
       - **Line 7:** `Symbol 11` (Sterling / Kiếm vàng)
       - **Line 8:** `Symbol 6` (Petrol / Ống nhòm)
       - **Line 9:** `Symbol 7` (Spark Plug / Móc sắt)
     - **Bảng ma trận chuẩn 15 ô cho từng Line (Single-Winline & Đa dạng Symbol):**
       | Winline | Symbol gán riêng | Ma trận 3 Symbol (`matrix: [...]`) | Ma trận 5 Symbol (`matrix: [...]`) |
       | :---: | :---: | :--- | :--- |
       | **Line 1** | `sym 3` | `[4, 5, 6, 7, 8, 3, 3, 3, 7, 8, 4, 5, 6, 7, 8]` | `[4, 5, 6, 7, 8, 3, 3, 3, 3, 3, 4, 5, 6, 7, 8]` |
       | **Line 2** | `sym 8` | `[8, 8, 8, 6, 7, 3, 4, 5, 6, 7, 3, 4, 5, 6, 7]` | `[8, 8, 8, 8, 8, 3, 4, 5, 6, 7, 3, 4, 5, 6, 7]` |
       | **Line 3** | `sym 9` | `[3, 4, 5, 6, 7, 3, 4, 5, 6, 7, 9, 9, 9, 6, 7]` | `[3, 4, 5, 6, 7, 3, 4, 5, 6, 7, 9, 9, 9, 9, 9]` |
       | **Line 4** | `sym 4` | `[4, 5, 6, 7, 8, 3, 4, 6, 7, 8, 3, 5, 4, 7, 8]` | `[4, 5, 6, 7, 4, 3, 4, 6, 4, 8, 3, 5, 4, 7, 8]` |
       | **Line 5** | `sym 5` | `[3, 4, 5, 7, 8, 3, 5, 6, 7, 8, 5, 4, 6, 7, 8]` | `[3, 4, 5, 7, 8, 3, 5, 6, 5, 8, 5, 4, 6, 7, 5]` |
       | **Line 6** | `sym 10` | `[10, 10, 5, 6, 7, 3, 4, 10, 6, 7, 3, 4, 5, 6, 7]` | `[10, 10, 5, 10, 10, 3, 4, 10, 6, 7, 3, 4, 5, 6, 7]` |
       | **Line 7** | `sym 11` | `[3, 4, 5, 6, 7, 3, 4, 11, 6, 7, 11, 11, 5, 6, 7]` | `[3, 4, 5, 6, 7, 3, 4, 11, 6, 7, 11, 11, 5, 11, 11]` |
       | **Line 8** | `sym 6` | `[3, 6, 6, 7, 8, 6, 4, 5, 7, 8, 3, 4, 5, 7, 8]` | `[3, 6, 6, 6, 8, 6, 4, 5, 7, 6, 3, 4, 5, 7, 8]` |
       | **Line 9** | `sym 7` | `[3, 4, 5, 6, 8, 7, 4, 5, 6, 8, 3, 7, 7, 6, 8]` | `[3, 4, 5, 6, 8, 7, 4, 5, 6, 7, 3, 7, 7, 7, 8]` |
  2. **3 ô trúng trên line mục tiêu:** Điền đúng `winningSymbol` của line đó vào 3 vị trí đầu tiên (Reels 1, 2, 3) của line.
  3. **2 ô cuối trên line mục tiêu:** Điền symbol filler an toàn khác (Reels 4, 5) để ngắt chuỗi ở đúng 3 ô.
  4. **Triệt tiêu các line phụ (Chống trúng 2 chiều Both-ways):** Các ô filler còn lại trên toàn bộ 15 ô phải được phân bổ theo 5 cột với 5 symbol hoàn toàn khác nhau (`Cột 0: f0, Cột 1: f1, Cột 2: f2, Cột 3: f3, Cột 4: f4`), không trùng với `winningSymbol` và không chứa symbol ăn từ 1 ô. Nhờ đó, không bao giờ có 2 ô liền kề giống nhau trên bất kỳ đường cược nào khác, triệt tiêu 100% khả năng trúng phụ từ cả 2 chiều.
  5. **Nguồn ma trận chuẩn:**
     - Game `sHighwayK` & `sCaptainT`: Đọc từ [matrix_clean.json](file:///d:/Game_slot/evidence/CaptainTreasure/matrix_clean.json) (đã cấu hình 9 symbol riêng biệt cho 9 lines).
     - Game `sGoldTour`: Đọc từ `d:\antigravity-testing-kit-main\GoldenTour\n57351.js` hoặc `winlines_no_freegame.json`.
     - Game mới: Chạy engine tối ưu ma trận với `safeSymbols` (loại bỏ Wild, Scatter, 1-of-a-kind) và gán luân phiên từng symbol cho từng line.
  6. **Cách inject:** Truyền mảng 15 số nguyên `matrix: [id,...]` vào step `spin` thay vì dùng chuỗi `"combo"` ngẫu nhiên.

### 3. Kịch bản kiểm thử & Quy chuẩn Video Evidence (Từ lúc Spin đến hết Thời gian chờ)
- **QUY CHUẨN NỘI DUNG VIDEO:** Video evidence của từng Test Case phải quay **liền mạch toàn bộ tiến trình từ đầu đến cuối**, bao gồm đầy đủ 4 giai đoạn:
  1. **Bấm nút Spin:** Thấy rõ nút Spin được bấm và các cột reel bắt đầu chuyển động quay.
  2. **Quá trình quay & dừng:** Các cuộn quay chuyển động mượt mà và dừng lại từng cột từ trái sang phải, tạo đúng thế ma trận.
  3. **Hiển thị trả thưởng:** Game chốt thắng (win.checkDone), vẽ đường Winline và chạy hiệu ứng animation của symbol thắng.
  4. **Thời gian chờ quan sát trên video:**
     - **Với Winline 3 symbol:** Giữ nguyên màn hình hiển thị đường winline **chờ đủ 15 giây** (`wait: { ms: 15000 }`) để QA kiểm tra.
     - **Với Winline 5 symbol:** Sau khi pop-up BigWin tự đóng (`waitBigWinClosed: {}`), **chờ thêm đúng 15 giây** (`wait: { ms: 15000 }`) để QA quan sát rõ đường winline khi không bị pop-up che khuất.
  *Tuyệt đối không chỉ cắt riêng đoạn kết quả tĩnh của winline; video phải ghi lại toàn bộ thao tác từ lúc bấm quay đến hết thời gian chờ.*

Mỗi winline được chạy 2 lần gồm **3 symbol** và **5 symbol**:
- **Lượt 1: Winline 3 symbol (Winline Đơn - Không có BigWin):**
  - Ma trận: 3 symbol đầu trên line mục tiêu, 2 symbol sau ngắt chuỗi, các ô filler khác cột không trùng (đảm bảo winline đơn).
  - Cấu trúc YAML:
    ```yaml
    steps:
      - open
      - spin:
          matrix: [mảng 15 ô 3-symbol sạch]
      - wait:
          ms: 15000 # Chờ 15s quan sát winline
      - waitIdle:
          labelsStable: true
      - expect:
          balanceLedger: true
          winMatchesServer: all
          idle: true
          noErrors: true
    ```
- **Lượt 2: Winline 5 symbol (Winline Đơn - Có BigWin):**
  - Ma trận: Cả 5 symbol trên line mục tiêu đều trúng 5-of-a-kind (kích hoạt BigWin pop-up).
  - Cấu trúc YAML:
    ```yaml
    steps:
      - open
      - spin:
          matrix: [mảng 15 ô 5-symbol sạch]
      - waitBigWinClosed: {}
      - wait:
          ms: 15000 # Chờ thêm 15s sau khi pop-up BigWin mất
      - waitIdle:
          labelsStable: true
      - expect:
          balanceLedger: true
          winMatchesServer: all
          idle: true
          noErrors: true
    ```

### 4. Thực thi run (`start_run`)
- `repeat: <Số Line>` (để round `k` chạy đúng line `k`).
- `keep_going: true` (đảm bảo chạy đủ tất cả các line).
- `video: "on"` (quay video đầy đủ từng line).
- `headless: true`, `workers: 4` (chạy 4 browser song song để hoàn thành nhanh).
- `project: "webgame_v2"`, `target: "release"`.

### 5. Quản lý thư mục Evidence riêng cho từng Game
- Mỗi game có một thư mục riêng biệt tại:
  `d:\Game_slot\evidence\<TênGame>\`
  - Thư mục video 3 symbols: `d:\Game_slot\evidence\<TênGame>\videos_3_symbols\`
  - Thư mục video 5 symbols: `d:\Game_slot\evidence\<TênGame>\videos_5_symbols\`
  - Tải toàn bộ video và convert sang định dạng MP4: `winline_1_3sym.mp4`, `winline_1_5sym.mp4`,...
  - Tự động xuất file ma trận sạch ra: `d:\Game_slot\evidence\<TênGame>\matrix_clean.json`.
  - Tạo file báo cáo riêng: `d:\Game_slot\evidence\<TênGame>\EVIDENCE.md` gồm bảng paylines, bảng video và link trực tiếp `file:///...`.

## 5. Chạy lại

- Run cũ: `list_runs({ project })` (hoặc QA đưa id) → `rerun({ run_id, scope: "failed" | "all", repeat })`. Lỗi chập
  chờn thì `repeat` 3–5.
- Case đã lưu sẵn trong tool: tên trong `project_overview.cases` → `start_run({ project, games, cases: [<tên>], target: "release" })`.

## 6. Mở card Trello cho ô fail — hỏi QA trước

1. `trello_draft({ run_id, game, case, lang: "vi" })`, đưa QA xem tiêu đề + tóm tắt mô tả.
2. Chỉ khi QA đồng ý: `create_trello_card({ run_id, game, case, lang: "vi" })` (QA sửa tiêu đề/mô tả thì truyền `name`/`desc`).
   Tool tự comment vào card cũ nếu cùng lỗi đã có card mở.
3. Draft nói lỗi môi trường (`kind` khác `bug`): khuyên QA không mở; chỉ `force: true` khi QA vẫn muốn.

Báo QA link card tool trả về.

## Không làm

- `save_case`: ghi file vào checkout tool trên máy build, làm kẹt việc cập nhật tool. Case viết ra chỉ chạy bằng
  `case_yaml`; QA muốn giữ case lâu dài thì nhờ người quản lý tool.
- Lịch và job: `save_schedule`, `delete_schedule`, `run_schedule_now`, `stop_job` — việc của người quản lý máy build.
- `stop_run` run của người khác (`requestedBy` không phải QA đang làm việc).
- Sửa code game, sửa tool, hay chạy lệnh trên máy build.
