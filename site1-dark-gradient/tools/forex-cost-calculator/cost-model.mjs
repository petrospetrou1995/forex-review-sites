export function estimateCost(input){
 const {lots,pipValue,spread,commission,swap,nights,other}=input;
 for(const [key,value] of Object.entries(input))if(!Number.isFinite(value))throw new Error('Enter a valid number for '+key+'.');
 if(!(lots>0)||pipValue<0||spread<0||commission<0||other<0||!Number.isInteger(nights)||nights<0)throw new Error('Lots must be positive; costs and nights must be nonnegative, and nights a whole number.');
 const spreadCost=lots*pipValue*spread;
 const commissionCost=lots*commission*2;
 const financingCost=-swap*nights;
 const otherCost=other;
 const total=spreadCost+commissionCost+financingCost+otherCost;
 if(!Number.isFinite(total))throw new Error('Values are too large.');
 return {spreadCost,commissionCost,financingCost,otherCost,total};
}
