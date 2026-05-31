# 📊 Báo Cáo Phân Tích Hệ Thống Cũ (Legacy System Analysis)
**Tác giả:** Senior Full-Stack Software Architect & Telecom Analytics Engineer  
**Hệ thống:** CDR Analyzer (Phân Tích Chi Tiết Nhật Ký Cuộc Gọi)

---

## 1. Phân Tích Hiện Trạng & Kiến Trúc Kỹ Thuật Cũ (Legacy Architecture)

### 1.1 Khảo Sát Tệp Tin & Cấu Trúc
Hệ thống cũ là một ứng dụng client-side thuần túy chạy trên trình duyệt web, được phân bổ trong thư mục `Mau/` gồm:
*   `index.html` (78.3 KB): Chứa cấu trúc giao diện Dashboard, các tab chức năng, modal cấu hình và các bảng hiển thị dữ liệu.
*   `styles.css` (85.5 KB): Chứa bộ quy chuẩn CSS cổ điển, xử lý toàn bộ bố cục, màu sắc, responsive và giao diện bảng biểu.
*   `script.js` (627.5 KB): Tệp JavaScript "phình to" cực lớn chứa toàn bộ logic xử lý, bao gồm:
    *   Thư viện đọc file Excel tích hợp (XLSX.js).
    *   Trình phân tích cú pháp (Parser) cho 3 nhà mạng Viettel, Vinaphone, Mobifone.
    *   Logic lưu trữ cục bộ bằng `LocalStorage`.
    *   Logic kết xuất Excel và vẽ bản đồ tọa độ Folium (thông qua xuất file HTML bản đồ).
    *   Giao diện kết xuất dữ liệu và điều khiển tabs.

### 1.2 Nhược Điểm Kiến Trúc Cũ (Bad Architecture & Duplicated Logic)
1.  **Monolithic Single-File (Tập tin Đơn Khối Khổng Lồ):** `script.js` nặng tới hơn 620KB chứa hàng chục nghìn dòng code. Việc gộp chung Logic Xử lý Dữ liệu viễn thông, Logic Giao diện (DOM Manipulation), Trực quan hóa Bản đồ, So sánh file và Xuất Excel vào một tệp duy nhất gây cực kỳ khó khăn cho việc bảo trì, debug và mở rộng.
2.  **Lưu trữ LocalStorage Giới Hạn:** Hệ thống sử dụng `LocalStorage` làm cơ sở dữ liệu. `LocalStorage` có giới hạn cứng từ 5MB - 10MB tùy trình duyệt. Đối với các file CDR viễn thông lớn chứa hàng chục ngàn bản ghi (mỗi file excel thực tế nặng 50KB - 200KB), dung lượng lưu trữ sẽ nhanh chóng bị quá tải sau khi import 3 - 5 file chuyên án.
3.  **Xử lý Excel Trên Client Tốn Tài Nguyên:** Việc đọc và phân tích cú pháp các file Excel lớn sử dụng thư viện JS thuần trên trình duyệt gây nghẽn luồng xử lý chính (Main Thread), làm đơ màn hình (UI Freezing) đối với các tệp tin chứa hơn 10.000 dòng.
4.  **Thiếu Khả Năng Liên Kết (Relational Mapping):** Hệ thống không có cơ sở dữ liệu quan hệ (Relational Database). Điều này làm hạn chế khả năng liên kết chéo thông tin giữa các chuyên án, ví dụ: tìm kiếm xem số điện thoại X đã xuất hiện ở những chuyên án nào, đi kèm thiết bị IMEI nào theo thời gian.

---

## 2. Kết Quả Đảo Ngược Quy Trình & Luật Viễn Thông (Reverse Engineered Rules)

Dựa trên việc quét và phân tích sâu 21 file Excel dữ liệu mẫu tại thư mục `File data mau`, chúng tôi đã làm rõ quy luật định dạng và cấu trúc dữ liệu của nhà mạng Viettel như sau:

### 2.1 Cấu Trúc Khối Metadata Thuê Bao (Header & Owner Block)
Mỗi tệp tin Excel là báo cáo lịch sử liên lạc thoại & SMS của một số thuê bao mục tiêu. Cấu trúc gồm hai phần riêng biệt:
1.  **Khối thông tin chủ sở hữu (Dòng 0 - 20):**
    *   `Họ Tên`: Tên chủ thuê bao (ví dụ: HỒ TẤT THANH HUYỀN, NGUYỄN ANH TUẤN).
    *   `Số thuê bao`: Số điện thoại đăng ký (định dạng 9 chữ số hoặc 10 chữ số).
    *   `Ngày sinh`, `Địa chỉ`, `Loại thuê bao` (Trả trước/Trả sau).
    *   `CCCD/Giấy tờ`, `Ngày cấp`, `Nơi cấp`.
    *   `Ngày kích hoạt`, `Tình trạng thuê bao` (Hoạt động/Khóa).
2.  **Khối dữ liệu chi tiết cuộc gọi CDR (Bắt đầu từ Dòng 21 hoặc Dòng 8):**
    *   Dòng tiêu đề chính chứa các ký tự định danh cột: `#`, `Số đi`, `Số đến`, `Thời gian`, `Giây`, `IMEI`, `Mã tỉnh`, `TYPE`, `Direction`, `Địa chỉ trạm BTS`, `LAC`, `Số Cell`.

### 2.2 Sơ Đồ Thuộc Tính Dữ Liệu Viễn Thông (Inferred Telecom Schema)

| Tên Cột Excel | Thuộc Tính Hệ Thống | Định Dạng Dữ Liệu | Vai Trò Nghiệp Vụ & Xử Lý |
| :--- | :--- | :--- | :--- |
| `#` | `stt` | Integer | Số thứ tự dòng bản ghi. |
| `Số đi` | `source_number` | String (Normalized) | Số điện thoại thực hiện cuộc gọi/gửi SMS. Chuẩn hóa đầu số (bỏ 84 đổi thành 0). |
| `Số đến` | `target_number` | String (Normalized) | Số điện thoại nhận cuộc gọi/nhận SMS. |
| `Thời gian` | `timestamp` | DateTime | Định dạng `dd/mm/yyyy hh:mm:ss`. Cần parse chính xác múi giờ UTC+7. |
| `Giây` | `duration` | Integer (Nullable) | Thời lượng cuộc gọi (giây). Tin nhắn SMS sẽ có giá trị rỗng/nan. |
| `IMEI` | `imei` | String (15 digits) | Mã định danh thiết bị phần cứng. Dùng để tra cứu thiết bị đã sử dụng. |
| `Mã tỉnh` | `province_code` | String (e.g. G059) | Mã tỉnh thành nơi thuê bao thực hiện kết nối. |
| `TYPE` | `call_type` | Enum (VOICE / SMS) | Phân loại phương thức liên lạc. |
| `Direction` | `direction` | String | Xác định chiều kết nối: Nội mạng, Ngoại mạng, Vas (Dịch vụ giá trị gia tăng). |
| `Địa chỉ trạm BTS` | `bts_station_name`| String | Tên/Địa điểm vật lý của cột phát sóng. |
| `LAC` | `lac_id` | String / Integer | Location Area Code - Mã vùng định vị trạm. |
| `Số Cell` | `cell_id` | String / Integer | Cell Identifier - Mã định danh nút phủ sóng cụ thể của trạm. |

### 2.3 Phân Tích Thuật Toán Nghiệp Vụ Trinh Sát Cốt Lõi
*   **Phân tích Tần Suất & Hành Vi:** Tính toán tổng số tương tác giữa Thuê bao chủ và các số liên lạc khác. Xếp hạng Top liên lạc dồn dập nhất.
*   **Phân tích CELL/LAC & Lộ Trình (Trajectory):** Dựa trên tọa độ trạm hoặc chuỗi trạm BTS kết nối theo dòng thời gian (`timestamp`), vẽ đường di chuyển của mục tiêu. Từ đó xác định địa bàn hoạt động chính và quy luật di chuyển thường nhật.
*   **Truy vết Thiết Bị (IMEI/IMSI Churning):** Theo dõi lịch sử thay đổi thiết bị của chủ thuê bao bằng cách tìm xem một số thuê bao đã lắp vào những thiết bị (IMEI) nào và ngược lại, một thiết bị IMEI đã được sử dụng bởi những số điện thoại nào.
*   **So Sánh Đồng Điệu (Comparative Analysis):**
    *   *Liên lạc chung:* Quét danh sách liên hệ của nhiều thuê bao khác nhau để tìm ra các "số liên lạc bắc cầu" chung (nghi ngờ là đồng phạm hoặc kẻ chỉ đạo).
    *   *Địa điểm chung:* Tìm các khoảng thời gian mà các thuê bao cùng xuất hiện tại cùng một trạm phát sóng (LAC/Cell) để chứng minh sự gặp gỡ trực tiếp tại hiện trường.

---

## 3. Đánh Giá Điểm Yếu & Cơ Hội Hiện Đại Hóa (Opportunities)

### 3.1 Điểm Yếu của Hệ Thống Cũ (Weaknesses)
*   **Bảo mật cục bộ thấp:** Dữ liệu nhạy cảm lưu trực tiếp dưới dạng plain text trên LocalStorage của trình duyệt, rất dễ bị trích xuất trái phép qua tấn công XSS hoặc truy cập máy vật lý.
*   **Không hỗ trợ đa người dùng:** Hệ thống cũ phân mảnh, mỗi trinh sát tự import trên máy của mình, không thể chia sẻ dữ liệu chuyên án hoặc đối soát tập trung.
*   **Không có bản đồ tương tác thực thụ:** Bản đồ cũ xuất dưới dạng file HTML Folium tĩnh, không cho phép tương tác thời gian thực hoặc hiển thị GPS trực quan trên dashboard chính.

### 3.2 Cơ Hội Hiện Đại Hóa (Modernization Roadmap)
*   **Hạ tầng Full-stack an toàn:** Chuyển sang mô hình **Client-Server**. Xử lý dữ liệu nặng ở Backend bằng Python FastAPI tốc độ cao với các luồng xử lý bất đồng bộ (Async task queues).
*   **Cơ sở dữ liệu quan hệ chuyên sâu:** Sử dụng SQLite (cho lab cục bộ) và PostgreSQL (cho triển khai hệ thống lớn) để tổ chức dữ liệu dạng bảng quan hệ chặt chẽ.
*   **Bản đồ động tích hợp:** Dựng bản đồ tương tác trực tiếp trên Dashboard bằng **Leaflet/React-Map** để vẽ đường đi thời gian thực của mục tiêu.
*   **Trình phân tích AI tích hợp:** Sử dụng Python Pandas để tự động phát hiện các chuỗi giao tiếp đáng ngờ và tạo biểu đồ mạng lưới tương tác (Social Network Analysis - SNA).
