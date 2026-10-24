# Kế Hoạch Triển Khai: Công Cụ Chèn & Vẽ Hình Thí Nghiệm, Hóa Học Chuẩn GDPT 2018

## Tóm tắt kế hoạch (Summary)
Tích hợp trực tiếp bộ công cụ đồ họa chuyên dụng môn Hóa học vào phần mềm Tạo Đề Thi 2026:
1. **Studio vẽ sơ đồ thí nghiệm & hóa học trực quan**: Thiết kế bảng vẽ canvas tương tác tích hợp sẵn thư viện dụng cụ thủy tinh (ống nghiệm, bình cầu, bình tam giác, phễu chiết, buret, sinh hàn...), nguồn nhiệt (đèn cồn, kiềng, lưới amiăng), chất phản ứng/bọt khí/kết tủa, và các nhãn ghi chú hóa học có thể kéo thả, xoay lật, đổi màu dung dịch.
2. **Kho thí nghiệm mẫu kinh điển SGK GDPT 2018**: Tích hợp sẵn 6 sơ đồ thí nghiệm chuẩn (Điều chế etilen $C_2H_4$ và thử tính chất, điều chế khí clo $Cl_2$, chuẩn độ acid-base dung dịch $HCl$ bằng $NaOH$, phản ứng xà phòng hóa chất béo, pin điện hóa $Zn - Cu$, và thí nghiệm tráng bạc $CH_3CHO$). Giáo viên có thể chèn ngay trong 1 click hoặc tùy biến.
3. **Công cụ chèn & dán ảnh linh hoạt**: Hỗ trợ dán ảnh trực tiếp từ clipboard (`Ctrl+V`), chọn file từ máy tính (PNG, JPG, WebP), hoặc vẽ sơ đồ mới.
4. **Hiển thị & xuất bản toàn diện**: Ảnh thí nghiệm được lưu trực tiếp vào từng câu hỏi (Phần I, Phần II, Phần III, Tự luận), hiển thị sắc nét trong giao diện soạn thảo, khung in đề thi chuẩn Bộ GD&ĐT (CV 7991), giao diện làm bài thi Online của học sinh, và tự động nhúng vào tài liệu Word (`.docx`) khi xuất file.

---

## Ý kiến Giáo viên & Các quyết định thiết kế (User Review & Critical Decisions)

Do Thầy/Cô đã bỏ qua các câu hỏi khảo sát nhanh, hệ thống đề xuất và áp dụng các cấu hình tối ưu nhất cho giáo viên dạy Hóa học:

- **Hình thức vẽ**: Bảng vẽ tương tác trực quan (Visual Drag & Drop Canvas) kết hợp Thư viện Dụng cụ SVG chuẩn mực sư phạm + Bút vẽ tự do & đường gióng + Text nhãn công thức hóa học ($KMnO_4$, $H_2SO_4$,...). Giáo viên không cần biết dùng Photoshop hay ChemDraw phức tạp mà vẫn vẽ xong một sơ đồ thí nghiệm chỉ trong 1-2 phút.
- **Thư viện mẫu tích hợp sẵn**: Cung cấp ngay 6 bộ thí nghiệm tiêu biểu hay xuất hiện nhất trong các đề thi Tốt nghiệp THPT và kiểm tra định kỳ 10, 11, 12.
- **Vị trí chèn hình**: Mỗi câu hỏi (Phần I, II, III, Tự luận) sẽ có nút bấm **"📷 Chèn / Vẽ hình thí nghiệm"** nằm ngay dưới nội dung câu hỏi. Hình ảnh sau khi tạo hoặc tải lên sẽ hiển thị trực quan, có nút thu nhỏ/phóng to và nút xóa/sửa lại.

---

## 1. Tổng quan & Tính năng cốt lõi (Overview & Core Concept)

### 1.1. Thư viện linh kiện & dụng cụ thí nghiệm (SVG Apparatus Library)
- **Dụng cụ thủy tinh**:
  - Bình cầu đáy tròn / đáy bằng (có nhánh hoặc không nhánh).
  - Ống nghiệm thẳng, ống nghiệm có nhánh.
  - Bình tam giác (Erlenmeyer flask), cốc thủy tinh có vạch chia độ.
  - Phễu lọc, phễu chiết quả lê (có khóa).
  - Buret chuẩn độ (có khóa và vạch), ống hút pipet.
  - Ống sinh hàn thẳng / ống sinh hàn xoắn.
  - Ống dẫn khí thủy tinh (chữ L, chữ U, ống thẳng, ống vuốt nhọn).
  - Chậu thủy tinh đựng nước / thu khí qua nước.
  - Nút cao su (nút 1 lỗ, nút 2 lỗ cắm ống dẫn khí hoặc nhiệt kế).
- **Phụ kiện & Nguồn nhiệt**:
  - Đèn cồn (ngọn lửa đang cháy / đã tắt).
  - Giá sắt kẹp ống nghiệm / bình cầu.
  - Kiềng sắt 3 chân và lưới thép bọc amiăng tản nhiệt.
  - Nhiệt kế thủy ngân / rượu có vạch nhiệt độ.
- **Hiện tượng & Hóa chất trực quan**:
  - Dung dịch màu tùy chỉnh (tím $KMnO_4$, xanh lam $CuSO_4$, vàng nâu $FeCl_3$, da cam nước brom, trong suốt...).
  - Bọt khí sủi tăm trong chất lỏng.
  - Kết tủa dưới đáy ống nghiệm (trắng $AgCl$/$BaSO_4$, vàng $AgI$/$S$, nâu đỏ $Fe(OH)_3$, xanh lam $Cu(OH)_2$).
  - Bông tẩm hóa chất (bông tẩm kiềm ngăn khí độc thoát ra ngoài).
- **Hóa học hữu cơ & Cấu tạo**:
  - Vòng benzen, liên kết đơn/đôi/ba, sơ đồ pin Galvanic $Zn-Cu$ kèm vôn kế.

### 1.2. Tính năng Studio vẽ (Chemistry Draw Studio)
- Kéo thả dụng cụ từ thanh công cụ bên trái vào khung vẽ chính.
- Bấm chọn dụng cụ để di chuyển, đổi kích thước, xoay, lật ngang/dọc, sắp xếp thứ tự trước/sau (Layering).
- Công cụ Bút vẽ đường ống dẫn khí thông minh (nối ống từ bình này sang bình khác).
- Công cụ Nhãn ghi chú (Text labels) với phông chữ rõ ràng, mũi tên chỉ vị trí hóa chất.
- Tải ảnh từ máy tính hoặc dán trực tiếp từ bộ nhớ tạm (`Ctrl+V`).
- Xuất sơ đồ thành hình ảnh PNG chất lượng cao (High DPI) để chèn ngay vào câu hỏi.

---

## 2. Trải nghiệm người dùng (UX) & Giao diện (Visual Design)

### 2.1. Cửa sổ Studio vẽ hình thí nghiệm (Modal)
- **Thanh bên trái (Sidebar)**: Phân loại linh kiện dụng cụ:
  - *Thủy tinh cơ bản* (Ống nghiệm, bình cầu, cốc, bình tam giác, phễu, buret).
  - *Nhiệt & Giá đỡ* (Đèn cồn, giá sắt, kiềng sắt, lưới amiăng, nhiệt kế).
  - *Ống dẫn & Nút* (Nút cao su, ống dẫn chữ L, ống vuốt nhọn, bông tẩm).
  - *Mẫu có sẵn* (6 thí nghiệm chuẩn SGK).
- **Vùng làm việc trung tâm (Canvas)**: Bảng vẽ có lưới tọa độ (Grid snap) giúp căn chỉnh thẳng hàng, thước đo trực quan, màu nền trắng tinh khiết.
- **Thanh công cụ đỉnh (Header / Toolbar)**:
  - Nút: Chọn (Select), Bút vẽ tự do, Đường thẳng/Mũi tên, Chèn chữ/Nhãn, Đổ màu dung dịch, Thêm bọt khí.
  - Nút: Hoàn tác (Undo), Làm lại (Redo), Xóa (Delete), Dọn sạch canvas (Clear).
  - Nút: Dán ảnh từ Clipboard (`Ctrl+V`), Tải ảnh từ máy (`Upload File`).
  - Nút chính nổi bật: **"Áp dụng vào câu hỏi" (Lưu hình)**.

### 2.2. Trình chỉnh sửa câu hỏi (Question Editor)
- Ngay cạnh khung nhập câu hỏi, thêm ô: **"Hình ảnh minh họa / Sơ đồ thí nghiệm"**.
- Nếu đã có hình: Hiển thị ảnh thu nhỏ (thumbnail) kèm 2 nút: **"Chỉnh sửa sơ đồ"** và **"Xóa ảnh"**, cùng tùy chọn căn lề (Căn giữa, Căn trái) và chú thích ảnh (ví dụ: *Hình 1. Sơ đồ điều chế khí clo trong phòng thí nghiệm*).
- Nếu chưa có hình: Nút bấm lớn màu xanh lục kèm icon kính lúp/bình hóa học: **"Thêm hình ảnh / Vẽ thí nghiệm"**.

### 2.3. Hiển thị đề thi & Xuất tài liệu
- **Xem trước in đề (OfficialExamPreview)**: Hình ảnh tự động căn giữa cân đối, kích thước vừa vặn khung in khổ A4 (không bị tràn lề, không bị vỡ hạt chữ).
- **Phòng thi Online (OnlineTestRoom)**: Học sinh thấy ngay sơ đồ thí nghiệm sắc nét bên dưới đề bài, có thể bấm vào ảnh để phóng to xem chi tiết các hóa chất.
- **Xuất file Word (.docx)**: Sử dụng module `docx.ImageRun` để nhúng ảnh nguyên bản vào file `.docx`, giáo viên tải về có thể in ấn ngay trên Microsoft Word.

---

## 3. Kiến trúc kỹ thuật & Luồng dữ liệu (Technical Architecture)

```
[Giáo viên mở Câu hỏi] 
       │
       ├──> Bấm "Thêm hình ảnh / Vẽ thí nghiệm"
       │         │
       │         ├──> Chọn mẫu có sẵn / Kéo thả dụng cụ SVG
       │         ├──> Hoặc Tải ảnh PNG/JPG từ máy / Dán Ctrl+V
       │         ├──> Thêm nhãn hóa chất, bọt khí, mũi tên
       │         └──> Bấm "Lưu vào câu hỏi" ───┐
       │                                         │
       ▼                                         ▼
[Cập nhật Question Model] <──────────────────────┘
(Thêm trường `imageUrl` dạng DataURL / SVG Base64)
       │
       ├──> Auto-save LocalStorage (đèn xanh nhấp nháy báo đã lưu)
       ├──> Đồng bộ Firestore Database (nếu đang bật Phòng thi Online)
       ├──> Hiển thị trên Form soạn thảo (QuestionEditor)
       ├──> Hiển thị trên Preview in đề chuẩn CV 7991 (OfficialExamPreview)
       ├──> Hiển thị trên Giao diện thi Online của Học sinh (OnlineTestRoom)
       └──> Nhúng nhị phân vào tệp Word DOCX (docxExport.ts)
```

### 3.1. Cập nhật Model Dữ liệu (`src/types/exam.ts`)
Bổ sung các thuộc tính tùy chọn vào các kiểu câu hỏi:
- `imageUrl?: string` (Chuỗi Base64 PNG hoặc SVG)
- `imageCaption?: string` (Ví dụ: "Hình 2. Thí nghiệm xà phòng hóa chất béo")
- `imageWidth?: number` (Độ rộng hiển thị, mặc định 320px - 450px)

### 3.2. Thành phần mới (`src/components/ChemistryDrawModal.tsx`)
- Thành phần Modal độc lập, nhẹ, không phụ thuộc thư viện nặng.
- Render đồ họa vector SVG các linh kiện hóa học sắc nét tuyệt đối ở mọi độ phân giải.
- Sử dụng HTML5 Canvas API để kết xuất ra ảnh Base64 PNG tương thích 100% với file Word và mọi trình duyệt.

---

## 4. Kế hoạch từng bước triển khai (Implementation Steps)

1. **Bước 1**: Cập nhật kiểu dữ liệu `src/types/exam.ts` hỗ trợ ảnh kèm chú thích cho Phần I, Phần II, Phần III và Tự luận.
2. **Bước 2**: Xây dựng component `src/components/ChemistryDrawModal.tsx` với đầy đủ bộ thư viện dụng cụ thí nghiệm SVG, 6 thí nghiệm mẫu SGK, công cụ dán/tải ảnh và canvas render.
3. **Bước 3**: Tích hợp nút mở Studio vào `src/components/QuestionEditor.tsx` cho tất cả các phần thi.
4. **Bước 4**: Cập nhật `src/components/OfficialExamPreview.tsx` và `src/components/OnlineTestRoom.tsx` để render ảnh sắc nét chuẩn khổ A4 và responsive di động.
5. **Bước 5**: Nâng cấp module `src/utils/docxExport.ts` để đọc và chèn ảnh thí nghiệm vào tài liệu Word xuất ra.
6. **Bước 6**: Kiểm thử Lint, Build và Dev Server đảm bảo 0 lỗi phát sinh.
