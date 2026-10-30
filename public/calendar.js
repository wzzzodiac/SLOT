const pad=n=>String(n).padStart(2,'0');
const iso=date=>date.getUTCFullYear()+'-'+pad(date.getUTCMonth()+1)+'-'+pad(date.getUTCDate());
export function monthCells(year,month){
  const first=new Date(Date.UTC(year,month,1)),offset=(first.getUTCDay()+6)%7;
  const count=new Date(Date.UTC(year,month+1,0)).getUTCDate();
  return Array.from({length:Math.ceil((offset+count)/7)*7},(_,i)=>i<offset||i>=offset+count?null:iso(new Date(Date.UTC(year,month,i-offset+1))));
}
export function shiftedMonth(year,month,amount){const d=new Date(Date.UTC(year,month+amount,1));return[d.getUTCFullYear(),d.getUTCMonth()];}
if(typeof document!=='undefined'){
  const form=document.querySelector('#proposal-form'),date=document.querySelector('#date'),time=document.querySelector('#time'),days=document.querySelector('#calendar-days');
  const civil=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'});
  const min=civil.format(Date.now()),max=civil.format(Date.now()+180*86400000);
  let year=Number(min.slice(0,4)),month=Number(min.slice(5,7))-1,focusDay=null;
  const monthName=new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',month:'long',year:'numeric'});
  const fullDay=new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',dateStyle:'full'});
  const toDate=value=>new Date(value+'T12:00:00Z');
  const previous=document.querySelector('#previous-month'),next=document.querySelector('#next-month');
  function draw(){
    document.querySelector('#month-title').textContent=monthName.format(new Date(Date.UTC(year,month,1)));
    const key=year+'-'+pad(month+1);previous.disabled=key<=min.slice(0,7);next.disabled=key>=max.slice(0,7);
    const cells=monthCells(year,month),enabled=cells.filter(v=>v&&v>=min&&v<=max);
    const anchor=enabled.includes(focusDay)?focusDay:enabled.includes(date.value)?date.value:enabled[0];
    days.replaceChildren();
    for(const value of cells){
      if(!value){const blank=document.createElement('span');blank.className='day-blank';blank.setAttribute('aria-hidden','true');days.append(blank);continue;}
      const button=document.createElement('button');button.type='button';button.className='day';button.id='day-'+value;
      button.textContent=String(Number(value.slice(8)));button.disabled=value<min||value>max;
      button.setAttribute('aria-label',fullDay.format(toDate(value)));button.setAttribute('aria-pressed',String(date.value===value));button.tabIndex=value===anchor?0:-1;
      button.classList.toggle('is-today',value===min);button.classList.toggle('is-selected',value===date.value);
      button.addEventListener('click',()=>{date.value=value;focusDay=value;date.dispatchEvent(new Event('change',{bubbles:true}));draw();document.getElementById('day-'+value)?.focus({preventScroll:true});});
      button.addEventListener('keydown',event=>{
        const offsets={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
        if(!(event.key in offsets))return;event.preventDefault();const target=toDate(value);target.setUTCDate(target.getUTCDate()+offsets[event.key]);const wanted=iso(target);
        if(wanted<min||wanted>max)return;year=target.getUTCFullYear();month=target.getUTCMonth();focusDay=wanted;draw();document.getElementById('day-'+wanted)?.focus({preventScroll:true});
      });days.append(button);
    }
    document.querySelector('#selected-date').textContent=date.value?fullDay.format(toDate(date.value)):'—';
  }
  function changeMonth(amount){[year,month]=shiftedMonth(year,month,amount);focusDay=null;draw();}
  previous.addEventListener('click',()=>changeMonth(-1));next.addEventListener('click',()=>changeMonth(1));
  const options=document.querySelector('#time-options');
  for(let minutes=8*60;minutes<20*60;minutes+=30){const value=pad(Math.floor(minutes/60))+':'+pad(minutes%60);const button=document.createElement('button');button.type='button';button.className='time-option';button.textContent=value;button.setAttribute('aria-label',value+' Berlin time');button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>{time.value=value;time.dispatchEvent(new Event('input',{bubbles:true}));});options.append(button);}
  function updateTimes(){for(const button of options.children){const selected=button.textContent===time.value;button.classList.toggle('is-selected',selected);button.setAttribute('aria-pressed',String(selected));}}
  time.addEventListener('input',updateTimes);
  form.addEventListener('reset',()=>queueMicrotask(()=>{focusDay=null;draw();updateTimes();}));
  draw();
}
