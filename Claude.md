# Hướng dẫn Phát triển Dự án: Sentinel Platform (Aegis Core Analytics)

Tài liệu này định hình kiến trúc, quy chuẩn giao diện (design system) và lộ trình phát triển cho **Sentinel Platform** (tên gọi nội bộ có tính bảo mật cao, giao diện tinh giản, hiện đại giống thiết kế công nghiệp cao cấp). 

Hệ thống được thiết kế theo phong cách tối giản, sang trọng (kết hợp thép không gỉ, kính mờ tối màu và các chi tiết tương phản mạnh), sử dụng ngôn ngữ học thuật/doanh nghiệp chuyên nghiệp để bảo mật mục đích trinh sát thực tế nhưng người trong ngành vẫn nhận diện được ngay công năng nghiệp vụ.

---

## 1. Bản Đồ Thuật Ngữ Nghiệp Vụ & Thương Mại (Terminology Mapping)

Để đảm bảo tính bảo mật khi người ngoài nhìn vào (giống một công cụ phân tích dữ liệu doanh nghiệp lớn hoặc hạ tầng mạng), toàn bộ tiêu đề và nhãn chức năng trên giao diện sẽ sử dụng các thuật ngữ thương mại hóa sang trọng:

| Thuật ngữ nghiệp vụ thực tế | Tên hiển thị trên giao diện (Discreet Label) | Mô tả chi tiết / Phụ đề tiếng Anh |
| :--- | :--- | :--- |
| **Phân tích tọa độ Cell-LAC (Định vị Trạm Thu Phát)** | **Hệ Phân Tích Viễn Thông Không Gian (GTP)** | *Geospatial Telemetry Processor (GTP)* - Phân tích phân bổ nút sóng và lịch trình di chuyển thiết bị. |
| **Lọc và phân tích Sao Kê Ngân Hàng** | **Bộ Đối Soát Luồng Tài Chính Doanh Nghiệp (FLA)** | *Financial Ledger Analyzer (FLA)* - Phân tích tần suất giao dịch đột biến và dòng tiền bất minh. |
| **Tạo link bẫy IP (Tracking Beacon)** | **Trình Xác Thực & Kiểm Toán Điểm Cuối (SRAU)** | *Secure Endpoint Audit Utility (SRAU)* - Tạo liên kết kiểm tra bảo mật, định danh IP và cấu hình chuyển hướng. |
| **Đối tượng cần trinh sát / bắt giữ** | **Nút Mục Tiêu / Điểm Cuối Đang Kiểm Toán** | *Subject Node / Client Endpoint* |
| **Địa bàn/Hiện trường vụ án** | **Khu Vực Phân Bổ Thiết Lập (Zone)** | *Deployment Zone* |

---

## 2. Quy Chuẩn Thiết Kế & Mỹ Thuật (Stainless Steel & Brushed Metal)

Dựa trên hình ảnh thiết kế công nghiệp từ trang tham chiếu (chất liệu kim loại xước mờ cao cấp, phối tông xám xi măng, đen graphite và xanh cyan đặc trưng của màn hình điều khiển quân sự/chuyên dụng), giao diện sẽ mang lại cảm giác tin cậy, chính xác và phản hồi tức thì.

### Bảng màu đặc trưng (Curated HSL Palette)
*   **Nền tối chủ đạo:** `hsl(220, 15%, 8%)` — Màu xám đen matte sâu thẳm, tạo độ tập trung cao.
*   **Khung chức năng (Card background):** `hsl(215, 12%, 13%)` — Màu thép xước mờ nhẹ.
*   **Màu nhấn nghiệp vụ (Active Accent):** `hsl(180, 75%, 45%)` — Xanh Cyan sáng (màu dạ quang của ống nhòm đêm hoặc radar chuyên dụng).
*   **Màu cảnh báo bất minh:** `hsl(0, 75%, 50%)` — Đỏ thẫm cảnh báo dòng tiền bất thường/thiết bị mất kết nối.
*   **Đường viền cực mảnh (Border):** `rgba(255, 255, 255, 0.08)` — Tạo cảm giác kính ghép tinh xảo.

### Font chữ đề xuất
*   **Tiêu đề & Chỉ số kỹ thuật:** `Roboto Mono` hoặc `Outfit` (sạch sẽ, mang tính toán học, tạo cảm giác chuyên nghiệp giống các thiết bị định vị vệ tinh).
*   **Nội dung chi tiết:** `Inter` (tối ưu hóa hiển thị bảng biểu và dòng trạng thái).

---

## 3. Kiến Trúc Các Phân Hệ Chức Năng (Core Modules)

### Phân Hệ A: Geospatial Telemetry Processor (GTP)
*   **Đầu vào:** Hỗ trợ kéo thả tệp tin dữ liệu mạng cung cấp (XLSX, CSV) chứa các cột: `MCC`, `MNC`, `LAC`, `Cell-ID`, `Thời gian`, `Cường độ tín hiệu`.
*   **Xử lý nghiệp vụ:**
    *   Tự động phân tích và chuyển đổi Cell-LAC sang tọa độ địa lý dựa trên cơ sở dữ liệu trạm phát sóng (hỗ trợ nạp file tọa độ trạm nội bộ).
    *   Dựng biểu đồ đường đi (lịch trình di chuyển của nút mục tiêu) theo trục thời gian thực.
*   **Giao diện hiển thị:**
    *   Bản đồ vector đơn sắc (Monochrome Dark Map).
    *   Thanh trượt thời gian (Time Slider) để dựng lại hoạt cảnh di chuyển với các hạt hiệu ứng (micro-animations) nối các điểm chốt sóng.

### Phân Hệ B: Financial Ledger Analyzer (FLA)
*   **Đầu vào:** File Excel/CSV sao kê của các ngân hàng thương mại phổ biến.
*   **Tính năng cốt lõi:**
    *   **Lọc tần suất giao dịch:** Tự động phát hiện các giao dịch lặp lại với số tiền giống nhau hoặc khoảng thời gian định kỳ bất thường.
    *   **Truy tìm dòng tiền bất minh:** Cơ chế lọc thông minh lọc nhanh các giao dịch có giá trị lớn vượt ngưỡng tùy chỉnh (ví dụ: chuyển khoản > 100 triệu), hoặc các giao dịch phát sinh vào khung giờ nhạy cảm (23h - 4h sáng).
    *   **Dựng đồ thị dòng tiền:** Biểu diễn trực quan hóa các luồng tiền chuyển tiếp qua lại giữa các số tài khoản dưới dạng mạng lưới kết nối (Node Link Diagram).

### Phân Hệ C: Secure Redirect & Audit Utility (SRAU)
*   **Tính năng:** Tạo link kiểm tra định danh thiết bị truy cập phục vụ xác minh vị trí đối tượng (trong môi trường thực nghiệm/được phép).
*   **Dữ liệu thu thập:** Địa chỉ IP Public, Nhà mạng cung cấp (ISP), Vị trí địa lý ước tính, Thiết bị sử dụng (User-Agent), Độ phân giải màn hình, Độ trễ mạng (Ping) và Thời gian click chính xác tới mili-giây.
*   **Trình cấu hình bẫy (Decoy Link):**
    *   Cho phép thiết lập trang chuyển hướng ngụy trang (ví dụ: link bài báo hot, link tải file tài liệu PDF, link hình ảnh phong cảnh).
    *   Bảng nhật ký thời gian thực (Live Stream Audit Logs) cập nhật lập tức qua WebSockets khi đối tượng nhấp vào liên kết.

---

## 4. Đặc Tả Giao Diện Mẫu (CSS & HTML Blueprint)

Giao diện mẫu dưới đây sử dụng cấu trúc Grid hiện đại, tối giản, bo góc mượt mà và hiệu ứng phản hồi trượt khi di chuột (hover effects):

```html
<div class="sentinel-dashboard">
  <!-- GTP Card -->
  <div class="tactical-card">
    <div class="card-status-bar">
      <span class="pulse-indicator online"></span>
      <span class="module-code">GTP-V4</span>
    </div>
    <h3 class="card-title">Hệ Không Gian Telemetry</h3>
    <p class="card-desc">Xử lý phân rã tọa độ trạm phát và liên kết lộ trình di chuyển lịch trình.</p>
    <div class="card-action">
      <button class="btn-tactical">Khởi Chạy Module</button>
    </div>
  </div>

  <!-- FLA Card -->
  <div class="tactical-card">
    <div class="card-status-bar">
      <span class="pulse-indicator online"></span>
      <span class="module-code">FLA-ANALYTICS</span>
    </div>
    <h3 class="card-title">Đối Soát Luồng Ledger</h3>
    <p class="card-desc">Quét dòng tài chính bất thường, phân tích tần suất giao dịch và kết nối dòng tiền.</p>
    <div class="card-action">
      <button class="btn-tactical">Nạp Dữ Liệu</button>
    </div>
  </div>

  <!-- SRAU Card -->
  <div class="tactical-card warning-state">
    <div class="card-status-bar">
      <span class="pulse-indicator standby"></span>
      <span class="module-code">SRAU-BEACON</span>
    </div>
    <h3 class="card-title">Kiểm Toán Điểm Cuối</h3>
    <p class="card-desc">Thiết lập cấu hình định danh bảo mật và ghi nhận thông số IP telemetry thời gian thực.</p>
    <div class="card-action">
      <button class="btn-tactical btn-warning">Tạo Beacon</button>
    </div>
  </div>
</div>
```

### Bộ Style CSS Đi kèm
```css
:root {
  --bg-sentinel: #0b0d11;
  --panel-steel: #13161c;
  --accent-cyan: #00f0ff;
  --border-light: rgba(255, 255, 255, 0.07);
  --text-active: #f1f5f9;
  --text-dim: #94a3b8;
}

body {
  background-color: var(--bg-sentinel);
  color: var(--text-active);
  font-family: 'Inter', sans-serif;
}

.tactical-card {
  background: linear-gradient(145deg, var(--panel-steel), #181d26);
  border: 1px solid var(--border-light);
  border-radius: 6px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  position: relative;
  overflow: hidden;
}

.tactical-card:hover {
  border-color: var(--accent-cyan);
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(0, 240, 255, 0.15);
}

.pulse-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 6px;
}

.pulse-indicator.online {
  background-color: var(--accent-cyan);
  box-shadow: 0 0 8px var(--accent-cyan);
}

.btn-tactical {
  background: transparent;
  border: 1px solid var(--accent-cyan);
  color: var(--accent-cyan);
  padding: 8px 16px;
  font-family: 'Roboto Mono', monospace;
  font-size: 0.85rem;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-tactical:hover {
  background-color: var(--accent-cyan);
  color: var(--bg-sentinel);
  box-shadow: 0 0 15px rgba(0, 240, 255, 0.4);
}
```

---

## 5. Kế Hoạch Triển Khai & Kiểm Thử Nghiệp Vụ

1.  **Bước 1: Thiết lập Hệ Thống Core Style**
    *   Tích hợp bộ CSS biến thể kim loại và nền tối.
    *   Khởi tạo bộ font chuyên dụng (`Inter`, `Outfit`, `Roboto Mono`).
2.  **Bước 2: Xây Dựng Trình Đọc Offline (Zero-Server-Leak)**
    *   Để đảm bảo an toàn tuyệt đối cho thông tin nghiệp vụ và hồ sơ sao kê, toàn bộ logic lọc và phân tích sao kê (FLA), vẽ đồ thị, cũng như chuyển đổi Cell-LAC (GTP) sẽ được thực thi **ngay trên Trình duyệt của điều tra viên (Client-side)**, không truyền bất kỳ tệp dữ liệu nào về máy chủ.
3.  **Bước 3: Lập trình Bộ Thu IP Mềm (SRAU Lab)**
    *   Phát triển máy chủ Node.js/Python siêu nhẹ để ghi lại log kết nối và thực hiện chuyển hướng tức thì sang link ngụy trang đã cấu hình.
4.  **Bước 4: Kiểm thử Tải & Tương Thích**
    *   Thực hiện chạy thử nghiệm với file dữ liệu sao kê thực tế dung lượng lên tới 50.000 dòng để tối ưu tốc độ kết xuất dữ liệu.
