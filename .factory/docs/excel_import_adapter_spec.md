# I. Primer

## 1. TL;DR kiểu Feynman
*   **Vấn đề:** Khi Admin vận hành tải file Excel Sapo ThanShoes lên mà hệ thống chưa bật tính năng biến thể, họ cần báo Dev điều chỉnh cấu hình. Tuy nhiên, tin nhắn hướng dẫn không nên quá dài dòng hay chứa đường dẫn hệ thống nội bộ để tránh Admin thắc mắc hoặc truy cập trái phép.
*   **Giải pháp:** Tối giản hóa tin nhắn copy. Chỉ nêu tên các cài đặt kỹ thuật cần đổi và gửi trực tiếp cho Dev mà không kèm link hay lời chào hỏi dư thừa.
*   **Kết quả:** Tin nhắn cực kỳ ngắn gọn, đi thẳng vào trọng tâm chuyên môn của Dev, Admin chỉ cần bấm copy-paste gửi đi là xong.

## 2. Elaboration & Self-Explanation
Nhân viên vận hành (Admin cửa hàng) không cần quan tâm đến các đường dẫn kỹ thuật như `system/modules/...` và việc hiển thị link này có thể khiến họ tò mò hoặc hỏi han phiền phức. 

Khi có lỗi tương thích cấu hình, hệ thống sẽ sinh ra một đoạn tin nhắn tối giản, mang tính chất kỹ thuật cao để gửi thẳng cho Dev. Dev chỉ cần đọc các tham số này là tự khắc biết phải truy cập vào đâu trong hệ thống để cấu hình lại, không cần bất kỳ sự giải thích hay dẫn link nào từ phía Admin.

## 3. Concrete Examples & Analogies
*   **Ví dụ đoạn tin nhắn tối giản được sinh ra:**
    > 📋 **Nội dung tin nhắn sao chép:**
    > Nhờ kỹ thuật cấu hình lại module Sản phẩm (Products) để import file Excel Sapo:
    > - Bật tính năng Phiên bản (variantEnabled = true)
    > - Chuyển quản lý Giá sang cấp Phiên bản (variantPricing = variant)
    > - Chuyển quản lý Tồn kho sang cấp Phiên bản (variantStock = variant)

---

# II. Audit Summary (Tóm tắt kiểm tra)
*   **Tinh giản UI/UX:**
    *   Bỏ đường dẫn URL cấu hình hệ thống khỏi tin nhắn copy.
    *   Rút gọn ngôn từ tin nhắn, đi thẳng vào cấu hình kỹ thuật để Dev dễ xử lý.
*   **Các Gap kỹ thuật cần xử lý để cả Import lẫn Update hoạt động hoàn hảo:**
    1.  **CategoryId bắt buộc:** Convex yêu cầu `categoryId` khi tạo mới sản phẩm. Ta cần map tên danh mục (cột C của Sapo) sang ID danh mục tương ứng của Convex.
    2.  **SKU biến thể:** Convex tự sinh SKU dạng `SKUCHA-1`, `SKUCHA-2`... Ta cần nhận SKU biến thể từ Excel (dạng `SKUCHA-SIZE`) để đồng bộ kho chính xác với Sapo.
    3.  **Đồng bộ tồn kho về 0:** Các size cũ có trong database nhưng không xuất hiện trong file Excel Sapo cần được cập nhật tồn kho về 0 thay vì xóa hoàn toàn (giúp giữ lịch sử đơn hàng cũ).
    4.  **Mảng ảnh:** Đồng bộ tất cả các URL ảnh từ biến thể (cột R) vào mảng ảnh `images` của sản phẩm cha.

---

# IV. Proposal (Đề xuất)

## 1. Nâng cấp UI Import Modal (import-modal.tsx)
Truyền danh sách `categories` từ client-side vào Server Action `parseProductExcelBase64` để thực hiện ánh xạ danh mục:
```tsx
const categoryList = categories.map(c => ({ id: c._id, name: c.name }));
const result = await parseProductExcelBase64(base64String, configData, excelOptions, categoryList);
```

## 2. Ánh xạ Danh mục và SKU biến thể trong Adapter (sapo-thanshoes.adapter.ts)
*   Nhận `categories` trong hàm `parse` để tìm danh mục khớp với tên loại sản phẩm (Cột C).
*   Gom toàn bộ ảnh của các biến thể vào mảng `images` của sản phẩm cha.
*   Gán trường `sku` cho từng biến thể: `sku: skuVal` (cột N từ Excel).

## 3. Tối ưu hóa Convex mutation (convex/productsImport.ts)
*   Mở rộng schema `bulkVariantDoc` hỗ trợ trường `sku: v.optional(v.string())`.
*   Sửa logic cập nhật biến thể sản phẩm: Sử dụng đối khớp theo SKU. Nếu SKU biến thể đã tồn tại thì thực hiện cập nhật (`patch`), nếu chưa thì tạo mới (`insert`).
*   Các biến thể cũ trong database không xuất hiện trong file Excel sẽ bị set `stock: 0` thay vì bị delete hoàn toàn để đảm bảo an toàn dữ liệu lịch sử đơn hàng.

---

# VIII. Todo
- `[x]` Thêm phương thức `checkCompatibility` vào interface `ExcelImportAdapter`.
- `[x]` Cài đặt kiểm tra tính tương thích cấu hình trong `sapo-thanshoes.adapter.ts`.
- `[x]` Thêm hàm sinh tin nhắn tối giản `generateSupportMessage` và `handleCopyMessage` trong `import-modal.tsx`.
- `[x]` Hiển thị Smart Panel cảnh báo tối giản kèm nút Copy to Clipboard trong giao diện Modal Import.
- `[x]` Vô hiệu hóa nút **"Tiến hành Import"** khi phát hiện lỗi không tương thích.
- `[x]` Cập nhật Convex mutation `upsertBulk` hỗ trợ nhận SKU biến thể và tối ưu hóa quản lý biến thể (đối khớp SKU, cập nhật tồn kho về 0 thay vì xóa biến thể cũ).
- `[x]` Chuyển danh sách `categories` từ client vào Server Action để tự động map danh mục.
- `[x]` Chạy compile check TypeScript và commit toàn bộ thay đổi.

---

# IX. Acceptance Criteria (Tiêu chí chấp nhận)
*   **Đúng dữ liệu (Import & Update):** Khi import hoặc cập nhật dữ liệu, sản phẩm cha và các biến thể con (Size, Giá bán, Tồn kho, Ảnh đại diện) phải được cập nhật/thêm mới chính xác vào database Convex dựa trên SKU biến thể thực tế (dạng `SKUCHA-SIZE`).
*   **Đồng bộ tồn kho:** Các biến thể không xuất hiện trong file Excel nhập kho phải được set `stock: 0` để cập nhật tồn kho thực tế, nhưng không bị xóa khỏi database.
*   **Tính an toàn:** Nút **"Tiến hành Import"** bị vô hiệu hóa khi cấu hình hệ thống bị lệch, ngăn chặn việc người dùng cố tình gửi dữ liệu lỗi.
