'use strict';
const assert=require('node:assert/strict');
const {parseCsv,parseFuelio,normalizeDate,fuelIntervals,calculateFuelFields,normalizeBackup,sameVehicle}=require('../dist/core');
const csv=`## Vehicle\nMake,Model,Year\nVolvo,V60,2021\n## Log\nDate,Odo (km),Fuel (litres),Price,VolumePrice,Full,Missed,Notes,GUID\n2024-01-01,1000,10,1000,100,true,false,"hello, world",f1\n2024-01-02,1010,5,500,100,false,false,"line one\nline two",f2\n2024-01-03,,8,800,100,false,true,,f3\n2024-01-04,1040,,1000,,true,false,,f4\n2024-01-05,1050,10,1000,100,true,false,,f1\n## Costs\nDate,CostTypeID,CostTitle,Cost,Odo,Notes,GUID\n2024-01-02,1,Wash,25,0,"note, quoted",c1\n## CostCategories\nCostTypeID,Name\n1,Wash\n`;
const parsed=parseFuelio(csv,{make:'Fallback'},(()=>{let i=0;return()=>`id${++i}`})());
assert.equal(parseCsv('a,b\n"x,y","q""z"')[1][0],'x,y');
assert.equal(parsed.records.length,5); // duplicate GUID removed
assert.equal(parsed.sections.fuel,5); assert.equal(parsed.sections.costs,1); assert.equal(parsed.duplicateCount,1);
assert.equal(parsed.records[0].notes,'hello, world'); assert.equal(parsed.records[1].notes,'line one\nline two');
assert.equal(parsed.records[2].odometer,null); assert.equal(parsed.records[2].missed,true);
assert.equal(parsed.records[3].litres,null); assert.equal(parsed.records[4].odometer,null);
assert.equal(parsed.vehicle.make,'Volvo');assert.equal(parsed.vehicle.model,'V60');
const differentVehicle=parseFuelio('## Vehicle\nMake,Model,Year,Plate\nSkoda,Octavia,2020,\n## Costs\nDate,CostTitle,Cost\n2024-01-01,Service,100',{make:'Volvo',model:'V60',plate:'A123BC'},()=>`vehicle-${Math.random()}`);
assert.deepEqual(differentVehicle.vehicle,{make:'Skoda',model:'Octavia',year:'2020'});
const noVehicle=parseFuelio('## Costs\nDate,CostTitle,Cost\n2024-01-01,Service,100',{make:'Volvo',model:'V60',plate:'A123BC'});
assert.equal(noVehicle.vehicle.plate,'A123BC');
const incomeImport=parseFuelio('## Costs\nDate,CostTitle,Cost,IsIncome\n2024-01-01,Refund,200,true');
assert.equal(incomeImport.records[0].category,'income');
assert.equal(sameVehicle({make:' Volvo ',model:'V-60',year:'2021'},{make:'volvo',model:'v 60',year:'2021'}),true);
assert.equal(sameVehicle({make:'Volvo',model:'V60'},{make:'Skoda',model:'Octavia'}),false);
const backup=normalizeBackup({version:1,vehicle:{make:'Skoda'},records:[
  {id:'duplicate',date:'2024-01-01',category:'income',amount:100,title:'Возврат'},
  {id:'duplicate',date:'2024-01-02',category:'fuel',amount:500,litres:5,odometer:0}
]},(()=>{let i=0;return()=>`json-${++i}`})());
assert.equal(backup.records.length,1);
assert.equal(backup.records[0].category,'income');
assert.equal(backup.duplicateCount,1);
assert.equal(backup.records[0].id,'json-1');
assert.equal(backup.records[0].odometer,null);
assert.equal(backup.vehicle.make,'Skoda');
for(const invalid of [
  {version:1,records:[{date:'31.02.2024',category:'fuel',amount:1}]},
  {version:1,records:[{date:'2024-01-01',category:'bogus',amount:1}]},
  {version:1,records:[{date:'2024-01-01',category:'fuel',amount:-1}]},
  {version:1,records:[{date:'2024-01-01',category:'fuel',amount:1,litres:-1}]},
  {version:1,records:[{date:'2024-01-01',category:'fuel',amount:1,odometer:-1}]},
  {version:1,records:[{date:'2024-01-01',category:'fuel',amount:1,pricePerLitre:-1}]}
])assert.throws(()=>normalizeBackup(invalid));
assert.throws(()=>parseFuelio('## Log\nDate,Fuel (litres),Price,Odo (km)\n2024-01-01,-1,10,100'));
assert.equal(normalizeDate('31.02.2024'),null);assert.equal(normalizeDate('2024-01-01'),'2024-01-01');
assert.throws(()=>parseFuelio('## Vehicle\nDistUnit,FuelUnit\n1,0\n## Log\nDate,Fuel (litres),Price\n2024-01-01,2,3'),/неподдерживаемые единицы/);
const unknownSection=parseFuelio('## Log\nDate,Fuel (litres),Price\n2024-01-01,2,3\n## Unknown\nDate,Fuel (litres),Price\n2024-01-02,9,9\n## Costs\nDate,CostTitle,Cost\n2024-01-03,Wash,10');
assert.equal(unknownSection.records.length,2); assert.equal(unknownSection.records[1].sourceCategory,'');
assert.equal(fuelIntervals([{category:'fuel',date:'1',fullTank:true,litres:10,odometer:100},{category:'fuel',date:'2',litres:5,odometer:110},{category:'fuel',date:'3',fullTank:true,litres:10,odometer:120}])[0].litresPer100Km,75);
assert.equal(fuelIntervals([{category:'fuel',date:'1',fullTank:true,litres:10,odometer:100},{category:'fuel',date:'2',litres:5,odometer:null},{category:'fuel',date:'3',fullTank:true,litres:10,odometer:120}]).length,0);
const partialInterval=fuelIntervals([
  {category:'fuel',date:'2026-01-01',fullTank:true,litres:42,amount:3000,odometer:100000},
  {category:'fuel',date:'2026-01-02',fullTank:false,litres:15,amount:1200,odometer:100200},
  {category:'fuel',date:'2026-01-03',fullTank:true,litres:35,amount:2800,odometer:100500}
]);
assert.equal(partialInterval.length,1);
assert.equal(partialInterval[0].litres,50);
assert.equal(partialInterval[0].km,500);
assert.equal(partialInterval[0].litresPer100Km,10);
assert.equal(partialInterval[0].spend,4000);
assert.equal(partialInterval[0].from,'2026-01-01');
assert.equal(partialInterval[0].to,'2026-01-03');
assert.equal(fuelIntervals([
  {category:'fuel',date:'2026-01-01',fullTank:true,litres:40,odometer:1000},
  {category:'fuel',date:'2026-01-02',missed:true,litres:10,odometer:1010},
  {category:'fuel',date:'2026-01-03',fullTank:true,litres:40,odometer:1100}
]).length,0);
assert.equal(fuelIntervals([
  {category:'fuel',date:'2026-01-01',fullTank:true,litres:40,odometer:1000},
  {category:'fuel',date:'2026-01-02',litres:-10,odometer:1010},
  {category:'fuel',date:'2026-01-03',fullTank:true,litres:40,odometer:1100}
]).length,0);
assert.equal(fuelIntervals([
  {category:'fuel',date:'2026-01-01',fullTank:true,litres:40,odometer:-1000},
  {category:'fuel',date:'2026-01-03',fullTank:true,litres:40,odometer:1100}
]).length,0);
assert.equal(fuelIntervals([
  {category:'fuel',date:'2026-01-01',fullTank:true,litres:40,odometer:1000},
  {category:'fuel',date:'2026-01-02',litres:10,odometer:1100},
  {category:'fuel',date:'2026-01-03',fullTank:true,litres:40,odometer:1050}
]).length,0);
const sameDateInterval=fuelIntervals([
  {category:'fuel',date:'2026-01-01',fullTank:true,litres:40,odometer:1000},
  {category:'fuel',date:'2026-01-01',fullTank:true,litres:40,odometer:1200},
  {category:'fuel',date:'2026-01-01',litres:10,odometer:1100}
]);
assert.equal(sameDateInterval.length,1);
assert.equal(sameDateInterval[0].km,200);
assert.equal(sameDateInterval[0].litres,50);
assert.deepEqual(calculateFuelFields({amount:'3000',pricePerLitre:'60',litres:''},'pricePerLitre'),{litres:'50.00'});
assert.deepEqual(calculateFuelFields({amount:'3000',pricePerLitre:'',litres:'50'},'amount'),{pricePerLitre:'60.00'});
assert.deepEqual(calculateFuelFields({amount:'',pricePerLitre:'60',litres:'50'},'litres'),{amount:'3000.00'});
assert.deepEqual(calculateFuelFields({amount:'3000',pricePerLitre:'59.99',litres:'50'},'litres'),{amount:'2999.50'});
assert.deepEqual(calculateFuelFields({amount:'3000',pricePerLitre:'60',litres:'50'},undefined),{});
assert.deepEqual(calculateFuelFields({amount:'3000',pricePerLitre:'',litres:'50'},'amount'),{pricePerLitre:'60.00'});
assert.deepEqual(calculateFuelFields({amount:'',pricePerLitre:'60',litres:'50'},'pricePerLitre'),{amount:'3000.00'});
assert.deepEqual(calculateFuelFields({amount:'0',pricePerLitre:'60',litres:''},'amount'),{litres:'0.00'});
assert.deepEqual(calculateFuelFields({amount:'3000',pricePerLitre:'0',litres:''},'pricePerLitre'),{});
assert.deepEqual(calculateFuelFields({amount:'',pricePerLitre:'',litres:'0'},'litres'),{});
assert.deepEqual(calculateFuelFields({amount:'',pricePerLitre:'60',litres:''},'litres'),{});
assert.deepEqual(calculateFuelFields({amount:'abc',pricePerLitre:'60',litres:'50'},'amount'),{});
console.log('core parser tests passed');
