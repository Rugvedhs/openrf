(function(){const n=document.createElement("link").relList;if(n&&n.supports&&n.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))i(a);new MutationObserver(a=>{for(const t of a)if(t.type==="childList")for(const o of t.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&i(o)}).observe(document,{childList:!0,subtree:!0});function s(a){const t={};return a.integrity&&(t.integrity=a.integrity),a.referrerPolicy&&(t.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?t.credentials="include":a.crossOrigin==="anonymous"?t.credentials="omit":t.credentials="same-origin",t}function i(a){if(a.ep)return;a.ep=!0;const t=s(a);fetch(a.href,t)}})();function ce(e){if(e===0)return 0;let n=0,s=1,i=e,a=1;for(let t=0;t<100;t++){const o=2*t+1;n+=s*i/(o*a),s*=-1,i*=e*e,a*=(2*t+2)*(2*t+3)}return n}function le(e){let n=0,s=1;const i=e/2;let a=1,t=1;for(let o=0;o<60;o++)n+=s*a/(t*t),s*=-1,a*=i*i,t*=o+1;return n}const B=299792458,de=88541878128e-22;class M extends Error{}function Z(e,n,s){const i=(s+1)/2+(s-1)/2*Math.pow(1+12*n/e,-.5),a=n*.412*(i+.3)*(e/n+.264)/((i-.258)*(e/n+.8));return{epsilonReff:i,lengthExtension:a}}function he(e,n){const s=e*n;return(-2+Math.cos(s)+s*ce(s)+Math.sin(s)/s)/(120*Math.PI*Math.PI)}function ue(e,n,s){const t=Math.PI,o=(t-0)/200;function r(h){const c=Math.cos(h),p=Math.sin(h),f=e*n*c/2,g=Math.abs(c)<1e-9?e*n/2:Math.sin(f)/c;return g*g*le(e*s*p)*Math.pow(p,3)}let d=r(0)+r(t);for(let h=1;h<200;h++){const c=0+h*o;d+=r(c)*(h%2===0?2:4)}return o/3*d/(120*Math.PI*Math.PI)}function pe(e,n,s){const i=e*n/s,a=2,t=(a-1)/(i*Math.sqrt(a));return{radiationQ:i,fractionalBandwidthVswr2:t}}function me(e,n,s,i){return de*i*e*n/s}function K(e,n,s,i,a){const t=B/e,o=2*Math.PI/t,r=he(o,n),d=ue(o,n,s),l=2*(r+d),h=1/l,c=me(n,s,i,a),p=2*Math.PI*e,{radiationQ:f,fractionalBandwidthVswr2:g}=pe(p,c,l);return{wavelength0:t,wavenumber0:o,selfConductance:r,mutualConductance:d,inputConductance:l,edgeResistance:h,capacitance:c,radiationQ:f,fractionalBandwidthVswr2:g}}function fe(e){const{frequencyHz:n,epsilonR:s,heightM:i,lossTangent:a,targetImpedanceOhm:t}=e;if(!Number.isFinite(n)||n<=0)throw new M("Frequency must be a positive number.");if(!Number.isFinite(s)||s<=1)throw new M("εr must be greater than 1 (air is εr = 1; all real dielectrics exceed it).");if(!Number.isFinite(i)||i<=0)throw new M("Substrate height must be a positive number.");if(!Number.isFinite(a)||a<0)throw new M("Loss tangent cannot be negative.");if(!Number.isFinite(t)||t<=0)throw new M("Target impedance must be a positive number.")}function X(e,n){return B/(2*e)*Math.sqrt(2/(n+1))}function Y(e,n,s,i,a,t=0){const o=[],{epsilonReff:r,lengthExtension:d}=Z(a,s,n),l=B/(2*e*Math.sqrt(r)),h=l-2*d;if(h<=0)throw new M("Substrate is too thick relative to the resonant wavelength, so the fringing-field length extension exceeds the resonant length itself, which is unphysical. This means the transmission-line model has broken down (not just degraded). Reduce substrate height or increase frequency.");const c=K(e,a,h,s,r);let p=null,f=!0;return i<=c.edgeResistance?p=h/Math.PI*Math.acos(Math.sqrt(i/c.edgeResistance)):(f=!1,o.push(`Target impedance (${i} Ω) exceeds the patch edge resistance (${c.edgeResistance.toFixed(1)} Ω); an inset feed can only lower impedance from the edge value, so this target is unreachable by feed placement alone. Try a thinner substrate, higher εr, or a different feed technique (e.g. quarter-wave transformer).`)),o.push(...ye(n,s,c.wavelength0,t)),{width:a,length:h,effectiveLength:l,epsilonReff:r,lengthExtension:d,insetFeedDepth:p,feasible:f,warnings:o,...c}}function J(e){fe(e);const{frequencyHz:n,epsilonR:s,heightM:i,lossTangent:a,targetImpedanceOhm:t}=e,o=X(n,s);return Y(n,s,i,t,o,a)}function ge(e){const{widthM:n,lengthM:s,heightM:i,epsilonR:a,feedInsetM:t}=e;if(n<=0||s<=0||i<=0||a<=1)throw new M("analyzePatch requires positive width/length/height and εr > 1.");const{epsilonReff:o,lengthExtension:r}=Z(n,i,a),d=s+2*r,l=B/(2*d*Math.sqrt(o)),h=K(l,n,s,i,o),c=Math.pow(Math.cos(Math.PI*t/s),2),p=h.edgeResistance*c;return{resonantFrequencyHz:l,epsilonReff:o,feedResistance:p,...h}}function ye(e,n,s,i){const a=[];e<2&&a.push(`εr = ${e} is low; the transmission-line model's fringing-field assumptions are least accurate below εr ≈ 2. Treat dimensions as a starting point, not a final design.`),e>10&&a.push(`εr = ${e} is high; accuracy at high permittivity has not been validated against a textbook example in this tool, so verify independently.`);const t=n/s;return t>.07&&a.push(`Substrate is electrically thick (h/λ₀ = ${t.toFixed(3)}); surface-wave losses become significant above roughly h/λ₀ ≈ 0.07 and are not modeled here, so predicted efficiency/bandwidth will be optimistic.`),i>.02&&a.push(`tan δ = ${i} is relatively lossy; dielectric loss is not folded into the radiation-Q/bandwidth estimate, so true bandwidth is likely somewhat wider than predicted, at the cost of radiation efficiency.`),a.push("Feed resistance uses the two-slot mutual-conductance correction (G1 + G12), but higher-order coupling and conductor loss are still neglected, so treat Rin as accurate to a few percent, not exact."),a.push("Bandwidth is derived from radiation Q alone (stored cavity energy vs. radiated power); dielectric/conductor loss would broaden it further in reality, so treat it as a conservative estimate."),a}function be(){const e=J({frequencyHz:1e10,epsilonR:2.2,heightM:.001588,lossTangent:.001,targetImpedanceOhm:50});return[["Patch width (W)",e.width*100,1.186,"cm"],["Effective εreff",e.epsilonReff,1.972,""],["Length extension (ΔL)",e.lengthExtension*100,.081,"cm"],["Patch length (L)",e.length*100,.906,"cm"],["Edge resistance (Rin)",e.edgeResistance,228,"Ω"],["Inset feed depth (y0)",(e.insetFeedDepth??NaN)*100,.3126,"cm"]].map(([s,i,a,t])=>({parameter:s,computed:i,reference:a,units:t,percentError:Math.abs(i-a)/a*100}))}function $e(e,n){const{resonantFrequencyHz:s,inputConductance:i,capacitance:a}=n,t=2*Math.PI*s;return{re:i,im:2*t*a*(e-s)/s}}function _(e,n){const s=n.re*n.re+n.im*n.im;return{re:(e.re*n.re+e.im*n.im)/s,im:(e.im*n.re-e.re*n.im)/s}}function ve(e,n){const s=$e(e,n),i={re:s.re/n.feedTransformerN2,im:s.im/n.feedTransformerN2},a=_({re:1,im:0},i),t=n.referenceImpedanceOhm,o={re:a.re-t,im:a.im},r={re:a.re+t,im:a.im},d=_(o,r),l=Math.hypot(d.re,d.im),h=20*Math.log10(Math.max(l,1e-12)),c=(1+l)/Math.max(1-l,1e-9);return{frequencyHz:e,reflectionMagnitude:l,returnLossDb:h,vswr:c}}function ee(e,n,s=121,i=4){const{resonantFrequencyHz:a}=e,t=Math.max(a*n*i,a*.001),o=[];for(let r=0;r<s;r++){const d=r/(s-1),l=a-t+2*t*d;o.push(ve(l,e))}return o}function xe(e){return{epsilonRToleranceFrac:e.epsilonRToleranceFrac,thicknessToleranceFrac:e.thicknessToleranceFrac,etchToleranceM:254e-7}}function P(e,n){return(e()*2-1)*n}function z(e,n){const s=Math.min(e.length-1,Math.max(0,Math.round(n*(e.length-1))));return e[s]}function we(e){const{nominalDesign:n,targetFrequencyHz:s,targetImpedanceOhm:i,heightM:a,epsilonR:t,tolerances:o,trials:r=1e3,random:d=Math.random}=e;if(n.insetFeedDepth===null)throw new Error("runMonteCarlo requires a feasible nominal design (insetFeedDepth must be set).");const l=[];for(let p=0;p<r;p++){const f=t*(1+P(d,o.epsilonRToleranceFrac)),g=a*(1+P(d,o.thicknessToleranceFrac)),y=n.width+P(d,o.etchToleranceM),$=n.length+P(d,o.etchToleranceM);try{const F=ge({widthM:y,lengthM:$,heightM:g,epsilonR:f,feedInsetM:n.insetFeedDepth});l.push({resonantFrequencyHz:F.resonantFrequencyHz,feedResistance:F.feedResistance})}catch{continue}}const h=l.map(p=>p.resonantFrequencyHz).sort((p,f)=>p-f),c=l.map(p=>p.feedResistance).sort((p,f)=>p-f);return{trials:l,resonantFrequencyHz:{p5:z(h,.05),p50:z(h,.5),p95:z(h,.95),nominal:s},feedResistance:{p5:z(c,.05),p50:z(c,.5),p95:z(c,.95),nominal:i}}}const C=[{id:"fr4",name:"FR4 (generic)",epsilonR:4.4,lossTangent:.02,thicknessesM:[4e-4,8e-4,.0016,.0032],epsilonRToleranceFrac:.08,thicknessToleranceFrac:.1,notes:"Cheapest, most available option. εr varies noticeably by manufacturer and with frequency (commonly quoted 4.3–4.6 in the low-GHz range) and its loss tangent is high enough to matter above a few GHz — fine for 2.4GHz ISM-band work, a poor choice above ~6GHz."},{id:"ro4003c",name:"Rogers RO4003C",epsilonR:3.55,lossTangent:.0027,thicknessesM:[203e-6,508e-6,813e-6,.001524],epsilonRToleranceFrac:.021,thicknessToleranceFrac:.03,notes:"Woven-glass PTFE-free laminate, much tighter εr control and lower loss than FR4. Common choice for real 2.4–10GHz designs where FR4's loss becomes a problem."},{id:"rt5880",name:"Rogers RT/duroid 5880",epsilonR:2.2,lossTangent:9e-4,thicknessesM:[254e-6,508e-6,787e-6,.001575],epsilonRToleranceFrac:.014,thicknessToleranceFrac:.03,notes:"PTFE/glass-microfiber, very low loss, the substrate Balanis' own worked example (Ch. 14, Example 14.1) uses. Common at higher microwave/mm-wave frequencies."},{id:"alumina",name:"Alumina (96%) ceramic",epsilonR:9.8,lossTangent:2e-4,thicknessesM:[254e-6,508e-6,635e-6,.001],epsilonRToleranceFrac:.02,thicknessToleranceFrac:.05,notes:"High-εr ceramic — shrinks the patch substantially for a given frequency, at the cost of narrower bandwidth and being far more expensive/fragile to fabricate on than PCB laminates."}];function V(e){const n=C.find(s=>s.id===e);if(!n)throw new Error(`Unknown substrate id: ${e}`);return n}function Fe(e){const{frequencyHz:n,targetImpedanceOhm:s,substrates:i=C,widthScaleRange:a=[.6,1.6],widthSamples:t=40,maxHOverLambda0:o=.1}=e,r=[];for(const c of i){const p=X(n,c.epsilonR);for(const f of c.thicknessesM)for(let g=0;g<t;g++){const y=t===1?.5:g/(t-1),$=a[0]+y*(a[1]-a[0]),F=p*$;let b;try{b=Y(n,c.epsilonR,f,s,F,c.lossTangent)}catch(S){if(S instanceof M)continue;throw S}const q=f/b.wavelength0;r.push({substrate:c,heightM:f,width:b.width,length:b.length,footprintM2:b.width*b.length,fractionalBandwidth:b.fractionalBandwidthVswr2,edgeResistance:b.edgeResistance,insetFeedDepth:b.insetFeedDepth,feasible:b.feasible,hOverLambda0:q,withinValidatedRegime:q<=o,dominated:!1})}}const d=r.filter(c=>c.feasible&&c.withinValidatedRegime),l=Me(d),h=new Set(l);for(const c of r)c.dominated=d.includes(c)&&!h.has(c);return l.sort((c,p)=>c.footprintM2-p.footprintM2),{allCandidates:r,paretoFront:l}}function Me(e){return e.filter(n=>!e.some(s=>{if(s===n)return!1;const i=s.footprintM2<=n.footprintM2,a=s.fractionalBandwidth>=n.fractionalBandwidth,t=s.footprintM2<n.footprintM2||s.fractionalBandwidth>n.fractionalBandwidth;return i&&a&&t}))}function k(e,n){const[s,i]=e,[a,t]=n;return o=>a+(o-s)/(i-s)*(t-a)}function E(e,n,s){if(e===n)return[e];const a=(n-e)/s,t=Math.pow(10,Math.floor(Math.log10(a))),o=a/t,r=(o>5?10:o>2?5:o>1?2:1)*t,d=Math.ceil(e/r)*r,l=[];for(let h=d;h<=n+r*1e-9;h+=r)l.push(Number(h.toPrecision(10)));return l}const w="font-family:'IBM Plex Mono','SFMono-Regular',Menlo,Consolas,monospace;";function te(e,n,s={}){const i=s.width??640,a=s.height??320,t={top:16,right:20,bottom:40,left:52},o=i-t.left-t.right,r=a-t.top-t.bottom,d=e.map(m=>m.frequencyHz/1e9),l=Math.min(...d),h=Math.max(...d),c=e.map(m=>Math.max(m.returnLossDb,-40)),p=Math.min(-15,Math.min(...c)),f=0,g=k([l,h],[t.left,t.left+o]),y=k([p,f],[t.top+r,t.top]),$=E(l,h,6),F=E(p,f,5),b=e.map((m,L)=>`${L===0?"M":"L"} ${g(m.frequencyHz/1e9).toFixed(2)} ${y(Math.max(m.returnLossDb,-40)).toFixed(2)}`).join(" ");let q="";if(s.toleranceBandHz){const[m,L]=s.toleranceBandHz,H=g(m/1e9),u=g(L/1e9);q=`
      <rect x="${Math.min(H,u).toFixed(2)}" y="${t.top}" width="${Math.abs(u-H).toFixed(2)}" height="${r}"
            fill="var(--chart-band)" />
      <text x="${((H+u)/2).toFixed(2)}" y="${t.top+12}" text-anchor="middle" font-size="9"
            fill="var(--chart-band-label)" style="${w}">5–95th pct. resonance shift</text>
    `}const S=F.map(m=>`<line x1="${t.left}" y1="${y(m).toFixed(2)}" x2="${t.left+o}" y2="${y(m).toFixed(2)}" class="chart-grid" />`).join(""),O=`<line x1="${t.left}" y1="${y(-10).toFixed(2)}" x2="${t.left+o}" y2="${y(-10).toFixed(2)}" class="chart-reference" /><text x="${t.left+o-4}" y="${(y(-10)-4).toFixed(2)}" text-anchor="end" font-size="9" class="chart-reference-label" style="${w}">-10 dB</text>`,G=`<line x1="${g(n/1e9).toFixed(2)}" y1="${t.top}" x2="${g(n/1e9).toFixed(2)}" y2="${t.top+r}" class="chart-f0-line" />`,D=$.map(m=>`
      <line x1="${g(m).toFixed(2)}" y1="${t.top+r}" x2="${g(m).toFixed(2)}" y2="${t.top+r+4}" class="chart-axis" />
      <text x="${g(m).toFixed(2)}" y="${t.top+r+16}" text-anchor="middle" font-size="10" class="chart-tick-label" style="${w}">${m.toFixed(3)}</text>
    `).join(""),A=F.map(m=>`
      <line x1="${t.left-4}" y1="${y(m).toFixed(2)}" x2="${t.left}" y2="${y(m).toFixed(2)}" class="chart-axis" />
      <text x="${t.left-8}" y="${(y(m)+3).toFixed(2)}" text-anchor="end" font-size="10" class="chart-tick-label" style="${w}">${m}</text>
    `).join("");return`
<svg viewBox="0 0 ${i} ${a}" class="chart-svg" role="img" aria-label="Predicted return loss vs frequency">
  ${q}
  ${S}
  ${O}
  ${G}
  <path d="${b}" class="chart-line-primary" fill="none" />
  <line x1="${t.left}" y1="${t.top}" x2="${t.left}" y2="${t.top+r}" class="chart-axis" />
  <line x1="${t.left}" y1="${t.top+r}" x2="${t.left+o}" y2="${t.top+r}" class="chart-axis" />
  ${D}
  ${A}
  <text x="${t.left+o/2}" y="${a-4}" text-anchor="middle" font-size="10" class="chart-axis-label" style="${w}">Frequency (GHz)</text>
  <text x="12" y="${t.top+r/2}" text-anchor="middle" font-size="10" class="chart-axis-label" style="${w}" transform="rotate(-90 12 ${t.top+r/2})">Return loss |S11| (dB)</text>
</svg>`}const qe={fr4:{shape:"circle"},ro4003c:{shape:"square"},rt5880:{shape:"triangle"},alumina:{shape:"diamond"}};function Re(e,n,s,i){switch(e){case"square":return`<rect x="${n-i}" y="${s-i}" width="${i*2}" height="${i*2}" />`;case"triangle":return`<path d="M ${n} ${s-i} L ${n+i} ${s+i*.8} L ${n-i} ${s+i*.8} Z" />`;case"diamond":return`<path d="M ${n} ${s-i} L ${n+i} ${s} L ${n} ${s+i} L ${n-i} ${s} Z" />`;default:return`<circle cx="${n}" cy="${s}" r="${i}" />`}}function Se(e,n,s,i=640,a=360){const t={top:16,right:20,bottom:44,left:56},o=i-t.left-t.right,r=a-t.top-t.bottom,d=e.filter(u=>u.feasible&&u.withinValidatedRegime),l=d.map(u=>u.footprintM2*1e6),h=d.map(u=>u.fractionalBandwidth*100),c=0,p=Math.max(...l,1)*1.05,f=0,g=Math.max(...h,1)*1.15,y=k([c,p],[t.left,t.left+o]),$=k([f,g],[t.top+r,t.top]),F=E(c,p,5),b=E(f,g,5),q=new Map,S=new Set(n),O=e.map((u,R)=>{var Q;if(!u.feasible||!u.withinValidatedRegime)return"";const ae=y(u.footprintM2*1e6),ie=$(u.fractionalBandwidth*100),j=S.has(u),W=R===s,oe=((Q=qe[u.substrate.id])==null?void 0:Q.shape)??"circle",re=W?6:j?4.5:2.5,U=`pareto-pt-${R}`;return q.set(U,R),`<g id="${U}" class="chart-point ${W?"chart-point-selected":j?"chart-point-pareto":"chart-point-dominated"}" data-index="${R}">${Re(oe,ae,ie,re)}</g>`}).join(""),D=[...n].sort((u,R)=>u.footprintM2-R.footprintM2).map((u,R)=>`${R===0?"M":"L"} ${y(u.footprintM2*1e6).toFixed(2)} ${$(u.fractionalBandwidth*100).toFixed(2)}`).join(" "),A=b.map(u=>`<line x1="${t.left}" y1="${$(u).toFixed(2)}" x2="${t.left+o}" y2="${$(u).toFixed(2)}" class="chart-grid" />`).join(""),m=F.map(u=>`
      <line x1="${y(u).toFixed(2)}" y1="${t.top+r}" x2="${y(u).toFixed(2)}" y2="${t.top+r+4}" class="chart-axis" />
      <text x="${y(u).toFixed(2)}" y="${t.top+r+16}" text-anchor="middle" font-size="10" class="chart-tick-label" style="${w}">${u}</text>
    `).join(""),L=b.map(u=>`
      <line x1="${t.left-4}" y1="${$(u).toFixed(2)}" x2="${t.left}" y2="${$(u).toFixed(2)}" class="chart-axis" />
      <text x="${t.left-8}" y="${($(u)+3).toFixed(2)}" text-anchor="end" font-size="10" class="chart-tick-label" style="${w}">${u}</text>
    `).join("");return{svg:`
<svg viewBox="0 0 ${i} ${a}" class="chart-svg" role="img" aria-label="Footprint vs bandwidth tradeoff, Pareto front highlighted">
  ${A}
  <path d="${D}" class="chart-pareto-front" fill="none" />
  ${O}
  <line x1="${t.left}" y1="${t.top}" x2="${t.left}" y2="${t.top+r}" class="chart-axis" />
  <line x1="${t.left}" y1="${t.top+r}" x2="${t.left+o}" y2="${t.top+r}" class="chart-axis" />
  ${m}
  ${L}
  <text x="${t.left+o/2}" y="${a-4}" text-anchor="middle" font-size="10" class="chart-axis-label" style="${w}">Footprint (mm&#178;)</text>
  <text x="14" y="${t.top+r/2}" text-anchor="middle" font-size="10" class="chart-axis-label" style="${w}" transform="rotate(-90 14 ${t.top+r/2})">Fractional bandwidth (%)</text>
</svg>`,pointIdToIndex:q}}function ze(e){const{result:n,frequencyHz:s,epsilonR:i,heightM:a,lossTangent:t,targetImpedanceOhm:o,substrateName:r}=e,d=c=>`${(c*1e3).toFixed(4)} mm`,l=c=>`${(c/1e9).toFixed(6)} GHz`,h=n.insetFeedDepth!==null?`${d(n.insetFeedDepth)} from the radiating edge, centered along the width`:"UNREACHABLE at this target impedance — see warnings below before fabricating anything";return`# OpenRF validation package

Generated from a live design in the OpenRF patch antenna synthesizer. Every number below came
directly from the app — nothing here was hand-transcribed, so treat this file as the source of
truth for fabrication and measurement, not the screen.

## Design target

| Parameter | Value |
|---|---|
| Substrate | ${r} |
| Resonant frequency (target) | ${l(s)} |
| εr | ${i} |
| tan δ | ${t} |
| Substrate height (h) | ${d(a)} |
| Target feed impedance | ${o} Ω |

## Synthesized geometry (fabricate to these dimensions)

| Parameter | Value |
|---|---|
| Patch width (W) | ${d(n.width)} |
| Patch length (L) | ${d(n.length)} |
| Feed inset depth (y0) | ${h} |
| Effective εreff | ${n.epsilonReff.toFixed(5)} |
| Ground plane (recommended min.) | ${d(n.length+6*a)} × ${d(n.width+6*a)} (L+6h × W+6h rule of thumb) |

## Predicted electrical performance (compare your measurement against these)

| Parameter | Predicted |
|---|---|
| Resonant frequency | ${l(s)} (by construction) |
| Edge resistance (Rin, y=0) | ${n.edgeResistance.toFixed(2)} Ω |
| Radiation Q | ${n.radiationQ.toFixed(2)} |
| Fractional bandwidth (VSWR ≤ 2) | ${(n.fractionalBandwidthVswr2*100).toFixed(3)}% (${(n.fractionalBandwidthVswr2*s/1e6).toFixed(2)} MHz) |
| Suggested VNA sweep span | ${l(s-n.fractionalBandwidthVswr2*s*4)} to ${l(s+n.fractionalBandwidthVswr2*s*4)} (±4 predicted bandwidths) |

## Model notes carried over from the synthesis (read before trusting the numbers above)

${n.warnings.map(c=>`- ${c}`).join(`
`)}

## Measurement results (fill in after building — see validation/PHYSICAL_BUILD_AND_MEASUREMENT.md)

| Quantity | Predicted | Measured | Δ (%) |
|---|---|---|---|
| Resonant frequency | ${l(s)} | | |
| −10dB bandwidth | ${(n.fractionalBandwidthVswr2*s/1e6).toFixed(2)} MHz | | |
| S11 at resonance (dB) | ≈ 0 (matched by design) | | — |

---
Generated by OpenRF (100% client-side) — https://github.com/ (see project README/spec).
`}function Te(e){const n=ze(e),s=new Blob([n],{type:"text/markdown;charset=utf-8"}),i=URL.createObjectURL(s),a=document.createElement("a"),t=(e.frequencyHz/1e9).toFixed(2).replace(".","p");a.href=i,a.download=`openrf-validation-${t}GHz.md`,document.body.appendChild(a),a.click(),document.body.removeChild(a),URL.revokeObjectURL(i)}const Le=document.querySelector("#app");Le.innerHTML=`
  <header class="masthead">
    <div>
      <h1>OpenRF</h1>
      <p class="tagline">Microstrip patch antenna synthesis &amp; tradeoff analysis, transmission-line model, entirely client-side</p>
    </div>
    <nav>
      <button type="button" id="toggle-verify" class="linklike">textbook verification</button>
      &nbsp;·&nbsp;
      <a href="./openrf-spec.md">spec</a>
    </nav>
  </header>

  <section id="verify-panel" class="sheet hidden">
    <div class="section-heading"><span class="num">§0</span><h2>Verification against Balanis, <em>Antenna Theory</em>, Example 14.1</h2></div>
    <p class="section-note">f0 = 10 GHz, εr = 2.2, h = 0.1588 cm, target Zin = 50 Ω. This tool's output compared against the book's published results.</p>
    <table class="datatable" id="verify-table"></table>
  </section>

  <div class="layout">
    <div class="controls">
      <section class="sheet">
        <div class="section-heading"><span class="num">§1</span><h2>Design target</h2></div>
        <div class="field">
          <label for="substrate">Substrate</label>
          <select id="substrate">
            ${C.map(e=>`<option value="${e.id}">${e.name}</option>`).join("")}
            <option value="custom">Custom</option>
          </select>
        </div>
        <div class="field">
          <label for="freq">Resonant frequency (GHz)</label>
          <input id="freq" type="number" step="0.01" min="0.01" value="2.45" />
        </div>
        <div class="field">
          <label for="epsr">εr</label>
          <input id="epsr" type="number" step="0.01" min="1.001" value="4.4" />
        </div>
        <div class="field">
          <label for="height">Substrate height h (mm)</label>
          <input id="height" type="number" step="0.01" min="0.001" value="1.6" />
        </div>
        <div class="field">
          <label for="losstan">Loss tangent (tan δ)</label>
          <input id="losstan" type="number" step="0.0001" min="0" value="0.02" />
        </div>
        <div class="field">
          <label for="zin">Target feed impedance (Ω)</label>
          <input id="zin" type="number" step="0.1" min="0.1" value="50" />
        </div>
        <button id="calc" type="button">Synthesize</button>
      </section>
    </div>

    <div class="results">
      <section id="error" class="sheet hidden">
        <div class="section-heading"><span class="num">!</span><h2>Invalid input</h2></div>
        <div class="notice error"><ul id="error-message"></ul></div>
      </section>

      <section id="results" class="sheet hidden">
        <div class="section-heading"><span class="num">§2</span><h2>Synthesized geometry <span id="feasible-tag"></span></h2></div>
        <table class="datatable" id="results-table"></table>
        <div id="warnings-container"></div>
        <button id="export-validation" type="button" class="secondary" style="margin-top:0.9rem;">
          Export validation package (.md)
        </button>
        <p class="section-note" style="margin-top:0.4rem;">
          Downloads a fabrication + measurement checklist pre-filled with these exact numbers. See
          <code>validation/PHYSICAL_BUILD_AND_MEASUREMENT.md</code> for the full build guide.
        </p>
      </section>

      <section id="response-section" class="sheet hidden">
        <div class="section-heading"><span class="num">§3</span><h2>Predicted frequency response</h2></div>
        <p class="section-note">
          Narrowband parallel-RLC model referenced to the target impedance (derivation and caveats in the source,
          see <code>frequencyResponse.ts</code>). By construction the reflection coefficient is exactly zero at the
          design frequency.
        </p>
        <figure class="chart-figure" id="response-chart-container"></figure>
        <div class="grid-2">
          <div class="stat-line"><span class="label">Radiation Q</span><span id="stat-q"></span></div>
          <div class="stat-line"><span class="label">Bandwidth (VSWR ≤ 2)</span><span id="stat-bw"></span></div>
        </div>
      </section>

      <section id="montecarlo-section" class="sheet hidden">
        <div class="section-heading"><span class="num">§4</span><h2>Manufacturing tolerance (Monte Carlo)</h2></div>
        <p class="section-note">
          Propagates typical fabrication tolerances (εr variance, laminate thickness variance, ±1 mil copper etch)
          through the as-built geometry to show how the real antenna's resonance and match are likely to shift from
          the nominal prediction. The feed inset stays fixed at its designed position, as it would on a fabricated board.
        </p>
        <button id="run-mc" type="button" class="secondary">Run 1,000-trial Monte Carlo</button>
        <div id="mc-results" class="hidden" style="margin-top:0.9rem;">
          <div class="grid-2">
            <div>
              <div class="stat-line"><span class="label">Resonant freq. p5</span><span id="mc-freq-p5"></span></div>
              <div class="stat-line"><span class="label">Resonant freq. p50</span><span id="mc-freq-p50"></span></div>
              <div class="stat-line"><span class="label">Resonant freq. p95</span><span id="mc-freq-p95"></span></div>
            </div>
            <div>
              <div class="stat-line"><span class="label">Feed resistance p5</span><span id="mc-zin-p5"></span></div>
              <div class="stat-line"><span class="label">Feed resistance p50</span><span id="mc-zin-p50"></span></div>
              <div class="stat-line"><span class="label">Feed resistance p95</span><span id="mc-zin-p95"></span></div>
            </div>
          </div>
        </div>
      </section>

      <section id="optimizer-section" class="sheet">
        <div class="section-heading"><span class="num">§5</span><h2>Design-space tradeoff (Pareto front)</h2></div>
        <p class="section-note">
          Exhaustive grid search over substrate, thickness, and patch width at the target frequency/impedance.
          Not a genetic/PSO search: the space is small enough that exhaustive search finds the exact Pareto front
          in milliseconds; see the reasoning in <code>optimizer.ts</code>). Minimizes footprint, maximizes bandwidth.
        </p>
        <button id="run-optimize" type="button" class="secondary">Explore tradeoffs at this frequency/impedance</button>
        <div id="optimizer-results" class="hidden" style="margin-top:1rem;">
          <figure class="chart-figure" id="pareto-chart-container"></figure>
          <div class="legend" id="pareto-legend"></div>
          <table class="datatable" id="pareto-table" style="margin-top:1rem;"></table>
        </div>
      </section>
    </div>
  </div>

  <footer class="colophon">
    Transmission-line model per Balanis, <em>Antenna Theory: Analysis and Design</em>, Ch. 14.
    Radiation Q/bandwidth derived from stored cavity energy vs. radiated power (see source comments for the full
    derivation and its cross-checks). 100% client-side. Nothing you enter leaves this browser tab.
  </footer>
`;function x(e,n=4){return Number.isFinite(e)?e.toPrecision(n):"N/A"}function He(){const e=be(),n=document.querySelector("#verify-table");n.innerHTML=`
    <thead><tr><th>Parameter</th><th class="num">Computed</th><th class="num">Balanis (published)</th><th class="num">Error</th></tr></thead>
    <tbody>
      ${e.map(s=>`
        <tr>
          <td>${s.parameter}</td>
          <td class="num">${x(s.computed)} ${s.units}</td>
          <td class="num">${s.reference} ${s.units}</td>
          <td class="num"><span class="tag ${s.percentError<1?"ok":"bad"}">${s.percentError.toFixed(2)}%</span></td>
        </tr>`).join("")}
    </tbody>
  `}document.querySelector("#substrate").addEventListener("change",e=>{const n=e.target.value;if(n==="custom")return;const s=V(n);document.querySelector("#epsr").value=String(s.epsilonR),document.querySelector("#losstan").value=String(s.lossTangent)});let v=null;function Pe(e){for(const s of["#results","#response-section","#montecarlo-section"])document.querySelector(s).classList.add("hidden");document.querySelector("#error").classList.remove("hidden"),document.querySelector("#error-message").innerHTML=`<li>${e}</li>`}function Ie(){document.querySelector("#error").classList.add("hidden")}function ke(e){document.querySelector("#results").classList.remove("hidden");const n=document.querySelector("#feasible-tag");n.innerHTML=e.feasible?'<span class="tag ok">feed reachable</span>':'<span class="tag bad">feed unreachable</span>';const s=document.querySelector("#results-table"),i=[["Patch width (W)",`${x(e.width*1e3)} mm`],["Patch length (L)",`${x(e.length*1e3)} mm`],["Effective εreff",x(e.epsilonReff)],["Length extension (ΔL)",`${x(e.lengthExtension*1e3)} mm`],["Free-space wavelength (λ0)",`${x(e.wavelength0*1e3)} mm`],["Self conductance (G1)",`${x(e.selfConductance)} S`],["Mutual conductance (G12)",`${x(e.mutualConductance)} S`],["Edge resistance (Rin, y=0)",`${x(e.edgeResistance)} Ω`],["Inset feed depth (y0)",e.insetFeedDepth!==null?`${x(e.insetFeedDepth*1e3)} mm from edge`:"N/A (unreachable)"]];s.innerHTML=`<tbody>${i.map(([t,o])=>`<tr><td>${t}</td><td class="num">${o}</td></tr>`).join("")}</tbody>`;const a=document.querySelector("#warnings-container");a.innerHTML=e.warnings.length>0?`<div class="notice"><h3>Model notes</h3><ul>${e.warnings.map(t=>`<li>${t}</li>`).join("")}</ul></div>`:""}function Ee(e,n,s){const i=document.querySelector("#response-section");if(!e.feasible||e.insetFeedDepth===null){i.classList.add("hidden");return}i.classList.remove("hidden");const a=Math.pow(Math.cos(Math.PI*e.insetFeedDepth/e.length),2),t=ee({resonantFrequencyHz:n,inputConductance:e.inputConductance,capacitance:e.capacitance,feedTransformerN2:a,referenceImpedanceOhm:s},e.fractionalBandwidthVswr2),o=document.querySelector("#response-chart-container");o.innerHTML=te(t,n)+"<figcaption>Fig. 1. Predicted |S11| vs. frequency, narrowband model referenced to the target feed impedance.</figcaption>",document.querySelector("#stat-q").textContent=e.radiationQ.toFixed(1),document.querySelector("#stat-bw").textContent=`${(e.fractionalBandwidthVswr2*100).toFixed(2)}% (${(e.fractionalBandwidthVswr2*n/1e6).toFixed(1)} MHz)`}function N(){const e=Number(document.querySelector("#freq").value)*1e9,n=Number(document.querySelector("#epsr").value),s=Number(document.querySelector("#height").value)/1e3,i=Number(document.querySelector("#losstan").value),a=Number(document.querySelector("#zin").value);return{frequencyHz:e,epsilonR:n,heightM:s,lossTangent:i,targetImpedanceOhm:a}}function ne(){const{frequencyHz:e,epsilonR:n,heightM:s,lossTangent:i,targetImpedanceOhm:a}=N();try{const t=J({frequencyHz:e,epsilonR:n,heightM:s,lossTangent:i,targetImpedanceOhm:a});Ie(),v={result:t,frequencyHz:e,targetImpedanceOhm:a},ke(t),Ee(t,e,a),document.querySelector("#montecarlo-section").classList.toggle("hidden",!t.feasible),document.querySelector("#mc-results").classList.add("hidden")}catch(t){if(t instanceof M)Pe(t.message),v=null;else throw t}}function Be(e){document.querySelector("#mc-results").classList.remove("hidden");const n=s=>`${(s/1e9).toFixed(4)} GHz`;if(document.querySelector("#mc-freq-p5").textContent=n(e.resonantFrequencyHz.p5),document.querySelector("#mc-freq-p50").textContent=n(e.resonantFrequencyHz.p50),document.querySelector("#mc-freq-p95").textContent=n(e.resonantFrequencyHz.p95),document.querySelector("#mc-zin-p5").textContent=`${e.feedResistance.p5.toFixed(1)} Ω`,document.querySelector("#mc-zin-p50").textContent=`${e.feedResistance.p50.toFixed(1)} Ω`,document.querySelector("#mc-zin-p95").textContent=`${e.feedResistance.p95.toFixed(1)} Ω`,v){const{result:s,frequencyHz:i,targetImpedanceOhm:a}=v,t=Math.pow(Math.cos(Math.PI*s.insetFeedDepth/s.length),2),o=ee({resonantFrequencyHz:i,inputConductance:s.inputConductance,capacitance:s.capacitance,feedTransformerN2:t,referenceImpedanceOhm:a},s.fractionalBandwidthVswr2,121,6),r=document.querySelector("#response-chart-container");r.innerHTML=te(o,i,{toleranceBandHz:[e.resonantFrequencyHz.p5,e.resonantFrequencyHz.p95]})+"<figcaption>Fig. 1. Predicted |S11| vs. frequency, with the 5th to 95th percentile resonance shift from the Monte Carlo tolerance run shaded.</figcaption>"}}document.querySelector("#run-mc").addEventListener("click",()=>{if(!v||!v.result.insetFeedDepth)return;const{epsilonR:e,heightM:n}=N(),s=document.querySelector("#substrate").value,i=s==="custom"?{epsilonRToleranceFrac:.08,thicknessToleranceFrac:.1,etchToleranceM:254e-7}:xe(V(s)),a=we({nominalDesign:v.result,targetFrequencyHz:v.frequencyHz,targetImpedanceOhm:v.targetImpedanceOhm,heightM:n,epsilonR:e,tolerances:i,trials:1e3});Be(a)});let T=null,I=null;function se(){if(!T)return;document.querySelector("#optimizer-results").classList.remove("hidden");const{svg:e,pointIdToIndex:n}=Se(T.allCandidates,T.paretoFront,I),s=document.querySelector("#pareto-chart-container");s.innerHTML=e+"<figcaption>Fig. 2. Footprint vs. bandwidth for every evaluated (substrate, thickness, width) combination. Dashed line connects the Pareto-optimal front; click a point to inspect it.</figcaption>",s.querySelectorAll(".chart-point").forEach(t=>{t.addEventListener("click",()=>{const o=n.get(t.id);o!==void 0&&(I=o,se())})});const i=document.querySelector("#pareto-legend");i.innerHTML=C.map(t=>`<span>${t.name}</span>`).join(" &nbsp; ");const a=document.querySelector("#pareto-table");a.innerHTML=`
    <thead><tr><th>Substrate</th><th class="num">h (mm)</th><th class="num">W×L (mm)</th>
      <th class="num">Footprint (mm&#178;)</th><th class="num">BW (%)</th><th class="num">Rin (Ω)</th></tr></thead>
    <tbody>
      ${T.paretoFront.map(t=>`<tr style="${T.allCandidates.indexOf(t)===I?"font-weight:600;":""}">
            <td>${t.substrate.name}</td>
            <td class="num">${(t.heightM*1e3).toFixed(3)}</td>
            <td class="num">${(t.width*1e3).toFixed(2)} × ${(t.length*1e3).toFixed(2)}</td>
            <td class="num">${(t.footprintM2*1e6).toFixed(1)}</td>
            <td class="num">${(t.fractionalBandwidth*100).toFixed(2)}</td>
            <td class="num">${t.edgeResistance.toFixed(0)}</td>
          </tr>`).join("")}
    </tbody>
  `}document.querySelector("#run-optimize").addEventListener("click",()=>{const{frequencyHz:e,targetImpedanceOhm:n}=N();T=Fe({frequencyHz:e,targetImpedanceOhm:n}),I=null,se()});document.querySelector("#calc").addEventListener("click",ne);document.querySelector("#toggle-verify").addEventListener("click",()=>{document.querySelector("#verify-panel").classList.toggle("hidden")});document.querySelector("#export-validation").addEventListener("click",()=>{if(!v)return;const e=document.querySelector("#substrate").value,n=e==="custom"?"Custom":V(e).name,{epsilonR:s,heightM:i,lossTangent:a}=N();Te({result:v.result,frequencyHz:v.frequencyHz,epsilonR:s,heightM:i,lossTangent:a,targetImpedanceOhm:v.targetImpedanceOhm,substrateName:n})});He();ne();
