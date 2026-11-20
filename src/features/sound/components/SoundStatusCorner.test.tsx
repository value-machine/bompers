import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SoundStatusCorner } from "@/features/sound/components/SoundStatusCorner";
import type { SoundStatus } from "@/features/sound/types/sound.types";

const status = vi.hoisted(() => ({ value: null as SoundStatus | null }));
vi.mock("@/features/sound/hooks/useAudioEngine", () => ({
  useSoundStatus: () => status.value,
}));

describe("SoundStatusCorner", () => {
  it("should show nothing when the sound plays", () => {
    status.value = null;
    render(<SoundStatusCorner placement="top-right" />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("should show the tap-for-sound chip when a gamepad press could not start the sound", () => {
    status.value = "blocked";
    render(<SoundStatusCorner placement="bottom-right" />);
    expect(screen.getByRole("status")).toHaveTextContent("Tap for sound");
  });
});
