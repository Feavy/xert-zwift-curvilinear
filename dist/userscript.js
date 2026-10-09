// ==UserScript==
// @name         Xert - Zwift Curvilinear Intervals fixed
// @namespace    http://tampermonkey.net/
// @version      2025-01-18
// @description  Fix exported curvilinear intervals from Xert workouts to Zwift ZWO format
// @author       Feavy
// @match        https://www.xertonline.com/workout/*/view
// @icon         https://www.google.com/s2/favicons?sz=64&domain=xertonline.com
// @grant        none
// ==/UserScript==

var d = Object.defineProperty;
var f = (i, t, s) => t in i ? d(i, t, { enumerable: !0, configurable: !0, writable: !0, value: s }) : i[t] = s;
var u = (i, t, s) => f(i, typeof t != "symbol" ? t + "" : t, s);
function l(i, t, s, e, n, o) {
  return Math.abs((n - s) * (e - t) - (s - i) * (o - e)) / Math.sqrt((n - s) ** 2 + (o - e) ** 2);
}
function p(i) {
  const t = Math.floor(i / 60), s = i % 60;
  return `${t}:${s < 10 ? "0" : ""}${s}`;
}
const a = class a {
  constructor(t) {
    this.values = [], this.ftp = t;
  }
  add(t) {
    this.values.push(t), typeof this.start > "u" && (this.start = t.seconds, this.startWatts = t.watts), (typeof this.minWatts > "u" || t.watts < this.minWatts) && (this.minWatts = t.watts), (typeof this.maxWatts > "u" || t.watts > this.maxWatts) && (this.maxWatts = t.watts);
  }
  close() {
    this.duration = this.values.length, this.endWatts = this.values[this.values.length - 1].watts, this.type = this.getType();
  }
  getFarestPoint() {
    let t = -1, s = null;
    for (const e of this.values) {
      const n = l(e.seconds, e.watts, this.start, this.startWatts, this.start + this.duration, this.endWatts);
      n > t && (t = n, s = e);
    }
    return s;
  }
  getMaxDistance() {
    const t = this.getFarestPoint();
    return l(t.seconds, t.watts, this.start, this.startWatts, this.start + this.duration, this.endWatts);
  }
  getMaxSubIntervalLength() {
    const t = this.getFarestPoint(), s = this.values.indexOf(t);
    return this.maxWatts > this.ftp * 1.4 ? 10 : s;
  }
  getType() {
    return this.values.map((s, e) => e === 0 ? 0 : Math.abs(s.watts - this.values[e - 1].watts)).slice(1).every((s) => Math.abs(s) === 0) ? "flat" : this.getMaxDistance() > a.CURVED_THRESHOLD ? "curved" : "linear";
  }
  toLinear() {
    if (this.values.length < 15) {
      const t = (this.startWatts + this.endWatts) / 2;
      return a.fromValues(this.values.map((s) => ({
        seconds: s.seconds,
        watts: t
      })), this.ftp);
    } else {
      const t = (this.endWatts - this.startWatts) / this.duration;
      return a.fromValues(this.values.map((s, e) => ({
        seconds: s.seconds,
        watts: this.startWatts + t * e
      })), this.ftp);
    }
  }
  toLinearIntervals() {
    const t = [];
    if (this.getMaxDistance() > a.CURVED_THRESHOLD) {
      const s = this.getMaxSubIntervalLength(), e = this.values.slice(0, s), n = this.values.slice(s);
      t.push(...a.fromValues(e, this.ftp).toLinearIntervals()), t.push(...a.fromValues(n, this.ftp).toLinearIntervals());
    } else
      t.push(this.toLinear());
    return t;
  }
  toZwo() {
    switch (this.type) {
      case "flat":
        return `<SteadyState Duration="${this.duration}" Power="${this.startWatts / this.ftp}" />`;
      case "linear":
        return `<Ramp Duration="${this.duration}" PowerLow="${this.startWatts / this.ftp}" PowerHigh="${this.endWatts / this.ftp}" />`;
      case "curved":
        return this.toLinearIntervals().map((t) => t.toZwo()).join(`
`);
    }
  }
  toString() {
    return `${this.type} @ ${p(this.start)} : ${Math.floor(this.startWatts)}W -> ${Math.floor(this.endWatts)}W in ${this.duration}s`;
  }
  static fromValues(t, s) {
    const e = new a(s);
    for (const n of t)
      e.add(n);
    return e.close(), e;
  }
};
u(a, "CURVED_THRESHOLD", 3);
let c = a;
class w {
  constructor(t, s, e = "Workout", n = "") {
    this.data = t, this.ftp = s, this.title = e, this.description = n, this.intervals = [];
    let o = new c(s), h;
    for (const r of this.data)
      (typeof this.min > "u" || r.watts < this.min) && (this.min = r.watts), (typeof this.max > "u" || r.watts > this.max) && (this.max = r.watts), typeof h < "u" && Math.abs(r.watts - h.watts) > 10 && (o.close(), this.intervals.push(o), o = new c(s)), o.add(r), h = r;
    o.close(), this.intervals.push(o);
  }
  toZwo() {
    return `<workout_file>
<author>Xert</author>
<name>${this.title}</name>
<description>${this.description}</description>
<sportType>bike</sportType>
<tags><tag name="Xert" /></tags>
<workout>
        ${this.intervals.map((s) => s.toZwo()).join(`
`)}
</workout>
</workout_file>`;
  }
}
async function m() {
  const i = document.getElementsByName("_token")[0].value, t = await fetch("/my-fitness", {
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "X-CSRF-TOKEN": i,
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/json"
    }
  }).then((e) => e.text());
  return JSON.parse(t.split("trainingAdvice:")[1].split(`,
`)[0]).signature.ftp.toFixed(0);
}
async function v() {
  const i = window.location.href.split("/workout/")[1].split("/")[0], t = document.getElementsByName("_token")[0].value;
  return await fetch(`/workout/${i}/data`, {
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "X-CSRF-TOKEN": t,
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/json"
    }
  }).then((e) => e.json());
}
async function g() {
  const i = await v(), t = await m(), s = WorkoutDetails.$$.ctx[4].name, e = WorkoutDetails.$$.ctx[4].description, n = new w(i.data, t, s, e);
  W(n.toZwo(), `${s}.zwo`);
}
var W = function() {
  var i = document.createElement("a");
  return document.body.appendChild(i), i.style = "display: none", function(t, s) {
    var e = new Blob([t], { type: "octet/stream" }), n = window.URL.createObjectURL(e);
    i.href = n, i.download = s, i.click(), window.URL.revokeObjectURL(n);
  };
}();
(function() {
  const i = document.querySelector(".flex.flex-row.flex-wrap.gap-2"), t = document.createElement("button");
  t.className = "focus-visible:ring-ring inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm h-8 rounded-md px-3 text-xs border-0", t.innerHTML = '<i class="fa-regular fa-download text-xs mr-1" aria-hidden="true"></i>ZWO (fixed)', i.insertBefore(t, i.childNodes[1]), t.addEventListener("click", g);
})();
