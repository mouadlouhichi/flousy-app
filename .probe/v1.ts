import { bucketOf, normalizeMonth, getUpcomingBills, carryOverDebts, debtOutstanding } from '../src/lib/store';
const cases:[string,'variable'|'fixed',string][] = [
 ['Rent','fixed','needs'],['Loyer','fixed','needs'],['إيجار','fixed','needs'],
 ['Groceries','variable','needs'],['Medicine','variable','needs'],['Médicaments','variable','needs'],
 ['Doctor','variable','needs'],['Dentist','variable','needs'],['School fees','variable','needs'],
 ['Crèche','variable','needs'],['حضانة','variable','needs'],['Electricity','variable','needs'],
 ['Baby diapers','variable','needs'],['Transport','variable','needs'],
 ['Restaurant','variable','wants'],['Gym','fixed','wants'],['Netflix','fixed','wants'],
 ['Disney+','fixed','wants'],['Shahid VIP','fixed','wants'],['Canal+','fixed','wants'],['Essence','variable','needs'],
];
let ok=0; for(const [n,k,e] of cases){const g=bucketOf(n,k as any); if(g===e)ok++; else console.log('WRONG',n,k,'->',g,'expected',e);}
console.log(`bucket accuracy ${ok}/${cases.length}`);
// due-day clamp
let missed=[]; for(let mo=0;mo<12;mo++){
 const s=new Date(Date.UTC(2026,mo,1)).toISOString().slice(0,10), e=new Date(Date.UTC(2026,mo+1,0)).toISOString().slice(0,10);
 const m=normalizeMonth({totalBudget:10000,bankPart:10000,periodStartDate:s,periodEndDate:e,fixedExpenses:[{id:'f1',name:'Rent',amount:3000,type:'Rent',date:'31st',place:'bank',status:'planned'}]} as any,`2026-${String(mo+1).padStart(2,'0')}`);
 const r=getUpcomingBills(m,40,new Date(Date.UTC(2026,mo,1))); if(r.length===0)missed.push(s.slice(0,7)); }
console.log('31st bill missing in:', missed.length?missed.join(','):'NONE (fixed)');
// debt divergence
const d={id:'d1',name:'Ali',amount:3000,type:'debt',status:'open',date:'2026-08-01',payments:[{id:'p0',amount:500,date:'2026-08-10',place:'bank'}]} as any;
let aug=normalizeMonth({totalBudget:10000,bankPart:10000,debts:[d]} as any,'2026-08');
let sep=carryOverDebts(normalizeMonth({totalBudget:10000,bankPart:10000} as any,'2026-09'),aug);
sep={...sep,debts:sep.debts!.map(x=>({...x,payments:[...(x.payments||[]),{id:'p1',amount:1000,date:'2026-09-05',place:'bank'}]}))};
// back-dated payment lands on the AUGUST original
aug={...aug,debts:aug.debts!.map(x=>({...x,payments:[...(x.payments||[]),{id:'p2',amount:300,date:'2026-08-20',place:'bank'}]}))};
const rec=carryOverDebts(sep,aug);
console.log('sep outstanding after reconcile:',debtOutstanding(rec.debts![0]),'(expected 3000-500-1000-300=1200)');
console.log('no duplicates:',rec.debts!.length===1);
