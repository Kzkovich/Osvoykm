'use strict';
(() => {
  const num = v => { if(v===null||v===undefined||String(v).trim()==='') return null; const n=Number(String(v).trim().replace(/\s/g,'').replace(',','.')); return Number.isFinite(n)?n:null; };
  const parseCsv = text => { const rows=[]; let row=[],cell='',quoted=false; for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++}else if(c==='"')quoted=false;else cell+=c}else if(c==='"')quoted=true;else if(c===','){row.push(cell);cell=''}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell=''}else cell+=c} row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows; };
  const norm=s=>String(s||'').trim().toLowerCase().replace(/^#+\s*/,'').replace(/\s*\(optional\)/g,'').replace(/\s+/g,' ');
  const validDate=s=>/^\d{4}-\d\d-\d\d$/.test(s)&&!Number.isNaN(Date.parse(`${s}T00:00:00Z`))&&new Date(`${s}T00:00:00Z`).toISOString().slice(0,10)===s;
  function calculateFuelFields(values,changed){const out={};const amount=num(values.amount),litres=num(values.litres),unit=num(values.pricePerLitre);if(changed==='amount'&&amount!==null){if(litres>0)out.pricePerLitre=(amount/litres).toFixed(2);else if(unit>0)out.litres=(amount/unit).toFixed(2)}else if(changed==='pricePerLitre'&&unit!==null){if(litres>0)out.amount=(litres*unit).toFixed(2);else if(amount!==null&&unit>0)out.litres=(amount/unit).toFixed(2)}else if(changed==='litres'&&litres!==null){if(unit>0)out.amount=(litres*unit).toFixed(2);else if(amount!==null&&litres>0)out.pricePerLitre=(amount/litres).toFixed(2)}return out;}
  function normalizeDate(v){const s=String(v||'').trim();let m;if((m=s.match(/^(\d{4})[-/.](\d\d)[-/.](\d\d)/))){const d=`${m[1]}-${m[2]}-${m[3]}`;return validDate(d)?d:null}if((m=s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/))){const d=`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;return validDate(d)?d:null}const d=new Date(s);return Number.isNaN(+d)?null:d.toISOString().slice(0,10)}
  function parseFuelio(text, fallbackVehicle={}, makeId=()=>`${Date.now()}-${Math.random()}`){const sections={};let section='',needHeader=false;const aliases={vehicle:'vehicle',log:'log',costs:'costs',costcategories:'costcategories',pictures:'pictures'};for(const row of parseCsv(text)){const rawFirst=String(row[0]||'').trim(),first=norm(row[0]).replace(/:$/,'');if(/^#+\s*/.test(rawFirst)){section=aliases[first]||'';if(section){sections[section]=[];needHeader=true}continue}if(!section)continue;if(needHeader){sections[section].push({header:row});needHeader=false;continue}sections[section].push(row)}
    const recordsFor=name=>{const a=sections[name]||[],h=a.find(x=>x.header)?.header||[];return a.filter(x=>!x.header).map(row=>Object.fromEntries(h.map((k,i)=>[norm(k),row[i]??''])))};
    const cats={};recordsFor('costcategories').forEach(x=>{const k=x.costtypeid;if(k)cats[k]=x.name||''});const fuel=recordsFor('log'),costs=recordsFor('costs'),records=[],guids=new Set();const add=r=>{if(r.guid&&guids.has(r.guid))return;if(r.guid)guids.add(r.guid);records.push({...r,id:makeId()})};
    fuel.forEach(x=>{const litres=num(x['fuel (litres)']??x['fuel (l)']??x.fuel),price=num(x.price??x.cost??x.amount),unit=num(x['price per litre']??x.volumeprice),odo=num(x['odo (km)']??x.odo??x.odometer),date=normalizeDate(x.date||x.data);if([litres,price,unit,odo].some(n=>n!==null&&n<0))throw new Error('В CSV обнаружены отрицательные значения топлива, суммы или пробега. Импорт остановлен.');if(!date||(!litres&&price===null))return;const full=/^(true|1|yes|да|y)$/i.test(String(x.full??x.fulltank??''));add({date,time:(String(x.date||x.data||'').match(/\b(\d\d:\d\d)(?::\d\d)?\b/)||[])[1]||'',category:'fuel',title:litres?'Заправка':'Запись топлива',amount:price!==null?Math.round(price*100)/100:(litres&&unit?Math.round(litres*unit*100)/100:0),litres,pricePerLitre:unit,fullTank:full,missed:/^(true|1|yes|да|y)$/i.test(String(x.missed||'')),odometer:odo>0?odo:null,notes:[x.notes,x.comment].filter(Boolean).join(' · '),guid:x.guid||null})});
    costs.forEach(x=>{const rawAmount=num(x.cost??x.price??x.amount),date=normalizeDate(x.date),odo=num(x.odo??x['odo (km)']);if(rawAmount!==null&&rawAmount<0||odo!==null&&odo<0)throw new Error('В CSV обнаружены отрицательные значения суммы или пробега. Импорт остановлен.');if(!date||rawAmount===null)return;const amount=Math.round(rawAmount*100)/100,cat=cats[x.costtypeid]||x.costtype||'',title=x.costtitle||x.title||cat||'Расход',s=`${cat} ${title}`.toLowerCase(),income=/^(true|1|yes|да|y)$/i.test(String(x.isincome||'')),category=income?'income':/fuel|petrol|бенз|топлив|заправ/.test(s)?'fuel':/wash|clean|мойк/.test(s)?'wash':/service|repair|maint|ремонт|сервис|то |замен|шиномонт/.test(s)?'service':'other';add({date,time:(String(x.date||'').match(/\b(\d\d:\d\d)(?::\d\d)?\b/)||[])[1]||'',category,title,sourceCategory:cat,amount,odometer:odo>0?odo:null,litres:null,fullTank:false,notes:x.notes||'',guid:x.guid||null})});
    const v=sections.vehicle?{}:{...fallbackVehicle};const rows=recordsFor('vehicle');for(const r of rows)for(const [k,val]of Object.entries(r))if(val)v[k.toLowerCase()]=val;const distUnit=String(v.distunit??'0'),fuelUnit=String(v.fuelunit??'0');if(distUnit!=='0'||fuelUnit!=='0')throw new Error('В CSV указаны неподдерживаемые единицы пробега или объёма топлива. Импорт этих данных остановлен, чтобы не исказить расчёты.');const vraw=(sections.vehicle||[]).flatMap(r=>r.header?[]:r).join(' ');for(const k of ['make','model','year'])if(!v[k]){const m=vraw.match(new RegExp(`${k}\\s*[,=:]\\s*([^,;\\r\\n]+)`,'i'));if(m)v[k]=m[1].trim()}
    return {records,vehicle:v,sections:{fuel:fuel.length,costs:costs.length,categories:recordsFor('costcategories').length,pictures:(sections.pictures||[]).length},duplicateCount:fuel.length+costs.length-records.length};}
  function normalizeBackup(data,makeId=()=>`${Date.now()}-${Math.random()}`){
    if(!data||data.version!==1||!Array.isArray(data.records))throw new Error('Неподдерживаемый формат JSON');
    const categories=new Set(['fuel','service','wash','other','income']),ids=new Set(),guids=new Set(),records=[];let duplicateCount=0;
    for(let i=0;i<data.records.length;i++){
      const r=data.records[i];
      if(!r||!categories.has(r.category)||!normalizeDate(r.date))throw new Error(`Некорректная запись №${i+1}`);
      const amount=num(r.amount),odometer=num(r.odometer),litres=num(r.litres),pricePerLitre=num(r.pricePerLitre);
      if(amount===null||amount<0||odometer<0||litres<0||pricePerLitre<0)throw new Error(`Некорректные числовые данные в записи №${i+1}`);
      const sourceId=typeof r.id==='string'?r.id:'';
      const guid=typeof r.guid==='string'&&r.guid.trim()?r.guid.trim():null;
      if((sourceId&&ids.has(sourceId))||(guid&&guids.has(guid))){duplicateCount++;continue}
      if(sourceId)ids.add(sourceId);if(guid)guids.add(guid);
      records.push({id:makeId(),guid,date:normalizeDate(r.date),time:typeof r.time==='string'?r.time.slice(0,20):'',category:r.category,title:String(r.title||({fuel:'Топливо',service:'Сервис',wash:'Мойка',income:'Доход',other:'Другое'}[r.category])).slice(0,90),amount,odometer:odometer>0?odometer:null,litres,pricePerLitre,fullTank:r.fullTank===true,missed:r.missed===true,notes:String(r.notes||'').slice(0,500),sourceCategory:String(r.sourceCategory||'').slice(0,100)});
    }
    const vehicle={};for(const k of ['make','model','year','fuel','plate'])if(typeof data.vehicle?.[k]==='string')vehicle[k]=data.vehicle[k].slice(0,100).trim();
    return {records,vehicle,sections:{fuel:records.filter(r=>r.category==='fuel').length,costs:records.filter(r=>r.category!=='fuel').length,pictures:0},duplicateCount};
  }
  function sameVehicle(a,b){
    const part=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/ё/gi,'е').toLowerCase().replace(/[^a-zа-я0-9]/g,'');
    const am=part(a?.make),amodel=part(a?.model),bm=part(b?.make),bmodel=part(b?.model);
    if(!am||!amodel||!bm||!bmodel)return true;
    return am===bm&&amodel===bmodel&&(!a.year||!b.year||part(a.year)===part(b.year));
  }
  function fuelIntervals(records){
    const a=records.filter(r=>r.category==='fuel').slice().sort((x,y)=>{
      const d=String(x.date).localeCompare(String(y.date));
      if(d)return d;
      if(x.time&&y.time){const t=String(x.time).localeCompare(String(y.time));if(t)return t}
      const xo=num(x.odometer),yo=num(y.odometer);
      return xo!==null&&yo!==null?xo-yo:0;
    });
    const out=[];
    for(let i=0;i<a.length;i++){
      const start=a[i],startOdo=num(start.odometer),startLitres=num(start.litres);
      if(!start.fullTank||start.missed||startOdo===null||startOdo<=0||startLitres===null||startLitres<=0)continue;
      let litres=0,spend=0,valid=true,end=-1,previousOdo=startOdo;
      for(let j=i+1;j<a.length;j++){
        const r=a[j],odo=num(r.odometer),volume=num(r.litres),amount=num(r.amount);
        if(r.missed||odo===null||odo<=0||volume===null||volume<=0||(amount!==null&&amount<0)||odo<=previousOdo){valid=false;break}
        litres+=volume;spend+=amount??0;previousOdo=odo;
        if(r.fullTank){end=j;break}
      }
      if(end<0||!valid)continue;
      const km=previousOdo-startOdo;
      if(km>0)out.push({from:start.date,to:a[end].date,km,litres,spend,litresPer100Km:litres*100/km,costPerKm:spend/km});
      i=end-1;
    }
    return out;
  }
  const api={parseCsv,parseFuelio,normalizeDate,num,fuelIntervals,calculateFuelFields,normalizeBackup,sameVehicle};if(typeof module!=='undefined'&&module.exports)module.exports=api;if(typeof window!=='undefined')window.BortCore=api;
})();
