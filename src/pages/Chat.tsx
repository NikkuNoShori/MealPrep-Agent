import { ChatInterface } from "../components/chat/ChatInterface";

const Chat = () => {
  return (
    <div className="container mx-auto px-4 py-8 h-[calc(100vh-8rem)]">
      <div className="h-full">
        <h1 className="text-3xl font-bold mb-2">AI Chat Assistant</h1>
        <p className="text-muted-foreground mb-8">
          Get help with meal planning, recipe suggestions, and cooking tips.
        </p>

        <div className="h-full">
          <ChatInterface />
        </div>
      </div>
    </div>
  );
};

export default Chat;
