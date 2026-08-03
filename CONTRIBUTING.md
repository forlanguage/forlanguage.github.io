# Hướng dẫn đóng góp cho ForLanguage

Cảm ơn bạn đã đóng góp cho cộng đồng tự học ngoại ngữ ForLanguage.

## 1. Đóng góp bằng Fork và Pull Request

1. Fork repository `forlanguage/forlanguage.github.io`.
2. Clone repository đã fork về máy.
3. Tạo branch mới, ví dụ:

   ```bash
   git checkout -b feat/add-aptis-reading-questions
   ```

4. Cập nhật nội dung và kiểm tra lại dữ liệu.
5. Commit với thông điệp rõ ràng.
6. Push branch lên repository đã fork.
7. Mở Pull Request về nhánh `main` của `forlanguage/forlanguage.github.io`.

Trong Pull Request, vui lòng ghi rõ:

- Loại đóng góp.
- Phạm vi thay đổi.
- Nguồn hoặc bối cảnh của nội dung.
- Question ID liên quan, nếu có.
- Cách bạn đã kiểm tra đáp án.

## 2. Đóng góp bằng Issue

### Đóng góp câu hỏi

Dùng loại Issue **Đóng góp câu hỏi** khi bạn có:

- Câu hỏi thực tế nhớ lại sau kỳ thi.
- Một nhóm câu hỏi có giá trị để mở rộng ngân hàng.
- Gợi ý chủ đề hoặc dạng bài còn thiếu.

Câu hỏi thực tế sau kỳ thi là nguồn rất có giá trị. Vui lòng mô tả lại bằng cách diễn đạt của bạn, không đăng dữ liệu cá nhân, thông tin thí sinh hoặc nội dung mà bạn không có quyền chia sẻ.

Mỗi đóng góp nên có tối thiểu:

- Kỳ thi hoặc dạng bài.
- Nội dung câu hỏi hoặc mô tả gần đúng.
- Các lựa chọn đáp án, nếu nhớ được.
- Đáp án đề xuất.
- Lý do hoặc ghi chú hỗ trợ.
- Mức độ chắc chắn: cao, trung bình hoặc thấp.

Sau khi review, nhóm dự án sẽ chuẩn hóa và bổ sung nội dung phù hợp để tăng số câu trong ngân hàng.

### Report đáp án sai

Dùng loại Issue **Report đáp án sai** khi bạn phát hiện:

- Đáp án đúng bị gán sai.
- Câu hỏi có nhiều hơn một đáp án hợp lý.
- Giải thích chưa chính xác.
- Câu hỏi hoặc lựa chọn có lỗi chính tả, ngữ pháp hoặc định dạng.

Vui lòng cung cấp:

- Question ID.
- Vị trí câu hỏi: section, test, part hoặc group.
- Đáp án hiện tại.
- Đáp án đề xuất.
- Giải thích hoặc nguồn tham khảo.

Trong Aptis Practice, nút **Báo lỗi** bên cạnh mỗi câu sẽ sao chép sẵn mẫu report có Question ID và vị trí câu hỏi.

## Nguyên tắc review

- Mọi nội dung phải được review trước khi merge.
- Không bổ sung câu hỏi trùng lặp.
- Đáp án phải có giải thích hợp lý.
- Giữ nguyên Question ID của câu đã phát hành; không tái sử dụng ID cho câu khác.
- Không đưa dữ liệu cá nhân hoặc thông tin nhạy cảm vào repository.
