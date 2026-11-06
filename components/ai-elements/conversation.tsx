"use client";

// Copyright 2023 Vercel, Inc.
// Adapted from the AI Elements Conversation registry item (Apache-2.0).
import type { ComponentProps } from "react";
import { StickToBottom } from "use-stick-to-bottom";

export function Conversation(props: ComponentProps<typeof StickToBottom>) {
  return <StickToBottom initial="smooth" resize="smooth" role="log" {...props} />;
}

export function ConversationContent(props: ComponentProps<typeof StickToBottom.Content>) {
  return <StickToBottom.Content {...props} />;
}
