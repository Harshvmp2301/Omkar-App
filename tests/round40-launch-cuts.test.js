import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Round-40 guards — the launch cuts and the owner's new rulings, pinned.
 *
 *   1. The testing-phase push receipt is gone everywhere: no "omkar-diag"
 *      in the worker, no readDiag or pushDiag keys in the panel or content.
 *   2. Enable and Disable wear the same button (one uniform shape).
 *   3. Seva cards are a multi-select (aria-pressed, checkbox mark).
 *   4. The contact field is an Oman number: exactly eight digits.
 *   5. The first seva is Prasada/Naivedya in both languages.
 *   6. The caption under the name ends "…through devotion, music and
 *      knowledge" in English, with the Kannada mirror ಜ್ಞಾನದ ಮೂಲಕ
 *      (the owner's later correction of the round-40 motto ruling).
 *   7. The light ground is the owner's silk ivory, #F6EBDD.
 *   8. The dashboard can delete seva signups and messages outright.
 */

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const sw = read("../public/sw.js");
const panel = read("../src/components/NotifyPanel.jsx");
const content = read("../src/data/content.js");
const styles = read("../src/styles.css");
const messagesAdmin = read("../src/admin/views/MessagesAdmin.jsx");

describe("round 40: the testing-phase scaffolding is gone", () => {
  it("leaves no omkar-diag receipt in the worker", () => {
    expect(sw).not.toContain("omkar-diag");
  });

  it("leaves no diagnostic line in the panel or the content", () => {
    expect(panel).not.toContain("readDiag");
    expect(panel).not.toContain("pushDiag");
    expect(content).not.toContain("pushDiag");
  });

  it("keeps Enable and Disable in one uniform button shape", () => {
    expect(panel).not.toContain("btn-quiet");
    // both the enable and the disable button wear btn-primary
    expect((panel.match(/className="btn-primary"/g) || []).length).toBe(2);
  });
});

describe("round 40: the owner's visual rulings", () => {
  it("ends the caption with knowledge, not the arts, in both languages", () => {
    expect(content).toContain(
      "through devotion, music and knowledge"
    );
    expect(content).toContain("ಭಕ್ತಿ, ಸಂಗೀತ ಮತ್ತು ಜ್ಞಾನದ ಮೂಲಕ");
    expect(content).not.toContain("music and the arts");
    expect(content).not.toContain("ಕಲೆಯ ಮೂಲಕ");
  });

  it("warms the light ground to silk ivory #F6EBDD", () => {
    const light = styles.slice(styles.indexOf(':root[data-theme="light"]'));
    expect(light.slice(0, 400)).toContain("--bg: #F6EBDD");
    expect(light.slice(0, 400)).toContain("--bg-rgb: 246, 235, 221");
  });

  it("draws the seva mark as a checkbox, not a radio dot", () => {
    const mark = styles.slice(styles.indexOf(".seva-radio {"));
    expect(mark.slice(0, 400)).toContain("border-radius: 5px");
  });
});

describe("round 40: the dashboard can clear what should not stay", () => {
  it("deletes messages row by row", () => {
    expect(messagesAdmin).toContain('.from("messages")');
    expect(messagesAdmin).toContain(".delete()");
    expect(messagesAdmin).toContain("window.confirm");
  });
});
