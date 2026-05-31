# 📊 HƯỚNG DẪN SỬ DỤNG CDR ANALYZER

## 🎯 Tổng quan
CDR Analyzer là công cụ phân tích chi tiết cuộc gọi (Call Detail Record) từ các file Excel, hỗ trợ phân tích dữ liệu từ các nhà mạng Việt Nam như Viettel, Vinaphone, Mobifone.

## 📁 Cài đặt và Khởi chạy

### Yêu cầu hệ thống
- Trình duyệt web hiện đại (Chrome, Firefox, Edge, Safari)
- File Excel (.xlsx, .xls) có dữ liệu CDR

### Khởi chạy
1. Mở file `index.html` bằng trình duyệt web
2. Hoặc khởi chạy server Python: `python -m http.server 8000`
3. Truy cập: `http://localhost:8000`

## 🚀 Hướng dẫn sử dụng cơ bản

### 1. 📂 Upload File Excel

#### Cách upload:
- **Kéo thả**: Kéo file Excel vào vùng "Kéo thả file Excel vào đây"
- **Chọn file**: Click "Chọn file Excel" và chọn file từ máy tính

#### Chọn template phù hợp:
- **📄 VIETTEL**: Dành cho file CDR từ Viettel
- **📄 VINA**: Dành cho file CDR từ Vinaphone  
- **📄 MOBI**: Dành cho file CDR từ Mobifone

#### Yêu cầu file Excel:
- Có cột chứa số điện thoại chủ
- Có cột thời gian cuộc gọi
- Có cột số điện thoại liên hệ
- Có cột IMEI (nếu có)

## 📱 Các tab chức năng chính

### 1. 📱 Thông tin thuê bao
**Mục đích**: Xem và chỉnh sửa thông tin chủ thuê bao

#### Các nút chức năng:
- **✏️ Chỉnh sửa**: Cho phép chỉnh sửa thông tin
- **💾 Lưu**: Lưu thay đổi
- **❌ Hủy**: Hủy thay đổi
- **🔄 Reset Data**: Khôi phục dữ liệu gốc từ file Excel
- **🗑️ Xóa toàn bộ**: Xóa toàn bộ dữ liệu đã lưu

#### Thông tin hiển thị:
- Số điện thoại chủ
- Họ tên (nếu có)
- Địa chỉ (nếu có)
- Ghi chú

### 2. 📋 Lịch sử cuộc gọi
**Mục đích**: Xem chi tiết tất cả cuộc gọi và tin nhắn

#### Tính năng tìm kiếm và lọc:
- **Tìm kiếm tổng quát**: Tìm theo tất cả thông tin
- **Lọc theo loại**: Cuộc gọi đi/đến, tin nhắn đi/đến
- **Lọc theo thời gian**: Từ ngày - đến ngày, từ giờ - đến giờ
- **Phân trang**: Hiển thị 25/50/75/100 dòng mỗi trang

#### Thông tin hiển thị:
- STT, Số chủ, Số liên hệ
- Thời gian, Thời lượng
- IMEI, Mã tỉnh, Loại
- Dịch vụ, Địa chỉ, LAC, Cell

#### Các nút chức năng:
- **💾 Xuất Excel**: Xuất dữ liệu ra file Excel
- **↑**: Lên đầu trang

### 3. 📱 Phân tích IMEI
**Mục đích**: Phân tích và tra cứu thông tin IMEI

#### Thống kê:
- IMEI duy nhất
- IMEI hợp lệ (15 số)
- IMEI không hợp lệ

#### Tính năng tra cứu:
- **🍪 Nhập Cookies**: Nhập cookies từ imei.info để tra cứu
- **🧪 Test IMEI**: Test tra cứu một IMEI
- **🔍 Tra cứu tất cả**: Tra cứu thông tin cho tất cả IMEI
- **💾 Xuất Excel**: Xuất dữ liệu IMEI
- **🗑️ Xóa dữ liệu**: Xóa toàn bộ dữ liệu IMEI

#### Thông tin hiển thị:
- IMEI
- Tần suất sử dụng
- Model thiết bị (sau khi tra cứu)
- Ghi chú

#### Tìm kiếm:
- Tìm theo IMEI hoặc Model
- Lọc theo trạng thái hợp lệ

### 4. 👥 Số liên lạc
**Mục đích**: Phân tích các số điện thoại liên hệ

#### Thống kê:
- Tổng số liên lạc
- Số liên lạc trong khoảng thời gian
- Tổng tương tác

#### Thông tin hiển thị:
- Số điện thoại
- Tần suất liên lạc
- Zalo, Facebook, Telegram (có thể chỉnh sửa)
- Ghi chú (có thể chỉnh sửa)

#### Tính năng:
- **Lọc theo thời gian**: Xem liên lạc trong khoảng thời gian
- **Tìm kiếm**: Tìm theo số điện thoại
- **Chỉnh sửa**: Click vào ô để chỉnh sửa Zalo/Facebook/Telegram/Ghi chú
- **💾 Xuất Excel**: Xuất dữ liệu liên lạc

### 5. ⏰ Phân tích thời gian
**Mục đích**: Phân tích mẫu hoạt động theo thời gian

#### Biểu đồ:
- **Khung giờ hoạt động (24h)**: Xem giờ nào hoạt động nhiều nhất
- **Hoạt động theo thứ trong tuần**: Xem ngày nào hoạt động nhiều nhất

### 6. 📍 Vị trí
**Mục đích**: Phân tích vị trí dựa trên Cell/LAC

#### Thống kê:
- Tổng vị trí
- Vị trí trong khoảng thời gian
- Tổng tương tác

#### Thông tin hiển thị:
- LAC (Location Area Code)
- CID (Cell ID)
- Mã tỉnh
- Tên trạm BTS
- Tần suất
- Link Google Maps

#### Tính năng:
- **Tìm kiếm**: Tìm theo tất cả thông tin hoặc theo số liên lạc
- **Lọc theo thời gian**: Xem vị trí trong khoảng thời gian
- **Chỉnh sửa**: Click vào ô để chỉnh sửa thông tin trạm BTS
- **🗺️ Google Maps**: Click để mở vị trí trên Google Maps

### 7. 🔄 IMEI/IMSI
**Mục đích**: Xem lịch sử thay đổi IMEI/IMSI

#### Hiển thị:
- Nhật ký thay đổi IMEI/IMSI theo thời gian
- Thông tin chi tiết về từng lần thay đổi

### 8. 🗺️ Bản đồ
**Mục đích**: Tạo bản đồ vị trí từ dữ liệu

#### Yêu cầu file Excel:
- Cột: Phone, MNC, Datetime, LAC, CID, Lat, Lon

#### Tính năng:
- **📁 Import file Excel**: Import file có dữ liệu tọa độ
- **🗺️ Vẽ Folium Maps**: Tạo bản đồ tương tác
- **🗺️ Mở bản đồ**: Xem bản đồ trong tab mới
- **💾 Tải bản đồ**: Tải file HTML bản đồ

### 9. 🔍 So sánh
**Mục đích**: So sánh dữ liệu giữa các file Excel

#### Upload file:
- Kéo thả hoặc chọn file Excel
- File cần có cột "Phone"

#### Tùy chọn phân tích:
- **📞 So sánh số liên lạc**: Tìm số liên hệ chung
- **📱 So sánh IMEI**: Tìm IMEI chung
- **⚙️ So sánh tùy chỉnh**: Phân tích tự động tất cả cột

#### Kết quả:
- Hiển thị dữ liệu chung giữa các file
- Tìm kiếm và lọc kết quả
- **💾 Xuất Excel**: Xuất kết quả so sánh

## 🛠️ Tính năng nâng cao

### Lưu trữ dữ liệu
- Dữ liệu được lưu tự động trong LocalStorage
- Mỗi file Excel có bộ dữ liệu riêng
- Có thể xóa dữ liệu của từng file hoặc toàn bộ

### Xuất dữ liệu
- **Xuất từng tab**: Xuất dữ liệu của tab hiện tại
- **📊 Xuất tất cả**: Xuất toàn bộ dữ liệu phân tích

### Keyboard Navigation
- **Tab**: Di chuyển giữa các ô
- **Enter**: Chỉnh sửa ô
- **Escape**: Hủy chỉnh sửa
- **Arrow keys**: Di chuyển trong ô

### Responsive Design
- Tối ưu cho desktop, tablet, mobile
- Tự động điều chỉnh giao diện theo kích thước màn hình

## 🔧 Xử lý sự cố

### File không được nhận diện
- Kiểm tra định dạng file (.xlsx, .xls)
- Kiểm tra template đã chọn đúng chưa
- Kiểm tra file có đủ cột dữ liệu cần thiết

### Dữ liệu hiển thị sai
- Thử chọn template khác
- Kiểm tra định dạng ngày tháng trong file Excel
- Reset dữ liệu về trạng thái gốc

### Tra cứu IMEI không hoạt động
- Kiểm tra kết nối internet
- Cập nhật cookies từ imei.info
- Sử dụng script Python gốc (nếu có)

### Bản đồ không hiển thị
- Kiểm tra file Excel có cột Lat, Lon
- Kiểm tra dữ liệu tọa độ hợp lệ
- Thử với file khác

## 📞 Hỗ trợ

### Yêu cầu kỹ thuật
- Trình duyệt: Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
- RAM: Tối thiểu 4GB (khuyến nghị 8GB+)
- Dung lượng: 100MB trống

### Lưu ý bảo mật
- Dữ liệu chỉ được lưu trên máy tính local
- Không gửi dữ liệu lên server
- Xóa dữ liệu khi không sử dụng

### Giới hạn
- File Excel tối đa: 50MB
- Số bản ghi: Không giới hạn (phụ thuộc RAM)
- Thời gian xử lý: Phụ thuộc kích thước file

---

**📝 Lưu ý**: Hướng dẫn này dành cho phiên bản hiện tại của CDR Analyzer. Một số tính năng có thể thay đổi trong các phiên bản sau.
