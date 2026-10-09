import { distanceToLine } from "../utils/mathUtils";
import { formatTime } from "../utils/timeUtils";

export default class Interval {
    static CURVED_THRESHOLD = 3;

    constructor(ftp) {
        this.values = [];
        this.ftp = ftp;
    }

    add(value) {
        this.values.push(value);

        if(typeof(this.start) === "undefined") {
            this.start = value.seconds;
            this.startWatts = value.watts;
        }
        if(typeof(this.minWatts) === "undefined" || value.watts < this.minWatts) {
            this.minWatts = value.watts;
        }
        if(typeof(this.maxWatts) === "undefined" || value.watts > this.maxWatts) {
            this.maxWatts = value.watts;
        }
    }

    close() {
        this.duration = this.values.length;
        this.endWatts = this.values[this.values.length - 1].watts;
        this.type = this.getType();
    }

    getFarestPoint() {
        let distance = -1;
        let farestValue = null;
        for(const value of this.values) {
            const d = distanceToLine(value.seconds, value.watts, this.start, this.startWatts, this.start + this.duration, this.endWatts);
            if(d > distance) {
                distance = d;
                farestValue = value;
            }
        }
        return farestValue;
    }

    getMaxDistance() {
        const farestValue = this.getFarestPoint();
        return distanceToLine(farestValue.seconds, farestValue.watts, this.start, this.startWatts, this.start + this.duration, this.endWatts);
    }

    getMaxSubIntervalLength() {
        const farestValue = this.getFarestPoint();
        const index = this.values.indexOf(farestValue);
        if(this.maxWatts > this.ftp * 1.4) {
            return 10;
        } else {
            return index;
        }
    }

    getType() {
        const deltas = this.values.map((value, index) => {
            if(index === 0) {
                return 0;
            }
            return Math.abs(value.watts - this.values[index - 1].watts);
        }).slice(1);

        if(deltas.every(delta => Math.abs(delta) === 0)) {
            return "flat";
        }
        return this.getMaxDistance() > Interval.CURVED_THRESHOLD ? "curved" : "linear";
    }

    toLinear() {
        if(this.values.length < 15) {
            const avg = (this.startWatts + this.endWatts) / 2;
            return Interval.fromValues(this.values.map(value => ({
                seconds: value.seconds,
                watts: avg,
            })), this.ftp);
        } else {
            const coef = (this.endWatts - this.startWatts) / this.duration;
            return Interval.fromValues(this.values.map((value, index) => ({
                seconds: value.seconds,
                watts: this.startWatts + coef * index,
            })), this.ftp);
        }
    }

    toLinearIntervals() {
        const intervals = [];
        if(this.getMaxDistance() > Interval.CURVED_THRESHOLD) {
            const index = this.getMaxSubIntervalLength();
            const values1 = this.values.slice(0, index);
            const values2 = this.values.slice(index);
            intervals.push(...Interval.fromValues(values1, this.ftp).toLinearIntervals());
            intervals.push(...Interval.fromValues(values2, this.ftp).toLinearIntervals());
        } else {
            intervals.push(this.toLinear());
        }

        return intervals;
    }

    toZwo() {
        switch(this.type) {
            case "flat":
                return `<SteadyState Duration="${this.duration}" Power="${this.startWatts / this.ftp}" />`;
            case "linear":
                return `<Ramp Duration="${this.duration}" PowerLow="${this.startWatts / this.ftp}" PowerHigh="${this.endWatts / this.ftp}" />`;
            case "curved": {
                return this.toLinearIntervals().map(interval => interval.toZwo()).join("\n");
            }
        }
    }

    toString() {
        return `${this.type} @ ${formatTime(this.start)} : ${Math.floor(this.startWatts)}W -> ${Math.floor(this.endWatts)}W in ${this.duration}s`;
    }

    static fromValues(values, ftp) {
        const interval = new Interval(ftp);
        for(const value of values) {
            interval.add(value);
        }
        interval.close();
        return interval;
    }
}
