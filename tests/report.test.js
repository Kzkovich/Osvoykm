'use strict';
const assert=require('node:assert/strict');
const {buildHtml}=require('../dist/report');

const html=buildHtml({demo:true,vehicle:{make:'Volvo',model:'V60',year:'2021',plate:'PLATE-SECRET',vin:'VIN-SECRET'},records:[
  {date:'2026-02-01',category:'service',title:'Замена масла',amount:12000,odometer:50000,notes:'PRIVATE-NOTE'},
  {date:'2026-03-01',category:'service',title:'<img src=x onerror=alert(1)>',amount:8000,odometer:51000,notes:'PRIVATE-LOCATION'},
  {date:'2026-03-02',category:'fuel',title:'Топливо',amount:5000,notes:'PRIVATE-FUEL-NOTE'}
]},{serviceOnly:true});

assert.match(html,/Выбранный срез: только записи категории «Сервис»/);
assert.match(html,/Сумма выбранных записей[\s\S]*?20\s?000 ₽/);
assert.match(html,/Всего записей: 2/);
assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
assert.doesNotMatch(html,/<img src=x/);
assert.doesNotMatch(html,/PLATE-SECRET|VIN-SECRET|PRIVATE-NOTE|PRIVATE-LOCATION|PRIVATE-FUEL-NOTE/);
assert.match(html,/эти записи демонстрационные/);
assert.match(html,/полнота и выполнение работ не подтверждены/);
assert.match(html,/@media\(max-width:600px\)/);
assert.match(html,/@media print/);

console.log('report tests passed');
