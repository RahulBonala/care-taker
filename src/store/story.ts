"use client";

// Story mode engine. Steps live in src/sim/story-steps.ts (filled in later in the build).
import { useDemo } from "./store";

export function startStory() {
  useDemo.setState({ story: { active: true, step: 0 } });
}

export function exitStory() {
  useDemo.setState((s) => ({ story: { ...s.story, active: false }, ui: { ...s.ui, highlight: undefined } }));
}
