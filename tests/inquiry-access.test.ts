import { test } from "node:test";
import assert from "node:assert/strict";
import {
  inquiryEligible,
  canInquire,
  inquiryBlocked,
  type Provider,
} from "../lib/domain";
test("demo inquiry access is independent of partnership, and non-demo access still requires a partner", () => {
  assert.equal(inquiryEligible({ partner: false }, true), true);
  assert.equal(inquiryEligible({ partner: true }, true), true);
  assert.equal(inquiryEligible({ partner: false }, false), false);
  assert.equal(inquiryEligible({ partner: true }, false), true);
  assert.equal(
    canInquire({ partner: false, inquiry_enabled: true } as Provider),
    true,
  );
  assert.equal(
    canInquire({ partner: false, inquiry_enabled: false } as Provider),
    false,
  );
});
test("inquiry availability respects explicit closure and fresh at-capacity status, including nonpartners", () => {
  assert.equal(
    inquiryBlocked({ activity: { accepting: false } } as Provider),
    true,
  );
  assert.equal(
    inquiryBlocked({
      availability: "At capacity",
      availability_at: new Date().toISOString(),
    } as Provider),
    true,
  );
  assert.equal(
    inquiryBlocked({
      availability: "Unknown",
      availability_at: null,
    } as Provider),
    false,
  );
  assert.equal(
    inquiryBlocked({
      activity: { accepting: true, fresh: true, tone: "red" },
    } as Provider),
    false,
  );
});
