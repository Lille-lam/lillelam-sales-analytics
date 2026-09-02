export default function Kpi({label,value,delta}:{label:string,value:string,delta?:number|null}) {
  return <div className="kpi">
    <div className="kpiLabel">{label}</div>
    <div className="kpiValue">{value}</div>
    {delta!==undefined && delta!==null && <div className={"delta "+(delta>0?"up":delta<0?"down":"")}>
      {delta>0?"+":""}{delta.toFixed(1)}%
    </div>}
  </div>;
}
