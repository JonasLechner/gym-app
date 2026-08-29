export const PLATE_SIZES = [25,20,15,10,5,2.5,1.25] as const;

export type PlateCount = { weight:number; count:number };
export type PlateLoad = { total:number; perSide:number; plates:PlateCount[] };
export type PlateCalculation = { exact:PlateLoad|null; below:PlateLoad|null; above:PlateLoad|null };

const PLATE_UNITS = PLATE_SIZES.map(weight => ({ weight, units:Math.round(weight/1.25) }));

function loadFromSideUnits(sideUnits: number, barWeight: number): PlateLoad {
  let remaining=sideUnits;
  const plates:PlateCount[]=[];
  PLATE_UNITS.forEach(({weight,units})=>{
    const count=Math.floor(remaining/units);
    if(count){plates.push({weight,count});remaining-=count*units}
  });
  const perSide=sideUnits*1.25;
  return { total:barWeight+perSide*2, perSide, plates };
}

/** Calculates symmetric loading with unlimited matching plate pairs. */
export function calculatePlateLoads(targetWeight: number, barWeight: number): PlateCalculation {
  const target=Math.max(0,targetWeight);
  const bar=Math.max(0,barWeight);
  const rawSideUnits=(target-bar)/2.5;
  const rounded=Math.round(rawSideUnits);
  if(rawSideUnits>=0&&Math.abs(rawSideUnits-rounded)<1e-8){
    const exact=loadFromSideUnits(rounded,bar);
    return {exact,below:null,above:null};
  }
  const belowUnits=Math.floor(rawSideUnits);
  const aboveUnits=Math.max(0,Math.ceil(rawSideUnits));
  return {
    exact:null,
    below:belowUnits>=0?loadFromSideUnits(belowUnits,bar):null,
    above:loadFromSideUnits(aboveUnits,bar),
  };
}
