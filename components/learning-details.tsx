type Text={en:string;zh:string};
const host={
 name:'Inna Tserniuk',
 photo:'/avatars/host-1.webp',
 role:{en:'Business Communication Coach · Business English Trainer',zh:'商务沟通教练 · 商务英语培训师'},
 origin:{en:'Grew up in Canada, now lives in Ukraine. Bilingual native speaker of English and Ukrainian.',zh:'成长于加拿大，现居乌克兰。英语与乌克兰语双母语。'},
 education:[
  {school:{en:'Chernivtsi National University',zh:'切尔诺夫策国立大学'},detail:{en:'Master’s in International Information · Information Analysis in International Affairs',zh:'国际信息硕士 · 专业方向：国际事务信息分析'}},
  {school:{en:'Advanced TESOL Certificate',zh:'Advanced TESOL 证书'},detail:{en:'120 hours',zh:'120 小时'}}
 ] as {school:Text;detail:Text}[],
 work:{en:'Has spent years teaching adult learners and working professionals. She truly loves this work and feels she has found her life’s calling: helping people communicate with more confidence.',zh:'长期从事成年学员与职场精英的教学工作。真心热爱这份工作，并且觉得自己找到了毕生使命——帮助人们建立更自信的沟通能力。'},
 about:{en:'She keeps orchids on her windowsill and shares her home with three Bengal cats and an English Mastiff. She loves cooking, exploring different cultures, and hearing people’s real-life stories.',zh:'窗台上养着兰花，家里还有三只孟加拉猫和一只英国獒犬。她喜欢做饭、探索不同文化，也喜欢听人讲真实的生活故事。'},
 q:{en:'If, after four weeks, your group remembers just one thing about their time with you, what would you want it to be?',zh:'如果四周后，组员只记住与你相处的一件事，你最希望是什么？'},
 a:{en:'I want people to remember that you don’t need perfect English to have a real conversation. I want my members to feel comfortable to share their thoughts, enjoy themselves. I want them to realize that English isn’t as scary, and that they’re much more capable than they give themselves credit for.',zh:'我希望大家记住：你不需要说一口完美的英语，也能进行真正的交流。我希望我的会员们能自在地分享想法，享受其中。我希望他们意识到，英语并没有那么可怕，而他们其实比自己以为的要厉害得多。'}
};

export function HostStandards({english=false}:{english?:boolean}){
 const criteria=english?[
 ['Clear communication','A native English-speaking Host with clear, natural expression.'],
 ['Respect and listening','Respect for different backgrounds and ways of expressing yourself.'],
 ['Consistent presence','Time and attention for the same group throughout four weeks.']
 ]:[
 ['专业沟通','英语母语背景，表达清晰、自然。'],
 ['尊重与倾听','尊重不同文化、表达节奏与个人边界。'],
 ['稳定同行','为四周交流持续投入时间与关注。']
 ];
 const lang=english?'en':'zh';
 return <section className="host-standards" id="your-host" aria-labelledby="host-standards-title"><div className="wrap host-layout"><div className="host-intro"><h2 id="host-standards-title">{english?'Someone who makes room for you.':<>有人，<br/>认真听你说。</>}</h2><div className="host-criteria">{criteria.map(([title,body])=><article key={title}><h3>{title}</h3><p>{body}</p></article>)}</div></div><article className="host-profile host-highlight" aria-label="Host highlight"><p className="host-highlight-label">HOST HIGHLIGHT</p><div className="host-highlight-head"><img src={host.photo} alt={english?`${host.name}, Host`:`Host ${host.name} 头像`} width={112} height={112} loading="lazy"/><div><h3>{host.name}</h3><p className="host-role">{host.role[lang]}</p><p className="host-origin">{host.origin[lang]}</p></div></div><blockquote className="host-qa"><p className="host-q"><b>Q</b>{host.q[lang]}</p><p className="host-a"><b>A</b>{host.a[lang]}</p></blockquote><details className="host-more"><summary>{english?'More about Inna':'了解更多'}</summary><div className="host-highlight-body"><section><h4>{english?'Education':'教育背景'}</h4><ul>{host.education.map(e=><li key={e.school.en}><strong>{e.school[lang]}</strong><span>{e.detail[lang]}</span></li>)}</ul></section><section><h4>{english?'Experience':'工作背景'}</h4><p>{host.work[lang]}</p></section><section><h4>{english?'About her':'关于她'}</h4><p>{host.about[lang]}</p></section></div></details></article></div></section>
}
