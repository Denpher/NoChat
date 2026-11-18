
(function(){
var D=[4,7,7,6,7,6,5],T=D.reduce(function(a,b){return a+b},0);
var sc=[].slice.call(document.querySelectorAll('.scene')),pp=document.getElementById('pp'),
track=document.getElementById('track'),fill=document.getElementById('fill');
var t=0,cur=-1,playing=true,last=0;
function idx(x){var s=0;for(var i=0;i<D.length;i++){s+=D[i];if(x<s)return i}return D.length-1}
function show(i){
if(i===cur)return;
sc.forEach(function(s){s.classList.remove('on')});
void document.body.offsetWidth;
sc[i].classList.add('on');cur=i;
}
function setBtn(){pp.textContent=playing?'❚❚':'▶';pp.setAttribute('aria-label',playing?'Pause':'Play')}
function tick(n){
if(playing){t+=(n-last)/1000;if(t>=T){t=0;cur=-1}}
last=n;show(idx(t));fill.style.width=(t/T*100)+'%';
requestAnimationFrame(tick);
}
pp.addEventListener('click',function(){playing=!playing;setBtn()});
function seek(x){var r=track.getBoundingClientRect();t=Math.max(0,Math.min(.999,(x-r.left)/r.width))*T;cur=-1}
track.addEventListener('click',function(e){seek(e.clientX)});
track.addEventListener('keydown',function(e){
if(e.key==='ArrowRight'){t=Math.min(T-.1,t+3);cur=-1}
if(e.key==='ArrowLeft'){t=Math.max(0,t-3);cur=-1}
});
document.addEventListener('visibilitychange',function(){last=performance.now()});
window.addEventListener('pageshow',function(){t=0;cur=-1;playing=true;last=performance.now();setBtn()});
setBtn();requestAnimationFrame(function(n){last=n;tick(n)});
})();
