import '../app/portal.css';
import './style.css';
/** 加入资料页的骨架屏：品牌、标题、进度条与几组输入框。 */
export default function Loading(){
  return <main className="apply-page" aria-busy="true" aria-label="正在读取你的资料">
    <span className="apply-brand">iriva <span>青鸟</span></span>
    <div style={{margin:'55px 0 35px'}}><div className="sk sk-title" style={{width:'60%'}}/><div className="sk sk-line w60"/><div className="sk sk-line" style={{width:'40%'}}/></div>
    <div className="sk sk-line" style={{height:28,marginBottom:32}}/>
    {Array.from({length:4},(_,i)=><div key={i} style={{marginBottom:22}}><div className="sk sk-line" style={{width:120}}/><div className="sk" style={{height:46}}/></div>)}
  </main>;
}
