import { Pricing } from "@/components/Pricing";
import {
  alternatives,
  applySteps,
  contactPlaceholder,
  ctaLabel,
  faqs,
  formats,
  graduation,
  heroStats,
  journey,
  nav,
  ourWay,
  refunds,
  roundtable,
  takeaways,
  values,
  weekSchedule,
} from "@/lib/content";

const container = "mx-auto max-w-[1120px] px-6";
const h2 = "font-serif text-[28px] leading-snug font-black sm:text-[34px]";
const eyebrow = "text-[15px] font-bold text-clay-text";

export default function Home() {
  return (
    <div>
      <Header />
      <main>
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

function CtaButton({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "min-h-11 px-[18px] py-2.5",
    md: "min-h-12 px-7 py-3.5 text-[17px]",
    lg: "min-h-[52px] px-8 py-4 text-lg",
  };
  return (
    <a
      href="#apply"
      className={`inline-flex items-center rounded-full bg-sand font-bold text-ink no-underline ${sizes[size]}`}
    >
      {ctaLabel}
    </a>
  );
}

function Header() {
  return (
    <header className="bg-sea text-white">
      <div className={`${container} flex flex-wrap items-center justify-between gap-4 py-5`}>
        <a href="#top" className="flex items-baseline gap-2.5 text-white no-underline">
          <span className="font-serif text-[26px] font-black tracking-[2px]">青鸟</span>
          <span className="text-xl font-bold tracking-[3px]">IRIVA</span>
        </a>
        <nav aria-label="页面导航" className="flex flex-wrap items-center gap-6 text-[15px]">
          {nav.map((n) => (
            <a key={n.href} href={n.href} className="text-mist no-underline">
              {n.label}
            </a>
          ))}
          <CtaButton size="sm" />
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="bg-sea pt-14 pb-24 text-white">
      <div className={`${container} flex flex-wrap items-center gap-12`}>
        <div className="min-w-0 flex-[1_1_520px]">
          <p className="mb-4 text-[15px] font-bold tracking-[1px] text-peach">
            IRIVA Household · 英语 · 首期招募中
          </p>
          <h1 className="font-serif text-[38px] leading-tight font-black sm:text-[54px]">
            让远方的声音，
            <br />
            成为身边的朋友。
          </h1>
          <p className="mt-6 max-w-[580px] text-[19px] text-mist">
            4 位学习者、1 位 Host，六周固定同行。在小组圆桌、伙伴练习、每周一对一和真实生活任务里，自在地用英语开口，认识来自另一个世界的人。
          </p>
          <p className="mt-5 text-lg font-bold text-peach">你不需要先变得流利，才能成为这里的一员。</p>
          <div className="mt-8 flex flex-wrap gap-4">
            <CtaButton />
            <a
              href="#price"
              className="inline-flex min-h-12 items-center rounded-full border-[1.5px] border-frost px-7 py-3.5 text-[17px] font-medium text-white no-underline"
            >
              看价格
            </a>
          </div>
          <div className="mt-12 flex flex-wrap gap-8">
            {heroStats.map((s) => (
              <div key={s.value}>
                <div className="text-[30px] font-bold">{s.value}</div>
                <div className="text-sm text-mist-2">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 flex-[1_1_360px] rounded-3xl bg-paper p-8 text-ink">
          <p className="text-sm font-bold tracking-[1px] text-clay-text">你在 Household 里的一周</p>
          <div aria-hidden="true" className="mt-5 flex justify-center gap-3">
            <div className="flex size-[52px] items-center justify-center rounded-full bg-sea-3 text-[13px] font-bold text-white">
              Host
            </div>
            <div className="flex size-[52px] items-center justify-center rounded-full bg-clay text-sm font-bold text-white">
              你
            </div>
            <div className="size-[52px] rounded-full bg-sage" />
            <div className="size-[52px] rounded-full bg-sage" />
            <div className="size-[52px] rounded-full bg-sage" />
          </div>
          <div className="mt-4 flex flex-col">
            {weekSchedule.map((w) => (
              <div
                key={w.name}
                className="flex justify-between gap-4 border-b border-line py-3.5 last:border-b-0"
              >
                <span className="font-bold">{w.name}</span>
                <span className="text-muted">{w.detail}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted">每周约 6–10 小时，时间按你和 Host 的作息排定。</p>
        </div>
      </div>
    </section>
  );
}

function Values() {
  return (
    <section className="bg-paper py-[72px]">
      <div className={`${container} grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-8`}>
        {values.map((v) => (
          <div key={v.tag}>
            <p className="text-[13px] font-bold tracking-[2px] text-sea-3">{v.tag}</p>
            <p className="mt-2 font-serif text-[22px] font-semibold">{v.title}</p>
            <p className="mt-2 text-muted">{v.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section className="py-[88px]">
      <div className={container}>
        <h2 className={h2}>练了很多，为什么还是不敢开口？</h2>
        <p className="mt-4 max-w-[720px] text-lg text-muted">
          缺的往往不是词汇和语法，而是一群固定的、愿意听你说话的人，和一个犯错也没关系的环境。
        </p>
        <div className="mt-10 flex flex-wrap gap-6">
          {alternatives.map((a) => (
            <div key={a.label} className="flex-[1_1_300px] rounded-[20px] border border-line bg-paper p-7">
              <p className="text-sm text-muted">{a.label}</p>
              <p className="mt-2 text-xl font-bold">{a.title}</p>
              <p className="mt-3 text-muted">{a.body}</p>
            </div>
          ))}
          <div className="flex-[1_1_300px] rounded-[20px] border-[1.5px] border-clay bg-clay-soft p-7">
            <p className="text-sm font-bold text-clay-ink">{ourWay.label}</p>
            <p className="mt-2 text-xl font-bold">{ourWay.title}</p>
            <p className="mt-3 text-clay-deep">{ourWay.body}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function How() {
  return (
    <section id="how" className="bg-paper py-[88px]">
      <div className={container}>
        <p className={eyebrow}>怎么相处</p>
        <h2 className={`mt-2 ${h2}`}>AI helps you prepare. People make the connection.</h2>
        <div className="mt-10 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6">
          {formats.map((f) => (
            <div key={f.title} className="rounded-[20px] border border-line bg-white p-6">
              <p className="text-xl font-bold">{f.title}</p>
              <p className="mt-1 text-sm font-bold text-clay-text">{f.meta}</p>
              <p className="mt-3 text-muted">{f.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-[20px] bg-sand p-7">
          <p className="text-lg font-bold">一次小组圆桌的 120 分钟</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {roundtable.map((r) => (
              <div
                key={r.time}
                className={`flex-[1_1_150px] rounded-[14px] px-4 py-3.5 ${r.highlight ? "bg-clay-soft" : "bg-white"}`}
              >
                <div className={`text-[13px] ${r.highlight ? "text-clay-ink" : "text-muted"}`}>{r.time}</div>
                <div className="font-bold">{r.name}</div>
                <div className={`min-h-[1.65em] text-sm ${r.highlight ? "text-clay-deep" : "text-muted"}`}>
                  {r.note}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted">
            Host 说得少、听得多，不当场纠错，不替你把话说完，会照顾安静的人。纠错交给 AI 在课后私下给你。
          </p>
        </div>
      </div>
    </section>
  );
}

function Journey() {
  return (
    <section id="journey" className="py-[88px]">
      <div className={container}>
        <p className={eyebrow}>六周旅程</p>
        <h2 className={`mt-2 ${h2}`}>从一句问候，到一次交谈；从彼此陌生，到逐渐熟悉</h2>
        <div className="mt-10 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
          {journey.map((j) => (
            <div key={j.week} className="rounded-2xl border border-line bg-paper p-5">
              <div className="text-[13px] font-bold text-clay-text">{j.week}</div>
              <div className="mt-1 font-bold">{j.title}</div>
              <div className="mt-1.5 text-sm text-muted">{j.body}</div>
            </div>
          ))}
          <div className="rounded-2xl bg-sea p-5 text-white">
            <div className="text-[13px] font-bold text-peach">{graduation.week}</div>
            <div className="mt-1 font-bold">{graduation.title}</div>
            <div className="mt-1.5 text-sm text-mist">{graduation.body}</div>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap gap-6">
          <div className="flex-[1_1_320px]">
            <h3 className="font-serif text-2xl font-black">六周后，你带走的</h3>
            <p className="mt-2 text-muted">一份看得见的进步，和一群愿意继续交流的人。</p>
          </div>
          <ul className="grid flex-[2_1_480px] grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
            {takeaways.map((t) => (
              <li key={t.title} className="rounded-[14px] border border-line bg-paper px-5 py-4">
                <strong>{t.title}</strong>
                <br />
                <span className="text-sm text-muted">{t.body}</span>
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
    <section id="price" className="bg-paper py-[88px]">
      <div className={container}>
        <p className={eyebrow}>价格</p>
        <h2 className={`mt-2 ${h2}`}>一个学期，一次付清；三档只差 Host 和场景</h2>
        <p className="mt-3 max-w-[720px] text-muted">
          体验结构完全一样。选择每周圆桌次数，价格随之变化；同一个 Household 的伙伴频次相同。
        </p>
        <Pricing />
        <div className="mt-8 flex flex-wrap gap-6">
          <div className="flex-[1_1_420px] rounded-[20px] bg-sand p-6">
            <p className="font-bold">和你现在的花费比一比</p>
            <p className="mt-2 text-muted">
              按欧美外教一对一约 ¥640/小时计，¥3,980 大约能买 6 小时。在这里，同样的预算是一整个学期：约 15 小时和 Host 相处、一位固定伙伴、全程 AI 教练和一份前后对比报告。
            </p>
          </div>
          <div className="flex-[1_1_420px] rounded-[20px] bg-clay-soft p-6">
            <p className="font-bold text-clay-ink">首期成员 8 折，邀请你一起把它做好</p>
            <p className="mt-2 text-clay-deep">
              1. 学期中和结业后各聊一次 30 分钟，告诉我们你的真实感受；2. 同意我们分享你的结业故事（可匿名）。名额有限，按见面先后组成 Household。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Refunds() {
  return (
    <section className="py-[88px]">
      <div className={`${container} flex flex-wrap gap-12`}>
        <div className="flex-[1_1_320px]">
          <h2 className="font-serif text-[30px] font-black">退款规则</h2>
          <p className="mt-3 text-muted">
            一个人离开，会影响 Household 里的伙伴，所以开学后退款逐步减少。规则写在前面，清清楚楚。
          </p>
        </div>
        <div className="min-w-0 flex-[2_1_520px] overflow-x-auto">
          <table className="w-full border-collapse bg-paper text-[15px]">
            <thead>
              <tr className="bg-sea text-left text-white">
                <th className="px-4 py-3.5">什么时候申请</th>
                <th className="px-4 py-3.5">怎么处理</th>
              </tr>
            </thead>
            <tbody>
              {refunds.map((r) => (
                <tr key={r.when} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-3.5">{r.when}</td>
                  <td className="px-4 py-3.5">{r.how}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-sm text-muted">退款在申请确认后 7 个工作日内原路退回。</p>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="bg-paper py-[88px]">
      <div className="mx-auto max-w-[880px] px-6">
        <h2 className={h2}>常见问题</h2>
        <div className="mt-8 flex flex-col">
          {faqs.map((f) => (
            <div key={f.q} className="border-b border-line py-5 last:border-b-0">
              <p className="text-lg font-bold">{f.q}</p>
              <p className="mt-2 text-muted">{f.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Apply() {
  return (
    <section id="apply" className="bg-sea py-[88px] text-white">
      <div className={container}>
        <h2 className="font-serif text-[30px] leading-snug font-black sm:text-[38px]">
          带着好奇来，从一次 15 分钟的见面开始
        </h2>
        <ol className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
          {applySteps.map((s) => (
            <li key={s.step} className="rounded-2xl bg-sea-2 p-5">
              <div className="text-[13px] font-bold text-peach">{s.step}</div>
              <div className="mt-1 font-bold">{s.title}</div>
              <div className="mt-1 text-sm text-mist">{s.body}</div>
            </li>
          ))}
        </ol>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <CtaButton size="lg" />
          <span className="text-[15px] text-mist">{contactPlaceholder}</span>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-ink py-8 text-foot">
      <div className={`${container} flex flex-wrap justify-between gap-4 text-sm`}>
        <span>
          <strong className="text-white">青鸟 IRIVA</strong> · A World of Voices. A Place to Belong.
        </span>
        <span>IRIVA Household 英语首期招募中 · 中文 Household 筹备中</span>
      </div>
    </footer>
  );
}
