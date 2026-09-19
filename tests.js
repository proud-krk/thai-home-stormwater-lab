const assert=require('assert');
const {compute,setLanguage,RAINFALL_PRESETS}=require('./dist/stormwater-lab-v3.js');
const close=(a,b,msg)=>assert.ok(Math.abs(a-b)<1e-6,msg||`${a} != ${b}`);
const base=()=>({lang:'th',preset:'custom',siteArea:400,rainfall:100,duration:1,returnPeriod:0,alloc:{roof:35,hard:25,garden:30,permeable:10},enabled:{tank:false,rainGarden:false,paving:false,detention:false,greenRoof:false},tank:{capacity:5000,catchment:100,availabilityMode:'100',availablePct:100},rainGarden:{area:10,catchment:80,roof:true,hard:true},paving:{area:20},detention:{capacity:3000,catchment:80,source:'hard'},greenRoof:{area:20}});
const closure=r=>close(r.total,r.infiltrated+r.captured+r.retained+r.detained+r.leaving,'water balance does not close');

assert.deepEqual(RAINFALL_PRESETS.standard,{depth:58.7,duration:1,returnPeriod:2});
assert.deepEqual(RAINFALL_PRESETS.heavy,{depth:76,duration:1,returnPeriod:5});

// 1 m² × 1 mm = 1 L
let s=base();s.siteArea=1;s.rainfall=1;s.alloc={roof:100,hard:0,garden:0,permeable:0};let r=compute(s);close(r.total,1);closure(r);

// Baseline land-cover extremes and rainfall conservation
for(const key of ['roof','garden','hard']){s=base();s.alloc={roof:0,hard:0,garden:0,permeable:0};s.alloc[key]=100;r=compute(s);assert.equal(r.valid,true);closure(r);if(key==='garden')close(r.leaving,39000);else close(r.leaving,40000)}
s=base();s.rainfall=0;r=compute(s);close(r.total,0);closure(r);

// Tank available storage: 100%, 50%, 0%, and tank larger than inflow
for(const [pct,expected] of [[100,5000],[50,2500],[0,0]]){s=base();s.siteArea=100;s.alloc={roof:100,hard:0,garden:0,permeable:0};s.enabled.tank=true;s.tank={capacity:5000,catchment:100,availabilityMode:'custom',availablePct:pct};r=compute(s);close(r.captured,expected);close(r.details.tank.overflow,10000-expected);closure(r)}
s=base();s.siteArea=100;s.alloc={roof:100,hard:0,garden:0,permeable:0};s.enabled.tank=true;s.tank={capacity:50000,catchment:100,availabilityMode:'100',availablePct:100};r=compute(s);close(r.captured,10000);close(r.details.tank.overflow,0);closure(r);

// Rain Garden alone: media intake, native-soil infiltration, temporary event retention and overflow
s=base();s.alloc={roof:50,hard:0,garden:50,permeable:0};s.enabled.rainGarden=true;s.rainGarden={area:10,catchment:50,roof:true,hard:false};r=compute(s);assert.ok(r.details.rainGarden.input>0);assert.ok(r.details.rainGarden.infiltrated>0);assert.ok(r.details.rainGarden.stored>0);close(r.details.rainGarden.drainage,0);assert.ok(r.details.rainGarden.overflow>0);closure(r);

// Permeable Pavement alone
s=base();s.alloc={roof:0,hard:100,garden:0,permeable:0};s.enabled.paving=true;s.paving.area=40;r=compute(s);close(r.details.paving.infiltrated,100);close(r.details.paving.stored,3900);close(r.details.paving.overflow,0);closure(r);

// Green Roof alone
s=base();s.alloc={roof:100,hard:0,garden:0,permeable:0};s.enabled.greenRoof=true;s.greenRoof.area=20;r=compute(s);close(r.details.greenRoof.stored,918);assert.ok(r.details.greenRoof.drainage>0);closure(r);

// Detention alone: storage is separate and still closes the event balance
s=base();s.alloc={roof:0,hard:100,garden:0,permeable:0};s.enabled.detention=true;s.detention={capacity:3000,catchment:50,source:'hard'};r=compute(s);close(r.detained,3000);close(r.leaving,37000);closure(r);

// All five measures together and no source-area double counting
s=base();Object.keys(s.enabled).forEach(k=>s.enabled[k]=true);s.detention.source='roof';r=compute(s);closure(r);assert.ok(r.details.tank.area+r.details.rainGarden.sourceRoof+r.details.detention.area<=r.roof-r.details.greenRoof.area+1e-6);assert.ok(r.details.rainGarden.sourceHard<=r.hard-r.details.paving.area+1e-6);

// Entries above source areas are capped
s=base();Object.keys(s.enabled).forEach(k=>s.enabled[k]=true);s.tank.catchment=9999;s.rainGarden.area=9999;s.rainGarden.catchment=9999;s.paving.area=9999;s.greenRoof.area=9999;s.detention.catchment=9999;r=compute(s);close(r.details.greenRoof.area,r.roof);close(r.details.paving.area,r.hard);close(r.details.rainGarden.area,r.garden);close(r.details.tank.area,0);close(r.details.detention.area,0);closure(r);

// Invalid allocation does not produce a valid result
s=base();s.alloc.roof=34;r=compute(s);assert.equal(r.valid,false);

// TH/EN switching changes language only; all inputs and calculated results remain the same
s=base();Object.keys(s.enabled).forEach(k=>s.enabled[k]=true);const before=compute(s);const snapshot=JSON.stringify({...s,lang:undefined});setLanguage(s,'en');const after=compute(s);assert.equal(s.lang,'en');assert.equal(JSON.stringify({...s,lang:undefined}),snapshot);close(before.leaving,after.leaving);closure(after);setLanguage(s,'th');assert.equal(s.lang,'th');

console.log('All event water-balance and interaction-state tests passed.');
