type Text={en:string;zh:string};
const hosts:{name:string;photo:string;education:{school:Text;detail:Text;years:string}[]}[]=[
 {name:'Olena',photo:'/avatars/host-1.webp',education:[
  {school:{en:'Global TESOL College Canada',zh:'加拿大环球 TESOL 学院'},detail:{en:'Other, Teaching English to Speakers of Other Languages (TESOL)',zh:'其他，对外英语教学（TESOL）'},years:'2017-2017'},
  {school:{en:'Yuriy Fedkovich Chernivtsi National University',zh:'切尔诺夫策国立大学（尤里·费德科维奇）'},detail:{en:'Master of Arts (MA), International Information: Information Analyst in International Affairs',zh:'文学硕士（MA），国际信息：国际事务信息分析'},years:'2008-2013'}
 ]},
 // TODO: placeholder education — replace with the second Host's real background.
 {name:'Daniel',photo:'/avatars/host-2.webp',education:[
  {school:{en:'Cambridge English (CELTA)',zh:'剑桥英语（CELTA）'},detail:{en:'Certificate in Teaching English to Speakers of Other Languages',zh:'对外英语教学证书'},years:'2016-2016'},
  {school:{en:'The University of Texas at Austin',zh:'得克萨斯大学奥斯汀分校'},detail:{en:'Bachelor of Arts (BA), English Language and Literature',zh:'文学学士（BA），英语语言文学'},years:'2009-2013'}
 ]}
];

export function HostStandards({english=false}:{english?:boolean}){
 const criteria=english?[
 ['Clear communication','A US native English-speaking Host with clear, natural expression.'],
 ['Respect and listening','Respect for different backgrounds and ways of expressing yourself.'],
 ['Consistent presence','Time and attention for the same group throughout four weeks.']
 ]:[
 ['专业沟通','美国母语背景，表达清晰、自然。'],
 ['尊重与倾听','尊重不同文化、表达节奏与个人边界。'],
 ['稳定同行','为四周交流持续投入时间与关注。']
 ];
 return <section className="host-standards" id="your-host" aria-labelledby="host-standards-title"><div className="wrap host-layout"><div className="host-intro"><h2 id="host-standards-title">{english?'Someone who makes room for you.':<>有人，<br/>认真听你说。</>}</h2><div className="host-criteria">{criteria.map(([title,body])=><article key={title}><h3>{title}</h3><p>{body}</p></article>)}</div></div><div className="host-profiles">{hosts.map(host=><article key={host.photo} className="host-profile"><img src={host.photo} alt={english?`${host.name}, Host`:`Host ${host.name} 头像`} width={112} height={112} loading="lazy"/><div><h3>{host.name}</h3><h4>{english?'Education':'教育背景'}</h4><ul>{host.education.map(e=>{const lang=english?'en':'zh';return <li key={e.school.en}><strong>{e.school[lang]}</strong><span>{e.detail[lang]} | <time>{e.years}</time></span></li>})}</ul></div></article>)}</div></div></section>
}
