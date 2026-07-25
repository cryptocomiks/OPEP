import { createGame, applyAction, buildDeck, canPlay, currentPlayerId, topCard, publicView, COLORS } from '../src/engine.js';

let fails = 0;
const ok = (cond, msg) => { if (!cond) { console.log('FAIL:', msg); fails++; } };

// deck integrity
const d = buildDeck();
ok(d.length === 116, `deck length 116 got ${d.length}`);
ok(d.filter(c=>c.value==='wild').length===4, 'four wilds');
ok(d.filter(c=>c.value==='wild4').length===4, 'four wild4');
ok(d.filter(c=>c.value==='swap').length===4, 'four swap');
ok(d.filter(c=>c.value==='renew').length===4, 'four renew');
ok(d.filter(c=>c.value==='0').length===4, 'four zeros');
ok(d.filter(c=>c.value==='5').length===8, 'eight fives');

// game creation
const players = [{id:'A',name:'Alice'},{id:'B',name:'Bob'},{id:'C',name:'Cara'}];
let g = createGame(players, 12345);
ok(g.hands.A.length===7 && g.hands.B.length===7 && g.hands.C.length===7, 'deal 7 each');
ok(g.discard.length===1, 'one discard start');
ok(g.discard[0].color!==null, 'start card colored');
const totalCards = g.drawPile.length + g.discard.length + 21;
ok(totalCards===116, `cards conserved ${totalCards}`);

// turn enforcement
let r = applyAction(g, {type:'play', playerId:'B', cardId:g.hands.B[0].id});
ok(!r.ok && /tour/.test(r.error), 'not your turn blocked');

// draw + pass flow
g = createGame(players, 999);
const cur = currentPlayerId(g);
r = applyAction(g, {type:'draw', playerId:cur});
ok(r.ok && g.hands[cur].length===8, 'draw adds card');
r = applyAction(g, {type:'draw', playerId:cur});
ok(!r.ok, 'double draw blocked');
r = applyAction(g, {type:'pass', playerId:cur});
ok(r.ok && currentPlayerId(g)!==cur, 'pass advances turn');

// forced play a valid card by searching a seed/hand
g = createGame(players, 4242);
let curId = currentPlayerId(g);
let hand = g.hands[curId];
let playable = hand.find(c=>canPlay(c,g));
if (playable) {
  const before = hand.length;
  const isWild = ['wild','wild4','swap','renew'].includes(playable.value);
  const targeted = ['swap','renew'].includes(playable.value);
  const target = targeted ? g.order.find(id=>id!==curId) : undefined;
  const playedId = playable.id;
  r = applyAction(g, {type:'play', playerId:curId, cardId:playedId, color: isWild?'red':undefined, target});
  ok(r.ok, 'valid play accepted: '+ (r.error||''));
  ok(topCard(g).id===playedId, 'played card is now on top of discard');
} else { console.log('note: no immediately playable card this seed'); }

// wild requires color
g = createGame(players, 7);
curId = currentPlayerId(g);
// inject a wild into current hand
g.hands[curId].push({id:'wtest',color:null,value:'wild'});
r = applyAction(g, {type:'play', playerId:curId, cardId:'wtest'});
ok(!r.ok && /couleur/.test(r.error), 'wild needs color');
r = applyAction(g, {type:'play', playerId:curId, cardId:'wtest', color:'green'});
ok(r.ok && g.currentColor==='green', 'wild sets color');

// draw2 effect: victim draws 2 and is skipped
g = createGame(players, 55);
curId = currentPlayerId(g);
g.currentColor='red';
g.discard[g.discard.length-1]={id:'topx',color:'red',value:'3'};
g.hands[curId].push({id:'d2',color:'red',value:'draw2'});
const order = g.order; const idx0 = g.turnIndex;
const victimId = order[(idx0+1)%order.length];
const vbefore = g.hands[victimId].length;
r = applyAction(g,{type:'play',playerId:curId,cardId:'d2'});
ok(r.ok, 'draw2 played');
ok(g.hands[victimId].length===vbefore+2, `victim drew 2 got ${g.hands[victimId].length-vbefore}`);
ok(currentPlayerId(g)===order[(idx0+2)%order.length], 'draw2 skips victim');

// win detection
g = createGame(players, 8);
curId = currentPlayerId(g);
g.hands[curId] = [{id:'last',color:g.currentColor,value:'7'}];
g.discard[g.discard.length-1]={id:'t',color:g.currentColor,value:'2'};
r = applyAction(g,{type:'play',playerId:curId,cardId:'last'});
ok(r.ok && g.status==='finished' && g.winner===curId, 'win detected');

// publicView hides other hands
g = createGame(players,3);
const pv = publicView(g,'A');
ok(pv.yourHand.length===7, 'view shows own hand');
ok(pv.players.every(p=>typeof p.count==='number'), 'view shows counts');
ok(!('hands' in pv), 'view has no raw hands');

// draw pile exhaustion / reshuffle: force many draws
g = createGame(players,17);
let dd = currentPlayerId(g);
let safety=0;
while (g.drawPile.length>0 && safety<200){ 
  const p=currentPlayerId(g);
  applyAction(g,{type:'draw',playerId:p});
  applyAction(g,{type:'pass',playerId:p});
  safety++;
}
// now force a draw that triggers reshuffle
const p2=currentPlayerId(g);
const total2 = g.drawPile.length+g.discard.length+Object.values(g.hands).reduce((a,h)=>a+h.length,0);
ok(total2===116, `cards conserved after many draws ${total2}`);

// swap: exchange hands with a target
g = createGame(players, 321);
curId = currentPlayerId(g);
const other = g.order.find(id=>id!==curId);
g.hands[curId] = [{id:'sw',color:null,value:'swap'}, {id:'x1',color:'red',value:'3'}];
g.hands[other] = [{id:'y1',color:'blue',value:'8'},{id:'y2',color:'green',value:'2'},{id:'y3',color:'red',value:'9'}];
r = applyAction(g,{type:'play',playerId:curId,cardId:'sw',color:'red'}); // color but no target
ok(!r.ok && /joueur/.test(r.error), 'swap needs target');
r = applyAction(g,{type:'play',playerId:curId,cardId:'sw',color:'red',target:other});
ok(r.ok, 'swap played: '+(r.error||''));
ok(g.hands[curId].length===3 && g.hands[other].length===1, 'hands swapped');
ok(g.lastEvent && g.lastEvent.type==='swap', 'swap event set');

// renew: target discards hand and draws a fresh one of same size
g = createGame(players, 654);
curId = currentPlayerId(g);
const victim = g.order.find(id=>id!==curId);
g.hands[curId] = [{id:'rn',color:null,value:'renew'}, {id:'k1',color:'red',value:'3'}];
const beforeCount = g.hands[victim].length;
const beforeIds = new Set(g.hands[victim].map(c=>c.id));
const totalBefore = g.drawPile.length + g.discard.length + Object.values(g.hands).reduce((a,h)=>a+h.length,0);
r = applyAction(g,{type:'play',playerId:curId,cardId:'rn',color:'blue',target:victim});
ok(r.ok, 'renew played: '+(r.error||''));
ok(g.hands[victim].length===beforeCount, 'renew keeps hand size');
const sameCard = g.hands[victim].some(c=>beforeIds.has(c.id));
ok(!sameCard, 'renew gives brand new cards');
const totalAfter = g.drawPile.length + g.discard.length + Object.values(g.hands).reduce((a,h)=>a+h.length,0);
ok(totalAfter===totalBefore, `renew conserves cards ${totalAfter} vs ${totalBefore}`);

// eventSeq increments on actions
g = createGame(players, 222);
const seq0 = g.eventSeq;
curId = currentPlayerId(g);
applyAction(g,{type:'draw',playerId:curId});
ok(g.eventSeq===seq0+1, 'eventSeq increments');

console.log(fails===0 ? 'ALL TESTS PASSED ✅' : `${fails} test(s) failed ❌`);
process.exit(fails===0?0:1);
