import { Check, ChevronDown, Handshake, MessageCircle, NotebookPen, UsersRound } from "lucide-react";
import { Pricing } from "@/components/Pricing";
import { WorkspacePreview } from "@/components/WorkspacePreview";
import {
  alternatives,
  applySteps,
  contactPlaceholder,
  ctaLabel,
  faqs,
  formats,
  graduation,
  journey,
  nav,
  ourWay,
  refunds,
  roundtable,
  takeaways,
  values,
} from "@/lib/content";

/*
 * Marketing site in the workspace's visual language: white surfaces, Slack-Lato, bay blue #12658a.
 * The one bold element is the code-drawn workspace in the hero; everything else stays quiet.
 */

const container = "mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8";
const h2 = "text-[30px] leading-[1.25] font-black text-balance sm:text-[40px]";
const lead = "mt-4 max-w-[640px] text-[18px] text-muted text-pretty";
const formatIcons = [UsersRound, MessageCircle, Handshake, NotebookPen];
const totalMinutes = roundtable.reduce((sum, r) => sum + r.minutes, 0);

export default function Home() {
  return (
    <div className="overflow-x-clip">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2">
        跳到正文
      </a>
      <Header />
      <main id="main">
        <Hero />
        <Values />
        <Problem />
        <How />
        <Journey />
        <Price />
        <Refunds />
        <Faq />
        <Apply />
      </main>
      <Footer />
    </div>
  );
}

function CtaButton({ size = "md", inverse = false }: { size?: "sm" | "md" | "lg"; inverse?: boolean }) {
  const sizes = {
    sm: "min-h-10 px-4 text-[14px]",
    md: "min-h-12 px-6 text-[16px]",
    lg: "min-h-14 px-8 text-[17px]",
  };
  const tone = inverse ? "bg-white text-accent hover:bg-tint" : "bg-accent text-white hover:bg-brand-deep";
  return (
    <a
      href="/apply"
      className={`inline-flex items-center justify-center rounded-lg font-bold whitespace-nowrap no-underline transition-colors ${tone} ${sizes[size]}`}
    >
      {ctaLabel}
    </a>
  );
}

function Wordmark() {
  return (
    <a href="#top" className="flex items-baseline gap-2 text-brand no-underline" aria-label="青鸟 IRIVA 首页">
      <span className="text-[28px] leading-none font-black tracking-[-1px]">iriva</span>
      <span className="text-[15px] font-bold text-muted">青鸟</span>
    </a>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className={`${container} flex h-16 items-center gap-8`}>
        <Wordmark />
        <nav aria-label="页面导航" className="hidden items-center gap-7 text-[15px] lg:flex">
          {nav.map((n) => (
            <a key={n.href} href={n.href} className="text-ink no-underline hover:text-brand">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-5">
          <a href="/learn" className="hidden text-[15px] font-bold whitespace-nowrap no-underline sm:inline">
            进入学习空间
          </a>
          <CtaButton size="sm" />
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="pt-16 pb-20 sm:pt-24">
      <div className={container}>
        <div className="mx-auto max-w-[860px] text-center">
          <h1 className="text-[40px] leading-[1.15] font-black sm:text-[64px]">
            让远方的声音，
            <br />
            成为身边的朋友。
          </h1>
          <p className="mx-auto mt-6 max-w-[640px] text-[18px] text-muted text-pretty sm:text-[20px]">
            4 位学习者、1 位 Host，六周固定同行。在 iriva meeting、伙伴练习、每周一对一和真实生活任务里，自在地用英语开口。你不需要先变得流利，才能成为这里的一员。
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <CtaButton size="lg" />
            <a
              href="#price"
              className="inline-flex min-h-14 items-center rounded-lg px-8 text-[17px] font-bold text-accent no-underline ring-1 ring-accent ring-inset transition-colors hover:bg-tint"
            >
              看价格
            </a>
          </div>
          <p className="mt-5 text-[15px] text-muted">英语 Household 首期招募中，首期成员 8 折</p>
        </div>

        <div className="mx-auto mt-14 max-w-[1080px] sm:mt-16">
          <WorkspacePreview />
        </div>
      </div>
    </section>
  );
}

function Values() {
  return (
    <section className="border-t border-line py-16">
      <div className={`${container} grid gap-10 md:grid-cols-3`}>
        {values.map((v) => (
          <div key={v.title}>
            <h2 className="text-[20px] font-black">{v.title}</h2>
            <p className="mt-2 text-muted">{v.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section className="bg-soft py-24">
      <div className={container}>
        <h2 className={h2}>练了很多，为什么还是不敢开口？</h2>
        <p className={lead}>缺的往往不是词汇和语法，而是一群固定的、愿意听你说话的人，和一个犯错也没关系的环境。</p>
        <div className="mt-12 grid gap-x-8 gap-y-10 md:grid-cols-3">
          {alternatives.map((a) => (
            <div key={a.label} className="border-t-2 border-line pt-6">
              <p className="text-[15px] text-muted">{a.label}</p>
              <h3 className="mt-2 text-[22px] font-black">{a.title}</h3>
              <p className="mt-3 text-muted">{a.body}</p>
            </div>
          ))}
          <div className="border-t-4 border-brand pt-[22px]">
            <p className="text-[15px] font-bold text-brand">{ourWay.label}</p>
            <h3 className="mt-2 text-[22px] font-black">{ourWay.title}</h3>
            <p className="mt-3">{ourWay.body}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function How() {
  return (
    <section id="how" className="py-24">
      <div className={container}>
        <h2 className={h2}>AI 帮你准备，人与人创造连接</h2>
        <p className={lead}>每周四种相处方式，围绕同一个 Household 展开。</p>

        <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {formats.map((f, i) => {
            const Icon = formatIcons[i];
            return (
              <div key={f.title}>
                <span className="grid size-11 place-items-center rounded-lg bg-tint text-brand">
                  <Icon className="size-[22px]" aria-hidden />
                </span>
                <h3 className="mt-4 text-[20px] font-black">{f.title}</h3>
                <p className="mt-1 text-[15px] font-bold text-brand">{f.meta}</p>
                <p className="mt-2 text-muted">{f.body}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-20">
          <h3 className="text-[22px] font-black">一次 iriva meeting 的 {totalMinutes} 分钟</h3>
          {/* Segment widths are proportional to each block's real length. */}
          <ol className="mt-6 flex flex-col gap-2 md:flex-row md:gap-1">
            {roundtable.map((r) => (
              <li
                key={r.time}
                style={{ flexGrow: r.minutes, flexBasis: 0 }}
                className="min-w-0 md:min-w-[96px]"
              >
                <div className={`h-2.5 rounded-full ${r.highlight ? "bg-brand" : "bg-line"}`} />
                <p className={`mt-3 text-[14px] ${r.highlight ? "font-bold text-brand" : "text-muted"}`}>{r.time}</p>
                <p className="font-bold">{r.name}</p>
                {r.note && <p className="text-[14px] text-muted">{r.note}</p>}
              </li>
            ))}
          </ol>
          <p className="mt-8 max-w-[720px] text-muted">
            Host 说得少、听得多，不当场纠错，不替你把话说完，会照顾安静的人。纠错交给 AI 在课后私下给你。
          </p>
        </div>
      </div>
    </section>
  );
}

function Journey() {
  const weeks = [...journey, graduation];
  return (
    <section id="journey" className="bg-tint py-24">
      <div className={container}>
        <h2 className={h2}>六周旅程</h2>
        <p className={lead}>从一句问候，到一次交谈；从彼此陌生，到逐渐熟悉。</p>

        <ol className="relative mt-12 grid gap-8 md:grid-cols-7 md:gap-5">
          <span aria-hidden className="absolute top-[7px] right-0 left-0 hidden h-0.5 bg-brand/20 md:block" />
          {weeks.map((w, i) => {
            const last = i === weeks.length - 1;
            return (
              <li key={w.week} className="relative flex gap-4 md:block">
                <span
                  aria-hidden
                  className={`relative mt-1 block size-4 flex-none rounded-full md:mt-0 ${last ? "bg-brand" : "bg-white ring-2 ring-brand"}`}
                />
                <div className="md:mt-5">
                  <p className="text-[14px] font-bold text-brand">{w.week}</p>
                  <h3 className="mt-1 text-[17px] font-black">{w.title}</h3>
                  <p className="mt-1 text-[15px] text-muted">{w.body}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-20 grid gap-10 lg:grid-cols-[1fr_2fr]">
          <div>
            <h3 className="text-[26px] font-black">六周后，你带走的</h3>
            <p className="mt-2 text-muted">一份看得见的进步，和一群愿意继续交流的人。</p>
          </div>
          <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {takeaways.map((t) => (
              <li key={t.title} className="flex gap-3">
                <Check aria-hidden className="mt-1 size-5 flex-none text-brand" strokeWidth={2.6} />
                <span>
                  <strong className="block font-black">{t.title}</strong>
                  <span className="text-[15px] text-muted">{t.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Price() {
  return (
    <section id="price" className="bg-soft py-24">
      <div className={container}>
        <h2 className={h2}>一个学期，一次付清</h2>
        <p className={lead}>
          三档的体验结构完全一样，只差 Host 和场景。选择每周 iriva meeting 次数，价格随之变化；同一个 Household 的伙伴频次相同。
        </p>
        <Pricing />
        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <div className="border-l-2 border-line pl-5">
            <h3 className="font-black">和你现在的花费比一比</h3>
            <p className="mt-2 text-muted">
              按欧美外教一对一约 ¥640/小时计，¥3,980 大约能买 6 小时。在这里，同样的预算是一整个学期：约 15 小时和 Host 相处、一位固定伙伴、全程 AI 教练和一份前后对比报告。
            </p>
          </div>
          <div className="border-l-2 border-brand pl-5">
            <h3 className="font-black">首期成员 8 折，邀请你一起把它做好</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
              <li>学期中和结业后各聊一次 30 分钟，告诉我们你的真实感受。</li>
              <li>同意我们分享你的结业故事（可匿名）。</li>
            </ol>
            <p className="mt-2 text-muted">名额有限，按见面先后组成 Household。</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Refunds() {
  return (
    <section className="py-24">
      <div className={`${container} grid gap-10 lg:grid-cols-[1fr_2fr]`}>
        <div>
          <h2 className="text-[30px] leading-tight font-black">退款规则</h2>
          <p className="mt-3 text-muted">
            一个人离开，会影响 Household 里的伙伴，所以开学后退款逐步减少。规则写在前面，清清楚楚。
          </p>
        </div>
        <div className="min-w-0">
          <div className="overflow-x-auto rounded-xl ring-1 ring-line">
            <table className="w-full min-w-[480px] border-collapse text-[15px]">
              <thead>
                <tr className="bg-soft text-left">
                  <th scope="col" className="px-5 py-3.5 font-black">什么时候申请</th>
                  <th scope="col" className="px-5 py-3.5 font-black">怎么处理</th>
                </tr>
              </thead>
              <tbody>
                {refunds.map((r) => (
                  <tr key={r.when} className="border-t border-line align-top">
                    <td className="px-5 py-4">{r.when}</td>
                    <td className="px-5 py-4 text-muted">{r.how}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[14px] text-muted">退款在申请确认后 7 个工作日内原路退回。</p>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="border-t border-line py-24">
      <div className="mx-auto w-full max-w-[880px] px-4 sm:px-6">
        <h2 className={h2}>常见问题</h2>
        <div className="mt-10 border-t border-line">
          {faqs.map((f) => (
            <details key={f.q} className="group border-b border-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[18px] font-black [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown aria-hidden className="size-5 flex-none text-muted transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <p className="max-w-[720px] pb-6 text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Apply() {
  return (
    <section id="apply" className="bg-[linear-gradient(160deg,#12658a,#14506c)] py-24 text-white">
      <div className={container}>
        <h2 className="max-w-[760px] text-[32px] leading-[1.25] font-black text-balance sm:text-[44px]">
          带着好奇来，从一次 15 分钟的见面开始
        </h2>
        <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {applySteps.map((s) => (
            <li key={s.step} className="border-t border-white/30 pt-5">
              <p className="text-[14px] font-bold text-on-brand-muted">{s.step}</p>
              <h3 className="mt-1 text-[19px] font-black">{s.title}</h3>
              <p className="mt-1 text-[15px] text-on-brand-muted">{s.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-4">
          <CtaButton size="lg" inverse />
          <span className="text-[16px] text-on-brand-muted">{contactPlaceholder}</span>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-10">
      <div className={`${container} flex flex-wrap items-center justify-between gap-6 text-[14px] text-muted`}>
        <div className="flex items-center gap-4">
          <Wordmark />
          <span>A World of Voices. A Place to Belong.</span>
        </div>
        <span>英语 Household 首期招募中，中文 Household 筹备中</span>
      </div>
    </footer>
  );
}
