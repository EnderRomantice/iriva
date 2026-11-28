'use client';
import {useEffect, useState} from 'react';
import {Menu, X} from 'lucide-react';
import HeroIris from './hero-iris';
import LanguageNav from './language-nav';
import ScrollState from './scroll-state';
import type {Locale} from '../lib/locale';
import './brand-site.css';

type Course = 'english' | 'chinese';
export default function BrandSite({locale, course}:{locale:Locale;course?:Course}) {
  const en = locale === 'en';
  const [menu, setMenu] = useState(false);
  const t = (zh:string, english:string) => en ? english : zh;
  const home = en ? '/en' : '/';
  const courseHref = (language:Course) => `${en ? '/en' : ''}/courses/${language}`;
  const courseName = course === 'chinese' ? t('中文', 'Chinese') : t('英语', 'English');
  const apply = `/apply?language=${course === 'chinese' ? 'Chinese' : 'English'}`;
  useEffect(() => { document.documentElement.lang = en ? 'en' : 'zh-CN'; }, [en]);
  const methods = [
    [t('固定伙伴，慢慢熟悉', 'Familiar faces, every week'), t('四位学习者组成一个 Household。聊生活、分享兴趣，让每次见面都有上一次的延续。', 'Four learners form a Household. Share everyday stories and interests, and pick up where you left off.')],
    [t('有引导，也有自己的节奏', 'Guidance, with room to be you'), t('Host 引导小组交流，也通过一对一时间，陪你梳理表达、找到自己的声音。', 'Your Host guides the group and makes time for one-to-one conversations to help you find your own voice.')],
    [t('把语言带回真实生活', 'A language that lives with you'), t('从自己的故事出发，准备、交流、回看。用录音和反馈，听见自己的变化。', 'Prepare a story of your own, share it, and reflect. Use recordings and feedback to hear what has changed.')],
  ];
  return <>
    <a className="skip" href="#main">{t('跳到正文','Skip to content')}</a><ScrollState/>
    <header className="brand-site-header">
      <div className="brand-block"><a className="brand" href={home}>iriva<span>青鸟</span></a><small className="brand-tagline">{t('全球性的语言和文化社区','A language & culture community')}</small></div>
      <LanguageNav lang={locale} hrefs={course ? {zh:`/courses/${course}`,en:`/en/courses/${course}`} : undefined}>
        <nav className={menu ? 'open' : ''} aria-label={t('主导航','Main navigation')}>
          <a href={course ? `${home}#languages` : '#languages'} onClick={()=>setMenu(false)}>{t('探索语言','Explore languages')}</a>
          <a href="#together" onClick={()=>setMenu(false)}>{t('怎样一起学习','How we learn')}</a>
          <a href="#our-story" onClick={()=>setMenu(false)}>{t('我们的故事','Our story')}</a>
        </nav>
      </LanguageNav>
      <a className="workspace-link" href="/app">{t('我的空间','Your space')}</a>
      <button className="menubtn" aria-label={t('切换导航','Toggle navigation')} aria-expanded={menu} onClick={()=>setMenu(!menu)}>{menu ? <X/> : <Menu/>}</button>
    </header>
    <main className="theme-paper brand-site" id="main">
      <section className="hero wrap brand-home-hero" id="top">
        <div className="herocopy">
          <p className="brand-eyebrow">{course ? t(`${courseName}学习与文化交流`,`${courseName} · Language & culture`) : t('语言，让我们相遇。','Meet through language.')}</p>
          <h1>{course ? t(`用${courseName}，\n认识更大的世界。`,`Find your voice.\nConnect in ${courseName}.`) : t('让远方的声音，\n成为身边的朋友。','A World of Voices.\nA Place to Belong.')}</h1>
          <p className="intro">{course ? t(`和固定伙伴、母语 Host 一起，把${courseName}带进真实的生活与交流。`, `Bring ${courseName} into everyday life, with familiar partners and a native-speaking Host.`) : t('一个通过语言与文化，让人们认识彼此的国际社区。\n从一段对话开始，走进另一种生活。','An international community connecting people through language and culture.\nStart a conversation. Discover another way of life.')}</p>
          {course ? <><a className="button" href={apply}>{t('申请加入','Apply to join')}</a><p className="smallnote">{t('四周一起学习 · 匹配确认后再参加','Four weeks together · Join after matching is confirmed')}</p></> : <div className="brand-entry" id="languages">
            <h2>{t('你想从哪一种语言开始？','Which language brings you here?')}</h2>
            <div className="brand-language-links">
              <a href={courseHref('english')}><strong>{t('学习英语','Learn English')}</strong><span lang={en ? 'zh-CN' : 'en'}>{en ? '英语' : 'English'}</span></a>
              <a href={courseHref('chinese')}><strong>{t('学习中文','Learn Chinese')}</strong><span lang={en ? 'zh-CN' : 'en'}>{en ? '中文' : 'Chinese'}</span></a>
            </div>
            <p>{t('选择你想学习的语言，了解课程与社区。','Explore the course and community that fit your interests.')}</p>
          </div>}
        </div>
        <div className="heroart"><HeroIris lang={locale}/></div>
      </section>
      <section className="brand-community" id="together"><div className="wrap">
        <div className="sectiontop"><h2>{t('不同的语言，\n同样温暖的相遇。','Different languages.\nThe same sense of belonging.')}</h2><p>{t('我们相信，愿意听你说的人，\n会让你拥有更多想说的话。','People who want to listen\ngive you more reasons to speak.')}</p></div>
        <div className="brand-methods">{methods.map(([title,body])=><article key={title}><h3>{title}</h3><p>{body}</p></article>)}</div>
      </div></section>
      {course && <section className="wrap brand-course" id="course-details">
        <div className="sectiontop"><h2>{t('四周，一起向前。','Four weeks, together.')}</h2><p>{t('相同的教学模式，围绕你选择的语言展开。\n开始前确认伙伴、Host 和共同时间。','One shared teaching model, in your chosen language.\nAgree on your group, Host and schedule before you begin.')}</p></div>
        <div className="brand-course-grid"><div>
          <h3>{t('你的四周学习安排','Your four-week experience')}</h3>
          <ul>{[
            t('4 次小组圆桌，每次 120 分钟','4 group roundtables, 120 minutes each'),
            t('4 次 Host 一对一，每次 30 分钟','4 Host one-to-ones, 30 minutes each'),
            t('指定伙伴、固定链接和邀约安排','Assigned partners, fixed links and invitations'),
            t('准备工具、Host 简短反馈和个人总结','Preparation tools, brief Host feedback and personal reflection'),
            t('前后录音对比，回看表达中的变化','Before-and-after recordings to reflect on your progress'),
          ].map(item=><li key={item}>{item}</li>)}</ul>
          <p>{t(`适合已有一些${courseName}基础、能参与简单对话的学习者。慢一点没关系；团队会先了解你的口语水平和学习目标。`, `For learners with some ${courseName} who can join a simple conversation. Taking your time is fine. We discuss your speaking level and goals before matching.`)}</p>
        </div><aside><p className="brand-eyebrow">{t('母语档 · 四周 Pilot','NATIVE · FOUR-WEEK PILOT')}</p><h3>{t(`和${courseName}母语 Host 一起学习`,`Learn with a native ${courseName} Host`)}</h3><p className="brand-course-price">¥1,980 <span>{t('/ 人 / 四周','/ person / four weeks')}</span></p><p>{t('初始成员特别优惠价。匹配完成前无需付款；提交资料不等于确认参加。','First pilot price. No payment before matching is confirmed; applying does not commit you to joining.')}</p><a className="button" href={apply}>{t('填写加入资料','Apply to join')}</a>{en && <small>The profile form is currently in Chinese.</small>}</aside></div>
        <details className="brand-course-more"><summary>{t('其他学习方案','Other learning plans')}</summary><p>{t('基础档（日常交流）与专业档（商务、出海与学术）后续开放，目前接受需求登记，价格待定。','Everyday conversation and Professional plans are coming later. Register your interest; pricing is to follow.')}</p><a href={`${apply}&plan=everyday`}>{t('登记基础档意向','Everyday plan interest')}</a><a href={`${apply}&plan=professional`}>{t('登记专业档需求','Professional plan interest')}</a></details>
        <div className="brand-course-faq"><h3>{t('参加前，你可能想知道','Before you join')}</h3>{[
          [t('什么时候可以开组？','When can a group begin?'),t('合适的四位学员匹配并确认，Host 与共同时间确定后即可开组。若暂时没有合适的小组，团队会与你沟通其他时间或继续等待。','Once four suitable learners are matched and confirmed, with a Host and shared time agreed. If no suitable group is available, the team will discuss other times or continued waiting.')],
          [t('录音会被公开吗？','Will recordings be shared?'),t('准备工具中的录音默认只留在当前标签页，可自行下载，不会自动上传或转写。用于 Host 反馈或结业回看时，需另行取得同意并确认交付与删除方式。未成年学员需监护人报名及同意。','Preparation recordings stay in the current tab unless you download them. They are not automatically uploaded or transcribed. Sharing for Host feedback requires separate consent and an agreed delivery and deletion process. Minors require guardian consent.')],
          [t('缺席与退款如何处理？','What if I miss a meeting or need a refund?'),t('固定圆桌缺席不单独补课。退款请通过「给青鸟的建议」提交申请，客服审核后按原支付方式手动退回。开学14天以前全额退款（扣支付手续费）；开学前14天内退80%；第一周结束前退50%，这两个阶段也可转期；第一周后原则上不退款，紧急情况可转期一次。由我们造成的未履约部分可按比例退款或转期。具体以报名时确认的协议为准。','Missed roundtables are not individually rescheduled. Request a refund through Share feedback; the team reviews it and refunds manually to the original payment method. More than 14 days before the start: full refund less payment fees. Within 14 days: 80%. Through the end of week one: 50%. A transfer is also available in those last two periods. After week one, generally no refund; one emergency transfer may be available. Undelivered services caused by IRIVA qualify for a proportional refund or transfer. The registration agreement governs the details.')],
        ].map(([question,answer])=><details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
      </section>}
      <section className="wrap origin" id="our-story"><div className="origin-heading"><h2>{t('让语言，\n成为人与人的连接。','Let language\nbring people closer.')}</h2></div><div className="origin-copy"><p>{t('我们见过工作中没能说清的想法，也见过身在海外却不敢开口的孤独。很多人认真学了多年，语言却仍未走进生活。','We have seen ideas left unspoken at work, and the loneliness of being overseas but struggling to join a conversation. Years of study do not always bring a language into everyday life.')}</p><p>{t('青鸟希望让远方的声音得到回应，让陌生的人慢慢熟悉。这份愿望属于每一种语言与文化。','IRIVA hopes to give distant voices a response, and strangers a chance to become familiar. This hope belongs across languages and cultures.')}</p><details className="brand-story"><summary>{t('为什么叫青鸟 IRIVA？','The story behind IRIVA and 青鸟')}</summary><p>{t('在中国诗文里，青鸟是为远方的人传递音信的信使。在古希腊神话中，Iris 是彩虹女神与信使。IRIVA，是受 Iris 启发而创造的名字。青鸟与彩虹在这里相遇，共同连接不同的世界。','In Chinese poetry, qingniao, the bluebird, is a messenger carrying news across great distances. In Greek mythology, Iris is the rainbow goddess and a messenger between worlds. IRIVA is a contemporary name inspired by Iris. Here, the bluebird meets the rainbow.')}</p></details></div></section>
      <section className="closing wrap"><h2>{t('下一次开口，\n从认识彼此开始。','Your next conversation\nstarts with getting acquainted.')}</h2><div className="brand-closing-links"><a className="button" href={courseHref('english')}>{t('探索英语课程','Explore English')}</a><a className="button" href={courseHref('chinese')}>{t('探索中文课程','Explore Chinese')}</a></div></section>
    </main>
    <footer className="wrap"><a className="brand" href={home}>iriva<span>青鸟</span></a><p>{t('让远方的声音，成为身边的朋友。','A World of Voices. A Place to Belong.')}</p><a href="/feedback">{t('成为 Host / 联系我们','Host with us / Contact')}</a><a href="/app">{t('进入我的空间','Your space')}</a></footer>
  </>;
}
