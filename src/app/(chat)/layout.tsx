import ChatLayout from "@/components/ChatLayout";

export default function ChatLayoutPage({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <ChatLayout>
        {children}
      </ChatLayout>
    </div>
  );
}