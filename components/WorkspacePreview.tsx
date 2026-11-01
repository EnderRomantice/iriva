import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarDays,
  ChevronDown,
  Hash,
  House,
  MessagesSquare,
  NotebookPen,
  Plus,
  Search,
  SendHorizontal,
  Smile,
} from "lucide-react";

/*
 * A static, code-drawn picture of the IRIVA workspace (same frame, rail, sidebar and channel
 * proportions as features/space). It is an illustration, so it is exposed as one image.
 */

type Person = { name: string; initial: string; tone: string; photo?: string };

const host: Person = { name: "Emma", initial: "E", tone: "", photo: "/host-portraits/emma.jpg" };
const learners: Person[] = [
  { name: "林夏", initial: "林", tone: "bg-[#f2d9d0] text-[#6e4439]" },
  { name: "周屿", initial: "周", tone: "bg-[#dce9db] text-[#37583a]" },
  { name: "陈沐", initial: "陈", tone: "bg-[#eee1c6] text-[#6c542c]" },
  { name: "你", initial: "你", tone: "bg-[#e6dced] text-[#604a6e]" },
];

function Avatar({ person, size = "size-9" }: { person: Person; size?: string }) {
  if (person.photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={person.photo} alt="" className={`${size} flex-none rounded-md object-cover`} />;
  }
  return (
    <span className={`${size} grid flex-none place-items-center rounded-md text-[13px] font-bold ${person.tone}`}>
      {person.initial}
    </span>
  );
}

const messages: { who: Person; time: string; text: string; reaction?: string; tag?: string }[] = [
  {
    who: host,
    tag: "Host",
    time: "20:02",
    text: "Welcome back, everyone! This week's topic: a meal that tastes like home. Bring one story to Thursday's meeting.",
  },
  {
    who: learners[0],
    time: "20:05",
    text: "Mine is my grandma's tomato and egg noodles. Can someone practice the story with me first?",
  },
  {
    who: learners[1],
    time: "20:06",
    text: "I can! Partner practice tomorrow at 8pm?",
    reaction: "👍 2",
  },
];

export function WorkspacePreview() {
  return (
    <div
      role="img"
      aria-label="IRIVA 工作区示意：Host Emma 和 4 位学习者在晨光 Household 频道里聊本周话题，并预约周四的 iriva meeting"
      className="overflow-hidden rounded-xl bg-[linear-gradient(160deg,#12658a,#14506c)] text-left text-[14px] leading-normal text-ink shadow-[0_24px_60px_-20px_rgba(18,101,138,0.45)]"
    >
      {/* top bar */}
      <div className="flex h-10 items-center gap-2 px-3 text-white">
        <div className="hidden gap-1 opacity-80 sm:flex">
          <ArrowLeft className="size-[18px]" aria-hidden />
          <ArrowRight className="size-[18px]" aria-hidden />
        </div>
        <div className="mx-auto flex h-7 w-full max-w-[520px] items-center gap-2 rounded-md bg-white/20 px-2.5 text-[13px] ring-1 ring-white/10">
          <Search className="size-4" aria-hidden />
          <span className="truncate">搜索 晨光 Household</span>
        </div>
      </div>

      <div className="flex pr-1.5 pb-1.5 max-md:pl-1.5 md:h-[440px]">
        {/* rail */}
        <div className="hidden w-[64px] flex-none flex-col items-center gap-4 pt-1 text-white md:flex">
          <span className="grid size-9 place-items-center rounded-lg bg-white/80 text-[18px] font-black text-[#242529]">青</span>
          {[
            { icon: House, label: "主页", active: true },
            { icon: MessagesSquare, label: "私信" },
            { icon: NotebookPen, label: "练习" },
            { icon: CalendarDays, label: "日程" },
          ].map(({ icon: Icon, label, active }) => (
            <span key={label} className="flex flex-col items-center gap-0.5">
              <span className={`grid size-9 place-items-center rounded-lg ${active ? "bg-white/25" : ""}`}>
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="text-[11px] font-bold">{label}</span>
            </span>
          ))}
        </div>

        {/* sidebar */}
        <div className="hidden w-[232px] flex-none flex-col rounded-l-md border-r border-line bg-tint text-[#3d5868] lg:flex">
          <div className="flex h-12 items-center gap-1.5 px-4 text-[17px] font-black text-ink">
            IRIVA <ChevronDown className="size-4" aria-hidden />
          </div>
          <div className="flex flex-col gap-0.5 px-2 text-[14px]">
            <p className="px-2 pt-1 pb-1 text-[13px]">Household</p>
            <span className="flex h-7 items-center gap-2 rounded-md bg-accent px-2 font-bold text-white">
              <span className="grid size-5 place-items-center rounded bg-white/25 text-[10px]">晨</span>晨光 Household
            </span>
            <span className="flex h-7 items-center gap-2 px-2">
              <span className="grid size-5 place-items-center rounded bg-white text-[10px] text-brand">远</span>远山 Household
            </span>
            <p className="px-2 pt-4 pb-1 text-[13px]">频道</p>
            {["公告", "本周话题", "伙伴练习"].map((c) => (
              <span key={c} className="flex h-7 items-center gap-2 px-2">
                <Hash className="size-4" aria-hidden />
                {c}
              </span>
            ))}
            <p className="px-2 pt-4 pb-1 text-[13px]">私信</p>
            <span className="flex h-7 items-center gap-2 px-2">
              <Avatar person={host} size="size-5" />
              Emma（Host）
            </span>
            <span className="flex h-7 items-center gap-2 px-2">
              <Avatar person={learners[1]} size="size-5" />
              周屿
            </span>
          </div>
        </div>

        {/* channel */}
        <div className="flex min-w-0 flex-1 flex-col rounded-md bg-white lg:rounded-l-none">
          <div className="flex h-12 flex-none items-center justify-between gap-3 border-b border-line px-4">
            <span className="flex min-w-0 items-center gap-1 truncate text-[17px] font-black">
              <Hash className="size-[18px] flex-none" strokeWidth={2.6} aria-hidden />
              晨光 Household
            </span>
            <span className="flex flex-none items-center gap-2 text-[12px] text-muted">
              <span className="flex -space-x-1.5">
                <Avatar person={host} size="size-6" />
                {learners.slice(0, 2).map((p) => (
                  <Avatar key={p.name} person={p} size="size-6" />
                ))}
              </span>
              5
              <Bell className="ml-1 hidden size-4 sm:block" aria-hidden />
            </span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col justify-end gap-1 overflow-hidden py-3">
            {/* next meeting */}
            <div className="mx-4 mb-2 flex items-center gap-3 rounded-lg border border-line p-3">
              <span className="grid size-10 flex-none place-items-center rounded-md bg-tint text-brand">
                <CalendarDays className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-[14px]">周四 20:00 iriva meeting</strong>
                <span className="block truncate text-[13px] text-muted">A meal that tastes like home，120 分钟</span>
              </span>
              <span className="flex-none rounded-md bg-accent px-3 py-1.5 text-[12px] font-bold text-white">已预约</span>
            </div>

            {messages.map((m) => (
              <div key={m.time} className="flex gap-2.5 px-4 py-1.5">
                <Avatar person={m.who} />
                <div className="min-w-0">
                  <p className="flex items-baseline gap-2">
                    <strong className="text-[14px] font-black">{m.who.name}</strong>
                    {m.tag && <span className="rounded bg-tint px-1.5 text-[11px] font-bold text-brand">{m.tag}</span>}
                    <span className="text-[12px] text-muted">{m.time}</span>
                  </p>
                  <p className="text-[14px]">{m.text}</p>
                  {m.reaction && (
                    <span className="mt-1 inline-block rounded-full border border-brand/40 bg-tint px-2 text-[12px]">
                      {m.reaction}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex-none px-4 pb-3">
            <div className="rounded-lg border border-[#b9bdc2]">
              <p className="px-3 pt-2.5 pb-4 text-[14px] text-muted">发消息到 # 晨光 Household</p>
              <div className="flex items-center gap-2 px-2 pb-2 text-muted">
                <Plus className="size-[18px]" aria-hidden />
                <Smile className="size-[18px]" aria-hidden />
                <span className="ml-auto grid h-7 w-8 place-items-center rounded bg-soft">
                  <SendHorizontal className="size-4" aria-hidden />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
