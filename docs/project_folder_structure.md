# 📂 Cấu Trúc Thư Mục Dự Án Hiện Đại (Modern Project Folder Structure)
**Dự án:** Sentinel Platform (Full-Stack Telecom Analytics Platform)

Dưới đây là sơ đồ cấu trúc thư mục quy chuẩn chuyên nghiệp cho toàn bộ dự án hiện đại, chia rõ ràng thành hai phần **`backend/`** (Python FastAPI) và **`frontend/`** (React Vite), nằm độc lập hoàn toàn với mã nguồn cũ nhằm giữ nguyên vẹn tệp tin cũ theo đúng nguyên tắc bảo trì hệ thống.

---

## 1. Bản Đồ Thư Mục Toàn Cục (Global Tree)

```text
sentinel-platform/
│
├── backend/                    # MÃ NGUỒN BACKEND (FastAPI + Python)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py             # Điểm khởi chạy ứng dụng (Uvicorn entrypoint)
│   │   ├── config.py           # Cấu hình hệ thống & biến môi trường
│   │   │
│   │   ├── api/                # Các route APIendpoints
│   │   │   ├── __init__.py
│   │   │   ├── deps.py         # Dependencies (auth, db sessions)
│   │   │   └── v1/
│   │   │       ├── auth.py
│   │   │       ├── upload.py
│   │   │       ├── subscribers.py
│   │   │       ├── analytics.py
│   │   │       └── compare.py
│   │   │
│   │   ├── db/                 # Kết nối DB & Migrations
│   │   │   ├── __init__.py
│   │   │   ├── base.py         # Điểm gộp chung toàn bộ Models phục vụ Alembic
│   │   │   ├── session.py      # SQLAlchemy engine & sessionmaker
│   │   │   └── models.py       # Khai báo các SQLAlchemy Models (Subscribers, CallRecords, Towers...)
│   │   │
│   │   └── services/           # Xử lý Logic Nghiệp Vụ
│   │       ├── __init__.py
│   │       ├── crypto.py       # Mã hóa & giải mã đối xứng AES-256
│   │       ├── parser/
│   │       │   ├── __init__.py
│   │       │   ├── engine.py   # Phân tích cú pháp Excel tự động detect template
│   │       │   └── templates.py# Cấu trúc mapping cột Viettel, Vina, Mobi
│   │       ├── normalizer.py   # Làm sạch số điện thoại, ngày tháng, tách Cell/LAC
│   │       ├── analytics.py    # Tổng hợp tần suất tương tác, tính quỹ đạo timeline
│   │       └── compare.py      # Giao liên lạc chung, đối soát trùng tọa độ
│   │
│   ├── migrations/             # Thư mục chứa các tệp Migration tự động của Alembic
│   ├── tests/                  # Kiểm thử toàn diện Backend
│   │   ├── __init__.py
│   │   ├── test_parser.py
│   │   ├── test_normalizer.py
│   │   └── test_analytics.py
│   │
│   ├── requirements.txt        # Danh mục thư viện Python cần cài đặt
│   └── alembic.ini             # File cấu hình database migration
│
├── frontend/                   # MÃ NGUỒN FRONTEND (React + Vite + Tailwind)
│   ├── public/                 # Các tài nguyên tĩnh (logos, map markers)
│   ├── src/
│   │   ├── main.jsx            # Điểm khởi chạy React app
│   │   ├── App.jsx             # File cấu hình chính, định tuyến screens
│   │   ├── index.css           # Cấu hình Tailwind CSS & Custom Design Tokens
│   │   │
│   │   ├── components/         # Các Component giao diện dùng chung (Reusable UI)
│   │   │   ├── ui/             # Shadcn/UI primitives (Buttons, Tables, Dialogs...)
│   │   │   ├── Layout.jsx      # Khung layout chính Sidebar + Topbar
│   │   │   ├── MapViewer.jsx   # Bản đồ Leaflet xử lý quỹ đạo timeline di chuyển
│   │   │   └── AnomalyChart.jsx# Biểu đồ Recharts kết xuất tần suất
│   │   │
│   │   ├── context/            # Zustand States / React Contexts
│   │   │   └── AppContext.jsx  # Quản lý file active, phiên đối soát và JWT Token
│   │   │
│   │   ├── services/           # Kết nối REST API
│   │   │   └── api.js          # Khởi tạo Axios client & các hàm gọi API endpoints
│   │   │
│   │   └── screens/            # Các trang màn hình chức năng chính
│   │       ├── Dashboard.jsx   # Bảng điều khiển chung hiển thị card nghiệp vụ
│   │       ├── GTPMap.jsx      # Trực quan hóa trạm phát Cell-LAC
│   │       ├── FLAFlow.jsx     # Bảng phân tích sao kê & dòng tiền cảnh báo đỏ
│   │       └── Comparator.jsx  # Kéo thả đối soát chéo nhiều tệp tin
│   │
│   ├── package.json            # Quản lý thư viện JS (Vite, React, Tailwind, Leaflet)
│   ├── tailwind.config.js      # Cấu hình HSL Color system và Dark-mode
│   └── vite.config.js          # File cấu hình đóng gói Vite
│
└── docs/                       # TÀI LIỆU KIẾN TRÚC & HƯỚNG DẪN DỰ ÁN
    ├── system_analysis.md
    ├── architecture.md
    ├── backend_roadmap.md
    ├── frontend_roadmap.md
    ├── telecom_schema_design.md
    ├── parser_strategy.md
    ├── migration_plan.md
    └── project_folder_structure.md
```
