# I. Primer

## 1. TL;DR kiểu Feynman
* **Vấn đề**: Dự án đang có 35 cảnh báo (warnings) linter từ `oxlint --type-aware --type-check`. Các cảnh báo này bao gồm: biến/import không sử dụng (unused vars/imports), Promise không được await (no-floating-promises), và chuyển đổi kiểu dữ liệu Object sang String có nguy cơ lỗi (no-base-to-string).
* **Giải pháp**: 
  1. Loại bỏ các dòng import không sử dụng của `lucide-react` trong các file UI và file cấu hình.
  2. Bỏ các biến cục bộ khai báo nhưng không dùng đến, sử dụng alias `_` hoặc dấu gạch dưới `_` cho các tham số destructuring không được tham chiếu.
  3. Bổ sung toán tử `void` trước các lệnh gọi Promise không cần `await` trong các sự kiện click React (`onClick`).
  4. Cải tiến hàm xử lý chuyển đổi dữ liệu của ExcelJS để cô lập kiểu dữ liệu trước khi ép sang `String`, ngăn chặn cảnh báo `no-base-to-string` và tránh trả về `"[object Object]"`.

## 2. Elaboration & Self-Explanation
Hệ thống `oxlint` tích hợp kiểm tra kiểu dữ liệu tĩnh rất nghiêm ngặt để đảm bảo code sạch sẽ và tối ưu bộ nhớ.
* **Import/Variable không sử dụng**: Các file được refactor qua nhiều phiên bản thường để lại các dòng import thư viện biểu tượng như `lucide-react` mà thực tế không dùng đến. Việc xóa các import này giúp giảm dung lượng bundle và làm sạch không gian tên (namespace).
* **Floating Promises**: Trong Next.js và React, khi ta gọi các hàm bất đồng bộ (async functions như `addItem` hoặc `handleAddToCart`) trong các sự kiện đồng bộ (`onClick`), trình biên dịch TypeScript cảnh báo nếu Promise đó không được xử lý bằng `await` hoặc bắt lỗi `.catch()`. Việc thêm từ khóa `void` trước lệnh gọi là cách báo cho trình biên dịch biết ta chủ động bỏ qua Promise này một cách an toàn.
* **Định dạng String của Object**: ExcelJS Cell chứa giá trị thuộc kiểu `ExcelJS.CellValue` có thể là `object`. Ép kiểu bằng `String(val)` trực tiếp trên một object có thể sinh ra `"[object Object]"`. Bằng cách phân tách kiểu rõ ràng bằng `typeof val !== "object"` và giải quyết riêng các trường hợp object (như `Date`), ta loại bỏ được lỗ hổng logic này.

## 3. Concrete Examples & Analogies
* **Ví dụ floating promise**:
  * *Trước*: `onClick={() => handleAddToCart(product)}` (Báo cảnh báo vì `handleAddToCart` là async)
  * *Sau*: `onClick={() => void handleAddToCart(product)}` (An toàn, tắt cảnh báo linter)
* **Ví dụ no-base-to-string**:
  * *Trước*: `return String(val).trim();` với `val` có kiểu phức tạp.
  * *Sau*: `if (typeof val !== "object") { return String(val).trim(); } return "";` (Đảm bảo giá trị truyền vào `String()` chỉ là kiểu nguyên bản nguyên thủy như number, boolean, string).
* **Ẩn dụ**: Giống như việc dọn dẹp một căn bếp. Xóa import thừa giống như vứt vỏ hộp rỗng; thêm `void` giống như dán nhãn "đã tắt bếp" để không ai phải lo lắng kiểm tra lại; sửa đổi hàm convert Excel giống như phân loại rác hữu cơ và vô cơ trước khi xử lý để tránh tắc nghẽn.

# II. Audit Summary (Tóm tắt kiểm tra)
* Chúng tôi đã định vị chính xác toàn bộ 10 file chứa các cảnh báo linter:
  1. `app/system/experiences/search-filter/page.tsx`
  2. `app/admin/home-components/footer/_components/FooterPreview.tsx`
  3. `components/site/DynamicFooter.tsx`
  4. `lib/excel/adapters/sapo-thanshoes.adapter.ts`
  5. `app/admin/settings/_components/SettingsPageShell.tsx`
  6. `app/admin/products/components/import-modal.tsx`
  7. `components/site/shared/ProductCardActions.tsx`
  8. `lib/modules/configs/settings.config.ts`
  9. `components/site/ProductListSection.tsx`
  10. `app/(site)/search/page.tsx`
* Đã xác định phương án sửa tối ưu nhất cho từng file mà hoàn toàn không thay đổi logic nghiệp vụ (business logic) của hệ thống.

# III. Root Cause & Counter-Hypothesis (Nguyên nhân gốc & Giả thuyết đối chứng)
* **Nguyên nhân gốc**:
  1. Các file component thay đổi cấu trúc qua các đợt refactor nhưng chưa dọn dẹp các thư viện import thừa và biến cục bộ.
  2. Sự kiện `onClick` gọi hàm async mà không có `void` hoặc `await`.
  3. Sử dụng `String(val)` trên kiểu dữ liệu phức tạp của `exceljs` dẫn đến cảnh báo `no-base-to-string`.
* **Giả thuyết đối chứng**: 
  * Nếu giữ nguyên không sửa, code vẫn hoạt động bình thường ở runtime nhưng sẽ làm ô nhiễm log kiểm thử tĩnh (static analysis) và có nguy cơ phát sinh lỗi runtime nếu `exceljs` trả về một object phức tạp ngoài dự kiến. Việc dọn dẹp này cải thiện đáng kể độ tin cậy của mã nguồn.

# IV. Proposal (Đề xuất)
* Thực hiện chỉnh sửa trực tiếp trên 10 file bị ảnh hưởng để loại bỏ hoàn toàn các warnings.
* Chạy lại công cụ `oxlint` sau khi sửa để đảm bảo không còn lỗi/cảnh báo nào sót lại.

# V. Files Impacted (Tệp bị ảnh hưởng)
### UI / Client Components:
1. `app/system/experiences/search-filter/page.tsx`
   * *Sửa*: Loại bỏ import `LayoutTemplate`, xóa các biến unused `canUseProducts` và `canUseQuickAddVariant`.
2. `app/admin/home-components/footer/_components/FooterPreview.tsx`
   * *Sửa*: Xóa import biểu tượng không sử dụng của `lucide-react` ở đầu file.
3. `components/site/DynamicFooter.tsx`
   * *Sửa*: Xóa import biểu tượng không sử dụng của `lucide-react`.
4. `app/admin/settings/_components/SettingsPageShell.tsx`
   * *Sửa*: Loại bỏ import `ShoppingBag`.
5. `app/admin/products/components/import-modal.tsx`
   * *Sửa*: Loại bỏ state `detectedAdapter`, đổi `detectedOptionNames` sang `detectedOptionNames: _detectedOptionNames` trong destructuring.
6. `components/site/shared/ProductCardActions.tsx`
   * *Sửa*: Xóa import `ShoppingCart`, đổi alias `buyNowLabel: _buyNowLabel` trong destructuring tham số.
7. `components/site/ProductListSection.tsx`
   * *Sửa*: Thêm `void` trước cuộc gọi `handleAddToCart` và `handleBuyNow`.
8. `app/(site)/search/page.tsx`
   * *Sửa*: Thêm `void` trước cuộc gọi `addItem` ở dòng 429.

### Shared / Server / Data Adapters:
9. `lib/excel/adapters/sapo-thanshoes.adapter.ts`
   * *Sửa*: Cập nhật hàm `getCellText` kiểm tra type an toàn, loại bỏ khai báo và các lệnh gán của `currentBrand` và `currentDesc`.
10. `lib/modules/configs/settings.config.ts`
    * *Sửa*: Xóa import `Store` từ `lucide-react`.

# VI. Execution Preview (Xem trước thực thi)
1. Đọc và chỉnh sửa các file UI để dọn dẹp imports và variables.
2. Cập nhật các file có lỗi Promise trôi nổi (floating-promises) bằng toán tử `void`.
3. Sửa adapter Excel để giải quyết triệt để lỗi chuyển đổi string và biến thừa.
4. Kích hoạt lệnh lint để kiểm tra kết quả cuối cùng.

# VII. Verification Plan (Kế hoạch kiểm chứng)
* **Kiểm tra tự động**: Chạy `bunx oxlint --type-aware --type-check` trên toàn bộ dự án để đảm bảo số lượng cảnh báo giảm về 0 (hoặc tối thiểu liên quan đến độ dài file `ProductsPage.tsx`).
* **Kiểm tra biên dịch**: Chạy `bunx tsc --noEmit` để đảm bảo kiểu dữ liệu vẫn hoàn toàn chính xác.

# VIII. Todo
- [ ] Cập nhật `app/system/experiences/search-filter/page.tsx`
- [ ] Cập nhật `app/admin/home-components/footer/_components/FooterPreview.tsx`
- [ ] Cập nhật `components/site/DynamicFooter.tsx`
- [ ] Cập nhật `lib/excel/adapters/sapo-thanshoes.adapter.ts`
- [ ] Cập nhật `app/admin/settings/_components/SettingsPageShell.tsx`
- [ ] Cập nhật `app/admin/products/components/import-modal.tsx`
- [ ] Cập nhật `components/site/shared/ProductCardActions.tsx`
- [ ] Cập nhật `lib/modules/configs/settings.config.ts`
- [ ] Cập nhật `components/site/ProductListSection.tsx`
- [ ] Cập nhật `app/(site)/search/page.tsx`
- [ ] Chạy `bunx oxlint --type-aware --type-check` để đối chiếu kết quả.

# IX. Acceptance Criteria (Tiêu chí chấp nhận)
* Toàn bộ 35 warnings được giải quyết triệt để.
* Không phát sinh lỗi biên dịch TypeScript mới.
* Ứng dụng hoạt động bình thường, các sự kiện click giỏ hàng và import Excel hoạt động ổn định.

# X. Risk / Rollback (Rủi ro / Hoàn tác)
* **Rủi ro**: Rất thấp vì đây hoàn toàn là các thay đổi dọn dẹp mã nguồn tĩnh và cú pháp chuẩn hóa.
* **Hoàn tác**: Sử dụng `git checkout` để rollback nhanh chóng bất kỳ file nào có dấu hiệu bất thường.

# XI. Out of Scope (Ngoài phạm vi)
* Thay đổi cấu trúc dữ liệu của các adapter hoặc thiết kế lại giao diện UI.
* Refactor các hàm xử lý logic nghiệp vụ chính.
