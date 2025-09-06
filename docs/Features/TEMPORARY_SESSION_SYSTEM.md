# Temporary Session System

## Overview
The temporary session system prevents unused chat sessions from being persisted to the database, improving performance and reducing clutter. Sessions are only saved when the user actually sends a message.

## How It Works

### 1. Session Creation
- **New Chat Button**: Creates a temporary session (`isTemporary: true`)
- **Navbar Chat Link**: Creates a temporary session when clicked
- **Default Session**: First session is temporary until used

### 2. Session Persistence
- **First Message**: When user sends their first message, `isTemporary` becomes `false`
- **localStorage**: Only non-temporary sessions are saved to localStorage
- **Database**: Only persisted sessions create database entries

### 3. Session Cleanup
- **Automatic**: Temporary sessions are cleaned up on component unmount
- **Manual**: "Clean Up Unused Chats" button removes all temporary sessions
- **Visual Indicator**: Temporary sessions show a "Temporary" badge

## Implementation Details

### Conversation Interface
```typescript
interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  lastMessage: string;
  timestamp: Date;
  sessionId: string;
  isTemporary: boolean; // New field for temporary tracking
}
```

### Session Lifecycle

#### 1. Creation
```typescript
const newConversation: Conversation = {
  id: Date.now().toString(),
  title: "New Chat",
  messages: [],
  lastMessage: "",
  timestamp: new Date(),
  sessionId: `session-${Date.now()}`,
  isTemporary: true, // Mark as temporary
};
```

#### 2. Persistence
```typescript
// When first message is sent
setConversations((prev) =>
  prev.map((conv) =>
    conv.id === currentConversationId
      ? {
          ...conv,
          messages: [...conv.messages, userMessage],
          isTemporary: false, // Persist the session
        }
      : conv
  )
);
```

#### 3. Storage
```typescript
// Only save non-temporary conversations
const persistentConversations = conversations.filter(conv => !conv.isTemporary);
localStorage.setItem("chat-conversations", JSON.stringify(persistentConversations));
```

### Navbar Integration
```typescript
const handleChatClick = (e: React.MouseEvent) => {
  e.preventDefault();
  localStorage.removeItem("chat-current-conversation-id");
  localStorage.setItem("chat-create-temporary-session", "true");
  navigate("/chat");
};
```

## User Experience

### Visual Indicators
- **Temporary Badge**: Yellow "Temporary" badge on unused sessions
- **Cleanup Button**: "Clean Up Unused Chats" button when temporary sessions exist
- **Session List**: Temporary sessions appear in the conversation list

### Behavior
- **Navbar Click**: Always creates a fresh temporary session
- **New Chat Button**: Creates temporary session in sidebar
- **First Message**: Automatically persists the session
- **Cleanup**: Manual cleanup removes unused sessions

## Benefits

### Performance
- **Reduced Storage**: Only used sessions are persisted
- **Faster Loading**: Fewer sessions to load from localStorage
- **Database Efficiency**: No unused database entries

### User Experience
- **Clean Interface**: No clutter from unused sessions
- **Fresh Start**: Navbar always provides a clean slate
- **Intentional Persistence**: Sessions only saved when actually used

### Development
- **Memory Management**: Automatic cleanup prevents memory leaks
- **State Management**: Clear distinction between temporary and persistent state
- **Debugging**: Easy to identify temporary vs persistent sessions

## Configuration

### localStorage Keys
- `chat-conversations`: Stores only persistent conversations
- `chat-current-conversation-id`: Current conversation ID
- `chat-create-temporary-session`: Flag for navbar-triggered temporary sessions

### Session States
- **Temporary**: `isTemporary: true`, not saved to localStorage
- **Persistent**: `isTemporary: false`, saved to localStorage
- **Active**: Currently selected conversation
- **Inactive**: Not currently selected

## Troubleshooting

### Common Issues

#### 1. Temporary Sessions Not Cleaning Up
- **Cause**: Component unmount not triggered
- **Solution**: Check useEffect cleanup function
- **Fallback**: Manual cleanup button

#### 2. Sessions Not Persisting
- **Cause**: `isTemporary` not set to false on first message
- **Solution**: Check message handling logic
- **Debug**: Check console logs for session state

#### 3. Navbar Not Creating Temporary Sessions
- **Cause**: localStorage flag not set or cleared
- **Solution**: Check `handleChatClick` function
- **Debug**: Check localStorage for flag

### Debug Information
```typescript
// Check session state
console.log('Current conversation:', getCurrentConversation());
console.log('All conversations:', conversations);
console.log('Temporary sessions:', conversations.filter(c => c.isTemporary));
```

## Future Enhancements

### Automatic Cleanup
- **Timeout**: Auto-cleanup after X minutes of inactivity
- **Background**: Cleanup in background service worker
- **Smart**: Cleanup based on user behavior patterns

### Session Management
- **Session Limits**: Limit number of temporary sessions
- **Session Recovery**: Recover accidentally deleted sessions
- **Session Sharing**: Share temporary sessions between devices

### Analytics
- **Usage Tracking**: Track temporary vs persistent session usage
- **Cleanup Metrics**: Monitor cleanup frequency and patterns
- **Performance Impact**: Measure performance improvements

## Conclusion

The temporary session system provides an optimal balance between user experience and system performance. It ensures that only meaningful conversations are persisted while providing a clean, responsive interface for users to start new chats without cluttering their conversation history.
