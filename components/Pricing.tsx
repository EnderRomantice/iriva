"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { hostHours, tiers, type Frequency } from "@/lib/content";

const frequencies: Frequency[] = [1, 2];

export function Pricing() {
  const [freq, setFreq] = useState<Frequency>(1);

  return (
    <>
      <div
        role="group"
        aria-label="每周 iriva meeting 次数"
        className="mt-8 inline-flex gap-1 rounded-lg bg-white p-1 ring-1 ring-line"
      >
        {frequencies.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={freq === f}
            onClick={() => setFreq(f)}
            className={`min-h-10 cursor-pointer rounded-md px-4 text-[15px] transition-colors ${
              freq === f ? "bg-accent font-bold text-white" : "text-muted hover:bg-tint hover:text-ink"
            }`}
          >
            每周 {f} 次 iriva meeting
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {tiers.map((t) => (
          <article
            key={t.name}
            className={`flex flex-col rounded-xl bg-white p-7 ${
              t.featured ? "ring-2 ring-brand" : "ring-1 ring-line"
            }`}
          >
            <h3 className="text-[22px] font-black">{t.name}</h3>
            <p className="mt-1 min-h-[3.2em] text-[15px] text-muted">{t.who}</p>
            <p className="mt-5 flex flex-wrap items-baseline gap-x-3">
              <span className="text-[40px] leading-none font-black tracking-tight">¥{t.pilot[freq]}</span>
              <span className="text-muted line-through">¥{t.list[freq]}</span>
            </p>
            <p className="mt-2 text-sm text-muted">首期价，正价 ¥{t.list[freq]} / 学期</p>
            <ul className="mt-6 flex flex-col gap-2.5 border-t border-line pt-6 text-[15px]">
              {[`Host：${t.host}`, `场景：${t.scene}`, `和 Host 相处约 ${hostHours[freq]} 小时`, t.extra].map((item) => (
                <li key={item} className="flex gap-2.5">
                  <Check aria-hidden className="mt-[3px] size-[18px] flex-none text-brand" strokeWidth={2.4} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </>
  );
}
