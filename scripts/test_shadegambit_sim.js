// Simulation for Shade's Gambit fairness
// Each duel: both sides flip 3 coins (H/T). Winner determined by most heads, tie -> compare tails, tie -> random.

function duelOutcome() {
  function flip3() {
    const flips = [0,0,0].map(() => Math.random() < 0.5 ? 'H' : 'T');
    const heads = flips.filter(x => x === 'H').length;
    return { flips, heads };
  }
  const a = flip3();
  const b = flip3();
  let winner = null;
  if (a.heads > b.heads) winner = 'A';
  else if (a.heads < b.heads) winner = 'B';
  else {
    const aT = 3 - a.heads;
    const bT = 3 - b.heads;
    if (aT > bT) winner = 'A';
    else if (aT < bT) winner = 'B';
    else winner = Math.random() < 0.5 ? 'A' : 'B';
  }
  return { winner, a, b };
}

function run(n) {
  let counts = { A: 0, B: 0 };
  let tieSame = 0;
  const hist = { '0':0,'1':0,'2':0,'3':0 };
  for (let i=0;i<n;i++) {
    const r = duelOutcome();
    counts[r.winner]++;
    hist[r.a.heads]++;
    if (r.a.heads === r.b.heads && r.a.heads === (3-r.a.heads)) tieSame++;
  }
  console.log('Simulations:', n);
  console.log('A wins:', counts.A, 'B wins:', counts.B);
  console.log('A win pct:', (counts.A/n*100).toFixed(3), '%  B win pct:', (counts.B/n*100).toFixed(3), '%');
  console.log('Heads distribution for side A:', hist);
}

if (require.main === module) run(1000000);
