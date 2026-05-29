# I. Primer

## 1. TL;DR kiểu Feynman
* **Vấn đề**: Ở **Layout 6** (kiểu ribbon cờ treo), mỗi thẻ dịch vụ có một chiếc cờ màu cam absolute nằm ở góc trên bên trái. Để chữ không đè lên cờ, toàn bộ chữ tiêu đề và mô tả được đẩy sang bên phải bằng khoảng trống đệm lớn (`pl-[76px]`). Trên điện thoại (mobile), chiều ngang màn hình cực kỳ hẹp, việc dồn toàn bộ chữ sang một bên làm chữ bị bóp nghẹt, xếp thành hàng dọc rất dài và làm tăng chiều cao của thẻ. Phần dưới của chiếc cờ bên trái vì thế bị bỏ trống hoàn toàn, tạo ra một "lỗ trống" lổ chỗ màu xám nâu rất xấu và phí không gian.
* **Giải pháp**: Trên di động, chúng ta sẽ cho chữ mô tả tràn rộng ra toàn bộ chiều ngang của thẻ, nằm ở phía dưới chiếc cờ thay vì bị ép ở bên phải. Chỉ giữ chữ tiêu đề ngắn gọn ở bên phải chiếc cờ. Để làm được điều này, chúng ta sẽ ép chiều cao tối thiểu cho tiêu đề để nó luôn đẩy chữ mô tả xuống dưới chiếc cờ, đồng thời bỏ khoảng trống đệm bên trái của thẻ trên di động.
* **Phạm vi sửa đổi**: Chỉ cần chỉnh sửa duy nhất tệp [ServicesSectionCore.tsx](file:///e:/NextJS/job/job_from_system_vietadmin/system_thanshoes/components/site/ServicesSectionCore.tsx) vì tệp này được dùng chung cho cả trang web thực tế và phần xem trước (preview) của Admin lúc tạo/sửa.

## 2. Elaboration & Self-Explanation
Hiện tại, trong layout mặc định (Layout 6 - timeline/ribbon style) của `ServicesSectionCore.tsx`, cấu trúc CSS đang quy định:
* Lớp CSS của thẻ `article`: `py-2.5 pl-[76px] pr-4` (luôn đệm 76px bên trái cho cả desktop và mobile).
* Ribbon cờ cam có kích thước: `absolute left-4 top-[-7px] z-10 h-[58px] w-12`.

Khi hiển thị trên Mobile dưới dạng 2 cột (`grid-cols-2`), chiều rộng của mỗi thẻ chỉ còn khoảng 163px. Sau khi trừ đi 76px đệm trái và 16px đệm phải, không gian còn lại cho phần chữ chỉ còn đúng **71px**! Điều này làm cho chữ mô tả dịch vụ bị dồn nén nghiêm trọng, kéo dài chiều cao thẻ lên tới 150px-180px.
Vì chiếc cờ chỉ chiếm chiều cao thực tế trong thẻ là `58px - 7px = 51px`, phần không gian phía dưới cờ từ 51px đến 180px bị bỏ trống hoàn toàn, tạo ra "lỗ trống" màu nền mất thẩm mỹ.

Để khắc phục, chúng tôi đề xuất tối ưu hóa CSS lớp của các thẻ trên thiết bị di động (Responsive-first):
1. Đổi đệm trái của thẻ `article` trên mobile thành `pl-4` (giống lề phải), và chỉ giữ `md:pl-[76px]` trên desktop.
2. Thêm `pl-[56px] md:pl-0` vào riêng thẻ **Tiêu đề** `h3` để chỉ đẩy tiêu đề sang bên phải chiếc cờ.
3. Ép chiều cao tối thiểu cho tiêu đề trên mobile là `min-h-[42px] md:min-h-0`. Vì padding-top của thẻ là 10px, chiều cao tối thiểu 42px đảm bảo mép dưới của tiêu đề luôn ở mức `42px + 10px = 52px`, vừa vặn vượt qua chiều cao trong thẻ của chiếc cờ (51px).
4. Thẻ **Mô tả** `p` sẽ không dùng đệm trái nữa (`pl-0`), tự động dàn trải rộng ra toàn bộ chiều rộng của thẻ và nằm ngay bên dưới chiếc cờ, lấp đầy "lỗ trống" cũ một cách hoàn hảo và tự nhiên.

## 3. Concrete Examples & Analogies
* **Ví dụ thực tế**: Giống như bạn có một văn phòng làm việc nhỏ hẹp. Bạn đặt một chiếc tủ hồ sơ lớn ở góc trái văn phòng. 
  * Cách làm cũ: Bạn cấm không cho ai để bất cứ thứ gì ở toàn bộ nửa bên trái văn phòng (từ sàn đến trần), bắt tất cả nhân viên phải dồn đống bàn ghế sang nửa bên phải chật chội. Kết quả là nửa bên phải thì chật cứng, còn nửa bên trái dưới chiếc tủ thì trống hoác.
  * Cách làm mới: Bạn vẫn đặt chiếc tủ ở góc trái. Nhưng bạn cho phép nhân viên kê bàn làm việc tràn sang bên trái, ngay phía dưới gầm của chiếc tủ treo tường đó. Văn phòng sẽ cực kỳ rộng rãi và tận dụng 100% không gian.

---

# II. Audit Summary (Tóm tắt kiểm tra)

* Chúng tôi đã phân tích tệp tin [ServicesSectionCore.tsx](file:///e:/NextJS/job/job_from_system_vietadmin/system_thanshoes/components/site/ServicesSectionCore.tsx) và xác định chính xác phân đoạn render cho Layout 6 (Timeline ribbon) từ dòng 773 đến dòng 833.
* Bản sửa đổi sẽ nằm tập trung tại đây và sử dụng các lớp CSS tiện ích của Tailwind (như `md:`, `min-h-`, `cn`) để đạt hiệu quả tối đa và đảm bảo không ảnh hưởng đến bất kỳ layout nào khác.

---

# III. Root Cause & Counter-Hypothesis (Nguyên nhân gốc & Giả thuyết đối chứng)

### Độ tin cậy nguyên nhân gốc: High (Cao)
* **Lý do**: Khoảng trống xuất hiện trực tiếp do việc sử dụng padding-left cố định cho toàn bộ thẻ chứa (`pl-[76px]`) thay vì chỉ áp dụng cho tiêu đề, kết hợp với việc chữ mô tả bị bóp nghẹt trên mobile chia 2 cột. Giải pháp định vị lại phần mô tả phía dưới ribbon là cực kỳ chính xác và tự nhiên.

---

# IV. Proposal (Đề xuất)

Cập nhật cấu trúc CSS của Layout 6 (Timeline ribbon) trong [ServicesSectionCore.tsx](file:///e:/NextJS/job/job_from_system_vietadmin/system_thanshoes/components/site/ServicesSectionCore.tsx) như sau:
* **Thẻ article**: Thay `pl-[76px]` bằng `pl-4 md:pl-[76px]`.
* **Thẻ h3 (Tiêu đề)**: Sử dụng helper `cn` để thêm lớp `pl-[56px] md:pl-0 min-h-[42px] md:min-h-0`.
* **Thẻ p (Mô tả)**: Sử dụng helper `cn` để thêm lớp `pl-0 mt-2 md:mt-0.5`.

---

# V. Files Impacted (Tệp bị ảnh hưởng)

### Sửa đổi:
1. **[ServicesSectionCore.tsx](file:///e:/NextJS/job/job_from_system_vietadmin/system_thanshoes/components/site/ServicesSectionCore.tsx)**
   * *Vai trò hiện tại*: Render toàn bộ các layout của Services component cho cả site thực tế và phần xem trước của Admin panel.
   * *Thay đổi*: Cập nhật lớp CSS của thẻ `article`, `h3`, và `p` ở layout mặc định (dòng 778-829) để áp dụng cấu trúc responsive mới trên mobile.

---

# VI. Execution Preview (Xem trước thực thi)

1. **Bước 1**: Đọc kỹ phân đoạn dòng 770-835 trong `ServicesSectionCore.tsx`.
2. **Bước 2**: Thực hiện thay đổi lớp CSS cho `article`, `h3` và `p`.
3. **Bước 3**: Tiến hành review tĩnh và đảm bảo các import cần thiết (như `cn`) đã sẵn sàng.

---

# VII. Verification Plan (Kế hoạch kiểm chứng)

### Kiểm tra thủ công:
1. Mở link edit Services trong Admin: `http://localhost:3000/admin/home-components/services/js73xcsqx77bk7cbxdzjqpx0qh87jebn/edit`
2. Chọn **Layout 6** (Timeline).
3. Đảm bảo phần preview hiển thị ảnh/icon ribbon cam ở góc trái, tiêu đề nằm gọn gàng bên phải, và chữ mô tả dàn trải rộng ra toàn bộ chiều ngang bên dưới, lấp đầy khoảng trống thừa cũ.
4. Chuyển đổi giữa các giả lập xem: Desktop, Tablet, Mobile và đảm bảo mọi thứ hiển thị cân đối, đẹp mắt.
5. Kiểm tra trực quan trên trang chủ site thực tế.

---

# VIII. Todo

- [x] Sửa đổi lớp CSS responsive cho layout mặc định (Layout 6) trong [ServicesSectionCore.tsx](file:///e:/NextJS/job/job_from_system_vietadmin/system_thanshoes/components/site/ServicesSectionCore.tsx).
- [x] Xác minh hiển thị và cập nhật walkthrough.md.

---

# IX. Acceptance Criteria (Tiêu chí chấp nhận)

* **Điều kiện Đạt (Pass)**:
  * Trên di động, chữ mô tả của Layout 6 dàn rộng ra sát lề trái (dưới chiếc cờ) và sát lề phải, tận dụng tối đa không gian.
  * Chiếc cờ màu cam vẫn được định vị chuẩn xác ở góc trên bên trái, tiêu đề nằm ngay bên phải cờ và không bị cờ đè lên.
  * Thẻ dịch vụ trở nên gọn gàng, giảm chiều cao dư thừa không cần thiết.
  * Trên Desktop, layout vẫn giữ nguyên cấu trúc đệm trái `pl-[76px]` ban đầu để hiển thị hàng ngang đẹp mắt.
* **Điều kiện Không Đạt (Fail)**:
  * Chữ mô tả vẫn bị bóp nghẹt trong cột hẹp bên phải, để lộ khoảng trống lớn dưới chiếc cờ trên di động.

---

# X. Risk / Rollback (Rủi ro / Hoàn tác)

* **Rủi ro**: Hầu như không có rủi ro nào vì thay đổi chỉ nằm trong phạm vi CSS của Layout 6 và được tối ưu hóa responsive an toàn.
* **Hoàn tác**: Sử dụng `git checkout` để khôi phục tệp tin về trạng thái cũ.

---

# XI. Out of Scope (Ngoài phạm vi)

* Không thay đổi thiết kế của các layout dịch vụ khác ngoài Layout 6.
* Không thay đổi API hay cấu trúc dữ liệu của Services component.
