"use client";

import { useState } from "react";
import { hostHours, tiers, type Frequency } from "@/lib/content";

const frequencies: Frequency[] = [1, 2];

export function Pricing() {
  const [freq, setFreq] = useState<Frequency>(1);

  return (
    <>
      <div
        role="group"
        aria-label="每周圆桌次数"
        className="mt-7 inline-flex gap-1 rounded-full bg-sand p-1"
      >
        {frequencies.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={freq === f}
            onClick={() => setFreq(f)}
            className={`min-h-11 cursor-pointer rounded-full px-5 py-2.5 text-[15px] ${
              freq === f ? "bg-sea font-bold text-white" : "font-medium text-ink"
            }`}
          >
            每周 {f} 次圆桌
          </button>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-6">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={`rounded-3xl bg-white p-8 ${
              t.featured
                ? "border-2 border-clay shadow-[0_0_0_6px_var(--color-clay-soft)]"
                : "border border-line"
            }`}
          >
            <p className="text-[22px] font-bold">{t.name}</p>
            <p className="mt-1 text-[15px] text-muted">{t.who}</p>
            <div className="mt-6 flex flex-wrap items-baseline gap-3">
              <span className="text-[40px] font-bold">¥{t.pilot[freq]}</span>
              <span className="text-base text-muted line-through">¥{t.list[freq]}</span>
            </div>
            <p className="mt-1 text-sm font-bold text-clay-ink">
              首期价 · 正价 ¥{t.list[freq]} / 学期
            </p>
            <ul className="mt-5 flex list-disc flex-col gap-1.5 pl-[18px] text-[15px]">
              <li>Host：{t.host}</li>
              <li>场景：{t.scene}</li>
              <li>和 Host 相处约 {hostHours[freq]} 小时</li>
              <li>{t.extra}</li>
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
