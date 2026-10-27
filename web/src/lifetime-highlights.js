const rows = (value) => Array.isArray(value) ? value : [];
const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
const maxRow = (items, field) => rows(items).filter((row)=>finite(row?.[field])).sort((a,b)=>Number(b[field])-Number(a[field]))[0] || null;

export function bestZeroToHundredSeconds(time, speed, start = 0, end = Math.min(time?.length || 0, speed?.length || 0)) {
  let candidate = null, previousTime = null, previousSpeed = null, best = Infinity;
  for (let index = start; index < end; index++) {
    const timestamp=Number(time[index]), velocity=Number(speed[index]);
    if (!Number.isFinite(timestamp) || !Number.isFinite(velocity)) continue;
    if (previousTime != null && (timestamp <= previousTime || timestamp - previousTime > 3)) candidate=null;
    if (velocity <= 5) candidate={timestamp,velocity};
    if (candidate && velocity >= 100 && timestamp > candidate.timestamp) {
      const crossing = previousTime != null && previousSpeed < 100 && velocity !== previousSpeed
        ? previousTime + (100-previousSpeed)/(velocity-previousSpeed)*(timestamp-previousTime)
        : timestamp;
      const duration=crossing-candidate.timestamp;
      if (duration >= 2 && duration <= 30) best=Math.min(best,duration);
      candidate=null;
    }
    previousTime=timestamp;previousSpeed=velocity;
  }
  return Number.isFinite(best) ? Math.round(best*100)/100 : null;
}

export function buildLifetimeHighlights(data = {}) {
  const trips=rows(data.trips),journeys=rows(data.journeys),charges=rows(data.charges);
  const fastest=maxRow(trips,"maxSpeedKmh"),power=maxRow(trips,"peakDrivePowerKw"),distance=maxRow(journeys,"distanceKm"),duration=maxRow(journeys,"durationMinutes"),acceleration=maxRow(trips,"maxAccelerationG"),braking=maxRow(trips,"maxBrakingG"),cornering=maxRow(trips,"maxLateralG"),sprint=trips.filter((row)=>finite(row.zeroToHundredSeconds)).sort((a,b)=>Number(a.zeroToHundredSeconds)-Number(b.zeroToHundredSeconds))[0]||null,charge=maxRow(charges,"maxPowerKw");
  return { fastest,power,distance,duration,acceleration,braking,cornering,sprint,charge,totalDistanceKm:trips.reduce((total,row)=>total+(Number(row.distanceKm)||0),0),totalRegeneratedKwh:trips.reduce((total,row)=>total+(Number(row.regeneratedKwh)||0),0) };
}

function roundedRect(context,x,y,width,height,radius){context.beginPath();context.roundRect(x,y,width,height,radius);context.fill();}
function download(blob,name){const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

export async function downloadLifetimeHighlightsCard({ title, subtitle, metrics, note }) {
  const canvas=document.createElement("canvas");canvas.width=1600;canvas.height=1000;const ctx=canvas.getContext("2d");
  const background=ctx.createLinearGradient(0,0,1600,1000);background.addColorStop(0,"#06191d");background.addColorStop(.58,"#0a2426");background.addColorStop(1,"#12342f");ctx.fillStyle=background;ctx.fillRect(0,0,1600,1000);
  ctx.fillStyle="rgba(57,196,154,.12)";ctx.beginPath();ctx.arc(1370,120,340,0,Math.PI*2);ctx.fill();ctx.fillStyle="#45c99a";ctx.font="700 20px Arial";ctx.fillText("XPENG ANALYTICS · LIFETIME HIGHLIGHTS",82,82);
  ctx.fillStyle="#f2f7f6";ctx.font="700 58px Arial";ctx.fillText(title,82,158);ctx.fillStyle="#9bb4b5";ctx.font="400 22px Arial";ctx.fillText(subtitle,82,202);
  const source=rows(metrics).slice(0,10),columns=2,gap=20,width=708,height=126,startY=262;
  source.forEach((metric,index)=>{const column=index%columns,row=Math.floor(index/columns),x=82+column*(width+gap),y=startY+row*(height+gap);ctx.fillStyle="rgba(255,255,255,.065)";roundedRect(ctx,x,y,width,height,18);ctx.fillStyle=index<2?"#45c99a":"#91a9aa";ctx.font="700 15px Arial";ctx.fillText(String(metric.label||"").toUpperCase(),x+24,y+34);ctx.fillStyle="#f5f8f7";ctx.font="700 36px Arial";ctx.fillText(String(metric.value||"—"),x+24,y+79);if(metric.note){ctx.fillStyle="#8ca4a6";ctx.font="400 14px Arial";ctx.fillText(String(metric.note),x+24,y+105);}});
  ctx.fillStyle="#81999b";ctx.font="400 15px Arial";ctx.fillText(note||"Calculated locally from the available XPENG data.",82,958);ctx.fillStyle="#45c99a";ctx.fillRect(82,976,1436,4);
  const blob=await new Promise((resolve)=>canvas.toBlob(resolve,"image/png",.96));if(!blob)throw new Error("card_export_failed");download(blob,"xpeng-analytics-lifetime-highlights.png");
}
