import type { Channel, Snapshot } from "@/domain/models";
export function directPeer(data: Snapshot, channelId: string) {
  const participant = data.channelParticipants.find(p => p.channelId === channelId && p.userId !== data.actor.userId);
  return data.users.find(u => u.id === participant?.userId);
}
export function channelName(data: Snapshot, channel: Channel) {
  return channel.kind === "direct" ? directPeer(data, channel.id)?.name || "私聊" : channel.name;
}
