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
 return <section className="host-standards" id="your-host" aria-labelledby="host-standards-title"><div className="wrap"><div className="learning-heading"><div><h2 id="host-standards-title">{english?'Someone who makes room for you.':'有人，认真听你说。'}</h2></div></div><div className="host-criteria">{criteria.map(([title,body])=><article key={title}><h3>{title}</h3><p>{body}</p></article>)}</div></div></section>
}
