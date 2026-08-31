import { describe, expect, it } from "vitest";

import {
  HlcClock,
  HlcDriftError,
  MAX_DRIFT_MS,
  compareHlc,
  decodeHlc,
  encodeHlc,
  laterHlc,
} from "@/lib/sync/hlc";

/** A clock under test's control. Every interesting HLC case is a time case. */
function fakeNow(start: number) {
  let t = start;
  return {
    now: () => t,
    set: (value: number) => {
      t = value;
    },
    advance: (ms: number) => {
      t += ms;
    },
  };
}

const PHONE = "11111111-1111-1111-1111-111111111111";
const LAPTOP = "22222222-2222-2222-2222-222222222222";

describe("encoding", () => {
  it("round-trips", () => {
    const hlc = { wallMs: 1_800_000_000_000, counter: 7, deviceId: PHONE };
    expect(decodeHlc(encodeHlc(hlc))).toEqual(hlc);
  });

  it("pads so that string order is numeric order", () => {
    // The bug this prevents is silent. Unpadded, "9" sorts after "10", the comparison is
    // quietly wrong, and the only symptom is the occasional lost edit.
    const nine = encodeHlc({ wallMs: 9, counter: 0, deviceId: PHONE });
    const ten = encodeHlc({ wallMs: 10, counter: 0, deviceId: PHONE });
    expect(compareHlc(nine, ten)).toBe(-1);

    const c9 = encodeHlc({ wallMs: 100, counter: 9, deviceId: PHONE });
    const c10 = encodeHlc({ wallMs: 100, counter: 10, deviceId: PHONE });
    expect(compareHlc(c9, c10)).toBe(-1);
  });

  it("keeps the device id, which contains dashes of its own", () => {
    expect(decodeHlc(encodeHlc({ wallMs: 1, counter: 1, deviceId: PHONE })).deviceId).toBe(PHONE);
  });

  it("breaks ties on device id, so two devices can never collide", () => {
    const a = encodeHlc({ wallMs: 100, counter: 0, deviceId: PHONE });
    const b = encodeHlc({ wallMs: 100, counter: 0, deviceId: LAPTOP });
    expect(compareHlc(a, b)).toBe(-1);
    expect(laterHlc(a, b)).toBe(b);
  });
});

describe("local ticks", () => {
  it("increases even when two events land in the same millisecond", () => {
    const clock = new HlcClock(PHONE, fakeNow(1000).now);
    const first = clock.tick();
    const second = clock.tick();
    expect(compareHlc(first, second)).toBe(-1);
  });

  it("resets the counter once real time moves on", () => {
    const time = fakeNow(1000);
    const clock = new HlcClock(PHONE, time.now);
    clock.tick();
    clock.tick();
    expect(clock.state.counter).toBe(1);

    time.advance(5);
    clock.tick();
    expect(clock.state).toEqual({ wallMs: 1005, counter: 0 });
  });

  it("keeps increasing when the device clock jumps backwards", () => {
    // This is the whole reason for the counter. A manual time change or an NTP correction
    // must not let a device re-issue stamps it has already used.
    const time = fakeNow(1_800_000_000_000);
    const clock = new HlcClock(PHONE, time.now);
    const before = clock.tick();

    time.set(1_700_000_000_000); // an hour and a half of wall clock, backwards
    const after = clock.tick();

    expect(compareHlc(before, after)).toBe(-1);
    expect(decodeHlc(after).wallMs).toBe(1_800_000_000_000);
  });

  it("resumes from persisted state, so a reload does not rewind the clock", () => {
    const time = fakeNow(1000);
    const first = new HlcClock(PHONE, time.now);
    const before = first.tick();

    const resumed = new HlcClock(PHONE, time.now, first.state);
    const after = resumed.tick();

    expect(compareHlc(before, after)).toBe(-1);
  });
});

describe("receiving a remote stamp", () => {
  it("drags this device forward, so a reply sorts after what it replies to", () => {
    const time = fakeNow(1000);
    const phone = new HlcClock(PHONE, time.now);

    const remote = encodeHlc({ wallMs: 5000, counter: 3, deviceId: LAPTOP });
    const reply = phone.receive(remote);

    expect(compareHlc(remote, reply)).toBe(-1);
    // And the next purely local event still sorts after the remote one.
    expect(compareHlc(remote, phone.tick())).toBe(-1);
  });

  it("steps past the higher counter when both clocks agree on the millisecond", () => {
    const time = fakeNow(1000);
    const phone = new HlcClock(PHONE, time.now);
    phone.tick(); // wall 1000, counter 0

    const remote = encodeHlc({ wallMs: 1000, counter: 9, deviceId: LAPTOP });
    const merged = phone.receive(remote);

    expect(decodeHlc(merged)).toMatchObject({ wallMs: 1000, counter: 10 });
  });

  it("rejects a peer beyond the drift limit rather than absorbing it", () => {
    // Absorbing it would poison this device's clock permanently — every later comparison
    // would be made against a time that never happened. A drifting clock is a real fault, so
    // it is surfaced as a sync error rather than silently clamped.
    const time = fakeNow(1_800_000_000_000);
    const phone = new HlcClock(PHONE, time.now);
    const wild = encodeHlc({
      wallMs: 1_800_000_000_000 + MAX_DRIFT_MS + 1,
      counter: 0,
      deviceId: LAPTOP,
    });

    expect(() => phone.receive(wild)).toThrow(HlcDriftError);
    // And the local clock is untouched by the rejection.
    expect(phone.state).toEqual({ wallMs: 0, counter: 0 });
  });

  it("accepts a peer exactly at the drift limit", () => {
    const time = fakeNow(1_800_000_000_000);
    const phone = new HlcClock(PHONE, time.now);
    const edge = encodeHlc({
      wallMs: 1_800_000_000_000 + MAX_DRIFT_MS,
      counter: 0,
      deviceId: LAPTOP,
    });

    expect(() => phone.receive(edge)).not.toThrow();
  });
});

describe("the Taiwan case", () => {
  it("a phone whose clock jumps forward does not win every later conflict", () => {
    // The concrete failure that ruled out Date.now(). With plain timestamps the phone's
    // stamps stay ahead of the laptop's for as long as the skew lasts, so every laptop edit
    // loses. The HLC does not prevent the phone from being ahead — it cannot, the clock really
    // is wrong — but the laptop drags itself forward on first contact and takes the lead back
    // for anything it does afterwards.
    const phoneTime = fakeNow(1_800_000_000_000 + 8 * 60 * 1000); // 8 minutes fast
    const laptopTime = fakeNow(1_800_000_000_000);

    const phone = new HlcClock(PHONE, phoneTime.now);
    const laptop = new HlcClock(LAPTOP, laptopTime.now);

    const phoneEdit = phone.tick();
    const laptopEdit = laptop.tick();
    expect(compareHlc(laptopEdit, phoneEdit)).toBe(-1); // phone wins, as expected

    // The laptop syncs, sees the phone's stamp, and edits again.
    const laptopReply = laptop.receive(phoneEdit);
    expect(compareHlc(phoneEdit, laptopReply)).toBe(-1);
    expect(laterHlc(phoneEdit, laptopReply)).toBe(laptopReply);
  });
});
