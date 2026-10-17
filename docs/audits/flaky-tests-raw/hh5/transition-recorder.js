() => {
  const h = window.__splashery.player.handsOn;
  const js = h.joints, w = h.world;
  const rows = [];
  const generated = new WeakMap();
  let activeHit = null;
  const bstate = (b) => b && {
    id: b.id, pinned: !!b.pinned, held: !!b.held,
    invMass: b.invMass, pos: b.pos.slice(), vel: b.vel.slice(),
    joint: js.joint(b) && {
      name: js.joint(b).name, broken: !!js.joint(b).broken,
      gliding: !!js.joint(b).gliding, parent: js.joint(b).parent?.name
    }
  };
  const stamp = () => ({tick:w.tick, worldTime:w.time, handsTime:h.time, jointTime:js.time});
  const log = (kind, extra) => { rows.push({kind, ...stamp(), ...extra}); };
  const cv = w.contactVelocity.bind(w);
  w.contactVelocity = (...args) => {
    const n = w.hits.length;
    const r = cv(...args);
    for (const hit of w.hits.slice(n)) {
      const at = {...stamp(), body:bstate(hit.body), other:bstate(hit.other)};
      generated.set(hit, at);
      log("hit-generated", {speed:hit.speed / h.R(), at});
    }
    return r;
  };
  const free = h.free.bind(h);
  h.free = (b) => {
    const before = bstate(b);
    const r = free(b);
    if (before.pinned !== !!b.pinned) log("free", {
      before, after:bstate(b), activeHit,
      stack:new Error().stack
    });
    return r;
  };
  const pin = js.pin.bind(js);
  js.pin = (j) => {
    log("pin:before", {body:bstate(j.body)});
    const r = pin(j);
    log("pin:after", {body:bstate(j.body)});
    return r;
  };
  const onHit = h.onHit.bind(h);
  h.onHit = (hit) => {
    activeHit = {speed:hit.speed/h.R(), generated:generated.get(hit),
                 body:bstate(hit.body), other:bstate(hit.other)};
    log("hit-handled", activeHit);
    try { return onHit(hit); } finally { activeHit=null; }
  };
  const seat = js.seatStep.bind(js);
  js.seatStep = (j) => {
    const before = {broken:j.broken, gliding:!!j.gliding};
    const r = seat(j);
    if (before.broken !== j.broken || before.gliding !== !!j.gliding)
      log("seat-completed", {before, body:bstate(j.body)});
    return r;
  };
  window.__hh5NativeEvents = rows;
}
