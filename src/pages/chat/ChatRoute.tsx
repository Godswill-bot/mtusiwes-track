
import { useParams } from "react-router-dom";
import { ChatPage } from "./ChatPage";
import { ChatLobby } from "./ChatLobby";

const ChatRoute = () => {
  const { id } = useParams<{ id: string }>();
  if (!id) return <ChatLobby />;
  return <ChatPage conversationId={id} />;
};

export default ChatRoute;
