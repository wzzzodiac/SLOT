import './config.js';
import './calendar.js';
const form=document.querySelector('#proposal-form'),send=document.querySelector('#send'),status=document.querySelector('#form-status'),page=document.querySelector('#page');
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),config=window.SLOT_CONFIG??{};
let busy=false,locked=false,operation=0,animations=[],retry=null,scene='form';
function cancelAnimations(){for(const animation of animations)animation.cancel();animations=[];}
async function animate(element,frames,options){if(reduced.matches||!element?.animate)return;const animation=element.animate(frames,options);animations.push(animation);try{await animation.finished;}catch{}}
function result(id){scene=id;page.hidden=true;document.querySelector('#void-scene').hidden=true;const element=document.querySelector(id);element.hidden=false;element.focus({preventScroll:true});window.scrollTo(0,0);}
async function vanish(){
  locked=true;scene='vanishing';form.inert=true;const revision=++operation;
  if(reduced.matches){result('#no-code');return;}
  document.querySelector('#void-scene').hidden=false;const cx=innerWidth/2,cy=innerHeight/2;
  const pieces=[...document.querySelectorAll('.masthead,.calendar-panel,.time-panel,.details-panel,.app-bottom')];
  const journeys=pieces.map((element,index)=>{const box=element.getBoundingClientRect(),x=cx-box.left-box.width/2,y=cy-box.top-box.height/2;return animate(element,[{transform:'none',opacity:1},{transform:'translate('+x*.18+'px,'+y*.18+'px) rotate('+((index%2?1:-1)*6)+'deg) scale(.96)',opacity:1,offset:.3},{transform:'translate('+x+'px,'+y+'px) rotate('+((index%2?1:-1)*160)+'deg) scale(.001)',opacity:0}],{duration:1450+index*90,delay:index*35,easing:'cubic-bezier(.6,.05,.7,.2)',fill:'forwards'});});
  journeys.push(animate(document.querySelector('.void-ring'),[{opacity:0,transform:'rotate(-30deg) scale(.1,.04)'},{opacity:1,transform:'rotate(-30deg) scale(1,.38)',offset:.3},{opacity:0,transform:'rotate(100deg) scale(.01)'}],{duration:2100,fill:'forwards'}));
  await Promise.all(journeys);if(revision===operation){result('#no-code');cancelAnimations();}
}
async function celebrate(){locked=true;operation++;result('#success');await Promise.all([animate(document.querySelector('.dispatch-mark'),[{transform:'translateY(90px) rotate(-15deg) scale(.5)',opacity:0},{transform:'translateY(-12px) rotate(3deg) scale(1.05)',opacity:1,offset:.7},{transform:'none',opacity:1}],{duration:850,easing:'cubic-bezier(.2,.8,.2,1)',fill:'both'}),animate(document.querySelector('.check-path'),[{strokeDasharray:80,strokeDashoffset:80},{strokeDasharray:80,strokeDashoffset:0}],{duration:650,delay:400,easing:'ease-out',fill:'both'})]);}
function showError(message){status.textContent=message;}
form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||locked)return;
  const data=Object.fromEntries(new FormData(form));data.code=data.code.trim();
  if(!data.code){await vanish();return;}
  if(!/^[A-Za-z0-9_-]{22}$/.test(data.code)){showError('Paste the full code.');document.querySelector('#code').focus();return;}
  if(!data.date){showError('Choose a date.');document.querySelector('.day:not(:disabled)')?.focus();return;}
  if(!form.reportValidity())return;
  if(!data.name.trim()||!data.description.trim()){showError('Add your name and topic.');return;}
  const fingerprint=JSON.stringify(data);if(!retry||retry.fingerprint!==fingerprint)retry={fingerprint,requestId:crypto.randomUUID()};
  const body={...data,requestId:retry.requestId};busy=true;form.inert=true;send.disabled=true;form.setAttribute('aria-busy','true');send.querySelector('span').textContent='Sending…';status.textContent='';
  try{
    const response=await fetch((config.apiBase??'')+'/api/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(45000)});
    const answer=await response.json();if(!response.ok)throw new Error(answer.error??'Could not send. Try again.');
    if(answer.delivery==='sent'){form.reset();retry=null;await celebrate();}
    else{locked=true;status.textContent=answer.delivery==='uncertain'?'Saved. Walter needs to check email delivery. Please do not send again.':answer.delivery==='failed'?'Saved, but email delivery failed. Walter can check it. Your code is used.':'Saved. The email is queued. Your code is used.';send.querySelector('span').textContent='Received';status.focus({preventScroll:true});}
  }catch(error){showError(error.name==='TimeoutError'||error.name==='TypeError'?'Connection hiccup. Keep this page open and try again — the same request will be checked.':error.message);}
  finally{busy=false;form.removeAttribute('aria-busy');if(!locked){form.inert=false;send.disabled=false;send.querySelector('span').textContent='Send';}}
});
document.querySelector('#reload').addEventListener('click',()=>location.reload());
const credits=document.querySelector('#credits');
document.querySelector('#credits-toggle').addEventListener('click',()=>credits.showModal());
document.querySelector('#credits-close').addEventListener('click',()=>credits.close());
reduced.addEventListener('change',()=>{if(reduced.matches){cancelAnimations();if(scene==='vanishing')result('#no-code');}});
