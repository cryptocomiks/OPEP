import { createGame, applyAction, buildDeck, canPlay, currentPlayerId, topCard, publicView, COLORS } from '../src/engine.js';

let fails = 0;
const ok = (cond, msg) => { if (!cond) { console.log('FAIL:', msg); fails++; } };

// deck integrity
const d = buildDeck();
ok(d.length === 108, `deck length 108 got ${d.length}`);
ok(d.filter(c=>c.value==='wild').length===4, 'four wilds');
ok(d.filter(c=>c.value==='wild4').length===4, 'four wild4');
ok(d.filter(c=>c.value==='0').length===4, 'four zeros');
ok(d.filter(c=>c.value==='5').length===8, 'eight fives');

// game creation
const players = [{id:'A',name:'Alice'},{id:'B',name:'Bob'},{id:'C',name:'Cara'}];
let g = createGame(players, 12345);
ok(g.hands.A.length===7 && g.hands.B.length===7 && g.hands.C.length===7, 'deal 7 each');
ok(g.discard.length===1, 'one discard start');
ok(g.discard[0].color!==null, 'start card colored');
const totalCards = g.drawPile.length + g.discard.length + 21;
ok(totalCards===108, `cards conserved ${totalCards}`);

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
  const isWild = playable.value==='wild'||playable.value==='wild4';
  r = applyAction(g, {type:'play', playerId:curId, cardId:playable.id, color: isWild?'red':undefined});
  ok(r.ok, 'valid play accepted: '+ (r.error||''));
  ok(g.hands[curId].length===before-1, 'card removed from hand');
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
ok(total2===108, `cards conserved after many draws ${total2}`);

console.log(fails===0 ? 'ALL TESTS PASSED ✅' : `${fails} test(s) failed ❌`);
process.exit(fails===0?0:1);
