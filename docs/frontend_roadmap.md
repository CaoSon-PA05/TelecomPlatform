# 🖥️ Lộ Trình Phát Triển Frontend (Frontend Development Roadmap)
**Công nghệ:** React 18 / Next.js (Vite) + TailwindCSS + Shadcn/UI + Recharts + Leaflet Maps

---

## 1. Bản Đồ Trải Nghiệm Người Dùng (User Flow Map)

```
[Tải Tệp Excel Lên] ──► [Hiệu Ứng Quét Tiến Trình] ──► [Bảng Điều Khiển Sentinel]
                                                            │
         ┌──────────────────┬───────────────────────────────┴─────────────────┐
         ▼                  ▼                                                 ▼
[1. Thông Tin Thuê Bao]  [2. Phân Tích Lộ Trình]                      [3. Đối Soát Chéo]
- Hồ sơ nhân thân        - Bản đồ vệ tinh động (Leaflet)              - So sánh tập hợp liên lạc
- Ghi chú điều tra       - Phát lại lịch sử timeline theo thanh trượt - So sánh trùng khớp địa điểm
- Lịch sử dùng thiết bị  - Bảng ghi tọa độ chi tiết                   - So sánh sử dụng chung IMEI
```

---

## 2. Các Giai Đoạn Phát Triển Chi Tiết

### Giai Đoạn 1: Dựng Khung Giao Diện & Thiết Kế Thép (UI/UX Foundation)
1.  **Thiết lập dự án:** Khởi tạo SPA React bằng Vite để tối ưu hóa tốc độ.
2.  **Tích hợp TailwindCSS & Shadcn/UI:** Cấu hình bảng màu HSL đặc thù (Slate, Graphite, Neon Cyan, Warning Dark Red) lấy cảm hứng từ trang thiết bị cơ khí cao cấp ICAM.
3.  **Xây dựng bộ Layout chính (Sidebar + Topbar):**
    *   *Sidebar:* Quản lý các tab tác nghiệp và hiển thị trạng thái mã hóa phiên làm việc của trinh sát.
    *   *Topbar:* Hiển thị thời gian thực theo múi giờ tác chiến, tên chuyên án đang mở, và nút đăng xuất an toàn.

### Giai Đoạn 2: Xây Dựng Trang Chi Tiết & Bảng Dữ Liệu Lớn (CDR Viewer)
1.  **Bảng nhật ký CDR tốc độ cao:**
    *   Tích hợp thư viện `@tanstack/react-table` hỗ trợ phân trang mượt mà (Pagination), tìm kiếm bộ lọc nhanh (Global Search Filter), và lọc động theo khoảng thời gian/thứ trong tuần.
    *   Xử lý hiển thị các nhãn cảnh báo giao dịch/cuộc gọi đáng ngờ trong khung giờ nhạy cảm hoặc thời lượng bất thường.
2.  **Thông tin chi tiết mục tiêu:**
    *   Giao diện thẻ hồ sơ nhân thân sang trọng hiển thị đầy đủ thông số giải mã từ cơ sở dữ liệu.
    *   Trình soạn thảo ghi chú điều tra lưu trữ trực tiếp vào DB.

### Giai Đoạn 3: Trực Quan Hóa Bản Đồ & Quỹ Đạo Di Chuyển (GTP Map Component)
1.  **Tích hợp Bản đồ Leaflet:**
    *   Sử dụng lớp bản đồ nền đơn sắc tối (CartoDB Dark Matter hoặc Mapbox Monochrome) để giữ đúng phong cách thiết kế nghiệp vụ tối giản.
    *   Hỗ trợ nạp và cache bản đồ ngoại tuyến (Offline Tiles Cache) phòng trường hợp trinh sát không có mạng internet tại hiện trường chuyên án.
2.  **Thanh trượt thời gian tương tác (Timeline Playback Slider):**
    *   Người dùng kéo thanh trượt để xem chấm đỏ mục tiêu di chuyển liên tiếp qua các trạm phát sóng BTS.
    *   Hiệu ứng hạt sáng neon chuyển động kết nối các trạm BTS được vẽ bằng Canvas/SVG để tối ưu hiệu năng hiển thị.

### Giai Đoạn 4: Trực Quan Biểu Đồ & Phân Hệ Đối Soát Chéo
1.  **Biểu đồ phân tích tần suất hành vi (Recharts):**
    *   Vẽ biểu đồ cột phân bố cuộc gọi theo 24 khung giờ trong ngày để tìm quy luật thức/ngủ của mục tiêu.
    *   Vẽ biểu đồ mạng lưới giao tiếp (Social Communication Network Graph) để nhận biết ngay nút liên lạc trung tâm của đường dây tội phạm.
2.  **Màn hình đối soát chéo (Comparator Panel):**
    *   Màn hình kéo thả nhiều tệp tin CDR chuyên án cùng một lúc.
    *   Bảng hiển thị kết quả giao liên lạc chung, hiển thị thời điểm hai đối tượng cùng kết nối tại một trạm BTS dưới dạng dòng thời gian song song (Parallel Timelines).

---

## 3. Quản Lý Trạng Thái Ứng Dụng (State Management)

Sử dụng thư viện **Zustand** siêu nhẹ để quản lý trạng thái đồng bộ:
*   `activeFileState`: Lưu thông tin file phân tích hiện hành đang mở.
*   `compareSessionState`: Lưu danh sách các file đang được chọn để đối soát chéo và kết quả đối soát trả về từ API.
*   `uiConfigState`: Lưu trạng thái thu phóng sidebar, cấu hình bản đồ (vệ tinh/đơn sắc) và bộ lọc thời gian toàn cục.
*   `authState`: Lưu trữ token phiên làm việc mã hóa JWT của trinh sát.
