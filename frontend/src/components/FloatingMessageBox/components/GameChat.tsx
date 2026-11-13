import React, { useState } from "react";

export function GameChat() {
  const [messageContent, setMessageContent] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // Anti browser reloading

    if (messageContent == "")
      return ;

    console.log("WIP for sending message " + messageContent);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col">
        <div className="chat chat-start">
          <div className="chat-image avatar">
            <div className="w-10 rounded-full">
              <img
                alt="Tailwind CSS chat bubble component"
                src="https://img.daisyui.com/images/profile/demo/kenobee@192.webp"
              />
            </div>
          </div>
          <div className="chat-header">
            Obi-Wan Kenobi
            <time className="text-xs opacity-50">12:45</time>
          </div>
          <div className="chat-bubble">You were the Chosen One!</div>
        </div>
        <div className="chat chat-end">
          <div className="chat-image avatar">
            <div className="w-10 rounded-full">
              <img
                alt="Tailwind CSS chat bubble component"
                src="https://img.daisyui.com/images/profile/demo/anakeen@192.webp"
              />
            </div>
          </div>
          <div className="chat-header">
            Anakin
            <time className="text-xs opacity-50">12:46</time>
          </div>
          <div className="chat-bubble">I hate you!</div>
        </div>
      </div>
      <form className="flex gap-2 items-center" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Your message"
          className="flex flex-1 input input-sm"
          onChange={(e) => setMessageContent(e.target.value)}
        />
        <button className="btn border-0 bg-secondary text-secondary-content">
          Send
        </button>
      </form>
    </div>
  );
}
