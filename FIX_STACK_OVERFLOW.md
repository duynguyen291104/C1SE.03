# 🔧 FIX: Camera & Mic Toggle - Stack Overflow Issue

## ❌ Vấn Đề Đã Gặp

### 1. Lỗi "Maximum call stack size exceeded"
```
RangeError: Maximum call stack size exceeded
at is-binary.js ...
```

**Nguyên nhân:**
- ❌ Sử dụng `localStream.addTrack()` gây mutation trực tiếp
- ❌ Socket.io cố serialize MediaStream object (có circular reference)
- ❌ Trigger re-render liên tục → stack overflow

### 2. Trạng thái kết nối sai
- Hiển thị "Mất kết nối" khi đã kết nối thành công
- Dùng sai state `isConnected` thay vì `webrtcConnected`

## ✅ Giải Pháp Đã Áp Dụng

### 1. Fix Toggle Camera & Microphone

**Thay đổi chính:**
```javascript
// ❌ TRƯỚC (SAI - gây stack overflow)
localStream.addTrack(videoTrack);
socketRef.current?.emit('media:toggle-camera', { enabled: true });

// ✅ SAU (ĐÚNG - tạo stream mới, kiểm tra socket)
const newStream = new MediaStream([...localStream.getTracks(), videoTrack]);
setLocalStream(newStream);
if (socketRef.current?.connected) {
  socketRef.current.emit('media:toggle-camera', { enabled: true });
}
```

**Lý do:**
- Tạo MediaStream mới tránh mutation
- Kiểm tra `socket.connected` trước khi emit
- Chỉ emit boolean, KHÔNG emit object phức tạp

### 2. Fix Connection Status Display

**Thay đổi:**
```jsx
// ❌ TRƯỚC
{isConnected ? (
  <span>🟢 Đã kết nối</span>
) : (
  <span>🔴 Mất kết nối</span>
)}

// ✅ SAU
{webrtcConnected ? (
  <span>🟢 Đã kết nối</span>
) : (
  <span>🔴 Đang kết nối...</span>
)}
```

## 🧪 Cách Test

### Bước 1: Mở 2 Browser Windows

**Window 1 - Teacher:**
```
URL: http://localhost:3000
Login: teacher@edu.com / Teacher@123
Navigate to: http://localhost:3000/live-room/69762d9ec096b16499465a36
```

**Window 2 - Student:**
```
URL: http://localhost:3000 (Incognito)
Login: student@edu.com / Student@123
Navigate to: http://localhost:3000/live-room/69762d9ec096b16499465a36
```

### Bước 2: Test Kết Nối

Kiểm tra header:
- ✅ Phải hiển thị: **"🟢 Đã kết nối"**
- ❌ KHÔNG được: "🔴 Mất kết nối"

### Bước 3: Test Toggle Camera

**Teacher Side:**
1. Click nút 📷 (Camera button)
2. Cho phép quyền camera
3. ✅ Phải thấy: Video stream hiển thị
4. ✅ Console log: "📷 Camera ON"
5. Click lại 📷
6. ✅ Video track disabled (màn hình đen nhưng placeholder hiển thị)
7. ✅ Console log: "📷 Camera OFF"

**Student Side:**
- Lặp lại các bước trên
- ✅ Phải hoạt động tương tự

### Bước 4: Test Toggle Microphone

**Cả 2 sides:**
1. Click nút 🔇 (Mic button)
2. Cho phép quyền microphone
3. ✅ Nút chuyển thành: 🎤 (màu xanh)
4. ✅ Console log: "🎤 Microphone ON"
5. Click lại
6. ✅ Nút chuyển về: 🔇 (màu đỏ)
7. ✅ Console log: "🎤 Microphone OFF"

### Bước 5: Kiểm Tra Console

**KHÔNG được có:**
- ❌ "Maximum call stack size exceeded"
- ❌ "is-binary.js" errors
- ❌ Infinite loop warnings

**Phải có:**
- ✅ "✅ Connected to signaling server"
- ✅ "🎉 Joined room: ..."
- ✅ "🎥 Local stream started (mic: true, camera: false)"
- ✅ "📷 Camera ON/OFF"
- ✅ "🎤 Microphone ON/OFF"

## 📊 Expected Behavior

### Toggle Camera Flow

```
User clicks Camera button
    ↓
toggleCamera() called
    ↓
Check if localStream exists
    ↓
[Has video track] → Enable/Disable track
[No video track] → Request camera → Create new stream
    ↓
Update state: setIsCameraOn(true/false)
    ↓
Emit socket: { enabled: true/false }
    ↓
Update UI: Button color changes
```

### Toggle Microphone Flow

```
User clicks Mic button
    ↓
toggleMicrophone() called
    ↓
Check if localStream exists
    ↓
[Has audio track] → Enable/Disable track
[No audio track] → Request mic → Create new stream
    ↓
Update state: setIsMicOn(true/false)
    ↓
Emit socket: { enabled: true/false }
    ↓
Update UI: Button icon changes
```

## 🎯 Technical Details

### Files Changed

1. **client/src/hooks/useWebRTC.js**
   - `toggleCamera()` - Fixed stream creation
   - `toggleMicrophone()` - Fixed stream creation
   - Added socket.connected check

2. **client/src/pages/LiveClassRoom.js**
   - Changed `isConnected` to `webrtcConnected`
   - Updated connection status text

### Key Changes

```javascript
// 1. Create new MediaStream instead of mutating
const newStream = new MediaStream([...localStream.getTracks(), videoTrack]);
setLocalStream(newStream);

// 2. Check socket connection before emit
if (socketRef.current?.connected) {
  socketRef.current.emit('media:toggle-camera', { enabled: newState });
}

// 3. Use webrtcConnected state
{webrtcConnected ? '🟢 Đã kết nối' : '🔴 Đang kết nối...'}
```

## 🚨 Common Issues & Solutions

### Issue 1: Camera không hiển thị
**Nguyên nhân:** Browser chưa cấp quyền
**Giải pháp:** 
- Settings → Privacy → Camera → Allow
- Refresh page

### Issue 2: Stack overflow vẫn xảy ra
**Nguyên nhân:** Code cũ còn cache
**Giải pháp:**
```bash
docker restart edu-client
# Hoặc
Ctrl + Shift + R (hard refresh browser)
```

### Issue 3: "Đang kết nối..." không đổi sang "Đã kết nối"
**Nguyên nhân:** Socket chưa connect
**Giải pháp:**
- Kiểm tra server logs: `docker logs edu-server`
- Kiểm tra joinToken có hợp lệ không

### Issue 4: Video không sync giữa Teacher và Student
**Nguyên nhân:** WebRTC peer connection chưa thiết lập
**Giải pháp:**
- Cả 2 phải join cùng roomId
- Kiểm tra console log: "📺 Received remote track from: ..."

## ✅ Verification Checklist

- [ ] Client compiled successfully
- [ ] No console errors
- [ ] Connection status: "🟢 Đã kết nối"
- [ ] Camera toggle works (Teacher)
- [ ] Camera toggle works (Student)
- [ ] Microphone toggle works (Teacher)
- [ ] Microphone toggle works (Student)
- [ ] No "Maximum call stack" error
- [ ] Video syncs between peers
- [ ] Audio syncs between peers

## 📝 Notes

- **Mặc định:** Mic ON, Camera OFF (privacy first)
- **Teacher & Student:** Có quyền toggle như nhau
- **WebRTC:** P2P connection, không qua server
- **Browser support:** Chrome, Firefox, Safari, Edge

---

**Status:** ✅ FIXED  
**Date:** 25/01/2026  
**Version:** 1.1.0
