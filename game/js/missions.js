/* Laguna Azul — 10 story missions: a bank-job arc for Rio, Luz and Marco. */
'use strict';
const MISSIONS = [
  { n: 1, name: 'FIRST LIGHT', stage: 'STAGE 1 / 4', objective: 'Meet Luz at Plaza Azul — walk to the gold marker',
    next: 'NEXT: Pick up the getaway Nebula GT', line: '“Rio. Ten jobs and we are out — first, prove you still know these streets.”',
    who: 'LUZ', role: 'HACKER · CREW', target: { x: 0, z: 20 }, kind: 'goto' },
  { n: 2, name: 'HOT WHEELS', stage: 'STAGE 2 / 4', objective: 'Steal a car — press E near any parked car and drive it',
    next: 'NEXT: Shake the first patrol', line: '“Any car, Rio. The city is a showroom if you stop asking permission.”',
    who: 'MARCO', role: 'ENFORCER · CREW', target: { x: 60, z: 60 }, kind: 'steal' },
  { n: 3, name: 'MERCADO RUN', stage: 'STAGE 2 / 4', objective: 'Deliver the package through Mercado Viejo — stay under 2 stars',
    next: 'NEXT: The buyer pays in cash, not questions', line: '“The market hides everything, even us. Drive like a local, not a tourist.”',
    who: 'LUZ', role: 'HACKER · CREW', target: { x: 150, z: 150 }, kind: 'goto' },
  { n: 4, name: 'SOUTH BEACH BLUES', stage: 'STAGE 3 / 4', objective: 'Outrun the beach patrol — 2 stars, no damage above 50%',
    next: 'NEXT: Marco has a plan for the vault', line: '“They chase the noise, Rio. Give them a sunset they will never catch.”',
    who: 'MARCO', role: 'ENFORCER · CREW', target: { x: -60, z: 180 }, kind: 'escape' },
  { n: 5, name: 'THE FIXER', stage: 'STAGE 1 / 4', objective: 'Collect the blueprints from the Old Town fixer',
    next: 'NEXT: Luz cracks the bank schedule', line: '“Blueprints, codes, a guard rota — the bank is a puzzle, and we just bought the box.”',
    who: 'LUZ', role: 'HACKER · CREW', target: { x: -120, z: -150 }, kind: 'goto' },
  { n: 6, name: 'GOLDEN HOUR', stage: 'STAGE 3 / 4', objective: 'Scout the Azul National Bank — photograph the vault door (drive-by)',
    next: 'NEXT: The crew votes: tonight or never', line: '“Golden hour hides a getaway better than midnight ever could. Trust the light.”',
    who: 'RIO', role: 'DRIVER · YOU', target: { x: 0, z: -70 }, kind: 'scout' },
  { n: 7, name: 'CREW UP', stage: 'STAGE 4 / 4', objective: 'Pick up Luz and Marco before the job — two stops, one car',
    next: 'NEXT: The heist starts at 18:42 sharp', line: '“We are all in. No one gets left on the curb tonight, Rio. No one.”',
    who: 'MARCO', role: 'ENFORCER · CREW', target: { x: 60, z: -60 }, kind: 'goto' },
  { n: 8, name: 'THE LAGUNA HEIST', stage: 'STAGE 3 / 4', objective: 'Reach the causeway checkpoint with the crew — 4 stars, air unit live',
    next: 'NEXT: Lose the air unit in the marina shallows', line: '“Rio, the air unit is painting us — cut through the marina shallows, their spotlight can\'t hold the water.”',
    who: 'LUZ', role: 'HACKER · CREW', target: { x: -355, z: -150 }, kind: 'escape' },
  { n: 9, name: 'SHALLOWS', stage: 'STAGE 4 / 4', objective: 'Break line of sight in the marina shallows until the stars fall',
    next: 'NEXT: The money is clean. The city is yours', line: '“Water is the only witness that never testifies. Stay low, stay wet, stay gone.”',
    who: 'LUZ', role: 'HACKER · CREW', target: { x: -200, z: 60 }, kind: 'hide' },
  { n: 10, name: 'LAST SUNSET', stage: 'STAGE 4 / 4', objective: 'Drive the crew to the south-beach boat — the finale',
    next: 'NEXT: Laguna Azul, behind us. The world, ahead', line: '“One last sunset, Rio. Then we are ghosts with a boat and a future.”',
    who: 'RIO', role: 'DRIVER · YOU', target: { x: -140, z: 200 }, kind: 'finale' },
];
const MissionSys = {
  current: 0,
  get() { return MISSIONS[this.current]; },
  set(i) { this.current = clamp(i, 0, MISSIONS.length - 1); },
  complete() {
    if (this.current < MISSIONS.length - 1) { this.current++; return MISSIONS[this.current]; }
    return null;
  },
};
