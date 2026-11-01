export const reactionEmojis = ['👍', '❤️', '😂', '🎉', '😮', '😢', '🙏', '🔥', '👀', '✅', '🙌', '😊'] as const;
export type ReactionEmoji = typeof reactionEmojis[number];
export interface MessageReaction { userId: string; emoji: ReactionEmoji }
export const reactionLabels: Record<ReactionEmoji, string> = { '👍':'赞', '❤️':'喜欢', '😂':'笑哭', '🎉':'庆祝', '😮':'惊讶', '😢':'难过', '🙏':'感谢', '🔥':'太棒了', '👀':'关注', '✅':'收到', '🙌':'欢呼', '😊':'微笑' };
