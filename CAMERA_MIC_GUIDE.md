# Hướng Dẫn Sử Dụng Camera và Microphone trong Live Class

## 🎥 Chức năng đã hoàn thiện

### ✅ Bật/Tắt Camera
- **Biểu tượng:** 📹 (ON) / 📷 (OFF)
- **Vị trí:** Thanh điều khiển ở giữa dưới cùng video area
- **Hoạt động:**
  - Click để bật/tắt camera
  - Khi tắt: Hiển thị placeholder với avatar và text "CAMERA OFF"
  - Khi bật: Hiển thị video stream từ camera
  - Tự động thông báo cho các thành viên khác trong phòng

### ✅ Bật/Tắt Microphone
- **Biểu tượng:** 🎤 (ON) / 🔇 (OFF)
- **Vị trí:** Thanh điều khiển ở giữa dưới cùng video area
- **Hoạt động:**
  - Click để bật/tắt microphone
  - Hiển thị icon 🔇 trên video tile khi mic tắt
  - Tự động thông báo cho các thành viên khác trong phòng

### ✅ Chia Sẻ Màn Hình
- **Biểu tượng:** 🖥️
- **Vị trí:** Thanh điều khiển ở giữa dưới cùng video area
- **Hoạt động:**
  - Click để bắt đầu/dừng chia sẻ màn hình
  - Chỉ teacher có thể chia sẻ màn hình

## 🎨 Giao Diện Điều Khiển

### Thanh điều khiển (Video Controls)
```
┌──────────────────────────────────────────────┐
│  🎤    📹    🖥️   🟢 Đã kết nối            │
└──────────────────────────────────────────────┘
```

**Màu sắc:**
- 🟢 **Xanh lá** (Active): Chức năng đang BẬT
- 🔴 **Đỏ** (Inactive): Chức năng đang TẮT

**Hiệu ứng:**
- Hover: Scale lớn hơn + hiển thị tooltip
- Click: Scale nhỏ lại (feedback)
- Gradient background đẹp mắt

## 🔧 Cách Sử Dụng

### 1. Khi Vào Phòng Lần Đầu

**Mặc định:**
- ❌ Camera: TẮT
- ❌ Microphone: TẮT

**Lý do:**
- Bảo mật privacy
- Cho phép người dùng chuẩn bị trước khi bật

### 2. Bật Camera

**Bước 1:** Click vào nút 📷 (camera OFF)
**Bước 2:** Trình duyệt yêu cầu quyền truy cập camera
**Bước 3:** Cho phép → Camera bật ✅
**Kết quả:** 
- Nút chuyển sang 📹 màu xanh
- Video stream hiển thị
- Các thành viên khác thấy video của bạn

### 3. Bật Microphone

**Bước 1:** Click vào nút 🔇 (mic OFF)
**Bước 2:** Trình duyệt yêu cầu quyền truy cập microphone
**Bước 3:** Cho phép → Microphone bật ✅
**Kết quả:**
- Nút chuyển sang 🎤 màu xanh
- Icon 🔇 trên video tile biến mất
- Các thành viên khác nghe được giọng nói của bạn

### 4. Tắt Camera/Microphone

**Cách 1:** Click lại vào nút đang active
**Cách 2:** Teacher có thể force mute students

## 🎯 Tính Năng Nâng Cao

### 1. Tự Động Thêm Track

Nếu bạn:
- Đã có stream với AUDIO nhưng chưa có VIDEO
- Bật camera → Tự động thêm video track vào stream hiện tại
- Không cần tạo stream mới

Tương tự với microphone.

### 2. WebRTC P2P

- Stream được chia sẻ trực tiếp giữa các peer
- Không qua server (giảm độ trễ)
- Tối ưu cho <= 6 người

### 3. Real-time Sync

Khi bạn bật/tắt camera hoặc mic:
```javascript
// Emit event qua socket
socket.emit('media:toggle-camera', { enabled: true })
socket.emit('media:toggle-mic', { enabled: true })

// Các thành viên khác nhận event
socket.on('media:user-camera-changed', ({ userId, enabled }) => {
  // Cập nhật UI
})
```

## 📱 Responsive Design

### Desktop (> 1024px)
```
┌─────────────┬─────────────┬─────────────┐
│ Participants│    Video    │   Chat      │
│   Panel     │    Grid     │   Panel     │
└─────────────┴─────────────┴─────────────┘
```

### Tablet/Mobile
```
┌─────────────────────────────────┐
│          Video Grid             │
├─────────────────────────────────┤
│          Chat Panel             │
└─────────────────────────────────┘
```

## 🐛 Troubleshooting

### Lỗi: "Could not access camera/microphone"

**Nguyên nhân:**
1. Chưa cấp quyền cho browser
2. Camera/Mic đang được sử dụng bởi app khác
3. Không có camera/mic trên thiết bị

**Giải pháp:**
1. Kiểm tra Settings → Privacy → Camera/Microphone
2. Đóng các app khác đang dùng camera/mic
3. Kiểm tra hardware

### Camera bị đen (Black Screen)

**Nguyên nhân:**
- Video track bị disabled
- Stream đã bị stop

**Giải pháp:**
- Click tắt rồi bật lại camera
- Refresh trang nếu cần

### Không nghe thấy người khác

**Kiểm tra:**
1. ✅ Volume của browser
2. ✅ Volume của hệ thống
3. ✅ Remote peer có bật mic không
4. ✅ Kết nối WebRTC (check console logs)

## 🔍 Debug

### Xem logs trong Console

```javascript
// Camera toggle
🎥 Starting stream with camera...
📷 Camera ON

// Mic toggle
🎤 Starting stream with microphone...
🎤 Microphone ON

// Remote state changes
📷 userId camera: ON
🎤 userId mic: OFF
```

### Kiểm tra Stream

```javascript
// Local stream
console.log('Local stream tracks:', localStream.getTracks());

// Remote streams
console.log('Remote streams:', remoteStreams);
```

## 💡 Tips & Best Practices

### Cho Giáo Viên (Teacher)

1. **Luôn bật camera và mic** khi dạy
2. **Sử dụng screen share** khi cần trình chiếu
3. **Force mute students** khi cần (click nút 🔇 bên cạnh tên student)
4. **Pin video** của student đang phát biểu

### Cho Học Sinh (Student)

1. **Tắt mic** khi không phát biểu (tránh nhiễu)
2. **Bật camera** khi giáo viên yêu cầu
3. **Giơ tay** (✋ button) trước khi hỏi
4. **Sử dụng chat** nếu không muốn mở mic

## 📊 Performance

### Bandwidth Usage (Ước tính)

| Quality    | Video     | Audio    | Total      |
|------------|-----------|----------|------------|
| HD (720p)  | 1.5 Mbps  | 50 Kbps  | ~1.6 Mbps  |
| SD (480p)  | 800 Kbps  | 50 Kbps  | ~850 Kbps  |
| Audio Only | 0 Kbps    | 50 Kbps  | ~50 Kbps   |

**Khuyến nghị:**
- Tốc độ internet tối thiểu: **2 Mbps**
- Tốc độ khuyến nghị: **5+ Mbps**

## 🎓 Cấu Trúc Code

### useWebRTC Hook
```javascript
const {
  localStream,        // MediaStream của bạn
  remoteStreams,      // Map<userId, stream> của người khác
  isMicOn,           // Boolean: mic có bật không
  isCameraOn,        // Boolean: camera có bật không
  toggleMicrophone,  // Function: bật/tắt mic
  toggleCamera,      // Function: bật/tắt camera
  ...
} = useWebRTC(joinToken);
```

### VideoGrid Component
```javascript
<VideoGrid
  localStream={localStream}
  remoteStreams={remoteStreams}
  isCameraOn={isCameraOn}
  isMicOn={isMicOn}
  participants={participants}
  ...
/>
```

## 🚀 Next Steps

Các tính năng có thể mở rộng:

1. ✨ **Virtual Background** - Thay đổi background ảo
2. 🎨 **Beauty Filters** - Bộ lọc làm đẹp
3. 📹 **Recording** - Ghi lại buổi học
4. 🔊 **Audio Effects** - Hiệu ứng âm thanh
5. 📊 **Network Stats** - Hiển thị thống kê kết nối
6. 🌐 **Language Translation** - Dịch realtime

---

**Phiên bản:** 1.0.0  
**Ngày cập nhật:** 25/01/2026  
**Tác giả:** Edu Ecosystem Team
