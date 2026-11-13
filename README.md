# Check Winline - Autotest QA

Repository chứa cấu hình Skill và kịch bản autotest kiểm tra Winline (Game Slot) trên nền tảng Autotest MCP.

## Tính năng chính & Quy chuẩn Winline
- **Kịch bản kiểm tra Winline tự động:**
  - Hỗ trợ chạy từng payline với ma trận 3 symbol và 5 symbol.
  - **Ma trận đơn sạch (Single-Winline Clean Matrix):** Triệt tiêu hiện tượng dính nhiều winline cùng lúc nhờ thuật toán phân bổ 5 cột filler khác nhau, chống trả thưởng 2 chiều (Both-Ways Left-to-Right và Right-to-Left).
  - **Video Evidence:** Ghi hình liền mạch từ lúc nhấn nút **Spin** $\rightarrow$ cuộn quay $\rightarrow$ dừng lại chốt thưởng $\rightarrow$ thời gian chờ quan sát.
  - **Thời gian chờ quan sát:**
    - Winline 3 symbol: Chờ 15s sau khi dừng guồng.
    - Winline 5 symbol: Chờ pop-up BigWin tự đóng + chờ tiếp 15s quan sát.
- **Thư mục Evidence cục bộ:** Thư mục `evidence/` được lưu trữ tại local và bỏ qua (ignore) trên Git.

## Cấu trúc thư mục
```text
├── .agent/
│   └── skills/
│       └── autotest-qa/
│           └── SKILL.md       # Cấu hình skill autotest-qa chuẩn
├── .agents/
│   └── skills/
│       └── autotest-qa/
│           └── SKILL.md       # Bản sao dự phòng cho agent
├── .gitignore                 # Bỏ qua thư mục evidence
└── README.md
```
