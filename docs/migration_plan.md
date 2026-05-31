# 🔄 Kế Hoạch Chuyển Đổi Hệ Thống (Migration & Integration Plan)
**Chuyển đổi:** Từ Legacy CDR Analyzer (Client-only) ──► Hiện Đại Sentinel Platform (Full-Stack Relational)

Tài liệu này định hình chiến lược chuyển đổi từng bước (Incremental Migration Strategy) nhằm di trú an toàn dữ liệu, kế thừa các thuật toán nghiệp vụ cũ, bảo vệ tính toàn vẹn thông tin chuyên án và xác thực hệ thống mới.

---

## 1. Bản Đồ Di Trú Tổng Quan (Migration Steps)

```
[Bước 1: Giữ Nguyên Legacy] ──► [Bước 2: Di Trú LocalStorage] ──► [Bước 3: Chạy Song Song Dual-Run] ──► [Bước 4: Chuyển Giao Trực Tiếp]
- Đóng gói toàn bộ code cũ    - Viết tool export JSON thô      - Trinh sát dùng cả hai app      - Đóng băng app cũ
- Cô lập thư mục Mau/         - Import JSON vào Database mới   - Đối soát đối chiếu kết quả     - Hoạt động 100% trên Sentinel
```

---

## 2. Các Bước Chuyển Đổi Chi Tiết

### Bước 1: Bảo Tồn & Cô Lập Mã Nguồn Cũ (Safety First)
1.  **Tuyệt đối không can thiệp vào mã nguồn cũ:** Thư mục `Mau/` chứa tệp `index.html`, `script.js` và `styles.css` cũ sẽ được giữ nguyên trạng thái tĩnh. Điều này đảm bảo trong trường hợp hệ thống mới đang xây dựng gặp sự cố, trinh sát vẫn có công cụ ngoại tuyến hoạt động ngay lập tức để phục vụ chuyên án khẩn cấp.
2.  **Đóng gói lưu trữ bản sao lưu (Backup):** Tạo một bản sao nén của thư mục `Mau/` và lưu trữ trong thư mục lưu trữ nội bộ bảo mật của đơn vị.

### Bước 2: Di Trú Dữ Liệu Lịch Sử (LocalStorage Migration Utility)
Do hệ thống cũ lưu trữ toàn bộ dữ liệu phân tích và thông tin thuê bao đã chỉnh sửa (như Zalo, Facebook, Ghi chú BTS) vào `LocalStorage` của trình duyệt trinh sát viên, chúng ta cần viết một cơ chế di trú để tránh mất mát các dữ liệu điều tra quý giá đã tích lũy:

1.  **Xây dựng bộ kết xuất JSON tại App Cũ:**
    *   Tích hợp một nút bấm tạm thời `"Xuất Dữ Liệu Di Trú"` trong phiên bản app cũ, khi nhấn sẽ đọc toàn bộ khóa `LocalStorage` liên quan đến CDR Analyzer và đóng gói thành một file `sentinel_migration_backup.json` tải về máy.
2.  **Bộ nhập dữ liệu lịch sử tại App Mới (Backend Migration Service):**
    *   Xây dựng router `/api/v1/migration/import` ở Backend FastAPI nhận file JSON di trú này.
    *   Tự động bóc tách:
        *   Tạo bản ghi trong bảng `subscribers` tương ứng với các thông tin đã lưu.
        *   Nạp các bản ghi cuộc gọi của từng thuê bao vào bảng `call_records`.
        *   Đặc biệt: Ánh xạ lại các chỉnh sửa thủ công của trinh sát (như liên kết mạng xã hội Zalo/FB của số liên lạc, địa chỉ trạm BTS do trinh sát tự sửa) và lưu đè vào các trường ghi chú trong cơ sở dữ liệu quan hệ mới.

### Bước 3: Vận Hành Song Song & Đối Soát Chất Lượng (Dual-Run Verification)
Trước khi tắt bỏ hoàn toàn hệ thống cũ, đơn vị nghiệp vụ sẽ thực hiện vận hành song song cả hai phiên bản trong vòng **2 - 4 tuần**:

1.  **Đối soát tính chính xác (Calculation Verification):**
    *   Mỗi khi tải lên một file CDR Excel mẫu (ví dụ các file trong `File data mau/`), trinh sát sẽ đối chiếu kết quả thống kê giữa hai app:
        *   Tổng số cuộc gọi, tin nhắn.
        *   Top số điện thoại liên lạc nhiều nhất.
        *   Danh sách các số liên lạc chung khi đối soát chéo file.
    *   Sai lệch kết quả bắt buộc phải bằng **0%**.
2.  **Đo lường hiệu năng xử lý (Performance Benchmarks):**
    *   Thực hiện đo thời gian xử lý tệp tin Excel lớn (dung lượng trên 100.000 dòng):
        *   *App cũ:* Thường đơ màn hình từ 15 - 30 giây, đôi khi crash trình duyệt.
        *   *App mới:* Phải phân tích và kết xuất kết quả hiển thị lên giao diện Dashboard trong vòng dưới 2 giây nhờ cơ chế xử lý đa luồng bất đồng bộ của FastAPI và cấu trúc vector của Pandas.

### Bước 4: Nghiệm Thu Chuyển Giao Hoàn Toàn (Direct Cut-over)
Sau khi kết quả đối soát khớp 100% và trinh sát viên đã quen thuộc với giao diện Brushed Steel hiện đại mới:
1.  Đóng băng hoàn toàn ứng dụng cũ.
2.  Xóa dữ liệu nhạy cảm trên `LocalStorage` của các máy trạm trinh sát sau khi đã xác nhận nhập liệu thành công vào Database mã hóa của Sentinel Platform.
3.  Ban hành cẩm nang tác nghiệp mới dựa trên giao diện hiện đại Sentinel Core.
