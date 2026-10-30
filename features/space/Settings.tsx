"use client";
import type { Dispatch, SetStateAction } from "react";
import type { Role } from "@/domain/models";
import { defaults, viewLabels, type Preferences, type View } from "./preferences";
import { setNetworkMode, type NetworkMode } from "@/local/sync";
import { Sheet } from "./primitives";
const colors = [{ name: "海湾", value: "#12658a" }, { name: "茄紫", value: "#4a154b" }, { name: "松林", value: "#315c4a" }, { name: "石墨", value: "#414854" }];
export function Settings({ preferences, setPreferences, role, mode, error, onClose }: { preferences: Preferences; setPreferences: Dispatch<SetStateAction<Preferences>>; role: Role; mode: NetworkMode; error: string; onClose: () => void }) {
  const update = (patch: Partial<Preferences>) => setPreferences(p => ({ ...p, ...patch }));
  const options = preferences.order.filter(v => role === "ops" ? v !== "tasks" : v !== "applications");
  const move = (view: View, direction: number) => {
    const index = preferences.order.indexOf(view), target = index + direction;
    if (target < 0 || target >= preferences.order.length) return;
    const order = [...preferences.order]; [order[index], order[target]] = [order[target], order[index]]; update({ order });
  };
  return <Sheet title="自定义工作区" onClose={onClose}>
    <section className="sp-setting"><h3>主题颜色</h3><p>同时调整顶栏、导航和选中状态。</p><div className="sp-palettes">{colors.map(color => <button key={color.value} onClick={() => update({ color: color.value })} aria-pressed={preferences.color === color.value}><span style={{ background: color.value }} />{color.name}</button>)}</div><label className="sp-color-input">自定义颜色<input aria-label="自定义颜色" type="color" value={preferences.color} onChange={e => update({ color: e.target.value })} /><span>{preferences.color.toUpperCase()}</span></label></section>
    <section className="sp-setting"><h3>显示</h3><label><input type="checkbox" checked={preferences.dark} onChange={e => update({ dark: e.target.checked })} />深色内容区</label><label><input type="checkbox" checked={preferences.compact} onChange={e => update({ compact: e.target.checked })} />紧凑间距</label><label><input type="checkbox" checked={preferences.collapsed} onChange={e => update({ collapsed: e.target.checked })} />收起侧栏</label></section>
    <section className="sp-setting"><h3>侧栏内容</h3><p>只显示你需要的入口，顺序也由你决定。</p><div className="sp-nav-config">{options.map((view, index) => <div key={view}><label><input type="checkbox" disabled={view === "overview"} checked={!preferences.hidden.includes(view)} onChange={e => update({ hidden: e.target.checked ? preferences.hidden.filter(v => v !== view) : [...preferences.hidden, view] })} />{viewLabels[view]}</label><button disabled={index === 0} aria-label={`上移${viewLabels[view]}`} onClick={() => move(view, preferences.order.indexOf(options[index - 1]) - preferences.order.indexOf(view))}>上移</button><button disabled={index === options.length - 1} aria-label={`下移${viewLabels[view]}`} onClick={() => move(view, preferences.order.indexOf(options[index + 1]) - preferences.order.indexOf(view))}>下移</button></div>)}</div></section>
    <section className="sp-setting"><h3>本地测试</h3><label>网络<select value={mode} onChange={e => setNetworkMode(e.target.value as NetworkMode)}><option value="online">正常连接</option><option value="slow">模拟慢网</option><option value="offline">模拟离线</option></select></label></section>
    {error && <p className="sp-error">{error}</p>}<div className="sp-actions"><button onClick={() => setPreferences({ ...defaults })}>恢复默认</button><button className="sp-primary" onClick={onClose}>完成</button></div>
  </Sheet>;
}
