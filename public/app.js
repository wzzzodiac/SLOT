const form=document.querySelector('#proposal-form'),send=document.querySelector('#send'),status=document.querySelector('#form-status'),page=document.querySelector('#page');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const config=window.SLOT_CONFIG??{};
let busy=false,locked=false,operation=0,animations=[],retry=null,scene='form';
const fields=['name','date','time','description','code'];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function cancelAnimations(){for(const a of animations)a.cancel();animations=[];}
async function animate(element,frames,options){if(reduced.matches||!element.animate)return;const a=element.animate(frames,options);animations.push(a);try{await a.finished;}catch{}}
function result(id){scene=id;page.hidden=true;document.querySelector('#void-scene').hidden=true;const el=document.querySelector(id);el.hidden=false;el.focus({preventScroll:true});window.scrollTo(0,0);}
async function vanish(){
  locked=true;scene='vanishing';const revision=++operation;form.inert=true;document.querySelector('#void-scene').hidden=false;
  if(reduced.matches){result('#no-code');return;}
  const ring=document.querySelector('.void-ring');
  const marks=[...document.querySelectorAll('.top,.intro,.ticket-top,.ticket-heading,.field,.timezone,.pass-note,.send-button,.ticket-bottom,footer,.ticket-shadow')];
  const cx=innerWidth/2,cy=innerHeight/2;
  const journeys=marks.map((el,index)=>{const b=el.getBoundingClientRect();return animate(el,[{transform:'none',opacity:1},{transform:`translate(${(cx-b.left-b.width/2)*.28}px,${(cy-b.top-b.height/2)*.28}px) rotate(${index%2?'-':'+'}8deg) scale(.94)`,opacity:1,offset:.32},{transform:`translate(${cx-b.left-b.width/2}px,${cy-b.top-b.height/2}px) rotate(${index%2?-145:170}deg) scale(.001)`,opacity:0}],{duration:1300+index*18,delay:index*12,easing:'cubic-bezier(.6,.05,.7,.2)',fill:'forwards'});});
  journeys.push(animate(document.querySelector('#ticket'),[{background:'#f2eedf'},{background:'transparent',offset:.28},{background:'transparent'}],{duration:1200,fill:'forwards'}));
  journeys.push(animate(ring,[{opacity:0,transform:'rotate(-28deg) scale(.1)'},{opacity:1,transform:'rotate(-28deg) scale(1)',offset:.25},{opacity:1,transform:'rotate(50deg) scale(.6)',offset:.8},{opacity:0,transform:'rotate(130deg) scale(.01)'}],{duration:2200,easing:'ease-in',fill:'forwards'}));
  await Promise.all(journeys);if(revision===operation){result('#no-code');cancelAnimations();}
}
async function celebrate(){locked=true;operation++;result('#success');await Promise.all([animate(document.querySelector('.letter'),[{transform:'translateY(60px)',opacity:0},{transform:'translateY(-15px)',opacity:1,offset:.65},{transform:'translateY(0)',opacity:1}],{duration:1100,easing:'cubic-bezier(.2,.8,.2,1)',fill:'both'}),animate(document.querySelector('.envelope'),[{transform:'translateY(20px) rotate(-8deg)',opacity:0},{transform:'translateY(0) rotate(0deg)',opacity:1}],{duration:650,easing:'ease-out',fill:'both'})]);}
function showError(message){status.textContent=message;}
const date=document.querySelector('#date');
const berlinNow=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());date.min=berlinNow;
form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||locked)return;
  const data=Object.fromEntries(new FormData(form));data.code=data.code.trim();
  if(!data.code){await vanish();return;}
  if(!/^[A-Za-z0-9_-]{22}$/.test(data.code)){showError('That pass looks different. Paste the full code.');document.querySelector('#code').focus();return;}
  if(!form.reportValidity())return;
  if(!data.name.trim()||!data.description.trim()){showError('A name and a little plan, please.');return;}
  const fingerprint=JSON.stringify(data);
  if(!retry||retry.fingerprint!==fingerprint)retry={fingerprint,requestId:crypto.randomUUID()};
  const body={...data,requestId:retry.requestId};
  busy=true;send.disabled=true;form.setAttribute('aria-busy','true');send.querySelector('span').textContent='Sending your plan…';status.textContent='';
  try{
    const response=await fetch(`${config.apiBase??''}/api/submit`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(45000)});
    const answer=await response.json();
    if(!response.ok)throw new Error(answer.error??'Something went sideways. Try again.');
    if(answer.delivery==='sent'){form.reset();retry=null;await celebrate();}
    else {locked=true;for(const name of fields)form.elements[name].disabled=true;status.textContent=answer.delivery==='uncertain'?'Your proposal is saved. Email delivery needs a check by Walter. Please don’t send it again.':answer.delivery==='failed'?'Your proposal is saved, but the email hit a snag. Walter can check it. Your pass has been used.':'Your proposal is saved. The email is still on its way. Your pass has been used.';send.querySelector('span').textContent='Proposal received';}
  }catch(error){showError(error.name==='TimeoutError'||error.name==='TypeError'?'Connection hiccup. Keep this form open and try again — we’ll check the same request.':error.message);}
  finally{busy=false;form.removeAttribute('aria-busy');if(!locked){send.disabled=false;send.querySelector('span').textContent='Send the plan';}}
});
document.querySelector('#reload').addEventListener('click',()=>location.reload());
document.querySelector('#credits-toggle').addEventListener('click',event=>{const p=document.querySelector('#credits');p.hidden=!p.hidden;event.currentTarget.setAttribute('aria-expanded',String(!p.hidden));event.currentTarget.textContent=p.hidden?'Credits +':'Credits −';});
reduced.addEventListener('change',()=>{if(reduced.matches){cancelAnimations();if(scene==='vanishing')result('#no-code');}});
