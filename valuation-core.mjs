const finite=(...a)=>a.every(Number.isFinite);
export function dcf({fcf,growth,discount,terminalGrowth,cash,debt,shares,years=5}){
 if(!finite(fcf,growth,discount,terminalGrowth,cash,debt,shares,years)||fcf<=0||growth<=-1||discount<=0||discount>=1||terminalGrowth<=-1||terminalGrowth>=discount||cash<0||debt<0||shares<=0||!Number.isInteger(years)||years<1||years>20)throw Error('Use positive normalized FCFF and shares; nonnegative cash/debt; a discount rate above terminal growth; and finite assumptions.');
 const flows=Array.from({length:years},(_,i)=>fcf*(1+growth)**(i+1)),pv=flows.reduce((s,v,i)=>s+v/(1+discount)**(i+1),0),terminal=flows.at(-1)*(1+terminalGrowth)/(discount-terminalGrowth),terminalPV=terminal/(1+discount)**years,enterprise=pv+terminalPV,equity=enterprise+cash-debt;
 return {flows,enterprise,equity,perShare:equity/shares,terminalShare:terminalPV/enterprise};
}
export function ddm({dividend,growth,discount}){if(!finite(dividend,growth,discount)||dividend<=0||growth<=-1||discount<=0||discount>=1||growth>=discount)throw Error('DDM needs a positive sustainable annual dividend and an equity discount rate above dividend growth.');return dividend*(1+growth)/(discount-growth);}
export function sensitivity(assumptions){return [-.01,0,.01].map(dr=>[-.005,0,.005].map(dg=>{try{return dcf({...assumptions,discount:assumptions.discount+dr,terminalGrowth:assumptions.terminalGrowth+dg}).perShare;}catch{return null;}}));}
