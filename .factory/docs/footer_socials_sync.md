# I. Primer

## 1. TL;DR kiểu Feynman
- **Vấn đề**: Khi cấu hình Footer trong trang admin (đường dẫn `/admin/home-components/footer/[id]/edit`), danh sách các nền tảng mạng xã hội và kênh liên hệ có thể lựa chọn (Facebook, Instagram, v.v.) bị thiếu nhiều tùy chọn so với nút hành động nổi (Speed Dial) như Shopee, Lazada, Tiki, Telegram, Messenger hay số điện thoại, email, địa chỉ.
- **Tại sao xảy ra**: File code định nghĩa danh sách mạng xã hội của Footer (`FooterForm.tsx`) chỉ khai báo cứng 7 mạng xã hội cơ bản, trong khi Speed Dial (`SpeedDialForm.tsx`) hỗ trợ tới 19 platform phong phú hơn. Việc load dữ liệu từ Settings hệ thống của Footer cũng thiếu các key liên hệ và Messenger.
- **Giải pháp**:
  - Mở rộng danh sách `SOCIAL_PLATFORMS` trong `FooterForm.tsx` tương tự như Speed Dial.
  - Cập nhật hàm `loadFromSettings` của Footer để load cả số điện thoại, email, địa chỉ, Messenger từ Settings hệ thống.
  - Bổ sung định nghĩa hiển thị các biểu tượng/ảnh (Shopee, Lazada, Tiki, Messenger, Telegram, v.v.) vào thành phần render Footer thực tế ở Client (`DynamicFooter.tsx`).

## 2. Elaboration & Self-Explanation
Hiện tại trong hệ thống có hai thành phần chính hiển thị thông tin mạng xã hội và liên hệ của shop:
1. **Footer (Chân trang)**: Nằm cố định ở cuối mỗi trang.
2. **Speed Dial (Nút hành động nhanh)**: Nút nổi tròn ở góc màn hình.

Khi quản trị viên vào trang chỉnh sửa Footer, hệ thống chỉ cho phép cấu hình 7 nền tảng: Facebook, Instagram, Youtube, TikTok, Zalo, X, Pinterest. Trong khi đó, nút Speed Dial lại hỗ trợ rất nhiều nền tảng mua sắm (Shopee, Lazada, Tiki) và liên hệ khác (Phone, Email, Địa chỉ, Messenger, Telegram). Việc này gây ra sự bất nhất về mặt trải nghiệm và tính năng, khiến quản trị viên không thể đồng bộ thông tin liên hệ chân trang với nút liên hệ nổi.

Để khắc phục, chúng ta cần đồng bộ danh sách nền tảng hỗ trợ từ Speed Dial sang Footer. Điều này đòi hỏi sửa đổi ở hai khu vực:
- **Trang Quản trị (Admin Form)**: Thêm các lựa chọn MXH mới vào dropdown cấu hình Footer, đồng thời bổ sung logic load tự động các thông tin này từ bảng Settings của hệ thống để quản trị viên không cần nhập tay lại.
- **Trang hiển thị Client (Dynamic Footer)**: Khi khách hàng truy cập, Footer phải biết cách render các biểu tượng (icon) mới (ví dụ SVG của Shopee, Messenger, hoặc ảnh logo của Lazada, Tiki) theo đúng màu sắc thương hiệu của từng nền tảng đó.

## 3. Concrete Examples & Analogies
- **Ví dụ cụ thể**: Shop có link Shopee là `https://shopee.vn/thanshoes`. Hiện tại, admin có thể thêm nút Shopee ở Speed Dial nổi, nhưng ở chân trang Footer thì hoàn toàn không có lựa chọn "Shopee" trong dropdown mạng xã hội. Sau khi sửa đổi, admin có thể chọn "Shopee", nhập link shopee vào và chân trang sẽ hiển thị logo Shopee màu cam chuẩn xác.
- **Analogy (Ẩn dụ đời thường)**: Giống như một nhà hàng có hai bảng thực đơn: một cuốn menu chính đặt trên bàn (Footer) và một tấm bảng gỗ ghi món nổi bật trước cửa (Speed Dial). Khách hàng phát hiện ra bảng gỗ ngoài cửa có bán trà sữa thái và sinh tố dừa, nhưng khi vào bàn mở menu chính ra lại hoàn toàn không tìm thấy hai món này để gọi. Chúng ta cần cập nhật menu chính để khách hàng có thể gọi bất kỳ món nước nào nhà hàng có bán.

# II. Audit Summary (Tóm tắt kiểm tra)
- Đã kiểm tra file định nghĩa Admin Form của Footer tại `app/admin/home-components/footer/_components/FooterForm.tsx`.
- Đã đối chiếu với file định nghĩa Admin Form của Speed Dial tại `app/admin/home-components/speed-dial/_components/SpeedDialForm.tsx`.
- Đã xác nhận các key cấu hình settings của hệ thống trong `convex/seeders/settings.seeder.ts` bao gồm cả `contact_phone`, `contact_email`, `contact_address`, `contact_messenger`.
- Đã kiểm tra file hiển thị Footer thực tế ngoài client tại `components/site/DynamicFooter.tsx` và phát hiện thiếu các cases render biểu tượng cho các platform mới.

# III. Root Cause & Counter-Hypothesis (Nguyên nhân gốc & Giả thuyết đối chứng)
- **Root Cause (Nguyên nhân gốc)**: Mảng tĩnh `SOCIAL_PLATFORMS` trong `FooterForm.tsx` chỉ chứa 7 phần tử. Đồng thời, hàm `loadFromSettings` chỉ truy vấn và map các keys mạng xã hội cơ bản, bỏ qua các keys liên hệ (`contact_phone`, `contact_email`, `contact_address`, `contact_messenger`). Thành phần client `DynamicFooter.tsx` cũng chưa có logic xử lý ảnh/icon cho các nền tảng mở rộng này.
- **Root Cause Confidence**: High (Độ tin cậy cao). Việc bổ sung đầy đủ khai báo mảng tĩnh, logic load settings và mapping render icon ở cả phía Admin và Client sẽ giải quyết triệt để vấn đề này mà không gây ảnh hưởng đến các dữ liệu Footer đã được lưu trước đó.

# IV. Proposal (Đề xuất)
1. **Admin Form (`FooterForm.tsx`)**:
   - Khai báo thêm các platform trong mảng `SOCIAL_PLATFORMS`: `messenger`, `telegram`, `shopee`, `lazada`, `tiki`, `linkedin`, `github`, `phone`, `mail`, `map-pin`.
   - Bổ sung helper `normalizePhoneUrl`, `normalizeEmailUrl`, `normalizeMapUrl` để đồng bộ định dạng link liên hệ giống Speed Dial.
   - Cập nhật `footerSettings` query để lấy thêm các settings liên hệ từ database.
   - Nâng cấp `loadFromSettings` để tự động load và đồng hóa các thông tin liên hệ này vào danh sách mạng xã hội của Footer.
   - Thêm helper `getSocialPlaceholder(platform)` để gợi ý định dạng nhập link phù hợp với từng nền tảng.
2. **Client Render (`DynamicFooter.tsx`)**:
   - Thêm các SVG custom: `ShopeeSvg`, `MessengerSvg`, `XSvg` giống Speed Dial.
   - Cập nhật `SocialIcon` switch case để render đầy đủ các icon mới, bao gồm cả hiển thị logo ảnh cho `lazada` và `tiki`.
   - Cập nhật mảng màu gốc `SOCIAL_ORIGINAL_COLORS` cho các platform mới để hiển thị đúng màu thương hiệu khi bật chế độ "Dùng màu icon gốc".
   - Import đầy đủ các icon Lucide cần thiết: `Mail`, `MapPin`, `Phone`, `Send`.

# V. Files Impacted (Tệp bị ảnh hưởng)
- **Sửa**: [FooterForm.tsx](file:///e:/NextJS/job/job_from_system_vietadmin/system_thanshoes/app/admin/home-components/footer/_components/FooterForm.tsx)
  - *Vai trò hiện tại*: Form quản trị cấu hình Footer.
  - *Thay đổi*: Mở rộng danh sách MXH, cập nhật query & logic load settings, thêm helper định dạng và gợi ý placeholder.
- **Sửa**: [DynamicFooter.tsx](file:///e:/NextJS/job/job_from_system_vietadmin/system_thanshoes/components/site/DynamicFooter.tsx)
  - *Vai trò hiện tại*: Thành phần hiển thị chân trang ngoài Client.
  - *Thay đổi*: Bổ sung các icon SVG và import Lucide, cập nhật switch-case render icon tương ứng với cấu hình MXH mới.

# VI. Execution Preview (Xem trước thực thi)
1. Đọc và lưu trữ chi tiết các dòng code của [FooterForm.tsx](file:///e:/NextJS/job/job_from_system_vietadmin/system_thanshoes/app/admin/home-components/footer/_components/FooterForm.tsx) cần thay đổi.
2. Thực hiện cập nhật [FooterForm.tsx](file:///e:/NextJS/job/job_from_system_vietadmin/system_thanshoes/app/admin/home-components/footer/_components/FooterForm.tsx).
3. Đọc và cập nhật [DynamicFooter.tsx](file:///e:/NextJS/job/job_from_system_vietadmin/system_thanshoes/components/site/DynamicFooter.tsx).
4. Tiến hành build dự án tĩnh / rà soát TypeScript compiler (`bunx tsc --noEmit`) để phát hiện và sửa các lỗi type (nếu có).
5. Tạo walkthrough mô tả các thay đổi và kết quả thử nghiệm.

# VII. Verification Plan (Kế hoạch kiểm chứng)
- **Automated Tests / Static Code Analysis**:
  - Chạy oxlint / TypeScript compiler kiểm tra không có lỗi cú pháp hoặc import sai.
- **Manual Verification (Kiểm chứng thủ công)**:
  - Khởi động ứng dụng, truy cập trang chỉnh sửa Footer, xác nhận dropdown mạng xã hội có đầy đủ các lựa chọn (Shopee, Lazada, Tiki, Phone, Mail, v.v.).
  - Bấm nút "Load từ Settings", xác nhận các link liên hệ tự động được điền và chuẩn hóa đúng.
  - Lưu lại cấu hình Footer mới và xác nhận chân trang ngoài Client hiển thị đúng logo, màu sắc của Shopee/Lazada/Tiki/Messenger theo thiết kế.

# VIII. Todo
- [ ] Cập nhật [FooterForm.tsx](file:///e:/NextJS/job/job_from_system_vietadmin/system_thanshoes/app/admin/home-components/footer/_components/FooterForm.tsx) để mở rộng platform MXH và cải thiện logic load từ settings.
- [ ] Cập nhật [DynamicFooter.tsx](file:///e:/NextJS/job/job_from_system_vietadmin/system_thanshoes/components/site/DynamicFooter.tsx) để hỗ trợ render tất cả icon MXH mới.
- [ ] Thực hiện static review và typecheck dự án.

# IX. Acceptance Criteria (Tiêu chí chấp nhận)
- Dropdown lựa chọn mạng xã hội trong trình chỉnh sửa Footer hiển thị đầy đủ các tùy chọn như Speed Dial.
- Nút "Load từ Settings" của Footer tự động lấy và định dạng đúng các thông tin từ Settings hệ thống bao gồm: Điện thoại, Email, Địa chỉ, Messenger và Zalo.
- Footer hiển thị ngoài trang chủ (Client) render đầy đủ các icon/logo tương ứng với liên kết mạng xã hội được thêm.
- Dự án biên dịch không phát sinh lỗi TypeScript.

# X. Risk / Rollback (Rủi ro / Hoàn tác)
- **Rủi ro**: Lỗi hiển thị biểu tượng nếu file ảnh logo Lazada/Tiki không tồn tại trên máy chủ.
- **Cách giảm thiểu**: Kiểm tra đường dẫn ảnh `/icons/lazada-logo.png` and `/icons/tiki-logo.png`. Nếu chưa có, đảm bảo fallback an toàn sang biểu tượng `Globe` mặc định để tránh lỗi vỡ layout.
- **Rollback**: Sử dụng `git checkout` để khôi phục trạng thái ban đầu của 2 file bị ảnh hưởng.

# XI. Out of Scope (Ngoài phạm vi)
- Việc thay đổi giao diện hoặc cấu hình tính năng của nút nổi Speed Dial.
- Việc can thiệp trực tiếp thay đổi cơ sở dữ liệu (schema) Convex.
