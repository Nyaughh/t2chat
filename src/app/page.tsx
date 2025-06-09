import ChatInterface from "@/components/ChatInterface";
import { ThemeProvider } from "next-themes";

export default function Home() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ChatInterface />
    </ThemeProvider>
  );
}
