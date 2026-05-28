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

---

# IV. Proposal (Đề xuất)

## 1. Nâng cấp UI Import Modal (import-modal.tsx)

```tsx
// Trong import-modal.tsx
const generateSupportMessage = () => {
  if (compatibilityIssues.length === 0) return "";
  
  const issuesList = compatibilityIssues.map((issue) => {
    // Lấy config key và giá trị mong muốn
    let keyName = issue.key;
    let expectedVal = issue.expected === "VARIANT_LEVEL" ? "variant" : String(issue.expected);
    return `- ${issue.label} (${keyName} = ${expectedVal})`;
  }).join("\n");

  return `Nhờ kỹ thuật cấu hình lại module Sản phẩm (Products) để import file Excel Sapo:\n${issuesList}`;
};

const handleCopyMessage = () => {
  const message = generateSupportMessage();
  if (message) {
    navigator.clipboard.writeText(message);
    setIsCopied(true);
    toast.success("Đã sao chép yêu cầu cấu hình gửi Dev!");
    setTimeout(() => setIsCopied(false), 2000);
  }
};
```

### Thiết kế UI Smart Panel tối giản trong Dialog:
```tsx
{compatibilityIssues.length > 0 && (
  <div className="flex flex-col gap-2 p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900 my-2">
    <div className="flex items-center gap-2 font-semibold text-amber-700">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>Cấu hình hệ thống chưa tương thích (Cần báo Dev)</span>
    </div>
    <div className="bg-white/80 p-2 rounded border border-amber-100 text-xs font-mono text-amber-800 whitespace-pre-wrap select-all">
      {generateSupportMessage()}
    </div>
    <Button 
      variant="outline" 
      size="sm" 
      className="mt-1 w-full gap-2 border-amber-300 hover:bg-amber-100 text-amber-900"
      onClick={handleCopyMessage}
    >
      {isCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
      {isCopied ? "Đã sao chép!" : "Sao chép tin nhắn gửi Dev"}
    </Button>
  </div>
)}
```

---

# VIII. Todo
- `[ ]` Thêm phương thức `checkCompatibility` vào interface `ExcelImportAdapter`.
- `[ ]` Cài đặt kiểm tra tính tương thích cấu hình trong `sapo-thanshoes.adapter.ts`.
- `[ ]` Thêm hàm sinh tin nhắn tối giản `generateSupportMessage` và `handleCopyMessage` trong `import-modal.tsx`.
- `[ ]` Hiển thị Smart Panel cảnh báo tối giản kèm nút Copy to Clipboard trong giao diện Modal Import.
- `[ ]` Vô hiệu hóa nút **"Tiến hành Import"** khi phát hiện lỗi không tương thích.
