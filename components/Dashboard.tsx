"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar
} from "recharts";
import Kpi from "./Kpi";
import UploadPanel from "./UploadPanel";
import {
  SaleRow, money, dateOnlyFilter, productFilter, metrics, filteredMetrics, groupBy,
  variants, daily, comparePeriods, pct
} from "@/lib/analytics";

type Tab = "Overview"|"Products"|"Colors"|"Sizes"|"Variants"|"Discounts"|"Trends";

function SelectMulti({label,values,selected,setSelected}:{label:string,values:string[],selected:string[],setSelected:(x:string[])=>void}) {
  return <label className="filterLabel">{label}
    <select multiple value={selected} onChange={e=>setSelected(Array.from(e.target.selectedOptions).map(o=>o.value))}>
      {values.map(v=><option key={v} value={v}>{v}</option>)}
    </select>
    {selected.length>0 && <button className="clearLink" onClick={(e)=>{e.preventDefault();setSelected([])}}>Clear ({selected.length})</button>}
  </label>;
}

function DataTable({rows,columns}:{rows:any[],columns:{key:string,label:string,format?:(v:any)=>string}[]}) {
  return <div className="tableWrap"><table><thead><tr>{columns.map(c=><th key={c.key}>{c.label}</th>)}</tr></thead>
    <tbody>{rows.map((r,i)=><tr key={i}>{columns.map(c=><td key={c.key}>{c.format?c.format(r[c.key]):r[c.key]}</td>)}</tr>)}</tbody>
  </table></div>;
}

export default function Dashboard() {
  const [rows,setRows]=useState<SaleRow[]>([]);
  const [uploads,setUploads]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState<Tab>("Overview");
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");
  const [products,setProducts]=useState<string[]>([]);
  const [colors,setColors]=useState<string[]>([]);
  const [sizes,setSizes]=useState<string[]>([]);
  const [productSort,setProductSort]=useState<"units"|"revenue"|"alpha">("units");
  const [productDirection,setProductDirection]=useState<"desc"|"asc">("desc");

  async function load() {
    setLoading(true);
    const r=await fetch("/api/data",{cache:"no-store"});
    const j=await r.json();
    if(r.ok) {
      setRows((j.rows||[]).map((x:any)=>({...x,qty:Number(x.qty),line_count:Number(x.line_count),revenue:Number(x.revenue)})));
      setUploads(j.uploads||[]);
    }
    setLoading(false);
  }
  useEffect(()=>{load()},[]);

  const dates=useMemo(()=>[...new Set(rows.map(r=>r.report_date))].sort(),[rows]);
  useEffect(()=>{
    if(dates.length && !from){setFrom(dates[0]);setTo(dates[dates.length-1]);}
  },[dates,from]);

  const productRowsAll=useMemo(()=>rows.filter(r=>r.row_type==="product"),[rows]);
  const productOptions=useMemo(()=>[...new Set(productRowsAll.map(r=>r.product||"").filter(Boolean))].sort(),[productRowsAll]);
  const colorOptions=useMemo(()=>[...new Set(productRowsAll.map(r=>r.color||"").filter(Boolean))].sort(),[productRowsAll]);
  const sizeOptions=useMemo(()=>[...new Set(productRowsAll.map(r=>r.size||"").filter(Boolean))].sort(),[productRowsAll]);

  const periodRows=useMemo(()=>from&&to?dateOnlyFilter(rows,from,to):[],[rows,from,to]);
  const period=useMemo(()=>metrics(periodRows),[periodRows]);
  const filtered=useMemo(()=>productFilter(rows,{from,to,products,colors,sizes}),[rows,from,to,products,colors,sizes]);
  const fm=useMemo(()=>filteredMetrics(filtered,period.orders),[filtered,period.orders]);

  const productPerf=useMemo(()=>groupBy(filtered,"product").sort((a,b)=>b.units-a.units),[filtered]);
  const colorPerf=useMemo(()=>groupBy(filtered,"color").sort((a,b)=>b.units-a.units),[filtered]);
  const sizePerf=useMemo(()=>groupBy(filtered,"size").sort((a,b)=>b.units-a.units),[filtered]);
  const variantPerf=useMemo(()=>variants(filtered).sort((a,b)=>b.units-a.units),[filtered]);
  const distinctColors=useMemo(()=>new Set(filtered.map(r=>r.color).filter(Boolean)).size,[filtered]);
  const distinctSizes=useMemo(()=>new Set(filtered.map(r=>r.size).filter(Boolean)).size,[filtered]);
  const distinctVariants=useMemo(()=>new Set(filtered.map(r=>`${r.product||""}|||${r.color||""}|||${r.size||""}`)).size,[filtered]);

  const sortedProductPerf=useMemo(()=>{
    const arr=[...productPerf];
    arr.sort((a,b)=>{
      let cmp=0;
      if(productSort==="units") cmp=a.units-b.units;
      else if(productSort==="revenue") cmp=a.revenue-b.revenue;
      else cmp=a.name.localeCompare(b.name,"nb");
      return productDirection==="desc" ? -cmp : cmp;
    });
    return arr;
  },[productPerf,productSort,productDirection]);

  const trend=useMemo(()=>daily(periodRows),[periodRows]);
  const comp=useMemo(()=>to?comparePeriods(rows,from,to):null,[rows,from,to]);

  function exportProducts() {
    const summary=productPerf.map(x=>({
      Product:x.name, Units:x.units, Omsetning:x.revenue, "Omsetning/unit":x.revenuePerUnit, Lines:x.lines
    }));
    const details=variantPerf.map(x=>({
      Product:x.product, Color:x.color, Size:x.size, Units:x.units, Omsetning:x.revenue, "Omsetning/unit":x.revenuePerUnit, Lines:x.lines
    }));
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(summary),"Product summary");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(details),"Product details");
    XLSX.writeFile(wb,`Lillelam_Product_Details_${from}_${to}.xlsx`);
  }

  if(loading) return <main className="loading">Loading Lillelam Sales Analytics…</main>;
  if(!rows.length) return <main className="shell"><header><h1>Lillelam Sales Analytics</h1></header><UploadPanel uploads={uploads} onChanged={load}/><div className="empty">No data yet. Open <b>Admin / Import</b> and upload the first Odoo Excel report.</div></main>;

  const topCols=[
    {key:"name",label:"Product"},{key:"units",label:"Units"},{key:"revenue",label:"Omsetning",format:money},{key:"revenuePerUnit",label:"Omsetning/unit",format:money}
  ];
  const slow=[...productPerf].filter(x=>x.units>0).sort((a,b)=>a.units-b.units||a.revenue-b.revenue).slice(0,10);
  const discountRows=periodRows.filter(r=>r.row_type==="discount");
  const discountQty=discountRows.reduce((a,r)=>a+r.qty,0);
  const discountLines=discountRows.reduce((a,r)=>a+r.line_count,0);

  function TabKpis({primaryLabel,primaryValue}:{primaryLabel:string,primaryValue:number}) {
    return <section className="filteredKpis">
      <Kpi label={primaryLabel} value={String(primaryValue)}/>
      <Kpi label="Units sold" value={String(fm.units)}/>
      <Kpi label="Avg. units / order" value={fm.avgUnitsOrder.toFixed(2)}/>
      <Kpi label="Omsetning" value={money(fm.revenue)}/>
      <Kpi label="Omsetning / unit" value={money(fm.revenuePerUnit)}/>
    </section>;
  }

  return <main className="shell">
    <header className="topHeader">
      <div><div className="eyebrow">LILLELAM</div><h1>Sales Analytics</h1><p>Odoo daily sales performance</p></div>
      <UploadPanel uploads={uploads} onChanged={load}/>
    </header>

    <section className="globalKpis">
      <Kpi label="Omsetning ex. VAT" value={money(period.revenue)}/>
      <Kpi label="Orders" value={String(period.orders)}/>
      <Kpi label="Products" value={String(period.products)}/>
      <Kpi label="Units sold" value={String(period.units)}/>
      <Kpi label="AOV" value={money(period.aov)}/>
      <Kpi label="Avg. units / order" value={period.avgUnitsOrder.toFixed(2)}/>
      <Kpi label="Discount" value={money(period.discount)}/>
      <Kpi label="Discount share" value={(period.discountShare*100).toFixed(1)+"%"}/>
    </section>
    <div className="globalNote">These top figures follow the selected <b>date range only</b>. Product, color and size filters change the analysis below.</div>

    <div className="layout">
      <aside className="filters">
        <h3>Filters</h3>
        <label className="filterLabel">From<input type="date" value={from} min={dates[0]} max={to} onChange={e=>setFrom(e.target.value)}/></label>
        <label className="filterLabel">To<input type="date" value={to} min={from} max={dates[dates.length-1]} onChange={e=>setTo(e.target.value)}/></label>
        <SelectMulti label="Product" values={productOptions} selected={products} setSelected={setProducts}/>
        <SelectMulti label="Color" values={colorOptions} selected={colors} setSelected={setColors}/>
        <SelectMulti label="Size" values={sizeOptions} selected={sizes} setSelected={setSizes}/>
        {(products.length||colors.length||sizes.length)?<button className="secondary full" onClick={()=>{setProducts([]);setColors([]);setSizes([])}}>Reset product filters</button>:null}
      </aside>

      <section className="content">
        <nav className="tabs">
          {(["Overview","Products","Colors","Sizes","Variants","Discounts","Trends"] as Tab[]).map(t=><button key={t} className={tab===t?"active":""} onClick={()=>setTab(t)}>{t}</button>)}
        </nav>


        {tab==="Overview" && <>
          <TabKpis primaryLabel="Products" primaryValue={fm.products}/>
          <h2>Period comparison</h2>
          {comp && <div className="comparisonGrid">
            {[
              ["Today vs yesterday",comp.today],
              ["WoW – last 7 days",comp.wow],
              ["MoM – month to date",comp.mom],
              ["YTD vs last year",comp.ytd]
            ].map(([label,c]:any)=><div className="compareCard" key={label}>
              <h3>{label}</h3>
              <Kpi label="Omsetning" value={money(c.current.revenue)} delta={pct(c.current.revenue,c.previous.revenue)}/>
              <div className="miniCompare"><span>Orders <b>{c.current.orders}</b></span><span className={pct(c.current.orders,c.previous.orders)>=0?"green":"red"}>{pct(c.current.orders,c.previous.orders).toFixed(1)}%</span></div>
              <div className="miniCompare"><span>Units <b>{c.current.units}</b></span><span className={pct(c.current.units,c.previous.units)>=0?"green":"red"}>{pct(c.current.units,c.previous.units).toFixed(1)}%</span></div>
            </div>)}
          </div>}

          <div className="twoCol">
            <div className="panel"><h2>Bestsellers</h2><DataTable rows={productPerf.slice(0,10)} columns={topCols}/></div>
            <div className="panel"><h2>Slow movers <small>among products sold</small></h2><DataTable rows={slow} columns={topCols}/></div>
          </div>

          <div className="panel"><h2>Sales trend</h2><div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis/><Tooltip formatter={(v:any)=>money(Number(v))}/><Line type="monotone" dataKey="revenue" stroke="currentColor" strokeWidth={2} dot={false}/></LineChart>
            </ResponsiveContainer>
          </div></div>
        </>}

        {tab==="Products" && <>
          <TabKpis primaryLabel="Products" primaryValue={fm.products}/>

          <div className="sectionHead">
            <div><h2>Products</h2><p>All product performance for the active filters.</p></div>
            <button onClick={exportProducts}>Export Product details (.xlsx)</button>
          </div>
          <DataTable rows={productPerf} columns={topCols}/>

          <div className="detailsHeader">
            <div>
              <h2>Product details</h2>
              <p>Open a product to see color, size, units and revenue.</p>
            </div>
            <div className="sortControls">
              <label>Sort product details by
                <select value={productSort} onChange={e=>setProductSort(e.target.value as any)}>
                  <option value="units">Units</option>
                  <option value="revenue">Omsetning</option>
                  <option value="alpha">Product</option>
                </select>
              </label>
              <label>Direction
                <select value={productDirection} onChange={e=>setProductDirection(e.target.value as any)}>
                  <option value="desc">{productSort==="alpha"?"Z–A":"Highest first"}</option>
                  <option value="asc">{productSort==="alpha"?"A–Z":"Lowest first"}</option>
                </select>
              </label>
            </div>
          </div>

          <div className="productAccordions">
            {sortedProductPerf.map(p=>{
              const details=variantPerf
                .filter(v=>v.product===p.name)
                .sort((a,b)=>b.units-a.units || b.revenue-a.revenue);
              return <details className="productDetail" key={p.name}>
                <summary>
                  <span>{p.name}</span>
                  <span className="summaryStats">{p.units} units • {money(p.revenue)}</span>
                </summary>
                <div className="detailBody">
                  <DataTable rows={details} columns={[
                    {key:"color",label:"Color"},
                    {key:"size",label:"Size"},
                    {key:"units",label:"Units"},
                    {key:"revenue",label:"Omsetning",format:money},
                    {key:"revenuePerUnit",label:"Omsetning/unit",format:money}
                  ]}/>
                </div>
              </details>
            })}
          </div>
        </>}

        {tab==="Colors" && <>
          <TabKpis primaryLabel="Colors" primaryValue={distinctColors}/>
          <h2>Color performance</h2>
          <div className="twoCol">
            <div className="panel"><DataTable rows={colorPerf} columns={[{key:"name",label:"Color"},{key:"units",label:"Units"},{key:"revenue",label:"Omsetning",format:money},{key:"revenuePerUnit",label:"Omsetning/unit",format:money}]}/></div>
            <div className="panel chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={colorPerf.slice(0,15)}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name" hide/><YAxis/><Tooltip/><Bar dataKey="units" fill="currentColor"/></BarChart></ResponsiveContainer></div>
          </div>
        </>}

        {tab==="Sizes" && <>
          <TabKpis primaryLabel="Sizes" primaryValue={distinctSizes}/>
          <h2>Size performance</h2>
          <div className="twoCol">
            <div className="panel"><DataTable rows={sizePerf} columns={[{key:"name",label:"Size"},{key:"units",label:"Units"},{key:"revenue",label:"Omsetning",format:money},{key:"revenuePerUnit",label:"Omsetning/unit",format:money}]}/></div>
            <div className="panel chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={sizePerf.slice(0,20)}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name"/><YAxis/><Tooltip/><Bar dataKey="units" fill="currentColor"/></BarChart></ResponsiveContainer></div>
          </div>
        </>}

        {tab==="Variants" && <>
          <TabKpis primaryLabel="Variants" primaryValue={distinctVariants}/>
          <h2>Product × color × size</h2>
          <DataTable rows={variantPerf} columns={[
            {key:"product",label:"Product"},{key:"color",label:"Color"},{key:"size",label:"Size"},
            {key:"units",label:"Units"},{key:"lines",label:"Antall"},{key:"revenue",label:"Omsetning",format:money},{key:"revenuePerUnit",label:"Omsetning/unit",format:money}
          ]}/>
        </>}

        {tab==="Discounts" && <>
          <section className="filteredKpis">
            <Kpi label="Total discount" value={money(period.discount)}/>
            <Kpi label="Discount share" value={(period.discountShare*100).toFixed(1)+"%"}/>
            <Kpi label="Discount quantity (Antall bestilt)" value={String(discountQty)}/>
            <Kpi label="Discount lines (Antall)" value={String(discountLines)}/>
          </section>
          <div className="info">The Odoo pivot exports discount as a separate WooCommerce Discount Product. It does not link that aggregated discount line to an exact physical product/color/size.</div>
          <h2>Daily discount trend</h2>
          <DataTable rows={trend} columns={[{key:"date",label:"Date"},{key:"discount",label:"Discount",format:money},{key:"revenue",label:"Omsetning",format:money}]}/>
        </>}

        {tab==="Trends" && <>
          <TabKpis primaryLabel="Days" primaryValue={trend.length}/>
          <h2>Daily trends</h2>
          <div className="panel"><h3>Revenue</h3><div className="chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis/><Tooltip formatter={(v:any)=>money(Number(v))}/><Line dataKey="revenue" stroke="currentColor" strokeWidth={2}/></LineChart></ResponsiveContainer></div></div>
          <div className="twoCol">
            <div className="panel"><h3>Units</h3><div className="chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis/><Tooltip/><Line dataKey="units" stroke="currentColor" strokeWidth={2}/></LineChart></ResponsiveContainer></div></div>
            <div className="panel"><h3>Orders</h3><div className="chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis/><Tooltip/><Line dataKey="orders" stroke="currentColor" strokeWidth={2}/></LineChart></ResponsiveContainer></div></div>
          </div>
        </>}
      </section>
    </div>
  </main>;
}
