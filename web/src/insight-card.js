const clean = (value, max = 120) => String(value ?? "").replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z?\b/gi, "").replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, "").replace(/\b[^\s]+\.(?:gpx|zip|xpeng|json\.gz)\b/gi, "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

export function buildInsightCardModel(input = {}) {
  return {
    title: clean(input.title, 80), subtitle: clean(input.subtitle, 140),
    metrics: (Array.isArray(input.metrics) ? input.metrics : []).slice(0, 6).map((row) => ({ label: clean(row?.label, 45), value: clean(row?.value, 32), note: clean(row?.note, 54) })),
    note: clean(input.note, 180), brand: "XPENG Analytics", kind: clean(input.kind || "Insight", 40),
  };
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath(); context.roundRect(x, y, width, height, radius); context.fill();
}

function wrap(context, value, maxWidth) {
  const words = String(value || "").split(" "), lines = []; let line = "";
  for (const word of words) { const next = line ? `${line} ${word}` : word; if (line && context.measureText(next).width > maxWidth) { lines.push(line); line = word; } else line = next; }
  if (line) lines.push(line); return lines;
}

export async function downloadInsightCard(input) {
  const model = buildInsightCardModel(input), canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 675;
  const ctx = canvas.getContext("2d"), gradient = ctx.createLinearGradient(0, 0, 1200, 675); gradient.addColorStop(0, "#edf8f5"); gradient.addColorStop(.55, "#f7faf9"); gradient.addColorStop(1, "#e9f3f5"); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1200, 675);
  ctx.fillStyle = "#0c3438"; ctx.font = "700 20px Arial, sans-serif"; ctx.fillText(model.brand, 64, 66); ctx.fillStyle = "#0a9b77"; ctx.font = "700 13px Arial, sans-serif"; ctx.fillText(model.kind.toUpperCase(), 64, 104);
  ctx.fillStyle = "#082f35"; ctx.font = "700 42px Arial, sans-serif"; wrap(ctx, model.title, 1040).slice(0, 2).forEach((line, index) => ctx.fillText(line, 64, 160 + index * 48));
  ctx.fillStyle = "#547075"; ctx.font = "400 18px Arial, sans-serif"; wrap(ctx, model.subtitle, 1040).slice(0, 2).forEach((line, index) => ctx.fillText(line, 64, 222 + index * 26));
  const columns = model.metrics.length <= 3 ? model.metrics.length : 3, rows = Math.ceil(model.metrics.length / Math.max(1, columns)), gap = 16, cardWidth = (1072 - gap * (columns - 1)) / Math.max(1, columns), cardHeight = rows > 1 ? 116 : 145, startY = rows > 1 ? 292 : 312;
  model.metrics.forEach((metric, index) => { const col=index%columns,row=Math.floor(index/columns),x=64+col*(cardWidth+gap),y=startY+row*(cardHeight+gap);ctx.fillStyle="rgba(255,255,255,.9)";roundedRect(ctx,x,y,cardWidth,cardHeight,15);ctx.fillStyle="#587278";ctx.font="700 12px Arial, sans-serif";ctx.fillText(metric.label.toUpperCase(),x+18,y+28);ctx.fillStyle="#082f35";ctx.font="700 28px Arial, sans-serif";ctx.fillText(metric.value,x+18,y+65);if(metric.note){ctx.fillStyle="#6a8286";ctx.font="400 12px Arial, sans-serif";ctx.fillText(metric.note,x+18,y+90);}});
  if(model.note){ctx.fillStyle="#587278";ctx.font="400 13px Arial, sans-serif";wrap(ctx,model.note,1040).slice(0,2).forEach((line,index)=>ctx.fillText(line,64,625+index*18));}
  ctx.fillStyle="#0a9b77";ctx.fillRect(64,646,1072,3);
  const blob=await new Promise((resolve)=>canvas.toBlob(resolve,"image/png",.96)); if(!blob)throw new Error("card_export_failed"); const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=`xpeng-analytics-${clean(input.fileName||"insight",40).toLowerCase().replace(/[^a-z0-9]+/g,"-")||"insight"}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
