class AppError extends Error { constructor(message,status=400){super(message);this.status=status;} }
const emptyState=()=>({schema:1,people:[],receipts:[],expenses:[],audit:[],settings:{weddingDate:'2026-11-14',referenceAsOf:'2024-10-28',referenceSummaryIncome:null}});
const id=()=>crypto.randomUUID();
const assert=(ok,msg)=>{if(!ok)throw new AppError(msg);};
const text=(s,max=500)=>typeof s==='string'&&s.length<=max;
function validDate(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;}
const validAmount=n=>Number.isSafeInteger(n)&&n>0;
function validateState(s){
 assert(s&&s.schema===1&&Array.isArray(s.people)&&Array.isArray(s.receipts)&&Array.isArray(s.expenses)&&Array.isArray(s.audit),'지원하지 않는 백업 형식입니다.');
 assert(s.people.length<=20000&&s.receipts.length<=100000&&s.audit.length<=200000,'백업 데이터가 너무 큽니다.');
 const ids=new Set(),refs=new Set();
 for(const p of s.people){assert(text(p.id,100)&&p.id&&!ids.has(p.id),'명단 ID가 중복되거나 잘못되었습니다.');ids.add(p.id);assert(text(p.name,100)&&p.name.trim()&&text(p.group,100)&&p.group.trim(),'이름과 그룹을 확인해 주세요.');if(p.reference){const r=p.reference;assert(Number.isSafeInteger(r.originalNo)&&r.originalNo>0&&!refs.has(r.originalNo)&&validAmount(r.amount)&&text(r.name,100)&&text(r.group,100),'과거 원본 연결을 확인해 주세요.');refs.add(r.originalNo);}}
 const receiptIds=new Set();let sum=0;
 for(const r of s.receipts){assert(text(r.id,100)&&r.id&&!receiptIds.has(r.id)&&ids.has(r.personId)&&validAmount(r.amount)&&validDate(r.date)&&['봉투','계좌','카드','기타'].includes(r.method)&&text(r.note??'',500),'입금 기록의 ID·명단·금액·날짜·방법을 확인해 주세요.');assert(!r.cancelled||r.cancelled===true,'입금 취소 상태를 확인해 주세요.');receiptIds.add(r.id);if(!r.cancelled)sum+=r.amount;}
 assert(Number.isSafeInteger(sum),'총액이 허용 범위를 벗어났습니다.');
 const expenseIds=new Set();for(const x of s.expenses){assert(text(x.id,100)&&x.id&&!expenseIds.has(x.id)&&['taehyun','haein'].includes(x.event)&&['plan','actual'].includes(x.kind)&&validAmount(x.amount)&&text(x.category,100)&&x.category.trim()&&(!x.date||validDate(x.date))&&(!x.cancelled||x.cancelled===true),'비용 기록을 확인해 주세요.');expenseIds.add(x.id);}
 assert(s.settings&&validDate(s.settings.weddingDate)&&validDate(s.settings.referenceAsOf)&&(s.settings.referenceSummaryIncome===null||validAmount(s.settings.referenceSummaryIncome)),'행사와 원본 정보를 확인해 주세요.');
 for(const a of s.audit)assert(a&&text(a.operationId,100)&&a.operationId&&text(a.actor,250)&&text(a.action,100)&&text(a.at,100),'수정 이력 형식을 확인해 주세요.');
 return s;
}
function stats(s){const active=s.receipts.filter(r=>!r.cancelled),paid=new Set(active.map(r=>r.personId));return {total:active.reduce((a,r)=>a+r.amount,0),transactions:active.length,paid:paid.size,unrecorded:s.people.length-paid.size,reference:s.people.reduce((a,p)=>a+(p.reference?.amount||0),0)};}
const personTotal=(s,pid)=>s.receipts.filter(r=>r.personId===pid&&!r.cancelled).reduce((a,r)=>a+r.amount,0);
function applyOperation(state,op,actor,at=new Date().toISOString()){
 validateState(state);assert(op&&text(op.id,100)&&op.id&&text(op.type,100),'저장 요청 ID가 필요합니다.');
 const signature=JSON.stringify({type:op.type,body:op.body||{}}),previous=state.audit.find(a=>a.operationId===op.id);
 if(previous){if(previous.signature&&previous.signature!==signature)throw new AppError('같은 요청 ID의 내용이 변경되었습니다. 새 저장 요청으로 다시 시도해 주세요.',409);return {state,replayed:true};}
 const s=structuredClone(state),b=structuredClone(op.body||{});let before=null,after=null;
 const person=pid=>s.people.find(p=>p.id===pid);
 const payment=b=>{assert(person(b.personId),'명단을 선택해 주세요.');assert(validAmount(b.amount),'금액은 0원보다 큰 원 단위 정수여야 합니다.');assert(validDate(b.date),'입금일을 확인해 주세요.');assert(['봉투','계좌','카드','기타'].includes(b.method),'입금방법을 확인해 주세요.');assert(text(b.note??'',500),'메모는 500자 이내로 입력해 주세요.');return {personId:b.personId,amount:b.amount,date:b.date,method:b.method,note:b.note||''};};
 if(op.type==='addReceipt'){
  if(b.newPerson){const n=b.newPerson;assert(text(n.name,100)&&n.name.trim()&&text(n.group,100)&&n.group.trim()&&text(n.id,100)&&n.id,'새 명단의 이름과 그룹을 확인해 주세요.');assert(!person(n.id),'명단 ID가 이미 있습니다.');assert(!s.people.some(p=>p.name.replace(/\s/g,'')===n.name.replace(/\s/g,'')&&p.group===n.group),'같은 이름과 그룹의 명단이 있습니다. 기존 명단을 선택해 주세요.');s.people.push({id:n.id,name:n.name.trim(),group:n.group.trim(),invitation:'unknown',reference:null});b.personId=n.id;}
  const r=payment(b);assert(text(b.receiptId,100)&&b.receiptId&&!s.receipts.some(x=>x.id===b.receiptId),'입금 기록 ID가 이미 있습니다.');
  const same=s.receipts.find(x=>!x.cancelled&&x.personId===r.personId&&x.amount===r.amount&&x.date===r.date&&x.method===r.method);
  if(same&&!b.confirmSeparate)throw new AppError('같은 명단·날짜·금액·방법의 입금이 있습니다. 별도 추가 입금인지 확인해 주세요.',409);
  if(same)assert(text(b.reason,300)&&b.reason.trim(),'별도 입금 사유를 입력해 주세요.');
  after={id:b.receiptId,...r,cancelled:false,createdAt:at,createdBy:actor};s.receipts.push(after);
 }else if(op.type==='editReceipt'){
  const r=s.receipts.find(x=>x.id===b.receiptId);assert(r&&!r.cancelled,'수정할 유효 입금 기록을 찾을 수 없습니다.');assert(text(b.reason,300)&&b.reason.trim(),'수정 사유를 입력해 주세요.');before=structuredClone(r);const changes=payment({...b,personId:r.personId});Object.assign(r,changes,{updatedAt:at,updatedBy:actor});after=structuredClone(r);
 }else if(op.type==='cancelReceipt'){
  const r=s.receipts.find(x=>x.id===b.receiptId);assert(r&&!r.cancelled,'취소할 입금 기록을 찾을 수 없습니다.');assert(text(b.reason,300)&&b.reason.trim(),'취소 사유를 입력해 주세요.');before=structuredClone(r);Object.assign(r,{cancelled:true,cancelledAt:at,cancelledBy:actor});after=structuredClone(r);
 }else if(op.type==='addExpense'){
  assert(validAmount(b.amount)&&text(b.category,100)&&b.category.trim()&&['plan','actual'].includes(b.kind)&&validDate(b.date),'비용 항목·금액·계획/실적·날짜를 확인해 주세요.');assert(text(b.expenseId,100)&&b.expenseId&&!s.expenses.some(x=>x.id===b.expenseId),'비용 ID가 이미 있습니다.');after={id:b.expenseId,event:'taehyun',kind:b.kind,category:b.category.trim(),amount:b.amount,date:b.date,createdAt:at,createdBy:actor};s.expenses.push(after);
 }else if(op.type==='editExpense'||op.type==='cancelExpense'){
  const x=s.expenses.find(x=>x.id===b.expenseId&&x.event==='taehyun'&&!x.cancelled);assert(x,'수정할 현재 행사 비용을 찾을 수 없습니다.');assert(text(b.reason,300)&&b.reason.trim(),'비용 수정·취소 사유를 입력해 주세요.');before=structuredClone(x);
  if(op.type==='editExpense'){assert(validAmount(b.amount)&&text(b.category,100)&&b.category.trim()&&['plan','actual'].includes(b.kind)&&validDate(b.date),'비용 항목·금액·계획/실적·날짜를 확인해 주세요.');Object.assign(x,{amount:b.amount,category:b.category.trim(),kind:b.kind,date:b.date,updatedAt:at,updatedBy:actor});}
  else Object.assign(x,{cancelled:true,cancelledAt:at,cancelledBy:actor});after=structuredClone(x);
 }else if(op.type==='setInvitation'){
  const p=person(b.personId);assert(p&&['unknown','sent','notSent'].includes(b.value),'청첩 상태를 확인해 주세요.');before={personId:p.id,value:p.invitation};p.invitation=b.value;after={personId:p.id,value:p.invitation};
 }else throw new AppError('지원하지 않는 저장 요청입니다.');
 s.audit.push({operationId:op.id,signature,action:op.type,actor,at,reason:b.reason||'',before,after});validateState(s);return {state:s,replayed:false};
}

