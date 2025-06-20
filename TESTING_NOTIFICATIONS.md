# Testing the Notification System

The notification system has been implemented and is working correctly. Here's how to test it:

## 🔔 **Testing with Mock Data**

Since you may not have any notifications yet (no posts or interactions), I've added a mock notification system for testing:

### **How to Enable Mock Notifications:**

1. **Log in** to the application (the notification bell only appears when logged in)
2. **Double-click** the notification bell icon (either in the desktop sidebar or mobile header)
3. You should see **3 mock notifications** appear with a red badge showing "3"
4. **Double-click again** to disable mock notifications

### **Mock Notification Types:**

The mock data includes:
- ❤️ **Reaction**: Someone reacted with a heart emoji to your post
- 💬 **Comment**: Someone commented "Great photo! Love the composition."
- ⚡ **Zap**: Someone zapped 21 sats to your post

## 🔍 **Testing Real Notifications**

For real notifications to appear, you need:

1. **Published Posts**: You must have published image posts (kind 20) or video posts (kind 22, 34236)
2. **Interactions**: Other users must have:
   - Reacted to your posts (kind 7 events)
   - Commented on your posts (kind 1 events with `e` tags referencing your posts)
   - Zapped your posts (kind 9735 events)

### **How Real Notifications Work:**

1. The system queries for your recent posts (last 100)
2. It then looks for reactions, comments, and zaps to those posts
3. It filters out your own interactions (self-reactions, etc.)
4. Notifications are sorted by time (newest first)
5. Read status is tracked in localStorage per user

## 🎯 **Notification Features**

### **Visual Indicators:**
- Red badge with unread count (shows "99+" for large numbers)
- Different icons for each notification type (heart, message, zap)
- Relative timestamps (5m, 2h, 3d, 1w)

### **Interactions:**
- Click notification to navigate to the target post
- Opening the notification panel marks all as read
- Read status persists across sessions

### **Responsive Design:**
- **Desktop**: Bell in left sidebar between "Post" and "Discover"
- **Mobile**: Bell in top-right corner of header

## 🐛 **Troubleshooting**

### **No Notifications Showing:**
1. Make sure you're logged in (bell icon should be visible)
2. Try the mock notifications (double-click the bell)
3. Check if you have any published posts
4. Wait for the 60-second auto-refresh or refresh the page

### **Mock Notifications Not Working:**
1. Ensure you're logged in
2. Try double-clicking the bell icon multiple times
3. Check browser console for any errors

### **Real Notifications Not Working:**
1. Publish some image or video posts first
2. Ask others to interact with your posts
3. Wait up to 60 seconds for the system to refresh
4. Check that your posts are visible to others

## 📱 **Platform-Specific Testing**

### **Desktop:**
- Look for the bell icon in the left sidebar
- Click to open notification panel to the right
- Double-click to toggle mock notifications

### **Mobile:**
- Look for the bell icon in the top-right corner
- Tap to open notification panel below
- Double-tap to toggle mock notifications

## ✅ **Expected Behavior**

When working correctly, you should see:
- Bell icon appears when logged in
- Red badge shows unread count
- Clicking opens a scrollable list of notifications
- Each notification shows user avatar, action, and time
- Clicking a notification navigates to the target post
- Notifications are marked as read when panel is opened

The notification system is fully functional and ready for use!