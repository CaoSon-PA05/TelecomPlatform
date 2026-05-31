# ⚙️ Lộ Trình Phát Triển Backend (Backend Development Roadmap)
**Công nghệ:** Python 3.12 + FastAPI + Pandas + SQLAlchemy + Uvicorn

---

## 1. Các Giai Đoạn Triển Khai (Phases of Implementation)

```
[Giai Đoạn 1: Thiết Lập Core] ──► [Giai Đoạn 2: Engine Phân Tích] ──► [Giai Đoạn 3: APIs & Security]
- Cấu hình khung dự án      - Xây dựng bộ Parser Excel        - Tích hợp mã hóa AES-256
- Thiết lập SQLAlchemy DB  - Hoàn thiện Normalizer Engine     - Cung cấp RESTful endpoints
- Viết migrations (Alembic)- Thực thi thuật toán Analytics   - Lập tài liệu Swagger API
```

---

## 2. Chi Tiết Từng Giai Đoạn Triển Khai

### Giai Đoạn 1: Thiết Lập Nền Móng & Cơ Sở Dữ Liệu
1.  **Cấu trúc thư mục:** Khởi tạo cấu trúc dự án chuẩn modular (xem tài liệu cấu trúc thư mục).
2.  **Cấu hình môi trường:** Thiết lập tệp `.env` quản lý các tham số bí mật:
    ```ini
    DATABASE_URL=sqlite:///./sentinel_local.db
    SECRET_KEY=highly-secure-jwt-secret-key-for-cshs
    SENTINEL_CRYPTO_KEY=base64-aes-256-encryption-key-for-columns
    ENVIRONMENT=development
    ```
3.  **Tạo ORM Models:** Chuyển đổi thiết kế DB thành các class model trong `app/db/models.py` kế thừa từ lớp Base của SQLAlchemy.
4.  **Thiết lập Cơ sở dữ liệu:** Viết engine khởi tạo và session manager (`app/db/session.py`) hỗ trợ cơ chế Context Manager của Python (`with get_db() as db:`).

### Giai Đoạn 2: Bộ Phân Tích Excel & Chuẩn Hóa (STPE)
1.  **Dịch vụ nạp file (`app/services/parser/`):**
    *   Sử dụng thư viện `openpyxl` kết hợp `pandas` để đọc file bất đồng bộ từ luồng tải lên.
    *   Viết thuật toán phát hiện tiêu đề tự động bằng cách quét 30 dòng đầu để tìm dòng chứa nhiều cột khớp từ khóa viễn thông nhất.
    *   Trích xuất khối metadata thông tin nhân thân thuê bao chủ.
2.  **Bộ chuẩn hóa (`app/services/normalizer/`):**
    *   Viết hàm làm sạch và định vị số điện thoại về chuẩn 10 số di động Việt Nam.
    *   Xây dựng bộ parse ngày tháng đa luồng (DateTime multi-parser).
    *   Xử lý tách cụm LAC-CellID.

### Giai Đoạn 3: Công Cụ Phân Tích & Đối Soát Chéo (Analytics Engine)
1.  **Tính toán tần suất (`app/services/analytics/`):**
    *   Sử dụng Pandas `groupby` để tổng hợp số lượng liên lạc, phân chia tỷ lệ Cuộc gọi đi/nhận/SMS.
    *   Phân tích khung giờ vàng (24h) và ngày hoạt động cao điểm trong tuần.
2.  **Tuyến lộ trình di chuyển (Geospatial Trajectory):**
    *   Trích xuất chuỗi các trạm phát sóng (LAC/Cell) mục tiêu di chuyển theo trình tự thời gian tăng dần.
    *   Tính toán thời gian lưu trú (dwell time) tại mỗi trạm BTS để tìm ra các vị trí nghi vấn đối tượng thường trú ngụ hoặc lặp lại chu kỳ hoạt động.
3.  **Thuật toán so sánh chéo (`app/services/compare/`):**
    *   *So sánh liên lạc:* Thực hiện phép giao tập hợp (Set Intersection) danh sách số điện thoại liên lạc của N đối tượng để tìm ra các số chung.
    *   *So sánh vị trí:* Tìm các bản ghi cuộc gọi của nhiều đối tượng khác nhau có cùng mã trạm BTS (`tower_id`) và khoảng cách mốc thời gian chênh lệch dưới 5 phút (ghi nhận sự gặp mặt vật lý).

### Giai Đoạn 4: Xây Dựng REST APIs & Bảo Mật Chuyên Sâu
1.  **Xây dựng Endpoint Router (`app/api/`):**
    *   `/api/v1/auth/`: Đăng nhập, cấp quyền trinh sát viên.
    *   `/api/v1/subscribers/`: CRUD danh mục thuê bao chuyên án.
    *   `/api/v1/telecom/upload`: Endpoint upload file đơn lẻ hoặc số lượng lớn (Bulk Upload). Tự động kích hoạt luồng Parser và lưu DB.
    *   `/api/v1/analytics/`: Lấy kết quả thống kê tần suất, hành vi, timeline di chuyển.
    *   `/api/v1/compare/`: Truy vấn đối soát chéo nhiều tệp tin.
2.  **Mã hóa AES-256:**
    *   Tích hợp bộ mã hóa/giải mã đối xứng trong lớp truy xuất dữ liệu (Data Access Layer) của Repository. Dữ liệu chỉ được giải mã khi hiển thị lên UI thông qua API an toàn.

---

## 3. Quy Trình Kiểm Thử Backend (Testing Strategy)

Sử dụng thư viện `pytest` để kiểm thử toàn diện hiệu năng và tính chính xác của các thuật toán:
*   **Unit Tests (`tests/test_parser.py`):** Kiểm tra tính chính xác của bộ phát hiện template nhà mạng với các file Excel thật trong thư mục `File data mau`.
*   **Unit Tests (`tests/test_normalizer.py`):** Kiểm tra bộ lọc regex số điện thoại, tách LAC/Cell và định dạng ngày tháng lỗi.
*   **Integration Tests (`tests/test_analytics.py`):** Đảm bảo thuật toán gom cụm tần suất liên lạc và giao tập hợp so sánh file tính toán ra kết quả chính xác tuyệt đối (không bị sai lệch số liệu).
