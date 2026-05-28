# Spec: Sửa lỗi Import sản phẩm thành công nhưng trống danh sách do thiếu danh mục mặc định

## I. Primer

### 1. TL;DR kiểu Feynman
* Khi import sản phẩm từ Excel, hệ thống cần biết mỗi sản phẩm thuộc danh mục nào (như Giày Đá Bóng, Phụ Kiện...).
* Nếu database hiện tại chưa có danh mục nào (trống rỗng), hệ thống sẽ không thể gán sản phẩm vào đâu và âm thầm bỏ qua (skip) việc lưu sản phẩm.
* Nhưng giao diện (UI) lại báo "Thành công 566 sản phẩm" vì nó chỉ đếm số dòng đọc được từ file chứ không đếm số dòng thực tế được lưu vào database.
* Giải pháp: Tự tạo một danh mục mặc định tên "Chưa phân loại" nếu database rỗng, gán sản phẩm vào đó để lưu thành công, đồng thời sửa UI để báo đúng số sản phẩm thực tế đã lưu.

### 2. Elaboration & Self-Explanation
Khi người dùng tải lên file Excel sản phẩm (Sapo), hệ thống Next.js sẽ chuyển đổi dữ liệu và gửi xuống Convex Mutation `upsertBulk`. Trong database Convex, mỗi sản phẩm bắt buộc phải có liên kết tới một danh mục (`categoryId` tham chiếu tới bảng `productCategories`).
Nếu database rỗng danh mục, hoặc không map được danh mục từ cột của Excel:
1. Biến `categoryId` bị gán là `undefined`.
2. Logic trong `upsertBulk` kiểm tra: `if (!existing && !categoryId) { continue; }` -> bỏ qua toàn bộ sản phẩm mới và ghi nhận lỗi vào mảng `errors`.
3. Mutation chạy hoàn tất thành công (trả về danh sách lỗi và số lượng created = 0, updated = 0).
4. Tại UI, code lấy số lượng sản phẩm từ mảng ban đầu `result.data.length` (566 dòng) để hiển thị thông báo thay vì đọc kết quả của mutation. Điều này làm người dùng tưởng lầm đã lưu thành công 566 sản phẩm nhưng thực chất database vẫn trống rỗng.

Để sửa lỗi này, chúng ta sẽ tự động tạo danh mục "Chưa phân loại" ngay khi bắt đầu mutation nếu bảng danh mục rỗng, và dùng nó làm fallback cho các sản phẩm không map được. Đồng thời, cập nhật UI để hiển thị đúng thông số kết quả từ mutation trả về.

### 3. Concrete Examples & Analogies
* **Ví dụ cụ thể:** Khi import giày SKU "THANS-01", tên danh mục trong Excel là "Giày bóng đá". Nếu database chưa có danh mục nào, hệ thống sẽ tự tạo danh mục "Chưa phân loại" và gán "THANS-01" vào đó. Sau đó, trên trang admin, sản phẩm "THANS-01" sẽ hiển thị dưới danh mục "Chưa phân loại".
* **Hình ảnh tương đồng:** Giống như bạn mang 566 cuốn sách vào thư viện để xếp lên kệ. Nhưng thư viện chưa lắp bất kỳ chiếc kệ nào. Thay vì xếp sách lên sàn, thủ thư âm thầm bỏ hết sách vào kho chứa đồ hỏng (bỏ qua), nhưng vẫn ký giấy xác nhận "Đã nhận 566 cuốn sách". Việc tự động tạo danh mục mặc định tương tự như việc ta lắp tạm một chiếc kệ tên là "Kệ tạm thời" để xếp sách lên đó ngay lập tức.

---

## II. Audit Summary (Tóm tắt kiểm tra)
* **Trạng thái database hiện tại:** Bảng `productCategories` trống rỗng `[]`, bảng `products` trống rỗng `[]`.
* **Trạng thái logic import:** 
  * `lib/excel/adapters/sapo-thanshoes.adapter.ts` trả về `categoryId: undefined` do `categories` truyền vào từ client là rỗng `[]`.
  * `convex/productsImport.ts` bỏ qua các sản phẩm mới có `categoryId: undefined` dẫn đến không tạo mới bản ghi nào.
  * UI hiển thị thông báo dựa trên biến client `result.data.length` thay vì kết quả trả về của `upsertBulk`.

---

## III. Root Cause & Counter-Hypothesis (Nguyên nhân gốc & Giả thuyết đối chứng)
* **Root Cause (Nguyên nhân gốc):** Do database chưa có danh mục sản phẩm nào, dẫn đến bộ chuyển đổi (Adapter) không gán được `categoryId` cho sản phẩm mới. Convex mutation `upsertBulk` lọc bỏ và bỏ qua các sản phẩm không có `categoryId` hợp lệ. UI thì báo cáo sai số lượng thực tế được lưu do đếm số dòng từ client.
* **Độ tin cậy nguyên nhân gốc:** **High (Cao)** - Đã xác minh qua việc chạy truy vấn database thực tế bằng Convex CLI và đối chiếu mã nguồn của client và server mutation.

---

## IV. Proposal (Đề xuất)
1. **Fallback danh mục mặc định ở Server:**
   * Trong `convex/productsImport.ts`, kiểm tra nếu bảng `productCategories` rỗng, tự động insert một danh mục mặc định:
     * `name: "Chưa phân loại"`
     * `slug: "chua-phan-loai"`
     * `active: true`
     * `order: 0`
   * Nếu có danh mục trong DB, lấy danh mục đầu tiên làm mặc định.
   * Gán danh mục mặc định này cho tất cả sản phẩm mới không map được danh mục cụ thể.
2. **Sửa hiển thị thông báo UI:**
   * Trong `app/admin/products/components/import-modal.tsx`, đọc kết quả trả về của `upsertBulk` chứa `{ createdCount, updatedCount }` để hiển thị toast chính xác: `"Đã thêm mới ${res.createdCount} và cập nhật ${res.updatedCount} sản phẩm."`

---

## V. Files Impacted (Tệp bị ảnh hưởng)

### Sửa: [productsImport.ts](file:///e:/NextJS/job/job_from_system_vietadmin/system_thanshoes/convex/productsImport.ts)
* *Vai trò:* Mutation xử lý ghi đè và thêm mới sản phẩm hàng loạt vào database Convex.
* *Thay đổi:* Thêm logic tự động khởi tạo/lấy danh mục mặc định và gán fallback cho các sản phẩm thiếu `categoryId`.

### Sửa: [import-modal.tsx](file:///e:/NextJS/job/job_from_system_vietadmin/system_thanshoes/app/admin/products/components/import-modal.tsx)
* *Vai trò:* Giao diện Modal Import sản phẩm của Admin.
* *Thay đổi:* Đọc kết quả từ mutation `upsertBulk` để hiển thị Toast thông báo chính xác số lượng sản phẩm được tạo mới và cập nhật.

---

## VI. Execution Preview (Xem trước thực thi)
1. Đọc và chỉnh sửa `convex/productsImport.ts` để bổ sung logic fallback danh mục mặc định.
2. Đọc và chỉnh sửa `app/admin/products/components/import-modal.tsx` để cập nhật hiển thị toast.
3. Review tĩnh mã nguồn để tránh lỗi TypeScript.

---

## VII. Verification Plan (Kế hoạch kiểm chứng)
1. **Kiểm tra kiểu dữ liệu:** Đảm bảo không có lỗi biên dịch TypeScript.
2. **Kiểm tra thực tế:** Người dùng tiến hành import lại file Excel Sapo trên giao diện `http://localhost:3000/admin/products`.
3. **Tiêu chí pass:** Giao diện hiển thị Toast báo đúng số lượng được tạo mới và danh sách 566 sản phẩm hiển thị đầy đủ trên bảng Admin.

---

## VIII. Todo
- [ ] Cập nhật mutation `upsertBulk` trong `convex/productsImport.ts`
- [ ] Cập nhật modal import trong `app/admin/products/components/import-modal.tsx`

---

## IX. Acceptance Criteria (Tiêu chí chấp nhận)
* Import file Excel Sapo thành công mà không cần tạo danh mục trước.
* Trang quản trị `/admin/products` hiển thị danh sách sản phẩm đã import (chứ không báo "Chưa có sản phẩm nào.").
* Toast thông báo chính xác số lượng tạo mới và cập nhật.

---

## X. Risk / Rollback (Rủi ro / Hoàn tác)
* **Rủi ro:** Không có rủi ro lớn vì chỉ thay đổi logic fallback khi thiếu dữ liệu và hiển thị toast.
* **Hoàn tác:** Sử dụng Git rollback về commit trước đó nếu có vấn đề.

---

## XI. Out of Scope (Ngoài phạm vi)
* Việc đồng bộ hay import danh mục phân cấp phức tạp nằm ngoài phạm vi này.
